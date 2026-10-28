// Runs only in the temporary production Next Node route created by run.mts.
// The browser host is fixed by the server; caller content/URLs/instructions are
// never accepted. This is a feasibility harness, not a publication validator.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium, type Browser, type Page } from "playwright-core";
import type { MathsResult } from "@/components/maths-renderer/types";
import type { HostJob } from "./Host";

type Fixture = { id: string; content: string };
type Fault = "missing-font" | "missing-prose-font" | "font-delay" | "deadline" | "exception";
const execute = promisify(execFile);
const clock = () => performance.now();
const elapsed = (start: number) => Math.round((clock() - start) * 100) / 100;
const cleanEnv = () => Object.fromEntries(["PATH", "HOME", "TMPDIR"].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));

async function fonts(page: Page, selector: string) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) return [];
    return (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
  } finally { await cdp.detach(); }
}

async function memory(pid: number) {
  // Local diagnostic only: RSS is not a Vercel memory/cgroup measurement.
  const { stdout } = await execute("ps", ["-axo", "pid=,ppid=,rss="]);
  const rows = stdout.trim().split("\n").map(line => line.trim().split(/\s+/).map(Number));
  const ids = new Set([pid]);
  for (let i = 0; i < rows.length; i++) for (const [child, parent] of rows) if (ids.has(parent)) ids.add(child);
  return { pid, processes: ids.size, rssMiB: Math.round(rows.filter(([id]) => ids.has(id)).reduce((n, row) => n + row[2], 0) / 1024 * 100) / 100 };
}

async function observe(page: Page) {
  const geometry = await page.locator("[data-maths-renderer]").evaluate(root => {
    const r = root.getBoundingClientRect(), css = getComputedStyle(root);
    const math = root.querySelector(".katex"), inline = root.querySelector("[data-maths-expression='inline']");
    const displays = [...root.querySelectorAll(".katex-display")].map(node => {
      const b = node.getBoundingClientRect();
      return { indent: b.left - r.left, width: b.width, top: b.top - r.top, height: b.height };
    });
    const working = root.querySelector(".mtable");
    const column = working?.querySelector(".col-align-l > .vlist-t > .vlist-r > .vlist");
    const rows = column ? [...column.children].map(row => row.lastElementChild!).filter(Boolean).map(row => {
      const box = row.getBoundingClientRect(); return { text: row.textContent, left: box.left, top: box.top, bottom: box.bottom };
    }) : [];
    return { rootWidth: r.width, naturalHeight: r.height, font: css.font, overflow: css.overflow,
      proseSize: parseFloat(css.fontSize), mathSize: math ? parseFloat(getComputedStyle(math).fontSize) : null,
      paragraphGap: root.querySelectorAll("[data-maths-paragraph]").length > 1 ? getComputedStyle(root.querySelectorAll("[data-maths-paragraph]")[1]).marginTop : null,
      inlineClearance: inline ? getComputedStyle(inline).paddingTop : null,
      mathml: root.querySelectorAll("math").length, visualHidden: root.querySelectorAll(".katex-html[aria-hidden='true']").length,
      loadedFaces: [...document.fonts].filter(face => face.status === "loaded").map(face => ({ family: face.family, weight: face.weight, style: face.style })),
      fallback: [...root.querySelectorAll("[data-maths-fallback]")].map(node => node.textContent), displays, rows };
  });
  const platformFonts = await fonts(page, "[data-maths-renderer]");
  // CDP's API reports text at the requested node, not arbitrary depth. Inspect
  // representative actual glyph-bearing nodes for each computed math font.
  const requested = await page.locator("[data-maths-renderer]").evaluate(root => {
    const found = new Map<string, { selector: string; declared: string; text: string }>();
    for (const node of root.querySelectorAll<HTMLElement>(".katex-html *")) {
      const text = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join("");
      if (!text.trim()) continue;
      const css = getComputedStyle(node), declared = `${css.fontFamily}|${css.fontWeight}|${css.fontStyle}`;
      if (found.has(declared)) continue;
      const index = String(found.size); node.setAttribute("data-proof-font", index);
      found.set(declared, { selector: `[data-proof-font='${index}']`, declared, text });
    }
    return [...found.values()];
  });
  const mathFonts = [];
  for (const request of requested) mathFonts.push({ ...request, actual: await fonts(page, request.selector) });
  return { ...geometry, platformFonts, mathFonts };
}

