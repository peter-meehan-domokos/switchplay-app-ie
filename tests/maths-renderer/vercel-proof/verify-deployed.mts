// Uses private, proof-project-only credentials; never prints request headers.
// Run only for the explicitly authorised protected Preview deployment.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const output = join(import.meta.dirname, "evidence");
assert(process.env.PROOF_ACCESS_FILE, "Private proof access file is required");
const access = JSON.parse(await readFile(process.env.PROOF_ACCESS_FILE, "utf8"));
assert.equal(access.projectId, "prj_KIkD92Ngbvl0b7IF1QSFU0l1D63o");
const deployment = JSON.parse(await readFile(join(output, "deployment.json"), "utf8"));
assert.equal(deployment.projectId, access.projectId); assert.equal(deployment.environment, "preview");
assert(!deployment.removed, "A removed deployment must never be used for verification");
const origin = `https://${deployment.url.replace(/^https:\/\//, "")}`;
assert(/^https:\/\/switchplay-maths-renderer-proof-[a-z0-9-]+\.vercel\.app$/.test(origin));
const headers = { "x-vercel-protection-bypass": access.bypassKey, "x-maths-proof-key": access.proofKey };
const report: Record<string, unknown> = { origin, externalDeployment: true, protectedPreview: true, at: new Date().toISOString(), measurements: [], failures: [] };
const records: Record<string, unknown>[] = [];
async function save() {
  const text = JSON.stringify({ ...report, requests: records }, null, 2);
  assert(!text.includes(access.proofKey) && !text.includes(access.bypassKey), "Secret must never enter evidence");
  await writeFile(join(output, "deployed-results.json"), text + "\n");
}
async function guard(path: string, options: RequestInit, expected: number | number[]) {
  const response = await fetch(origin + path, { ...options, redirect: "manual", signal: AbortSignal.timeout(45000) });
  const allowed = Array.isArray(expected) ? expected : [expected]; assert(allowed.includes(response.status), `Guard ${path}: ${response.status}`);
  return { path, status: response.status };
}
async function invoke(scenario: string) {
  const start = performance.now();
  const response = await fetch(`${origin}/api/proof`, { method: "POST", headers, body: scenario, redirect: "manual", signal: AbortSignal.timeout(45000) });
  const clientElapsedMs = Math.round((performance.now() - start) * 100) / 100;
  assert.equal(response.status, 200, `${scenario}: HTTP ${response.status}`);
  const measurement = await response.json();
  const record = { scenario, clientElapsedMs, vercelRequestId: response.headers.get("x-vercel-id"), ...measurement };
  records.push(record); await save();
  console.log(`${scenario}: ${measurement.result?.status ?? measurement.failure}; client ${clientElapsedMs}ms; phase ${measurement.phase}`);
  assert.equal(measurement.platform, "linux"); assert.equal(measurement.arch, "x64"); assert.match(measurement.node, /^v24\./);
  assert.deepEqual(measurement.cleanup, { browserConnected: false, browserProcessAlive: false, contexts: 0 });
  if (measurement.result?.status === "ready") {
    assert.equal(measurement.observation.fontProfileVerified, true);
    assert.equal(measurement.chromium, "153.0.8010.0");
    assert.equal(measurement.executableSha256, "53a15d6c3a3d27dfb54c4ba60278b1683136f70cf1e67e989da7dfbd3d451ef0");
    assert.equal(measurement.observation.mathSize, "9.5px");
    assert.equal(measurement.observation.overflow, "visible");
    assert.equal(measurement.result.fits, !measurement.result.layout.overflowX && !measurement.result.layout.overflowY);
    assert(Math.abs(measurement.result.layout.bounds.bottom - measurement.observation.naturalHeight) < .5);
  } else assert.equal(measurement.readyAndFits, false);
  return record;
}
try {
  report.guards = [
    await guard("/api/proof", { method: "POST", body: "review-1:reference:plain" }, [401, 302, 303, 307, 308]),
    await guard("/api/proof", { method: "POST", body: "review-1:reference:plain", headers: { "x-vercel-protection-bypass": access.bypassKey } }, 404),
    await guard("/measure-host", { headers: { "x-vercel-protection-bypass": access.bypassKey } }, 404),
    await guard("/api/proof", { method: "POST", headers, body: "https://example.invalid/arbitrary-instructions" }, 400),
    await guard("/dev/maths-renderer", { headers: { "x-vercel-protection-bypass": access.bypassKey } }, 404),
    await guard("/dev/maths-fonts", { headers: { "x-vercel-protection-bypass": access.bypassKey } }, 404),
  ];
  // First observed browser execution follows only non-executing access checks.
  const first = await invoke("review-1:reference:plain");
  report.firstObservedExecution = first;
  assert.equal(first.execution, "complete");
  assert.equal((first.result as { status: string })?.status, "ready");
  for (let n = 0; n < 3; n++) await invoke("review-1:reference:plain");
  const measurements = [];
  for (const id of ["review-1", "review-2", "review-3", "review-4", "review-5", "tall"]) for (const height of ["reference", "160", "320"]) for (const media of ["plain", "media"]) {
    const m = await invoke(`${id}:${height}:${media}`); measurements.push(m);
    const result = m.result as { status: string; fits: boolean; layout: { available: { width: number; height: number }; overflowY: boolean } };
    assert.equal(m.execution, "complete"); assert.equal(result.status, "ready"); assert.equal(result.layout.available.width, 214);
    if (height !== "reference") assert.equal(result.layout.available.height, Number(height) - (media === "media" ? 36 : 0));
    if (id.startsWith("review-") && height !== "reference") assert.equal(result.fits, true);
    if (id === "tall" && height === "160") assert.equal(result.layout.overflowY, true);
    if (id === "tall" && height === "320" && media === "plain") assert.equal(result.fits, true);
  }
  for (const id of ["composition", "chain", "currency", "oversized", "invalid", "incomplete"]) {
    const m = await invoke(`${id}:reference:plain`); measurements.push(m);
    const result = m.result as { status: string; fits?: boolean; layout?: { overflowX: boolean } };
    assert.equal(m.execution, "complete");
    if (["invalid", "incomplete"].includes(id)) { assert.equal(result.status, "invalid-input"); assert(!("fits" in result)); }
    if (id === "oversized") assert.equal(result.layout!.overflowX, true);
  }
  report.measurements = measurements;
  const failures = [];
  for (const id of ["hidden", "missing-font", "font-timeout", "deadline", "exception", "missing-binary", "stale", "container"]) {
    const m = await invoke(id); failures.push(m);
    if (["hidden", "missing-font", "font-timeout"].includes(id)) assert.equal((m.result as { status: string }).status, "measurement-unavailable");
    if (["deadline", "exception", "missing-binary"].includes(id)) { assert.equal(m.execution, "failed"); assert(!m.result); }
    if (id === "stale") assert.equal((m.result as { status: string }).status, "invalid-input");
    if (id === "container") assert.equal((m.result as { status: string }).status, "ready");
  }
  report.failures = failures;
  const pair = await Promise.all(["review-2:reference:plain", "review-5:reference:plain"].map(async body => {
    const response = await fetch(`${origin}/api/proof`, { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(45000) });
    assert([200, 503].includes(response.status));
    if (response.status === 503) return { scenario: body, status: 503 };
    const result = await response.json();
    assert.equal(result.scenario, body); assert.equal(result.execution, "complete"); assert.equal(result.cleanup.browserProcessAlive, false);
    return { scenario: body, status: 200, result };
  }));
  assert(pair.some(entry => entry.status === 200)); report.concurrent = pair;
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error instanceof Error ? error.message : "Unexpected verification error";
  throw error;
} finally { await save(); }
