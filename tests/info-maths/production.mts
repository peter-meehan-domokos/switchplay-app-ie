import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { trustedInfoMaths, checkInfoMathsRendering } from "../../src/lib/infoCards/trustedMaths";
const target = await mkdtemp(join(tmpdir(), "switchplay-info-maths-production-"));
const output = process.env.INFO_MATHS_PRODUCTION_OUTPUT ?? "tests/info-maths/evidence"; await mkdir(output, { recursive: true });
for (const name of ["src", "public", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "next-env.d.ts"]) await cp(name, join(target, name), { recursive: true });
await cp("node_modules", join(target, "node_modules"), { recursive: true, mode: constants.COPYFILE_FICLONE });
const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SESSION_SECRET: "isolated-info-maths-production-test-only", SWITCHPLAY_DATABASE_MODE: "disposable", MONGODB_URI: "mongodb://127.0.0.1:9", MONGODB_DB: "switchplay_phase2_browser_maths_unused" };
process.env.SESSION_SECRET = env.SESSION_SECRET;
let server: ReturnType<typeof spawn> | undefined, log = "";
let protectedProxy: ReturnType<typeof createHttpServer> | undefined;
const previousBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const report: Record<string, unknown> = { productionDeployment: false, applicationSnapshot: true };
try {
  const build = spawn(process.execPath, [join(target, "node_modules/next/dist/bin/next"), "build"], { cwd: target, env, stdio: ["ignore", "pipe", "pipe"] });
  build.stdout!.on("data", b => { log += b; }); build.stderr!.on("data", b => { log += b; });
  assert.equal((await once(build, "exit"))[0], 0, log.slice(-4000)); await writeFile(join(output, "build.log"), log);
  const trace = JSON.parse(await readFile(join(target, ".next/server/app/api/info-cards/[infoCardId]/check-rendering/route.js.nft.json"), "utf8"));
  assert(trace.files.some((f: string) => f.endsWith("chromium.br"))); assert(trace.files.some((f: string) => f.endsWith("playwright-core/browsers.json")));
  assert.equal(trace.files.filter((f: string) => /info-cards\/fonts\/.*\.ttf$/.test(f)).length, 8); report.tracing = "browser binary, dynamic driver registry and eight fonts present";
  const publicationTrace = JSON.parse(await readFile(join(target, ".next/server/app/api/info-cards/[infoCardId]/publish/route.js.nft.json"), "utf8"));
  assert(!publicationTrace.files.some((f: string) => /chromium\.br|playwright-core/.test(f))); report.publicationHasNoChromiumRuntime = true;
  const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening"); const address = probe.address(); assert(address && typeof address !== "string"); await new Promise<void>(resolve => probe.close(() => resolve()));
  const origin = `http://127.0.0.1:${address.port}`; log = "";
  server = spawn(process.execPath, [join(target, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(address.port)], { cwd: target, env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout!.on("data", b => { log += b; }); server.stderr!.on("data", b => { log += b; });
  for (const deadline = Date.now() + 30000; ;) { try { if ((await fetch(origin + "/internal/info-maths")).status === 404) break; } catch {} assert(Date.now() < deadline); await new Promise(resolve => setTimeout(resolve, 200)); }
  assert.equal((await fetch(origin + "/internal/info-maths", { headers: { "x-info-maths-host": "forged" } })).status, 404);
  const sources = [...(await readFile("src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx", "utf8")).matchAll(/content:\s*String\.raw`([^`]+)`/g)].map(m => m[1]);
  // Local authentication gate exercises real Chromium and the production-built
  // host. This does not substitute for verification on a real Vercel Preview.
  const bypass = "isolated-production-gate-test-only";
  let loginRequests = 0;
  protectedProxy = createHttpServer(async (request, response) => {
    if (request.url === "/login") { loginRequests++; response.end("Login"); return; }
    if (request.headers["x-vercel-protection-bypass"] !== bypass) { response.writeHead(302, { Location: "/login" }); response.end(); return; }
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) if (typeof value === "string" && key !== "host") headers.set(key, value);
    const upstream = await fetch(origin + request.url, { headers, redirect: "manual" });
    const responseHeaders = Object.fromEntries(upstream.headers);
    delete responseHeaders["content-encoding"]; delete responseHeaders["content-length"];
    response.writeHead(upstream.status, responseHeaders); response.end(Buffer.from(await upstream.arrayBuffer()));
  });
  protectedProxy.listen(0, "127.0.0.1"); await once(protectedProxy, "listening");
  const proxyAddress = protectedProxy.address(); assert(proxyAddress && typeof proxyAddress !== "string");
  const protectedOrigin = `http://127.0.0.1:${proxyAddress.port}`;
  assert.equal((await fetch(protectedOrigin + "/internal/info-maths", { redirect: "manual" })).status, 302);
  const validate = trustedInfoMaths(protectedOrigin), results = [];
  for (const credential of [undefined, "invalid-test-only-bypass"]) {
    if (credential) process.env.VERCEL_AUTOMATION_BYPASS_SECRET = credential; else delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    await assert.rejects(validate({ title: "Maths", body: "$x$", bodyFormat: "latex-v1", seriesId: "s", mediaItem: null }, "Basics"), { failure: "authentication" });
  }
  assert.equal(loginRequests, 0); // Credentials/automation never follow the login redirect.
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET = bypass;
  assert.equal((await fetch(protectedOrigin + "/internal/info-maths", { headers: { "x-vercel-protection-bypass": bypass, "x-info-maths-host": "forged" } })).status, 404);
  report.localProtectedHost = { invalidBypassRejected: true, missingBypassRejected: true, hostTokenStillRequired: true, loginRequests };

  for (const [index, body] of sources.entries()) for (const mediaItem of [null, { mediaType: "image" }]) {
    const m = await validate({ title: "Maths", body, bodyFormat: "latex-v1", seriesId: "s", mediaItem } as Parameters<typeof validate>[0], "Basics");
    assert.equal(m.result.status, "ready"); assert(m.safe && m.headerFits); results.push({ index, media: !!mediaItem, ...m });
  }
  const invalid = await validate({ title: "Maths", body: "Before $$\\frac{1}{2}", bodyFormat: "latex-v1", seriesId: "s", mediaItem: null }, "Basics"); assert.equal(invalid.result.status, "invalid-input"); assert(!invalid.safe);
  const currency = await validate({ title: "Maths", body: String.raw`Prices €5, £3 and \$2. $\text{€}+\pounds+\$$`, bodyFormat: "latex-v1", seriesId: "s", mediaItem: null }, "Basics");
  assert.equal(currency.result.status, "ready"); assert(currency.safe); report.currency = currency;
  const wide = await validate({ title: "Maths", body: "$$\\rule{400px}{1px}$$", bodyFormat: "latex-v1", seriesId: "s", mediaItem: null }, "Basics");
  assert.equal(wide.result.status, "ready"); assert(!wide.safe); report.wide = wide;
  const secret = process.env.SESSION_SECRET; process.env.SESSION_SECRET = "incorrect-host-token";
  await assert.rejects(validate({ title: "Maths", body: "$x$", bodyFormat: "latex-v1", seriesId: "s", mediaItem: null }, "Basics"));
  process.env.SESSION_SECRET = secret;
  const retry = validate({ title: "Maths", body: "$x$", bodyFormat: "latex-v1", seriesId: "s", mediaItem: null }, "Basics");
  await assert.rejects(validate({ title: "Maths", body: "$y$", bodyFormat: "latex-v1", seriesId: "s", mediaItem: null }, "Basics"));
  assert((await retry).safe); report.failureCleanupAndContention = true;
  const diagnostic = await checkInfoMathsRendering(protectedOrigin)({ title: "Maths", body: sources[2], bodyFormat: "latex-v1", seriesId: "s", mediaItem: null }, "Basics");
  assert.equal(diagnostic.measurement.result.status, "ready"); assert(diagnostic.screenshot?.dataUrl.startsWith("data:image/png;base64,"));
  await writeFile(join(output, "diagnostic.png"), Buffer.from(diagnostic.screenshot!.dataUrl.split(",")[1], "base64"));
  const overflowCapture = await checkInfoMathsRendering(protectedOrigin)({ title: "Maths", body: "$$\\rule{400px}{1px}$$\n" + Array(25).fill("Working $x$").join("\n"), bodyFormat: "latex-v1", seriesId: "s", mediaItem: null }, "Basics");
  assert(overflowCapture.screenshot && overflowCapture.screenshot.width > 400 && overflowCapture.screenshot.height > 204);
  await writeFile(join(output, "overflow-diagnostic.png"), Buffer.from(overflowCapture.screenshot.dataUrl.split(",")[1], "base64"));
  report.diagnostic = { measurement: diagnostic.measurement, screenshotWidth: diagnostic.screenshot!.width, screenshotHeight: diagnostic.screenshot!.height };
  report.overflowDiagnostic = { measurement: overflowCapture.measurement, screenshotWidth: overflowCapture.screenshot.width, screenshotHeight: overflowCapture.screenshot.height };
  report.passed = true; report.results = results; report.invalid = invalid; report.hostProtected = true;
} finally {
  if (previousBypass === undefined) delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET; else process.env.VERCEL_AUTOMATION_BYPASS_SECRET = previousBypass;
  if (protectedProxy) await new Promise<void>(resolve => protectedProxy!.close(() => resolve()));
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  await writeFile(join(output, "server.log"), log); await writeFile(join(output, "production.json"), JSON.stringify(report, null, 2) + "\n"); await rm(target, { recursive: true, force: true });
}
console.log("Production build, tracing, real renderer measurements, currency fonts, failure cleanup and contention passed.");
