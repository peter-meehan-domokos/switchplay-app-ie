// Explicit isolated proof: node --import tsx tests/maths-renderer/trusted-proof/run.mts
// No repository env files, dependencies, application routes or running servers
// are altered. A full snapshot is built in an ordinary temporary directory.
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { tmpdir, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { additional, presentation } from "./fixtures";

const repository = resolve(import.meta.dirname, "../../..");
const proof = import.meta.dirname;
const output = join(repository, "tests/maths-renderer/evidence/trusted-proof");
await mkdir(output, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "switchplay-trusted-proof-"));
const source = await readFile(join(repository, "src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx"), "utf8");
const reviews = [...source.matchAll(/content:\s*String\.raw`([^`]+)`/g)].map((match, index) => ({ id: `review-${index + 1}`, content: match[1] }));
assert.equal(reviews.length, 5, "Read the exact current five authored sources without executing the fixture module");
const fixtures = [...reviews, ...additional];
const hash = (content: string | Buffer) => createHash("sha256").update(content).digest("hex");
const guarded = ["package.json", "package-lock.json", "next.config.ts", "vercel.json", "src/components/info-cards", "src/lib", "src/components/maths-renderer"];
async function hashes(paths: string[], root = repository) {
  const result: Record<string, string> = {};
  async function visit(path: string) {
    const absolute = join(root, path), info = await stat(absolute);
    if (info.isDirectory()) for (const child of await readdir(absolute)) await visit(`${path}/${child}`);
    else result[path] = hash(await readFile(absolute));
  }
  for (const path of paths) await visit(path);
  return result;
}
const before = await hashes(guarded);
const report: Record<string, unknown> = { at: new Date().toISOString(), host: { platform: process.platform, arch: process.arch, release: release(), node: process.version },
  productionDeployment: false, playwrightRegularChromiumExecutable: chromium.executablePath(), fixtureSourceHash: hash(source), fixtures,
  rendererHashes: Object.fromEntries(Object.entries(before).filter(([file]) => file.startsWith("src/components/maths-renderer/"))),
  profileAssets: { globalCSS: hash(await readFile(join(repository, "src/app/globals.css"))),
    cardCSS: hash(await readFile(join(repository, "src/components/info-cards/InfoCardFace.module.css"))),
    katex: JSON.parse(await readFile(join(repository, "node_modules/katex/package.json"), "utf8")).version,
    playwright: JSON.parse(await readFile(join(repository, "node_modules/playwright-core/package.json"), "utf8")).version,
    arialRegularSHA256: hash(await readFile("/System/Library/Fonts/Supplemental/Arial.ttf")) } };
let server: ChildProcess | undefined, build: ChildProcess | undefined;
let buildLog = "", serverLog = "";
try {
  for (const name of ["src", "public", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs"]) {
    await cp(join(repository, name), join(scratch, name), { recursive: true });
  }
  await cp(join(repository, "node_modules"), join(scratch, "node_modules"), { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
  const target = join(scratch, "src/trusted-proof"); await mkdir(target, { recursive: true });
  for (const file of ["Host.tsx", "Reference.tsx", "server.ts"]) await cp(join(proof, file), join(target, file));
  await writeFile(join(target, "fixtures.json"), JSON.stringify({ fixtures, presentation }));
  async function file(path: string, content: string) { const absolute = join(scratch, path); await mkdir(dirname(absolute), { recursive: true }); await writeFile(absolute, content); }
  await file("src/app/trusted-proof-host/page.tsx", 'export { default } from "@/trusted-proof/Host";\n');
  await file("src/app/trusted-proof-reference/page.tsx", 'export { default } from "@/trusted-proof/Reference";\n');
  await file("src/app/api/trusted-proof/route.ts", `import { runProof, coldSample } from "@/trusted-proof/server";
