import assert from "node:assert/strict";
import { test } from "node:test";
import { typesetMath } from "../../src/components/maths-renderer/typesetMath";
import { alignmentFixtures } from "../../src/app/dev/maths-renderer/fixtures";

test("authored alignment candidates typeset with mathematical accessibility output", () => {
  for (const fixture of alignmentFixtures) {
    const result = typesetMath(fixture.latex);
    assert(result.ok, fixture.id);
    assert.match(result.html, /<math/);
    assert.match(result.html, /col-align-l/);
  }
  // Syntax is only a prerequisite. Geometry is verified in the browser suite.
});

test("typesetting keeps macro state local and unsafe resource commands disabled", () => {
  assert(typesetMath(String.raw`\gdef\stageone{7}\stageone`).ok);
  assert.equal(typesetMath(String.raw`\stageone`).ok, false);
  const result = typesetMath(String.raw`\includegraphics{https://example.invalid/image.png}`);
  if (result.ok) assert.doesNotMatch(result.html, /<img\b/);
});

test("normal supported vocabulary is passed to KaTeX without a command allowlist", () => {
  assert(typesetMath(String.raw`\int_0^1 x^2\,dx = \frac13,\quad \sum_{n=1}^\infty \frac1{n^2} = \frac{\pi^2}{6}`).ok);
  assert(typesetMath(String.raw`\begin{pmatrix}a & b \\ c & d\end{pmatrix}`).ok);
  assert.equal(typesetMath(String.raw`\frac{`).ok, false);
});
