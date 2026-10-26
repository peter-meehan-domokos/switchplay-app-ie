// Explicitly run after approval. Restricted to this one disposable project.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const execute = promisify(execFile), output = join(import.meta.dirname, "evidence");
const projectId = "prj_KIkD92Ngbvl0b7IF1QSFU0l1D63o", scope = "peter-meehan-domokos-projects";
const prepared = JSON.parse(await readFile(join(output, "preparation.json"), "utf8"));
const bootstrap = JSON.parse(await readFile(join(output, "bootstrap-deployment.json"), "utf8"));
assert.equal(bootstrap.projectId, projectId); assert.equal(bootstrap.retainedDuringTesting, true);
assert((await readFile(join(prepared.target, "check-environment.mjs"), "utf8")).includes("MATHS_PROOF_REQUIRES_PREVIEW"));
await mkdir(join(prepared.target, ".vercel"), { recursive: true });
await writeFile(join(prepared.target, ".vercel/project.json"), JSON.stringify({ projectId, orgId: "team_tMUjYJgjIAwloHy658xY0NUw", projectName: "switchplay-maths-renderer-proof" }));
async function api(path: string) {
  const { stdout } = await execute("vercel", ["api", path, "--scope", scope, "--raw"], { maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(stdout);
}
const inert = await api(`/v13/deployments/${bootstrap.deploymentId}`);
assert.equal(inert.projectId, projectId); assert.equal(inert.readyState, "READY"); assert.equal(inert.target, "production");
const { stdout } = await execute("vercel", ["deploy", prepared.target, "--environment", "preview", "--scope", scope,
  "--project", "switchplay-maths-renderer-proof", "--yes", "--json", "--no-wait"], { maxBuffer: 4 * 1024 * 1024 });
const submitted = JSON.parse(stdout).deployment;
assert(submitted?.id && submitted.url);
let previousState = "";
for (const deadline = Date.now() + 180000; Date.now() < deadline;) {
  const current = await api(`/v13/deployments/${submitted.id}`);
  assert.equal(current.projectId, projectId);
  const record = { projectId, scope, name: "switchplay-maths-renderer-proof", deploymentId: current.id, url: current.url,
    rawTarget: current.target ?? null, environment: current.target === "production" ? "production" : "preview", customEnvironment: current.customEnvironment ?? null,
    readyState: current.readyState, bootstrapRetained: true, targetVerifiedBeforeMeasurements: current.target !== "production",
    productionProjectModified: false, createdAt: current.createdAt, readyAt: current.ready ?? null };
  await writeFile(join(output, "deployment.json"), JSON.stringify(record, null, 2) + "\n");
  assert.notEqual(current.target, "production", "STOP: actual proof classified as Production. No measurement endpoint has been called.");
  assert(!current.customEnvironment, "Proof must use standard Preview");
  if (previousState !== current.readyState) { console.log(`Preview ${current.id}: ${current.readyState}`); previousState = current.readyState; }
  if (current.readyState === "READY") { console.log(`Verified Preview ready: https://${current.url}`); process.exit(0); }
  assert(!["ERROR", "CANCELED"].includes(current.readyState), "Preview build failed");
  await new Promise(resolve => setTimeout(resolve, 2000));
}
throw new Error("Bounded Preview build wait expired");
