import assert from "node:assert/strict";
import { test } from "node:test";
import { INFO_CAPACITY, measureInfoCapacity, textWidth } from "../src/lib/infoCards/capacity";
import { assertInfoDraft, sameInfoReferences, seriesName, infoId } from "../src/lib/infoCards/domain";
import { EMPTY_INFO_DRAFT } from "../src/lib/infoCards/model";

export const CAPACITY_SAMPLES = [
  { title: "Negative signs", seriesTitle: "What You Need", body: "When you rearrange an expression, keep every minus sign attached to its number. Use brackets to keep the signs clear.\n\nTwo negatives multiply to make a positive. One negative gives a negative.", hasMedia: true },
  { title: "Create space", seriesTitle: "What To Do", body: "Step away from your defender before you cut towards the basket.\n\nChange speed as you turn. Keep your eyes up so you can see the pass.", hasMedia: true },
  { title: "Input", seriesTitle: "Maths", body: "x = (a + b) / c\n\ny = (x − 1) / 2\n\nf(x) = (x + 3) / (x − 2)", hasMedia: true },
  { title: "Signs", seriesTitle: "Maths", body: "é α β − π 中文\n\nKeep each sign with its number.", hasMedia: true },
];
test("approved five-line prototype samples fit the measured layout with media", () => {
  for (const sample of CAPACITY_SAMPLES) assert.equal(measureInfoCapacity(sample).fits, true, JSON.stringify(measureInfoCapacity(sample)));
  assert.equal(INFO_CAPACITY.width, 240); assert.equal(INFO_CAPACITY.height, 157);
});
test("capacity uses glyph widths, combined title, paragraphs and media reservation", () => {
  const sample = CAPACITY_SAMPLES[0];
  assert(textWidth("WWWW") > textWidth("iiii"));
  assert.equal(measureInfoCapacity({ ...sample, seriesTitle: "Understanding inverse function notation", title: "Recognising the original input" }).fits, false);
  assert.equal(measureInfoCapacity({ ...sample, body: sample.body.repeat(5) }).fits, false);
  assert.equal(measureInfoCapacity({ ...sample, body: "a\n\na\n\na\n\na\n\na" }).fits, false);
  assert(measureInfoCapacity({ ...sample, hasMedia: false }).availableBodyHeight > measureInfoCapacity(sample).availableBodyHeight);
  assert.equal(measureInfoCapacity({ ...sample, title: "Title\nTwo" }).fits, false);
  assert.equal(measureInfoCapacity({ ...sample, body: "\twrong" }).fits, false);
  assert.equal(measureInfoCapacity({ ...sample, title: "" }).fits, false);
});
test("incomplete/overflow drafts are valid; unknown fields and unsafe media are not", () => {
  assertInfoDraft(EMPTY_INFO_DRAFT);
  assertInfoDraft({ ...EMPTY_INFO_DRAFT, body: "x".repeat(9000) });
  assert.throws(() => assertInfoDraft({ ...EMPTY_INFO_DRAFT, ownerUserId: "attacker" }));
  assert.throws(() => assertInfoDraft({ ...EMPTY_INFO_DRAFT, seriesId: { $ne: null } }));
  assert.throws(() => assertInfoDraft({ ...EMPTY_INFO_DRAFT, mediaItem: { id: "x", mediaType: "image", src: "https://evil.invalid/x", description: "x" } }));
});
test("absent and empty main attachment lists are equal without rewriting history", () => {
  assert(sameInfoReferences(undefined, [])); assert(sameInfoReferences(["a", "b"], ["a", "b"]));
  assert(!sameInfoReferences(["a", "b"], ["b", "a"]));
  assert.throws(() => sameInfoReferences(null, [])); assert.throws(() => sameInfoReferences(["a", "a"], []));
  assert.throws(() => infoId("a\n"));
  assert.equal(seriesName("  Ｂasics \t ").normalisedTitle, "basics");
});
