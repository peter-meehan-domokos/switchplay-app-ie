import assert from "node:assert/strict";
import { test } from "node:test";
import { parseContent } from "../../src/components/maths-renderer/parseContent";
import { prepareContent } from "../../src/components/maths-renderer/prepareContent";

test("inline and display regions preserve authored mathematics, delimiters and original offsets", () => {
  const source = "First $x^2$ then\r\n$$\\begin{aligned}x&=1\\\\y&=2\n\\end{aligned}$$\rTherefore";
  const result = parseContent(source);
  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(result.blocks.map(block => block.kind), ["paragraph", "display", "paragraph"]);
  for (const block of result.blocks) for (const part of block.kind === "display" ? [block.part] : block.parts) {
    if (part.kind === "math") { assert.equal(source.slice(part.source.start, part.source.end), part.raw); assert.equal(source.slice(part.expressionStart, part.source.end - (part.display ? 2 : 1)), part.latex); }
  }
  assert.deepEqual(result.blocks[2], { kind: "paragraph", parts: [{ kind: "text", text: "Therefore" }] });
});

test("single newlines survive, blank separator runs collapse, display boundaries create no empty rows", () => {
  const result = parseContent("One\r\nTwo\r\n \t\r\n\r\nThree\n\n$$x=4$$\n\nTherefore\nDone");
  assert.deepEqual(result.blocks, [
    { kind: "paragraph", parts: [{ kind: "text", text: "One\nTwo" }] },
    { kind: "paragraph", parts: [{ kind: "text", text: "Three" }] },
    { kind: "display", part: { kind: "math", latex: "x=4", raw: "$$x=4$$", display: true, source: { start: 23, end: 30 }, expressionStart: 25 } },
    { kind: "paragraph", parts: [{ kind: "text", text: "Therefore\nDone" }] },
  ]);
});

test("escaping uses backslash parity; ordinary prose, currency and Markdown are literal", () => {
  const result = parseContent(String.raw`\$5 €6 £7 **bold** \(x\) \\$x$ \\\$9`);
  const block = result.blocks[0]; assert.equal(block.kind, "paragraph");
  if (block.kind !== "paragraph") return;
  assert.equal(block.parts[0].kind, "text");
  assert.deepEqual(block.parts[0], { kind: "text", text: String.raw`$5 €6 £7 **bold** \(x\) \\` });
  assert.equal(block.parts[1].kind, "math");
  assert.deepEqual(block.parts[2], { kind: "text", text: String.raw` \\$9` });
});

test("escaped dollars inside mathematics retain their KaTeX escape", () => {
  const prepared = prepareContent(String.raw`Price $\$5+\pounds7+\text{€}6$ and £8.`);
  assert.equal(prepared.invalid, false);
  assert(prepared.diagnostics.some(issue => issue.code === "symbolNotInFont" && issue.severity === "warning"));
  for (const issue of prepared.diagnostics) assert(issue.source && issue.source.start >= 6 && issue.source.end <= 34);
});

test("an unmatched opener makes the complete remainder literal and preserves earlier complete regions", () => {
  for (const opener of ["$", "$$"]) {
    const source = `🧮\r\nBefore $x=2$. ${opener}unclosed\r\n\nLater \\$5 and end`;
    const parsed = parseContent(source);
    const start = source.indexOf(opener, source.indexOf(". "));
    assert.deepEqual(parsed.diagnostics[0].source, { start, end: source.length });
    const final = parsed.blocks.at(-1)!; assert.equal(final.kind, "paragraph");
    if (final.kind === "paragraph") assert.deepEqual(final.parts.at(-1), { kind: "literal", raw: source.slice(start), source: { start, end: source.length } });
  }
  const mixed = parseContent("Before $x=1$. $$unclosed\nLater $x=3$ stays literal.");
  assert.equal(mixed.diagnostics.length, 1);
  assert.equal(mixed.blocks.flatMap(block => block.kind === "display" ? [block.part] : block.parts).filter(part => part.kind === "math").length, 1);
});

