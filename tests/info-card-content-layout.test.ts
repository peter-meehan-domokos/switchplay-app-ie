import assert from "node:assert/strict";
import test from "node:test";
import { buildInfoCardContentLayout, infoContentItems } from "../src/components/info-cards/infoCardContentLayout";
import { validateInfoCardContent } from "../src/components/info-cards/infoCardContentValidation";

const presentation = { paragraphGapEm: 0.8, lineHeight: 1.25 };
const layout = (body: string) => buildInfoCardContentLayout(body, presentation);
const shape = (body: string) => layout(body).blocks.map(block => ({ v: block.vCentre, items: block.items.map(item => item.kind === "spacer" ? `spacer:${item.blankLines}:${+item.heightEm.toFixed(2)}` : `${item.centre ? "C:" : ""}${item.source}`) }));

test("untagged content is one left-aligned item, unchanged", () => {
  const body = "Keep the sign.\n\nThen $x^2$ and\n$$\\frac12$$";
  assert.deepEqual(shape(body), [{ v: false, items: [body] }]);
  assert.deepEqual(layout(body).diagnostics, []);
});

test("centre and v-centre tags produce flagged items with tags removed", () => {
  assert.deepEqual(shape("Intro\n[[centre]]\nMiddle\n[[/centre]]\nEnd"), [{ v: false, items: ["Intro", "C:Middle", "End"] }]);
  assert.deepEqual(shape("Top\n[[v-centre]]\nCentred\n[[/v-centre]]"), [{ v: false, items: ["Top"] }, { v: true, items: ["Centred"] }]);
});

test("combined tags mean the same in either nesting order, and crossing tags behave as independent flags", () => {
  const expected = [{ v: true, items: ["C:Both"] }];
  assert.deepEqual(shape("[[centre]][[v-centre]]Both[[/v-centre]][[/centre]]"), expected);
  assert.deepEqual(shape("[[v-centre]][[centre]]Both[[/centre]][[/v-centre]]"), expected);
  assert.deepEqual(shape("[[v-centre]]\n[[centre]]\nBoth\n[[/centre]]\n[[/v-centre]]"), expected);
  assert.deepEqual(shape("[[centre]]a[[v-centre]]b[[/centre]]c[[/v-centre]]"), [{ v: false, items: ["C:a"] }, { v: true, items: ["C:b", "c"] }]);
});