async function context(browser: Browser, origin: string, fault?: Fault) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1,
    locale: "en-GB", timezoneId: "UTC", serviceWorkers: "block", acceptDownloads: false, reducedMotion: "reduce" });
  const blocked: string[] = [];
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    const allowed = url.origin === origin && (url.pathname.startsWith("/_next/static/") || ["/trusted-proof-host", "/trusted-proof-reference"].includes(url.pathname));
    if (!allowed) { blocked.push(url.origin + url.pathname); return route.abort(); }
    if (/\.(woff2?|ttf)(?:$|\?)/.test(url.pathname)) {
      if (fault === "missing-font") return route.abort("failed");
      if (fault === "font-delay" || fault === "deadline") return; // Deliberately unresolved, released by context.close().
    }
    return route.continue();
  });
  return { context, blocked };
}

async function measure(browser: Browser, origin: string, job: HostJob, fault?: Fault, screenshot?: string) {
  const start = clock();
  const { context: ctx, blocked } = await context(browser, origin, fault);
  const page = await ctx.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  let result: MathsResult | null = null;
  let observation: Awaited<ReturnType<typeof observe>> | null = null;
  let history: unknown[] = [];
  let failure: string | null = null;
  const deadlineMs = fault === "deadline" ? 250 : 14500;
  const task = (async () => {
    const response = await page.goto(`${origin}/trusted-proof-host`, { waitUntil: "domcontentloaded" });
    assert.equal(response!.status(), 200);
    await page.waitForFunction(() => !!window.trustedProofHost);
    if (fault === "missing-prose-font") await page.addStyleTag({ content: "@font-face{font-family:ProofMissingProse;src:url('/_next/static/nonexistent-proof-font.woff2')}" });
    if (fault === "exception") await page.evaluate(() => { queueMicrotask(() => { throw new Error("intentional proof page failure"); }); });
    await page.evaluate(value => window.trustedProofHost!.mount(value), job);
    for (;;) {
      // Capture the actual callback value atomically. A separate wait followed
      // by a read can race a font event that invalidates the preceding result.
      const handle = await page.waitForFunction(id => {
        const current = window.trustedProofHost?.current;
        return current?.id === id && current.result.status !== "pending" ? current : false;
      }, job.id, { timeout: 14000 });
      const snapshot = await handle.jsonValue(); await handle.dispose();
      assert(snapshot);
      observation = await observe(page);
      const current = await page.evaluate(() => window.trustedProofHost!.current);
      if (JSON.stringify(current) !== JSON.stringify(snapshot)) continue;
      result = snapshot.result;
      history = await page.evaluate(() => window.trustedProofHost!.history);
      break;
    }
    if (pageErrors.length) throw new Error("HOST_EXCEPTION");
    if (screenshot) await page.screenshot({ path: screenshot });
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("PROOF_DEADLINE")), deadlineMs); })]);
  } catch (error) { failure = error instanceof Error ? error.message : String(error); result = null; }
  finally { clearTimeout(timer); await ctx.close(); await task.catch(() => {}); }
  return { id: job.id, source: job.content, width: job.width, height: job.height, container: !!job.container,
    result: result as MathsResult | null, observation: observation as Awaited<ReturnType<typeof observe>> | null,
    history, blocked, pageErrors, failure, elapsedMs: elapsed(start), contextClosed: !browser.contexts().includes(ctx) };
}