import data from "@/trusted-proof/fixtures.json";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.PROOF_KEY || request.headers.get("x-proof-key") !== process.env.PROOF_KEY) return new Response(null, {status:404});
  const action = await request.text();
  if (!["suite","cold"].includes(action)) return new Response(null, {status:400});
  // Only fixed server-owned fixtures and a fixed host. No URLs, source, results,
  // evaluation instructions or browser launch options are supplied by clients.
  const result = action === "suite" ? await runProof(process.env.PROOF_ORIGIN!, data.fixtures, data.presentation, process.env.PROOF_OUTPUT!)
    : await coldSample(process.env.PROOF_ORIGIN!, data.fixtures[4].content, data.presentation, 110.015625);
  return Response.json(result);
}\n`);
  const listener = createServer(); listener.listen(0, "127.0.0.1"); await once(listener, "listening");
  const address = listener.address(); assert(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  const origin = `http://127.0.0.1:${address.port}`, key = randomBytes(32).toString("hex");
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
    NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SWITCHPLAY_DATABASE_MODE: "disposable", MONGODB_URI: "mongodb://127.0.0.1:9",
    MONGODB_DB: "switchplay_phase2_browser_trusted_proof_unused", SESSION_SECRET: "unused-isolated-proof-no-login",
    PROOF_KEY: key, PROOF_ORIGIN: origin, PROOF_OUTPUT: output };
  const cli = join(scratch, "node_modules/next/dist/bin/next");
  const buildStarted = performance.now();
  build = spawn(process.execPath, [cli, "build"], { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] });
  build.stdout!.on("data", chunk => { buildLog += chunk; }); build.stderr!.on("data", chunk => { buildLog += chunk; });
  const [code] = await once(build, "exit");
  await writeFile(join(output, "build.log"), buildLog);
  assert.equal(code, 0, "Temporary production build failed; inspect build.log");
  report.buildMs = performance.now() - buildStarted;
  // Next trace is packaging evidence only: local cached browser is intentionally
  // outside it. A Vercel-compatible Linux binary/font pack is still required.
  const trace = JSON.parse(await readFile(join(scratch, ".next/server/app/api/trusted-proof/route.js.nft.json"), "utf8"));
  const traceRoot = join(scratch, ".next/server/app/api/trusted-proof");
  let traceBytes = 0;
  for (const path of trace.files) { try { traceBytes += (await stat(resolve(traceRoot, path))).size; } catch {} }
  report.routeTrace = { fileCount: trace.files.length, bytes: traceBytes, includesBrowserBinary: trace.files.some((name: string) => /chrome-headless-shell|Chromium\.app|chromium\.br/.test(name)) };
  server = spawn(process.execPath, [cli, "start", "--hostname", "127.0.0.1", "--port", String(address.port)], { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout!.on("data", chunk => { serverLog += chunk; }); server.stderr!.on("data", chunk => { serverLog += chunk; });
  for (const deadline = Date.now() + 30000; ;) {
    try { if ((await fetch(`${origin}/trusted-proof-host`)).ok) break; } catch {}
    assert(server.exitCode === null && Date.now() < deadline, "Proof server did not become ready");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal((await fetch(`${origin}/api/trusted-proof`, { method: "POST", body: "suite" })).status, 404);
  assert.equal((await fetch(`${origin}/dev/maths-renderer`)).status, 404);
  const invoke = async (action: string) => {
    const response = await fetch(`${origin}/api/trusted-proof`, { method: "POST", headers: { "x-proof-key": key }, body: action, signal: AbortSignal.timeout(180000) });
    const body = await response.text(); assert.equal(response.status, 200, body.slice(0, 300)); return JSON.parse(body);
  };
  report.proof = await invoke("suite");
  const cold = [];
  for (let i = 0; i < 3; i++) cold.push(await invoke("cold"));
  report.coldSamples = cold;
  assert.equal((report.proof as { passed: boolean }).passed, true, JSON.stringify((report.proof as { error?: string }).error));
  report.passed = true;
  console.log("Trusted proof passed: actual production Next Node route launched Chromium and consumed MathsRenderer callbacks.");
} catch (error) { report.passed = false; report.error = error instanceof Error ? error.stack : String(error); throw error; }
finally {
  if (build && build.exitCode === null) { build.kill("SIGTERM"); await once(build, "exit"); }
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  await writeFile(join(output, "server.log"), serverLog);
  report.guardedFilesUnchanged = JSON.stringify(before) === JSON.stringify(await hashes(guarded));
  report.scratchRemoved = true; report.serverStopped = !server || server.exitCode !== null;
  await rm(scratch, { recursive: true, force: true });
  await writeFile(join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
}
