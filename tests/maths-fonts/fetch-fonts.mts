// Explicit upstream download for development-only font comparisons. No installs,
// font modification, system installation or proprietary font redistribution.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const target = resolve(import.meta.dirname, "../../src/app/dev/maths-fonts/fonts");
const scratch = await mkdtemp(join(tmpdir(), "switchplay-open-fonts-"));
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const records: { file: string; url: string; sha256: string; bytes: number }[] = [];
async function download(url: string) {
  const response = await fetch(url); assert(response.ok, `${response.status}: ${url}`);
  return Buffer.from(new Uint8Array(await response.arrayBuffer()));
}
async function save(file: string, url: string, bytes: Buffer) {
  await writeFile(join(target, file), bytes);
  records.push({ file, url, sha256: digest(bytes), bytes: bytes.byteLength });
}
try {
  await mkdir(target, { recursive: true });
  const arimo = "https://raw.githubusercontent.com/google/fonts/903d46673260c1f4c7f7ef67f5190fb03eab5042/ofl/arimo";
  const tinos = "https://raw.githubusercontent.com/googlefonts/tinos/3b4482a99b80ea5fc75f187b1be3120a3f5905b3";
  const liberation = "https://raw.githubusercontent.com/liberationfonts/liberation-fonts/2.1.5";
  // Establish and retain each actual distribution's OFL before its binaries.
  for (const [file, url] of [["Arimo-OFL.txt", `${arimo}/OFL.txt`], ["Tinos-OFL.txt", `${tinos}/OFL.txt`], ["Liberation-LICENSE.txt", `${liberation}/LICENSE`]]) {
    const bytes = await download(url); assert(bytes.toString().includes("SIL OPEN FONT LICENSE Version 1.1")); await save(file, url, bytes);
  }
  for (const [file, upstream] of [["Arimo-Regular.ttf", "Arimo[wght].ttf"], ["Arimo-Italic.ttf", "Arimo-Italic[wght].ttf"]]) {
    const url = `${arimo}/${encodeURIComponent(upstream)}`; await save(file, url, await download(url));
  }
  for (const style of ["Regular", "Bold", "Italic", "BoldItalic"]) {
    const file = `Tinos-${style}.ttf`, url = `${tinos}/fonts/ttf/${file}`; await save(file, url, await download(url));
  }
  // The binary attachment is linked by the upstream 2.1.5 release itself.
  const archiveURL = "https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz";
  const archive = await download(archiveURL), path = join(scratch, "fonts.tar.gz"); await writeFile(path, archive);
  const execute = promisify(execFile);
  const entries = (await execute("tar", ["-tzf", path])).stdout.trim().split("\n");
  assert(entries.every(entry => entry.startsWith("liberation-fonts-ttf-2.1.5/") && !entry.split("/").includes("..")));
  await execute("tar", ["-xzf", path, "-C", scratch]);
  for (const family of ["Sans", "Serif"]) for (const style of ["Regular", "Bold", "Italic", "BoldItalic"]) {
    const file = `Liberation${family}-${style}.ttf`, source = join(scratch, "liberation-fonts-ttf-2.1.5", file);
    await cp(source, join(target, file)); const bytes = await readFile(source);
    records.push({ file, url: archiveURL, sha256: digest(bytes), bytes: bytes.length });
  }
  await writeFile(join(target, "sources.json"), JSON.stringify({ purpose: "Unmodified open-font review assets; not approved production typography", licence: "SIL OFL 1.1; retained notices apply", archive: { url: archiveURL, sha256: digest(archive) }, files: records }, null, 2) + "\n");
  console.log(`Downloaded ${records.length} font/licence files from pinned official upstream sources.`);
} finally { await rm(scratch, { recursive: true, force: true }); }
