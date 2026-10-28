// Run explicitly with node --import tsx. Never builds into a running server's
// output, loads repository env files or creates another Git checkout/worktree.
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { once } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";

const repository = resolve(import.meta.dirname, "../..");
const output = join(repository, "tests/maths-renderer/evidence/stage5");
const scratch = await mkdtemp(join(tmpdir(), "switchplay-maths-production-"));
await mkdir(output, { recursive: true });
for (const name of ["src", "public", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs"]) {
  await cp(join(repository, name), join(scratch, name), { recursive: true });
}
// Turbopack rejects dependencies symlinked outside its filesystem root. Clone
// installed files where supported; no install, configuration change or shared
// build directory is needed. Preserve internal relative package-bin symlinks.
await cp(join(repository, "node_modules"), join(scratch, "node_modules"), {
  recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE,
});

// An ordinary test consumer exists only in the temporary copy. It proves the
// compiled renderer's CSS/font loading under the real application root layout.
const probe = join(scratch, "src/app/maths-acceptance-probe");
await mkdir(probe, { recursive: true });
await writeFile(join(probe, "page.tsx"), `"use client";
import { useState } from "react";
import MathsRenderer from "@/components/maths-renderer/MathsRenderer";
import type { MathsResult } from "@/components/maths-renderer/types";
export default function Probe() {
  const [result,setResult]=useState<MathsResult|null>(null);
  return <main><p data-neighbour="">Ordinary neighbour</p><MathsRenderer
    content={${JSON.stringify(String.raw`Before $x^2=9$.
$$\begin{aligned}3x&=12\\x&=\frac{12}{3}\\x&=4\end{aligned}$$
Therefore, $x=\sqrt{16}$.

Final paragraph.`)}}
    constraints={{kind:"explicit",widthPx:360,heightPx:1000}}
    presentation={{fontFamily:"Arial, sans-serif",fontSizePx:18,lineHeight:1.5,mathScale:1,paragraphGapEm:.8,displayIndentEm:1,displayGapEm:.6}}
    onResult={setResult}/><pre data-production-result="">{JSON.stringify(result)}</pre></main>;
}`);

const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SWITCHPLAY_DATABASE_MODE: "disposable",
  MONGODB_URI: "mongodb://127.0.0.1:9", MONGODB_DB: "switchplay_phase2_browser_maths_acceptance_unused", SESSION_SECRET: "isolated-maths-production-test-only" };