test("invalid mathematics retains exact raw source and reports original code-unit positions", () => {
  const source = "🧮\r\nGood $x=1$; bad $\\notARealCommand{x}$ and $$\\frac{1}$$";
  const prepared = prepareContent(source);
  assert(prepared.invalid);
  assert.equal(prepared.diagnostics.length, 2);
  for (const diagnostic of prepared.diagnostics) {
    assert.equal(diagnostic.code, "INVALID_LATEX");
    assert(diagnostic.source && diagnostic.source.start >= 21 && diagnostic.source.end <= source.length);
  }
  const invalid = [...prepared.mathematics].filter(([, result]) => !result.ok).map(([part]) => part.kind === "math" ? part.raw : "");
  assert.deepEqual(invalid, ["$\\notARealCommand{x}$", "$$\\frac{1}$$"]);
  assert.equal(prepared.diagnostics[0].source!.start, source.indexOf("\\notARealCommand"));
});

test("unsafe resources return diagnostics and original fallback, never trusted HTML", () => {
  for (const command of [String.raw`\includegraphics{https://example.invalid/x.png}`, String.raw`\href{javascript:alert(1)}{x}`, String.raw`\htmlStyle{position:fixed}{x}`]) {
    const prepared = prepareContent(`$${command}$`);
    assert(prepared.invalid); assert(prepared.diagnostics.some(issue => issue.code === "UNSAFE_COMMAND"));
    assert([...prepared.mathematics.values()].every(result => !result.ok));
  }
});

test("math rows, normal vocabulary and macros stay intact without state leaking to another expression", () => {
  const prepared = prepareContent(String.raw`$$\begin{aligned}x&=\sqrt{\frac{a}{b}}\\y&=\int_0^1 t^2\,dt\end{aligned}$$ $\gdef\local{7}\local$ $\local$`);
  assert.equal(prepared.diagnostics.length, 1);
  assert(prepared.invalid);
  assert.deepEqual([...prepared.mathematics.values()].map(result => result.ok), [true, true, false]);
});

test("accessible MathML retains source metadata without announcing it alongside presentation", () => {
  const prepared = prepareContent(String.raw`$\frac{x^2+1}{\sqrt{x+2}}$`);
  const result = [...prepared.mathematics.values()][0];
  assert(result.ok);
  assert.match(result.html, /<math[^>]*><semantics><mrow>/);
  assert.match(result.html, /<annotation encoding="application\/x-tex" aria-hidden="true">\\frac\{x\^2\+1\}\{\\sqrt\{x\+2\}\}<\/annotation>/);
  assert.match(result.html, /class="katex-html" aria-hidden="true"/);
});

test("mixed delimiter runs use the agreed longest opener and never infer repairs", () => {
  const unfinishedDisplay = parseContent("$$x$");
  assert.deepEqual(unfinishedDisplay.diagnostics[0].source, { start: 0, end: 4 });
  assert.deepEqual(unfinishedDisplay.blocks, [{ kind: "paragraph", parts: [{ kind: "literal", raw: "$$x$", source: { start: 0, end: 4 } }] }]);
  const extraCloser = parseContent("$x$$");
  assert.deepEqual(extraCloser.diagnostics[0].source, { start: 3, end: 4 });
  const adjacent = prepareContent("$x$$y$");
  assert.equal(adjacent.invalid, false);
  assert.equal(adjacent.mathematics.size, 2);
});

test("empty and whitespace-only mathematical regions follow KaTeX acceptance without diagnostics", () => {
  for (const source of ["$$$$", "$ $", "$$ \n\t $$", "$\t\n $"]) {
    const prepared = prepareContent(source);
    assert.equal(prepared.invalid, false, source);
    assert.deepEqual(prepared.diagnostics, [], source);
    assert.equal(prepared.mathematics.size, 1);
    for (const [part, result] of prepared.mathematics) {
      assert.equal(part.kind, "math");
      if (part.kind !== "math") continue;
      assert.equal(part.raw, source);
      assert.deepEqual(part.source, { start: 0, end: source.length });
      assert.equal(result.ok, true);
      assert.deepEqual(result.issues, []);
    }
  }
  // Longest-delimiter recognition still applies: $$ is an unmatched display
  // opener, not an inferred empty inline expression.
  for (const source of ["$$", "$$$"]) {
    const prepared = prepareContent(source);
    assert.equal(prepared.invalid, true);
    assert.equal(prepared.diagnostics[0].code, "UNMATCHED_DELIMITER");
  }
});