test("unmatched, repeated and misspelt tags stay as visible text and are reported", () => {
  for (const [body, code] of [["[[centre]]open only", "INFO_UNMATCHED_FORMAT_TAG"], ["close only[[/v-centre]]", "INFO_UNMATCHED_FORMAT_TAG"],
    ["[[centre]]a[[centre]]b[[/centre]]", "INFO_NESTED_FORMAT_TAG"], ["[[center]]US spelling[[/center]]", "INFO_UNKNOWN_FORMAT_TAG"], ["[[vcentre]]x[[/vcentre]]", "INFO_UNKNOWN_FORMAT_TAG"]] as const) {
    const result = layout(body);
    assert(result.diagnostics.some(issue => issue.code === code && issue.severity === "error"), `${body}: ${code}`);
    // No text is dropped: every character outside accepted tags is still rendered somewhere.
    const rendered = infoContentItems(result).map(item => item.source).join("");
    for (const word of body.replace(/\[\[\/?(centre|v-centre)\]\]/g, " ").split(/\s+/).filter(Boolean)) if (!/^\[\[/.test(word)) assert(rendered.includes(word.replace(/\[\[.*?\]\]/g, "")), `${body}: ${word}`);
  }
  assert.equal(infoContentItems(layout("[[centre]]open only"))[0].source, "[[centre]]open only");
  assert.deepEqual(layout("[[centre]]a[[centre]]b[[/centre]]").diagnostics.map(issue => issue.source), [{ start: 11, end: 21 }]);
  // Ordinary double-bracket text that is not a near-miss of a tag name is left alone.
  assert.deepEqual(layout("Matrix [[a]] and [[note]]").diagnostics, []);
});

test("tags inside maths are left to the maths", () => {
  const body = "$a [[centre]] b$ and $$\\text{[[v-centre]]}$$";
  assert.deepEqual(shape(body), [{ v: false, items: [body] }]);
  assert.deepEqual(layout(body).diagnostics, []);
  // After an unmatched dollar the rest is literal maths source, so a tag there is not interpreted either.
  assert.deepEqual(shape("Cost $5 [[centre]]x[[/centre]]"), [{ v: false, items: ["Cost $5 [[centre]]x[[/centre]]"] }]);
});

test("one blank line stays a renderer paragraph break; two or more become an explicit spacer", () => {
  assert.deepEqual(shape("a\n\nb"), [{ v: false, items: ["a\n\nb"] }]);
  assert.deepEqual(shape("a\n\n\nb"), [{ v: false, items: ["a", "spacer:2:2.05", "b"] }]);
  assert.deepEqual(shape("a\n\n \n\t\nb"), [{ v: false, items: ["a", "spacer:3:3.3", "b"] }]);
  // Next to display maths the display block already provides its spacing, so only the further lines are added.
  assert.deepEqual(shape("a\n\n\n$$x$$"), [{ v: false, items: ["a", "spacer:2:1.25", "$$x$$"] }]);
  // Blank lines inside display maths belong to the maths.
  assert.deepEqual(shape("$$x\n\n\n\ny$$"), [{ v: false, items: ["$$x\n\n\n\ny$$"] }]);
});

test("blank lines around tags are kept, but a tag on its own line is not a blank line", () => {
  assert.deepEqual(shape("a\n[[centre]]\nb\n[[/centre]]"), [{ v: false, items: ["a", "C:b"] }]);
  assert.deepEqual(shape("a\n\n[[centre]]\nb\n[[/centre]]"), [{ v: false, items: ["a", "spacer:1:0.8", "C:b"] }]);
  assert.deepEqual(shape("\n\nTop"), [{ v: false, items: ["spacer:2:2.5", "Top"] }]);
  // A spacer is part of the vertically centred group only when it lies inside it.
  assert.deepEqual(shape("[[v-centre]]a\n\n\nb[[/v-centre]]"), [{ v: true, items: ["a", "spacer:2:2.05", "b"] }]);
  assert.deepEqual(shape("a\n\n\n[[v-centre]]b[[/v-centre]]"), [{ v: false, items: ["a", "spacer:2:2.05"] }, { v: true, items: ["b"] }]);
});

test("offsets point at each item in the original body", () => {
  const body = "Intro\n[[centre]]\n$$x$$\n[[/centre]]\nEnd";
  for (const item of infoContentItems(layout(body))) assert.equal(body.slice(item.offset, item.offset + item.source.length), item.source);
});

test("server validation sees tag-free maths and absolute diagnostic positions", () => {
  assert.equal(validateInfoCardContent("[[centre]]$$\\frac12$$[[/centre]]").invalid, false);
  const broken = validateInfoCardContent("Fine\n[[centre]]$\\frac{$[[/centre]]");
  assert.equal(broken.invalid, true);
  const issue = broken.diagnostics.find(entry => entry.severity === "error")!;
  assert(issue.source!.start >= "Fine\n[[centre]]".length, "maths diagnostics are shifted to the body position");
  assert.equal(validateInfoCardContent("[[centre]]never closed").invalid, true);
  assert.equal(validateInfoCardContent("plain\n\n\n\ntext").invalid, false);
});

test("the layout is a pure projection", () => {
  const body = "a\n\n\n[[v-centre]][[centre]]b[[/centre]][[/v-centre]]";
  assert.deepEqual(layout(body), layout(body));
  const result = layout(body);
  assert.doesNotThrow(() => JSON.stringify(result));
});
