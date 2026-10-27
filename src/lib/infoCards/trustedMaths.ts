// Explicit diagnostic execution (also retained for existing proof tools). No database/session credentials enter the browser.
import { chromium } from "playwright-core";
import serverless from "@sparticuz/chromium";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mathsHostToken } from "./mathsHostAuth";
import { InfoMathsError, type InfoMathsValidator, type InfoMathsFailure, type InfoRenderingChecker, type InfoRenderingCapture } from "./mathsValidation";
let active = false;

export function trustedInfoMaths(origin: string): InfoMathsValidator {
  const run = trustedRendering(origin, false);
  return async (content, seriesTitle) => (await run(content, seriesTitle)).measurement;
}
export function checkInfoMathsRendering(origin: string): InfoRenderingChecker {
  return trustedRendering(origin, true);
}
function trustedRendering(origin: string, capture: boolean): InfoRenderingChecker {
  return async (content, seriesTitle) => {
    if (active) throw new InfoMathsError(undefined, "busy");
    active = true;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let failure: InfoMathsFailure = "browser-startup";
    const task = (async () => {
      const url = new URL(origin);
      if (process.env.VERCEL === "1") {
        if (url.origin !== `https://${process.env.VERCEL_URL}`) throw new Error("Untrusted measurement origin");
      } else if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Local measurement requires loopback");
      // Protected Previews require Vercel's server-only automation credential.
      if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview" && !process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
        throw new InfoMathsError(undefined, "authentication");
      const local = process.env.VERCEL !== "1" && (process.platform !== "linux" || !!process.env.INFO_MATHS_CHROMIUM_EXECUTABLE);
      const executablePath = local ? process.env.INFO_MATHS_CHROMIUM_EXECUTABLE : await serverless.executablePath();
      const env: Record<string, string> = { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: tmpdir(), TMPDIR: tmpdir() };
      if (!local) {
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(executablePath!)) hash.update(chunk);
        if (hash.digest("hex") !== "53a15d6c3a3d27dfb54c4ba60278b1683136f70cf1e67e989da7dfbd3d451ef0") throw new Error("Unexpected canonical binary");
        const directory = join(tmpdir(), "switchplay-info-maths-fonts"); await mkdir(directory, { recursive: true });
        const fontDirectory = join(process.cwd(), "src/components/info-cards/fonts").replaceAll("&", "&amp;").replaceAll("<", "&lt;");
        await writeFile(join(directory, "fonts.conf"), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fontDirectory}</dir><cachedir>${directory}/cache</cachedir></fontconfig>`);
        env.FONTCONFIG_FILE = join(directory, "fonts.conf"); env.FONTCONFIG_PATH = directory;
        if (process.env.LD_LIBRARY_PATH) env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH;
      }
      browser = await chromium.launch({ executablePath, headless: true, timeout: 12000, env,
        args: local ? [] : serverless.args.filter(arg => !["--disable-web-security", "--allow-running-insecure-content"].includes(arg)) });
      if (cancelled) throw new Error("Cancelled");
      if (!local && browser.version() !== "153.0.8010.0") throw new Error("Unexpected canonical browser");
      failure = "host";
      const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1, locale: "en-GB", timezoneId: "UTC", serviceWorkers: "block", acceptDownloads: false });
      // Fulfilled documents have no network address space. Local development
      // needs explicit loopback permission for Next's HMR/hydration requests.
      if (local) await context.grantPermissions(["local-network-access"], { origin: url.origin });
      const token = mathsHostToken();
      await context.route("**/*", async route => {
        try {
          const target = new URL(route.request().url());
          if (target.origin !== url.origin || !(target.pathname === "/internal/info-maths" || target.pathname.startsWith("/_next/static/"))) return await route.abort();
          const headers = { ...route.request().headers(), "x-info-maths-host": token };
          if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) Object.assign(headers, { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET });
          // continue({headers}) propagates headers across redirects. Fetch without
          // redirects so neither credential can reach an SSO/login destination.
          const response = await route.fetch({ headers, maxRedirects: 0 });
          if ([301, 302, 303, 307, 308, 401, 403].includes(response.status())) {
            failure = "authentication";
            return await route.abort();
          }
          return await route.fulfill({ response });
        } catch {
          // route.fetch errors can include credential-bearing request headers.
          // Contain them here, including cancellation during browser cleanup.
          if (!cancelled && failure !== "authentication") failure = "host";
          await route.abort().catch(() => {});
        }
      });
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      let exception = false; page.on("pageerror", () => { exception = true; });
      const response = await page.goto(`${url.origin}/internal/info-maths`, { waitUntil: "domcontentloaded" });
      if (page.url() !== `${url.origin}/internal/info-maths` || response?.status() !== 200) throw new Error("Measurement host unavailable");
      await page.waitForFunction(() => !!window.infoMaths);
      failure = "renderer";
      await page.evaluate(card => window.infoMaths!.mount(card), { title: content.title, body: content.body, bodyFormat: content.bodyFormat, seriesTitle, seriesCreatorUsername: "", mediaKind: content.mediaItem?.mediaType });
      const readMeasurement = async () => {
        const handle = await page.waitForFunction(() => {
          const current = window.infoMaths?.current;
          return current && current.result.status !== "pending" ? current : undefined;
        });
        try { return (await handle.jsonValue())!; } finally { await handle.dispose(); }
      };
      let measurement = await readMeasurement();
      if (measurement.result.status === "ready") {
        // Header fonts share the host but are outside the renderer's content.
        // Let their loading notifications finish before consuming the latest
        // public result; never reuse the earlier pre-inspection snapshot.
        await page.evaluate(async () => { await document.fonts.ready; });
        await page.waitForFunction(() => window.infoMaths?.current && window.infoMaths.current.result.status !== "pending");
        // Verify actual glyph fonts, not just declared CSS family names.
        failure = "fonts";
        const cdp = await context.newCDPSession(page); await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
        const { root } = await cdp.send("DOM.getDocument");
        const selectors = await page.locator("[data-info-card-face] *").evaluateAll(nodes => nodes.filter(node => !node.closest(".katex-mathml, .pstrut, .vlist-s") && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())).map((node, index) => { node.setAttribute("data-font-check", String(index)); return `[data-font-check='${index}']`; }));
        for (const selector of selectors) {
          const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
          const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
          if (fonts.some(font => font.glyphCount && (!font.isCustomFont || !/^(Liberation (Sans|Serif)|KaTeX_)/.test(font.familyName)))) throw new Error("Unapproved font fallback");
        }
        await cdp.detach();
        // Capture the definitive callback atomically, after glyph verification.
        // A separate wait/read can race a font-triggered pending transition.
        measurement = await readMeasurement();
      }
      failure = "renderer";
      if (exception || cancelled || JSON.stringify(measurement) !== JSON.stringify(await page.evaluate(() => window.infoMaths!.current))) throw new Error("Stale or failed measurement");
      let screenshot: InfoRenderingCapture["screenshot"] = null;
      let screenshotError: string | undefined;
      if (capture) {
        // Frame the existing card plus visible overflow using the renderer's
        // bounds. This crop is only image framing, never a capacity decision.
        const clip = await page.evaluate(measured => {
          const face = document.querySelector<HTMLElement>("[data-info-card-face]")!;
          const body = face.querySelector<HTMLElement>("[data-info-card-body]")!;
          const root = face.querySelector<HTMLElement>("[data-maths-renderer]")!;
          const card = face.getBoundingClientRect(), origin = body.getBoundingClientRect();
          const title = face.querySelector<HTMLElement>("[data-info-card-title]")!.getBoundingClientRect();
          const bounds = measured.result.status === "ready" ? measured.result.layout.bounds
            : { left: 0, top: 0, right: root.scrollWidth, bottom: root.scrollHeight };
          const x = Math.floor(Math.min(card.left, origin.left + bounds.left));
          const y = Math.floor(Math.min(card.top, origin.top + bounds.top));
          return { x, y, width: Math.ceil(Math.max(card.right, title.right, origin.left + bounds.right) - x),
            height: Math.ceil(Math.max(card.bottom, origin.top + bounds.bottom) - y), scale: 1 };
        }, measurement);
        if (clip.x < 0 || clip.y < 0 || clip.width > 8192 || clip.height > 8192 || clip.width * clip.height > 8_000_000) {
          screenshotError = "The rendered content exceeds the screenshot resource limit. Measurements are unchanged; no image was resized or cropped to fit.";
        } else {
          // CDP captures the actual painted card even after font failure, without
          // screenshot helpers waiting indefinitely for a failing font request.
          const session = await context.newCDPSession(page);
          try {
            const image = await session.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
            if (image.data.length > 2_800_000) screenshotError = "The screenshot exceeds the response size limit.";
            else screenshot = { dataUrl: `data:image/png;base64,${image.data}`, width: clip.width, height: clip.height };
          } catch { screenshotError = "Chromium could not capture the card screenshot."; }
          finally { await session.detach().catch(() => {}); }
        }
        // Chromium capture can trigger viewport/lifecycle invalidation. Consume
        // the renderer's latest definitive callback after capture instead of
        // treating that new generation as an outdated source revision.
        measurement = await readMeasurement();
      }
      return { measurement, screenshot, ...(screenshotError ? { screenshotError } : {}) };
    })();
    try {
      return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => { cancelled = true; void browser?.close(); reject(new InfoMathsError(undefined, "timeout")); }, 25000); })]);
    } catch (error) {
      // The asynchronous task updates this phase across awaited browser work.
      const phase = failure as InfoMathsFailure;
      const reason = error instanceof InfoMathsError ? error.failure ?? phase
        : phase !== "authentication" && error instanceof Error && error.name === "TimeoutError" ? "timeout" : phase;
      // Only controlled categories are logged/returned, never browser requests,
      // headers, credentials or arbitrary authored source from exceptions.
      console.error("Info Card trusted measurement unavailable:", reason, phase, error instanceof Error && /^Stale (?:or failed|screenshot) measurement$/.test(error.message) ? error.message : error instanceof Error ? error.name : "UnknownError");
      throw new InfoMathsError(undefined, reason);
    }
    finally {
      cancelled = true; clearTimeout(timer); await browser?.close().catch(() => {});
      await task.catch(() => {}); await browser?.close().catch(() => {}); active = false;
    }
  };
}
