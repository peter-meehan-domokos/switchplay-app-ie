import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { prepare, output } from "./prepare.mjs";

const prepared = await prepare(), target = prepared.target;
const node = process.env.PROOF_NODE;
assert(node && process.env.PROOF_LOCAL_EXECUTABLE, "Supply pinned local Node 24 and Chromium 153 executables");
const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", MATHS_PROOF_KEY: randomBytes(32).toString("hex"),
  PROOF_LOCAL_EXECUTABLE: process.env.PROOF_LOCAL_EXECUTABLE };
let child: ChildProcess | undefined, log = "";
const report: Record<string, unknown> = { externalDeployment: false, target, node, localChromium: env.PROOF_LOCAL_EXECUTABLE, linuxExecution: false };
try {
  const start = performance.now();
  // Exercise the same Preview-only pre-build guard as the remote npm script.
  const guard = spawn(node, [join(target, "check-environment.mjs")], { cwd: target, env, stdio: "ignore" });
  assert.equal((await once(guard, "exit"))[0], 0);
  child = spawn(node, [join(target, "node_modules/next/dist/bin/next"), "build"], { cwd: target, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout!.on("data", bytes => { log += bytes; }); child.stderr!.on("data", bytes => { log += bytes; });
  const [code] = await once(child, "exit"); await writeFile(join(output, "build.log"), log);
  assert.equal(code, 0, "Isolated build failed; see evidence/build.log");
  report.buildMs = performance.now() - start;
  const traceRoot = join(target, ".next/server/app/api/proof");
  const trace = JSON.parse(await readFile(join(traceRoot, "route.js.nft.json"), "utf8"));
  let bytes = 0;
  for (const file of trace.files) bytes += (await stat(join(traceRoot, file))).size;
  report.routeTrace = { count: trace.files.length, bytes, includes: trace.files.filter((file: string) => /chromium\/bin\/|public\/fonts\//.test(file)), note: "Next trace, not a Vercel function artifact" };
  assert(trace.files.some((file: string) => file.endsWith("chromium.br")));
  assert(trace.files.some((file: string) => file.endsWith("playwright-core/browsers.json")), "Driver dynamically reads its browser registry at runtime");
  assert.equal(trace.files.filter((file: string) => /public\/fonts\/.*\.ttf$/.test(file)).length, 8);
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const address = socket.address(); assert(address && typeof address !== "string"); await new Promise<void>(resolve => socket.close(() => resolve()));
  const origin = `http://127.0.0.1:${address.port}`; env.PROOF_LOCAL_ORIGIN = origin;
  log = "";
  child = spawn(node, [join(target, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(address.port)], { cwd: target, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout!.on("data", bytes => { log += bytes; }); child.stderr!.on("data", bytes => { log += bytes; });
  for (const deadline = Date.now() + 30000; ;) {
    try { if ((await fetch(origin)).status === 404) break; } catch {}
    assert(child.exitCode === null && Date.now() < deadline); await new Promise(resolve => setTimeout(resolve, 100));
  }
  const headers = { "x-maths-proof-key": env.MATHS_PROOF_KEY! };
  assert.equal((await fetch(`${origin}/api/proof`, { method: "POST", body: "review-1:reference:plain" })).status, 404);
  assert.equal((await fetch(`${origin}/measure-host`)).status, 404);
  assert.equal((await fetch(`${origin}/api/proof`, { method: "POST", headers, body: "arbitrary instructions" })).status, 400);
  for (const path of ["/dev/maths-renderer", "/dev/maths-fonts", "/api/info-cards"]) assert.equal((await fetch(origin + path)).status, 404);
  report.guards = "Unauthorised host/API 404, unknown scenario 400, dev/app routes absent";
  const invoke = async (scenario: string) => {
    const response = await fetch(`${origin}/api/proof`, { method: "POST", headers, body: scenario, signal: AbortSignal.timeout(45000) });
    const text = await response.text(); assert.equal(response.status, 200, text.slice(0, 200));
    const result = JSON.parse(text); console.log(`${scenario}: ${result.result?.status ?? result.failure}${result.result?.status === "ready" ? ` fits=${result.result.fits}` : ""}`);
    assert.equal(result.cleanup.browserConnected, false); assert.equal(result.cleanup.browserProcessAlive, false); assert.equal(result.cleanup.contexts, 0);
    if (result.result?.status === "ready") {
      assert.equal(result.observation.fontProfileVerified, true, JSON.stringify(result.observation.unexpectedFonts));
      assert.equal(result.observation.mathSize, "9.5px"); assert.equal(result.observation.overflow, "visible");
      assert(Math.abs(result.result.layout.bounds.bottom - result.observation.naturalHeight) < .5);
      assert.equal(result.result.fits, !result.result.layout.overflowX && !result.result.layout.overflowY);
    } else assert.equal(result.readyAndFits, false);
    return result;
  };
  const measurements = [];
  for (const id of ["review-1", "review-2", "review-3", "review-4", "review-5", "tall"]) for (const height of ["reference", "160", "320"]) for (const media of ["plain", "media"]) {
    const result = await invoke(`${id}:${height}:${media}`); assert.equal(result.execution, "complete"); assert.equal(result.result.status, "ready");
    assert.equal(result.job.width, 214);
    if (height !== "reference") assert.equal(result.result.layout.available.height, Number(height) - (media === "media" ? 36 : 0));
    if (id.startsWith("review-") && height !== "reference") assert.equal(result.result.fits, true);
    if (id === "tall" && height === "160") assert.equal(result.result.layout.overflowY, true);
    if (id === "tall" && height === "320" && media === "plain") assert.equal(result.result.fits, true);
    measurements.push(result);
  }
  for (const id of ["composition", "chain", "currency", "oversized", "invalid", "incomplete"]) {
    const result = await invoke(`${id}:reference:plain`); assert.equal(result.execution, "complete");
    if (["invalid", "incomplete"].includes(id)) { assert.equal(result.result.status, "invalid-input"); assert(!("fits" in result.result)); }
    if (id === "oversized") assert.equal(result.result.layout.overflowX, true);
    measurements.push(result);
  }
  report.measurements = measurements;
  const failures = [];
  for (const id of ["hidden", "missing-font", "font-timeout", "deadline", "exception", "missing-binary", "stale", "container"]) {
    const result = await invoke(id);
    if (["hidden", "missing-font", "font-timeout"].includes(id)) assert.equal(result.result.status, "measurement-unavailable");
    if (["deadline", "exception", "missing-binary"].includes(id)) { assert.equal(result.execution, "failed"); assert(!result.result); }
    if (id === "stale") { assert.equal(result.result.status, "invalid-input"); assert.equal(result.history.at(-1).id, "current"); }
    if (id === "container") assert.equal(result.result.status, "ready");
    failures.push(result);
  }
  report.failureCases = failures;
  const pair = await Promise.all(["review-1:reference:plain", "review-5:reference:plain"].map(body => fetch(`${origin}/api/proof`, { method: "POST", headers, body })));
  assert.deepEqual(pair.map(response => response.status).sort(), [200, 503]);
  const accepted = await pair.find(response => response.status === 200)!.json(); assert.equal(accepted.cleanup.browserProcessAlive, false);
  report.concurrent = { statuses: pair.map(response => response.status), policy: "one browser per function instance; simultaneous request fails closed with retry hint" };
  report.passed = true;
  console.log("Isolated production proof verified locally. Linux/Vercel execution remains untested.");
} catch (error) { report.passed = false; report.error = String(error); throw error; }
finally {
  if (child && child.exitCode === null && !child.signalCode) { child.kill("SIGTERM"); await once(child, "exit"); }
  await writeFile(join(output, "server.log"), log);
  report.localServerStopped = true; report.preparedDirectoryRetained = true;
  await writeFile(join(output, "local-results.json"), JSON.stringify(report, null, 2) + "\n");
}
