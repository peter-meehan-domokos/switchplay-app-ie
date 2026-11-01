import { test } from "node:test";
import assert from "node:assert/strict";
import { groupProgressFixture, projectGroupProgressFixture } from "./fixtures/groupProgress";
import { resolveEffectiveMapping } from "../src/lib/frameworks/mapping";
import { assertAssessmentSource } from "../src/lib/assessments/contracts";

test("visual fixture maps twelve distinct Cards and thirty-six distinct Steps to populated Areas/Items", () => {
  const fixture = groupProgressFixture(), { cards, framework } = fixture;
  assert.equal(new Set(cards.map(card => card.content.intro.title)).size, 12);
  assert.equal(new Set(cards.flatMap(card => card.content.steps.map(step => step.description))).size, 36);
  const graph = new Map(cards.map(card => [card.cardTemplateId, { cardTemplateId: card.cardTemplateId, forkedFrom: null }]));
  assert.ok(cards.every(card => resolveEffectiveMapping(framework, card.cardTemplateId, graph).state === "mapped"));
  assert.equal(new Set(framework.areas.flatMap(area => area.items.flatMap(item => item.cardTemplateIds))).size, 12);
  assert.equal(framework.areas.flatMap(area => area.items).length, 9);
});

test("Group summaries use underlying Steps, neutral skipped, raw confidence and unequal Item sizes", () => {
  const fixture = groupProgressFixture(), { summary, followerComparisons } = projectGroupProgressFixture(fixture);
  assert.deepEqual(summary.areas.map(area => [area.progress.completion, area.progress.confidence]), [[55, 6], [45, 4], [38, 8]]);
  assert.equal(summary.areas[0].items[0].progress.completion, 67);
  assert.equal(summary.areas[0].items[1].progress.completion, 100);
  assert.equal(summary.areas[2].items[0].progress.completion, 33);
  assert.notEqual(summary.areas[0].progress.completion, Math.round(summary.areas[0].items.reduce((sum, item) => sum + item.progress.completion!, 0) / 3));
  assert.equal(followerComparisons["review-area-1"].activeTotal, 4);
  fixture.cards[0].learning.items.forEach(step => { step.completionStatus = "todo"; });
  assert.notEqual(projectGroupProgressFixture(fixture).summary.areas[0].progress.completion, 55);
  fixture.cards.forEach(card => card.learning.items.forEach(step => { step.completionStatus = "skipped"; }));
  const skipped = projectGroupProgressFixture(fixture).summary;
  assert.ok(skipped.areas.every(area => area.progress.completion === null && area.progress.confidence !== null));
});

test("fixture-only histories combine Group Card/direct Item sources, are read-only, and never accept personal history input", () => {
  const fixture = groupProgressFixture(), { histories } = projectGroupProgressFixture(fixture);
  assert.equal(Object.values(fixture.cardTests).flat().length, 24);
  assert.equal(Object.values(fixture.itemTests).flat().length, 27);
  for (const history of Object.values(histories)) {
    assert.ok(history.results.some(row => row.source.kind === "card"));
    assert.ok(history.results.some(row => row.source.kind === "item"));
    assert.ok(history.results.some(row => row.result) && history.results.some(row => !row.result));
    assert.ok(history.results.every(row => !row.canMutate));
    assert.ok(history.sources.every(source => !source.canMutate));
    history.results.forEach(row => { assertAssessmentSource(row.source); assert.match(row.date, /^2026-10-\d{2}$/); });
    assert.equal(history.latestThree.length, 3);
  }
  assert.ok(!JSON.stringify(histories).includes("PRIVATE-test"));
});