const cli = join(scratch, "node_modules/next/dist/bin/next");
let server: ChildProcess | undefined;
let serverLog = "";
const result: Record<string, unknown> = { scratch, testConsumerOnlyInScratch: true, repositoryEnvFilesCopied: false };
try {
  let buildLog = "";
  const build = spawn(process.execPath, [cli, "build"], { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] });
  build.stdout!.on("data", chunk => { buildLog += chunk; }); build.stderr!.on("data", chunk => { buildLog += chunk; });
  const [code] = await once(build, "exit");
  await writeFile(join(output, "production-build.log"), buildLog);
  assert.equal(code, 0, "Production build failed; inspect production-build.log");
  result.build = { passed: true, bundler: "turbopack", fullApplicationSnapshot: true };
  const listener = createServer(); listener.listen(0, "127.0.0.1"); await once(listener, "listening");
  const address = listener.address(); assert(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  const baseURL = `http://127.0.0.1:${address.port}`;
  server = spawn(process.execPath, [cli, "start", "--hostname", "127.0.0.1", "--port", String(address.port)], { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout!.on("data", chunk => { serverLog += chunk; }); server.stderr!.on("data", chunk => { serverLog += chunk; });
  for (const deadline = Date.now() + 30000; ;) {
    try { if ((await fetch(`${baseURL}/maths-acceptance-probe`)).ok) break; } catch {}
    assert(server.exitCode === null && Date.now() < deadline, "Production server did not become ready");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const guards = [];
  for (const rsc of [false, true]) {
    const response = await fetch(`${baseURL}/dev/maths-renderer${rsc ? "?_rsc=acceptance" : ""}`, { headers: rsc ? { RSC: "1" } : {} });
    const body = await response.text(); assert.equal(response.status, 404);
    assert(!body.includes("data-maths-stage") && !body.includes("data-review-case") && !body.includes("data-capacity-case"));
    guards.push({ rsc, status: response.status, fixtureContent: false });
  }
  result.guards = guards;
  const browsers = [];
  for (const [name, engine] of [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]] as const) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage(); const errors: string[] = [], assetErrors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("response", response => { if (response.url().includes("/_next/static/") && response.status() >= 400) assetErrors.push(response.url()); });
      await page.route("**/_vercel/insights/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
      const denied = await page.goto(`${baseURL}/dev/maths-renderer`); assert.equal(denied!.status(), 404);
      assert.equal(await page.locator("[data-maths-renderer],[data-review-case]").count(), 0);
      assert(await page.evaluate(() => !("mathsFixtures" in window) && !("mathsLifecycle" in window)));
      await page.goto(`${baseURL}/maths-acceptance-probe`);
      await page.waitForFunction(() => JSON.parse(document.querySelector("[data-production-result]")!.textContent!)?.status === "ready");
      const capacity = JSON.parse((await page.locator("[data-production-result]").textContent())!);
      assert.equal(capacity.fits, true);
      const styles = await page.locator("[data-maths-renderer]").evaluate(root => ({ prose: parseFloat(getComputedStyle(root).fontSize), math: parseFloat(getComputedStyle(root.querySelector(".katex")!).fontSize), overflow: getComputedStyle(root).overflow,
        mathml: root.querySelectorAll("math").length, visualHidden: root.querySelectorAll(".katex-html[aria-hidden='true']").length,
        loadedKaTeXFaces: [...document.fonts].filter(face => face.family.includes("KaTeX") && face.status === "loaded").length }));
      assert.equal(styles.prose, 18); assert.equal(styles.math, 18); assert.equal(styles.overflow, "visible");
      assert.equal(styles.mathml, 3); assert.equal(styles.visualHidden, 3); assert(styles.loadedKaTeXFaces > 0);
      const spacing = await page.locator("[data-maths-renderer]").evaluate(root => {
        const paragraphs = root.querySelectorAll("[data-maths-paragraph]");
        const display = root.querySelector(".katex-display")!, table = display.querySelector(".mtable")!;
        const origin = root.getBoundingClientRect(), working = table.getBoundingClientRect(), block = display.getBoundingClientRect();
        const first = paragraphs[0].getBoundingClientRect(), second = paragraphs[1].getBoundingClientRect(), third = paragraphs[2].getBoundingClientRect();
        return { indent: working.left - origin.left, before: block.top - first.bottom,
          after: second.top - block.bottom, paragraph: third.top - second.bottom,
          inline: parseFloat(getComputedStyle(root.querySelector("[data-maths-expression='inline']")!).paddingTop) };
      });
      for (const [actual, expected] of [[spacing.indent, 18], [spacing.before, 10.8], [spacing.after, 10.8], [spacing.paragraph, 14.4], [spacing.inline, 4.5]]) assert(Math.abs(actual - expected) <= 0.5, `Production spacing ${actual} differs from ${expected}`);
      assert.deepEqual(errors, []); assert.deepEqual(assetErrors, []);
      browsers.push({ name, deniedStatus: 404, fixtureHooksExposed: false, capacity, styles, spacing, errors, assetErrors });
      await page.locator("[data-maths-renderer]").screenshot({ path: join(output, `production-${name}.png`) });
    } finally { await browser.close(); }
  }
  result.browsers = browsers; result.passed = true;
  console.log("Production build, HTML/RSC guards, private fixture hooks and compiled renderer CSS/fonts passed in all three browsers.");
} catch (error) {
  result.passed = false; result.error = error instanceof Error ? error.message : String(error); throw error;
} finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  await writeFile(join(output, "production-server.log"), serverLog);
  result.scratchRemoved = true;
  await writeFile(join(output, "production-acceptance.json"), JSON.stringify(result, null, 2) + "\n");
  await rm(scratch, { recursive: true, force: true });
}
