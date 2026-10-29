// Verify the new review route is unavailable in a real production build, using
// an ordinary temporary snapshot and a random loopback-only port.
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repository = resolve(import.meta.dirname, "../..");
const output = join(repository, "tests/maths-fonts/evidence"); await mkdir(output, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "switchplay-font-production-"));
let child: ChildProcess | undefined, log = "";
const result: Record<string, unknown> = { deployed: false, environmentFilesCopied: false };
const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  SWITCHPLAY_DATABASE_MODE: "disposable", MONGODB_URI: "mongodb://127.0.0.1:9", MONGODB_DB: "switchplay_phase2_browser_fonts_unused", SESSION_SECRET: "unused-local-font-build-only" };
try {
  for (const name of ["src", "public", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs"]) await cp(join(repository, name), join(scratch, name), { recursive: true });
  await cp(join(repository, "node_modules"), join(scratch, "node_modules"), { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
  const cli = join(scratch, "node_modules/next/dist/bin/next");
  child = spawn(process.execPath, [cli, "build"], { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout!.on("data", data => { log += data; }); child.stderr!.on("data", data => { log += data; });
  const [code] = await once(child, "exit"); await writeFile(join(output, "production-build.log"), log); assert.equal(code, 0);
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const address = socket.address(); assert(address && typeof address !== "string"); await new Promise<void>(resolve => socket.close(() => resolve()));
  log = "";
  child = spawn(process.execPath, [cli, "start", "--hostname", "127.0.0.1", "--port", String(address.port)], { cwd: scratch, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout!.on("data", data => { log += data; }); child.stderr!.on("data", data => { log += data; });
  const origin = `http://127.0.0.1:${address.port}`;
  for (const deadline = Date.now() + 30000; ;) {
    try { if ((await fetch(`${origin}/dev/maths-fonts`)).status === 404) break; } catch {}
    assert(child.exitCode === null && Date.now() < deadline); await new Promise(resolve => setTimeout(resolve, 100));
  }
  const guards = [];
  for (const route of ["/dev/maths-fonts", "/dev/maths-renderer"]) for (const rsc of [false, true]) {
    const response = await fetch(`${origin}${route}${rsc ? "?_rsc=font-proof" : ""}`, { headers: rsc ? { RSC: "1" } : {} });
    const text = await response.text(); assert.equal(response.status, 404); assert(!text.includes("data-font-profile") && !text.includes("data-explanation-review"));
    guards.push({ route, rsc, status: response.status, fixtureMarkup: false });
  }
  result.guards = guards; result.passed = true;
  console.log("Production build passed; both review routes return HTML/RSC 404 without fixture markup.");
} catch (error) { result.passed = false; result.error = String(error); throw error; }
finally {
  if (child && child.exitCode === null && !child.signalCode) { child.kill("SIGTERM"); await once(child, "exit"); }
  await writeFile(join(output, "production-server.log"), log); await rm(scratch, { recursive: true, force: true });
  result.serverStopped = true; result.scratchRemoved = true;
  await writeFile(join(output, "production.json"), JSON.stringify(result, null, 2) + "\n");
}
