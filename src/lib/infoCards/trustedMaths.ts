// Publication-only import. No database/session credentials enter the browser.
import { chromium } from "playwright-core";
import serverless from "@sparticuz/chromium";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mathsHostToken } from "./mathsHostAuth";
import { InfoMathsError, type InfoMathsValidator } from "./mathsValidation";
let active = false;

export function trustedInfoMaths(origin: string): InfoMathsValidator {
  return async (content, seriesTitle) => {
    if (active) throw new InfoMathsError();
    active = true;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const task = (async () => {
      const url = new URL(origin);
      if (process.env.VERCEL === "1") {
        if (url.origin !== `https://${process.env.VERCEL_URL}`) throw new Error("Untrusted measurement origin");
      } else if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Local measurement requires loopback");
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
      const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1, locale: "en-GB", timezoneId: "UTC", serviceWorkers: "block", acceptDownloads: false });
      const token = mathsHostToken();
      await context.route("**/*", route => {
        const target = new URL(route.request().url());
        if (target.origin !== url.origin || !(target.pathname === "/internal/info-maths" || target.pathname.startsWith("/_next/static/"))) return route.abort();
        const headers = { ...route.request().headers(), "x-info-maths-host": token };
        if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) Object.assign(headers, { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET });
        return route.continue({ headers });
      });
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      let exception = false; page.on("pageerror", () => { exception = true; });
      const response = await page.goto(`${url.origin}/internal/info-maths`, { waitUntil: "domcontentloaded" });
      if (response?.status() !== 200) throw new Error("Measurement host unavailable");
      await page.waitForFunction(() => !!window.infoMaths);
      await page.evaluate(card => window.infoMaths!.mount(card), { title: content.title, body: content.body, bodyFormat: content.bodyFormat, seriesTitle, seriesCreatorUsername: "", mediaKind: content.mediaItem?.mediaType });
      await page.waitForFunction(() => window.infoMaths?.current && window.infoMaths.current.result.status !== "pending");
      let measurement = await page.evaluate(() => window.infoMaths!.current!);
      if (measurement.result.status === "ready") {
        // Header fonts share the host but are outside the renderer's content.
        // Let their loading notifications finish before consuming the latest
        // public result; never reuse the earlier pre-inspection snapshot.
        await page.evaluate(async () => { await document.fonts.ready; });
        await page.waitForFunction(() => window.infoMaths?.current && window.infoMaths.current.result.status !== "pending");
        // Verify actual glyph fonts, not just declared CSS family names.
        const cdp = await context.newCDPSession(page); await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
        const { root } = await cdp.send("DOM.getDocument");
        const selectors = await page.locator("[data-info-card-face] *").evaluateAll(nodes => nodes.filter(node => !node.closest(".katex-mathml, .pstrut, .vlist-s") && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())).map((node, index) => { node.setAttribute("data-font-check", String(index)); return `[data-font-check='${index}']`; }));
        for (const selector of selectors) {
          const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
          const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
          if (fonts.some(font => font.glyphCount && (!font.isCustomFont || !/^(Liberation (Sans|Serif)|KaTeX_)/.test(font.familyName)))) throw new Error("Unapproved font fallback");
        }
        await cdp.detach();
        await page.waitForFunction(() => window.infoMaths?.current && window.infoMaths.current.result.status !== "pending");
        measurement = await page.evaluate(() => window.infoMaths!.current!);
      }
      if (exception || cancelled || JSON.stringify(measurement) !== JSON.stringify(await page.evaluate(() => window.infoMaths!.current))) throw new Error("Stale or failed measurement");
      return measurement;
    })();
    try {
      return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => { cancelled = true; void browser?.close(); reject(new InfoMathsError()); }, 25000); })]);
    } catch (error) {
      console.error("Info Card trusted measurement unavailable:", error instanceof Error ? error.message : "Unknown browser failure");
      throw new InfoMathsError();
    }
    finally {
      cancelled = true; clearTimeout(timer); await browser?.close().catch(() => {});
      await task.catch(() => {}); await browser?.close().catch(() => {}); active = false;
    }
  };
}