export async function runProof(origin: string, fixtures: Fixture[], presentation: HostJob["presentation"], output: string) {
  assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin), "Proof requires its own loopback-only server");
  const started = clock();
  const launchStart = clock();
  // launchServer exposes the owned child PID for cleanup/RSS evidence. This
  // websocket listens only on loopback and is closed in finally.
  const server = await chromium.launchServer({ headless: true, host: "127.0.0.1", env: cleanEnv(), timeout: 15000 });
  const pid = server.process().pid!;
  const launchMs = elapsed(launchStart);
  let browser: Browser;
  try { browser = await chromium.connect(server.wsEndpoint()); }
  catch (error) { await server.close(); throw error; }
  const report: Record<string, unknown> = { platform: process.platform, arch: process.arch, node: process.version,
    chromium: browser.version(), executable: server.process().spawnfile, launchMs, browserPid: pid,
    profile: { viewport: [1100, 900], deviceScaleFactor: 1, locale: "en-GB", timezone: "UTC" } };
  const memorySamples: { browserRSSMiB: number; nodeRSSMiB: number }[] = [];
  let sampling = false;
  const sampler = setInterval(async () => {
    if (sampling) return;
    sampling = true;
    try { memorySamples.push({ browserRSSMiB: (await memory(pid)).rssMiB, nodeRSSMiB: process.memoryUsage().rss / 1024 / 1024 }); }
    finally { sampling = false; }
  }, 500);
  try {
    const ref = await context(browser, origin);
    const page = await ref.context.newPage();
    await page.goto(`${origin}/trusted-proof-reference`);
    await page.getByRole("button", { name: "Series Series; show series creator" }).first().waitFor();
    const budgets = await page.locator("[data-proof-reference]").evaluateAll(nodes => nodes.map(node => {
      const face = node.querySelector<HTMLElement>("[data-info-card-face]")!, body = node.querySelector<HTMLElement>("[data-info-card-body]")!, header = node.querySelector<HTMLElement>("[data-info-card-header]")!;
      const frame = face.getBoundingClientRect(), box = body.getBoundingClientRect(), css = getComputedStyle(face);
      return { media: node.getAttribute("data-proof-reference") === "media", width: box.width, height: box.height,
        frame: { width: frame.width, height: frame.height, padding: css.padding, border: css.borderWidth, boxSizing: css.boxSizing },
        headerHeight: header.getBoundingClientRect().height, proseFont: css.font };
    }));
    report.referenceFonts = await fonts(page, "[data-info-card-header]");
    report.budgets = budgets;
    await ref.context.close();
    assert.equal(budgets[0].width, 214); assert.equal(budgets[0].frame.height, 157);
    assert.equal(budgets[0].height - budgets[1].height, 36);
    const jobs = budgets.flatMap(budget => fixtures.map(fixture => ({ ...fixture, id: `${fixture.id}-${budget.media ? "media" : "plain"}`,
      width: budget.width, height: budget.height, presentation })));
    const results = [];
    for (const job of jobs) {
      const evidence = await measure(browser, origin, job, undefined, job.id.startsWith("review-") && job.id.endsWith("plain") ? `${output}/${job.id}.png` : undefined);
      assert.equal(evidence.failure, null, `${job.id}: execution failed`);
      assert(evidence.result && evidence.result.status !== "pending");
      assert(evidence.contextClosed);
      if (evidence.result.status === "ready") {
        assert.equal(evidence.result.fits, !evidence.result.layout.overflowX && !evidence.result.layout.overflowY);
        assert(Math.abs(evidence.result.layout.available.height! - job.height) < .001);
        assert(Math.abs(evidence.result.layout.bounds.bottom - evidence.observation!.naturalHeight) < .5, "Independent natural-height corroboration");
        assert.equal(evidence.observation!.overflow, "visible");
        if (evidence.observation!.mathSize !== null) assert.equal(evidence.observation!.mathSize, 9.5);
        assert.equal(evidence.observation!.mathml, evidence.observation!.visualHidden);
      } else assert(!("fits" in evidence.result));
      results.push(evidence);
    }
    report.measurements = results;
    report.memoryAfterRepresentativeJobs = await memory(pid);
    // Same source and public callback under both constraint input contracts.
    const sample = jobs.find(job => job.id === "review-5-plain")!;
    const container = await measure(browser, origin, { ...sample, id: "container", container: true });
    const explicit = results.find(result => result.id === sample.id)!;
    assert(container.result?.status === "ready" && explicit.result?.status === "ready");
    assert.deepEqual(container.result.layout.bounds, explicit.result.layout.bounds);
    assert.equal(container.result.fits, explicit.result.fits);
    // getComputedStyle serialises 110.015625 as 110.016. This compares the
    // constraint APIs' serialisation only; it is not an overflow allowance.
    assert(Math.abs(container.result.layout.available.height! - explicit.result.layout.available.height!) < .001);
    report.containerParity = container;
    // Fit threshold is unchanged. Change the supplied height, never the result
    // or renderer epsilon. Source is deliberately ordinary display maths.
    assert(explicit.result?.status === "ready");
    const bottom = explicit.result.layout.bounds.bottom;
    const boundary = [];
    for (const delta of [-.02, .02]) boundary.push(await measure(browser, origin, { ...sample, id: `height-boundary-${delta}`, height: bottom + delta }));
    assert(boundary[0].result?.status === "ready" && boundary[0].result.layout.overflowY);
    assert(boundary[1].result?.status === "ready" && !boundary[1].result.layout.overflowY);
    report.heightBoundary = boundary;
    const horizontalBoundary = [];
    for (const delta of [-.02, .02]) horizontalBoundary.push(await measure(browser, origin, { ...sample, id: `width-boundary-${delta}`, width: explicit.result.layout.bounds.right + delta }));
    assert(horizontalBoundary[0].result?.status === "ready" && horizontalBoundary[0].result.layout.overflowX);
    assert(horizontalBoundary[1].result?.status === "ready" && !horizontalBoundary[1].result.layout.overflowX);
    report.widthBoundary = horizontalBoundary;
    const base = { ...sample, content: String.raw`$x=\frac{1}{2}$` };
    const failures = [];
    for (const fault of ["missing-font", "missing-prose-font", "font-delay", "deadline", "exception"] as const) {
      const job = fault === "missing-prose-font" ? { ...base, content: "Ordinary prose", presentation: { ...presentation, fontFamily: "ProofMissingProse, Arial, sans-serif" } } : base;
      const entry = await measure(browser, origin, { ...job, id: fault }, fault);
      if (fault === "missing-font" || fault === "missing-prose-font" || fault === "font-delay") {
        assert.equal(entry.result?.status, "measurement-unavailable", `${fault}: ${JSON.stringify(entry)}`);
        if (entry.result?.status === "measurement-unavailable") assert.equal(entry.result.reason, fault === "font-delay" ? "FONT_TIMEOUT" : "FONT_LOAD_FAILED");
      } else { assert(entry.failure); assert.equal(entry.result, null); }
      assert(entry.contextClosed); failures.push(entry);
    }
    for (const [id, change] of [["hidden", { hidden: true }], ["rotation", { transform: "rotate(5deg)" }], ["scaled", { transform: "translate(12px, 7px) scale(1.4)" }]] as const) {
      const entry = await measure(browser, origin, { ...sample, id, ...change });
      assert.equal(entry.result?.status, id === "scaled" ? "ready" : "measurement-unavailable");
      failures.push(entry);
    }
    report.failureCases = failures;
    // Replacement while fonts load: same renderer instance, no old ready fit.
    const stale = await context(browser, origin, "font-delay");
    const stalePage = await stale.context.newPage();
    await stalePage.goto(`${origin}/trusted-proof-host`); await stalePage.waitForFunction(() => !!window.trustedProofHost);
    await stalePage.evaluate(job => { window.trustedProofHost!.mount({ ...job, id: "superseded", content: "$x$" }); }, base);
    await stalePage.waitForFunction(() => window.trustedProofHost!.current?.id === "superseded");
    await stalePage.evaluate(job => window.trustedProofHost!.mount({ ...job, id: "current", content: String.raw`$$x=\frac{1}{$$` }), base);
    await stalePage.waitForFunction(() => window.trustedProofHost!.current?.id === "current" && window.trustedProofHost!.current.result.status === "invalid-input");
    await stalePage.waitForTimeout(100);
    const current = await stalePage.evaluate(() => window.trustedProofHost!.current);
    assert.equal(current?.id, "current"); assert.equal(current.result.status, "invalid-input");
    report.staleReplacement = { current, history: await stalePage.evaluate(() => window.trustedProofHost!.history) };
    await stale.context.close();
    const concurrentStart = clock();
    const concurrent = await Promise.all([1, 2].map(n => measure(browser, origin, { ...base, id: `concurrent-${n}` })));
    assert(concurrent.every(entry => entry.result?.status === "ready" && entry.contextClosed));
    report.concurrent = { elapsedMs: elapsed(concurrentStart), results: concurrent, memory: await memory(pid) };
    report.contextsRemaining = browser.contexts().length; assert.equal(browser.contexts().length, 0);
    // A wrong binary fails before mounting anything; no fabricated fit result.
    try { await chromium.launch({ executablePath: "/nonexistent/switchplay-proof-chromium", timeout: 1000, env: cleanEnv() }); assert.fail("Missing binary unexpectedly launched"); }
    catch (error) { assert(!(error instanceof assert.AssertionError)); report.missingBinary = { failed: true, error: String(error).split("\n")[0] }; }
    report.passed = true;
  } catch (error) { report.passed = false; report.error = error instanceof Error ? error.stack : String(error); }
  finally {
    clearInterval(sampler);
    report.memorySampling = { intervalMs: 500, samples: memorySamples.length,
      maximumObservedBrowserRSSMiB: Math.max(0, ...memorySamples.map(sample => sample.browserRSSMiB)),
      maximumObservedNodeRSSMiB: Math.max(0, ...memorySamples.map(sample => sample.nodeRSSMiB)),
      note: "Sampled local RSS, not cgroup usage or a guaranteed peak; Node includes the temporary Next server." };
    await browser.close(); await server.close();
    let alive = true;
    try { process.kill(pid, 0); } catch { alive = false; }
    report.cleanup = { browserConnected: browser.isConnected(), browserProcessAlive: alive, contexts: browser.contexts().length };
    report.elapsedMs = elapsed(started);
  }
  return report;
}

export async function coldSample(origin: string, content: string, presentation: HostJob["presentation"], height: number) {
  const start = clock();
  const server = await chromium.launchServer({ headless: true, host: "127.0.0.1", env: cleanEnv(), timeout: 15000 });
  const launchMs = elapsed(start), pid = server.process().pid!;
  let browser: Browser;
  try { browser = await chromium.connect(server.wsEndpoint()); }
  catch (error) { await server.close(); throw error; }
  try {
    const result = await measure(browser, origin, { id: "cold", content, width: 214, height, presentation });
    const rss = await memory(pid);
    assert(result.result?.status === "ready" && result.result.fits);
    return { launchMs, throughResultMs: elapsed(start), rss, result };
  } finally { await browser.close(); await server.close(); }
}
