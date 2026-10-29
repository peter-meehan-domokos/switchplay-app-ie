// Generates an ordinary isolated Next app in /tmp. Never a branch/worktree.
// No environment files, app routes, database code or deployment links are copied.
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const proof = import.meta.dirname, repository = resolve(proof, "../../..");
export const output = join(proof, "evidence");
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export async function prepare() {
  const target = await mkdtemp(join(tmpdir(), "switchplay-maths-vercel-proof-"));
  await mkdir(output, { recursive: true });
  const provenance = JSON.parse(await readFile(join(repository, "src/app/dev/maths-fonts/fonts/sources.json"), "utf8"));
  const inputs: { source: string; target: string; bytes: number; sha256: string }[] = [];
  async function copyFile(source: string, destination: string) {
    const bytes = await readFile(source); await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes);
    inputs.push({ source: relative(repository, source), target: relative(target, destination), bytes: bytes.length, sha256: hash(bytes) });
  }
  async function copyTree(source: string, destination: string, templates = false) {
    for (const name of await readdir(source)) {
      const from = join(source, name), to = join(destination, templates ? name.replace(/\.(tsx?|mjs)\.txt$/, ".$1") : name);
      if ((await stat(from)).isDirectory()) await copyTree(from, to, templates);
      else await copyFile(from, to);
    }
  }
  await copyTree(join(proof, "template"), target, true);
  await copyTree(join(repository, "src/components/maths-renderer"), join(target, "src/components/maths-renderer"));
  for (const name of ["package.json", "package-lock.json"]) await copyFile(join(proof, name), join(target, name));
  for (const font of provenance.files.filter((file: { file: string }) => file.file.startsWith("Liberation"))) {
    const from = join(repository, "src/app/dev/maths-fonts/fonts", font.file);
    assert.equal(hash(await readFile(from)), font.sha256, `Font/licence provenance: ${font.file}`);
    await copyFile(from, join(target, "public/fonts", font.file));
  }
  const source = await readFile(join(repository, "src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx"), "utf8");
  const reviews = [...source.matchAll(/content:\s*String\.raw`([^`]+)`/g)].map((match, index) => ({ id: `review-${index + 1}`, content: match[1] }));
  assert.equal(reviews.length, 5);
  const additions = [
    { id: "composition", content: String.raw`$(g\circ f)(x)$ or $g(f(x))$: first $f$, then $g$.` },
    { id: "chain", content: String.raw`Therefore,
$$\begin{aligned}{} & x^2+5x+6 \\ ={} & x^2+2x+3x+6 \\ ={} & (x+2)(x+3)\end{aligned}$$` },
    { id: "currency", content: String.raw`Prices: €12, £8 and \$5. Maths: $\$5+\pounds 8$. $\text{€}$, $\textbf{€}$, $\textit{€}$, $\textbf{\textit{€}}$.` },
    { id: "oversized", content: String.raw`$$\underbrace{x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x}_{\text{deliberately wide}}$$` },
    { id: "invalid", content: String.raw`Before $\frac{1}{$ after.` },
    { id: "incomplete", content: String.raw`Before $$\frac{1}{2}` },
    { id: "tall", content: Array(3).fill(reviews[2].content).join("\n\n") },
  ];
  await mkdir(join(target, "src/proof"), { recursive: true });
  await writeFile(join(target, "src/proof/fixtures.json"), JSON.stringify([...reviews, ...additions], null, 2) + "\n");
  // Cloning installed, separately locked proof dependencies avoids changing the
  // shared app's dependencies or build output. npm ci remains the deploy path.
  await cp(join(proof, "node_modules"), join(target, "node_modules"), { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
  const report = { at: new Date().toISOString(), target, externalDeployment: false, environmentFilesCopied: false,
    fixturesSourceSHA256: hash(source), rendererSourceUnmodified: true, inputs, fonts: provenance.files.filter((file: { file: string }) => file.file.startsWith("Liberation")),
    proposedRuntime: { node: "24.x", localVerificationNode: "24.22.1", chromiumPackage: "153.0.0", driver: "1.63.0" } };
  await writeFile(join(target, "proof-inputs.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(join(output, "preparation.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}
if (process.argv[1] === import.meta.filename) console.log((await prepare()).target);
