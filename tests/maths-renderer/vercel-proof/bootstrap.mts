// Approved inert bootstrap only: static Build Output API, no functions/deps.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const target = await mkdtemp(join(tmpdir(), "switchplay-maths-inert-bootstrap-"));
await mkdir(join(target, ".vercel/output/static"), { recursive: true });
await cp(join(import.meta.dirname, "bootstrap/config.json"), join(target, ".vercel/output/config.json"));
await cp(join(import.meta.dirname, "bootstrap/404.html"), join(target, ".vercel/output/static/404.html"));
const project = { projectId: "prj_KIkD92Ngbvl0b7IF1QSFU0l1D63o", orgId: "team_tMUjYJgjIAwloHy658xY0NUw", projectName: "switchplay-maths-renderer-proof" };
assert.equal(project.projectName, "switchplay-maths-renderer-proof");
await writeFile(join(target, ".vercel/project.json"), JSON.stringify(project));
await writeFile(join(import.meta.dirname, "evidence/bootstrap-preparation.json"), JSON.stringify({ target, projectId: project.projectId,
  outputFiles: ["config.json", "static/404.html"], functions: 0, browserRuntime: false, applicationCode: false,
  measurementAPI: false, databaseConnection: false, approval: "User explicitly approved inert Production-classified bootstrap, retained during Preview tests." }, null, 2) + "\n");
console.log(target);
