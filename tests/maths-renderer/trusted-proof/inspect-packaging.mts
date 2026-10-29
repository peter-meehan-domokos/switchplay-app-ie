// Inspect a pinned upstream Linux package; never install or execute it.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { brotliDecompressSync } from "node:zlib";

const execute = promisify(execFile);
const scratch = await mkdtemp(join(tmpdir(), "switchplay-chromium-package-"));
const output = resolve(import.meta.dirname, "../evidence/trusted-proof/runtime-inspection.json");
try {
  const registry = await fetch("https://registry.npmjs.org/@sparticuz/chromium").then(r => r.json());
  const version = "153.0.0";
  const metadata = registry.versions[version]; assert(metadata);
  const response = await fetch(metadata.dist.tarball);
  const archive = Buffer.from(new Uint8Array(await response.arrayBuffer()));
  const integrity = `sha512-${createHash("sha512").update(archive).digest("base64")}`;
  assert.equal(integrity, metadata.dist.integrity);
  await writeFile(join(scratch, "package.tgz"), archive);
  await execute("tar", ["-xzf", join(scratch, "package.tgz"), "-C", scratch]);
  const binaryFiles = [];
  for (const name of await readdir(join(scratch, "package/bin"))) {
    const path = join(scratch, "package/bin", name), info = await stat(path);
    const record: Record<string, unknown> = { name, bytes: info.size };
    if (name.endsWith(".br")) {
      const compressed = await readFile(path), started = performance.now();
      const decompressed = brotliDecompressSync(compressed);
      record.localBrotliDecompressMs = performance.now() - started;
      record.extractedBytes = decompressed.byteLength;
      if (name === "chromium.br") {
        record.binarySHA256 = createHash("sha256").update(decompressed).digest("hex");
        record.magic = decompressed.subarray(0, 4).toString("hex");
        record.elfMachine = decompressed.readUInt16LE(18);
      } else if (name.endsWith(".tar.br")) {
        const tar = join(scratch, name.slice(0, -3)); await writeFile(tar, decompressed);
        record.entries = (await execute("tar", ["-tf", tar])).stdout.trim().split("\n");
      }
    }
    binaryFiles.push(record);
  }
  const driverCandidates = [];
  for (const version of ["1.62.0", "1.63.0", "1.64.1"]) {
    const response = await fetch(`https://registry.npmjs.org/playwright-core/${version}`);
    if (!response.ok) { driverCandidates.push({ version, available: false }); continue; }
    const metadata = await response.json();
    const archiveResponse = await fetch(metadata.dist.tarball);
    const archive = Buffer.from(new Uint8Array(await archiveResponse.arrayBuffer()));
    assert.equal(`sha512-${createHash("sha512").update(archive).digest("base64")}`, metadata.dist.integrity);
    const path = join(scratch, `playwright-${version}.tgz`); await writeFile(path, archive);
    const browsers = JSON.parse((await execute("tar", ["-xOzf", path, "package/browsers.json"])).stdout);
    driverCandidates.push({ version, integrity: metadata.dist.integrity, chromium: browsers.browsers.filter((entry: { name: string }) => entry.name === "chromium" || entry.name === "chromium-headless-shell") });
  }
  const result = { at: new Date().toISOString(), executed: false, installed: false, driverCandidates,
    available145Releases: Object.keys(registry.versions).filter(v => v.startsWith("145.")),
    inspected: { name: metadata.name, version, engines: metadata.engines, dependencies: metadata.dependencies,
      dist: metadata.dist, downloadedBytes: archive.byteLength, integrityVerified: true, binaryFiles },
    packageJSON: JSON.parse(await readFile(join(scratch, "package/package.json"), "utf8")) };
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ version, downloadedBytes: archive.byteLength, assets: binaryFiles.map(file => ({ name: file.name, bytes: file.bytes, extractedBytes: file.extractedBytes })), executed: false }));
} finally { await rm(scratch, { recursive: true, force: true }); }
