import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultCardContent } from "../src/lib/cards/creatorDefaults";
import { editedForkContent, forkCardContent, inheritForkCardData, personalHistorySegments } from "../src/lib/cards/forks";
import { initialCardData, assertCardContent } from "../src/lib/cards/domain";

const source = createDefaultCardContent(["a", "b", "c"]), ref = { cardTemplateId: "source", version: 3 };
const now = new Date("2026-10-07T00:00:00Z");

test("fork remapping records immediate lineage, preserves media/content, and requires an actual edit", () => {
  const content = { ...source, intro: { ...source.intro, title: "Source" }, steps: source.steps.map((step) => ({ ...step,
    forkedFrom: { cardTemplateId: "ancestor", version: 1, stepId: `old-${step.stepId}` } })) };
  const fork = forkCardContent(content, ref, ["x", "y", "z"]);
  assert.deepEqual(fork.steps.map((step) => step.forkedFrom), source.steps.map((step) => ({ ...ref, stepId: step.stepId })));
  assert.throws(() => editedForkContent(content, ref, ["x", "y", "z"], fork), { code: "NO_MEANINGFUL_FORK_EDIT" });
  assertCardContent(editedForkContent(content, ref, ["x", "y", "z"], { ...fork, intro: { ...fork.intro, title: "Edited" } }));
  assert.throws(() => forkCardContent(source, ref, ["a", "y", "z"]), { code: "INVALID_FORK_STEP_IDS" });
  assert.throws(() => forkCardContent(source, ref, ["x", "x", "z"]), { code: "INVALID_FORK_STEP_IDS" });
});

test("current-state inheritance maps stable identity through reorder, retains skipped/1/null, and keeps history separate", () => {
  const data = initialCardData("source", 1, source, now);
  data.items[0].completionStatus = "skipped"; data.items[1].completionStatus = "done";
  data.signalReadings[0].reading = 1; data.signalReadings[1].reading = 10;
  data.reflection = "Reflection"; data.targetDate = "2030-01-01";
  const fork = forkCardContent(source, ref, ["x", "y", "z"]);
  fork.steps.reverse();
  const target = inheritForkCardData("target", fork, ref, source, source, data, now);
  assert.deepEqual(target.items.map((item) => item.completionStatus), ["todo", "done", "skipped"]);
  assert.deepEqual(target.signalReadings.map((item) => item.reading), [null, 10, 1]);
  assert.equal(target.reflection, "Reflection"); assert.equal(target.targetDate, data.targetDate);
  assert.equal(target.historySourceCardTemplateId, "source");
  assert.deepEqual([target.tests, target.chats, target.mediaItems], [[], [], []]);
  const library = inheritForkCardData("library", fork, ref, source, source, data, now);
  assert.deepEqual(library.items, target.items); assert.equal(library.reflection, "Reflection"); assert.equal(library.historySourceCardTemplateId, "source");
});

test("defensive intersection excludes missing identities without position/title matching", () => {
  const older = createDefaultCardContent(["a", "b", "old"]), data = initialCardData("source", 1, older, now);
  data.items.forEach((item) => { item.completionStatus = "done"; }); data.signalReadings.forEach((item) => { item.reading = 8; });
  const target = inheritForkCardData("target", forkCardContent(source, ref, ["x", "y", "z"]), ref, source, older, data, now);
  assert.deepEqual(target.items.map((item) => item.completionStatus), ["done", "done", "todo"]);
  assert.deepEqual(target.signalReadings.map((item) => item.reading), [8, 8, null]);
});

test("history traversal returns original contexts once; deletion and corrupt cycles preserve usable history", () => {
  const a = initialCardData("a", 1, source, now), b = initialCardData("b", 1, source, now), c = initialCardData("c", 1, source, now);
  c.historySourceCardTemplateId = "b"; b.historySourceCardTemplateId = "a";
  a.chats = [{ id: "chat", deckTemplateId: "original-deck", comments: [] }];
  a.tests = [{ id: "earlier-test", date: "2026-01-01", result: true, createdAt: now }];
  a.cardTemplateVersion = 3;
  const segment = personalHistorySegments([a, b, c], "c")[2];
  assert.equal(segment.currentAdoptedCardTemplateVersion, 3);
  assert.equal(segment.eventVersionAttribution, "not-recorded");
  assert.equal(Object.hasOwn(segment, "cardTemplateVersion"), false);
  assert.deepEqual(segment.tests, a.tests);
  a.cardTemplateVersion = 4;
  assert.equal(personalHistorySegments([a, b, c], "c")[2].currentAdoptedCardTemplateVersion, 4);
  assert.deepEqual(personalHistorySegments([a, b, c], "c")[2].tests, segment.tests);
  assert.deepEqual(personalHistorySegments([a, b, c], "c").map((item) => item.cardTemplateId), ["c", "b", "a"]);
  assert.equal(personalHistorySegments([a, b, c], "c")[2].chats[0].deckTemplateId, "original-deck");
  assert.deepEqual(personalHistorySegments([a, c], "c").map((item) => item.cardTemplateId), ["c"]);
  a.historySourceCardTemplateId = "c";
  assert.deepEqual(personalHistorySegments([a, b, c], "c").map((item) => item.cardTemplateId), ["c", "b", "a"]);
});

test("malformed history isolates individual events/comments, repairs readable timestamps, and preserves stored data", () => {
  const data = initialCardData("a", 1, source, now);
  Object.assign(data, { tests: [null, { id: "bad", date: "2026-01-01", result: true, createdAt: "not a date" },
    { id: "good", date: "2026-01-01", result: false, createdAt: "2026-01-01T10:00:00Z" }],
    chats: [null, { id: "chat", deckTemplateId: "original", comments: [null,
      { id: "good", creatorId: "coach", text: "Feedback", createdAt: "2026-01-01", isRetained: true },
      { id: "bad", creatorId: "coach", text: {}, createdAt: "2026-01-01", isRetained: true }] }],
    mediaItems: [null, { id: "image", mediaType: "image", src: "https://example.invalid/image.png", description: "Evidence",
      sourceCardTemplateId: "untrusted-source", historyReadOnly: true }, { id: "bad" }],
    historySourceCardTemplateId: {} });
  const stored = structuredClone(data), [segment] = personalHistorySegments([data], "a");
  assert.deepEqual(segment.tests.map((item) => item.id), ["good"]);
  assert.equal(segment.tests[0].createdAt.toISOString(), "2026-01-01T10:00:00.000Z");
  assert.equal(segment.chats[0].comments.length, 1); assert.equal(segment.mediaItems.length, 1);
  assert.equal(Object.hasOwn(segment.mediaItems[0], "sourceCardTemplateId"), false);
  assert.deepEqual(data, stored);
});

test("finite history has no depth cap; duplicate/invalid source metadata does not disable current history", () => {
  const records = Array.from({ length: 512 }, (_, i) => ({ ...initialCardData(`card-${i}`, 1, source, now),
    ...(i ? { historySourceCardTemplateId: `card-${i - 1}` } : {}) }));
  assert.equal(personalHistorySegments(records, "card-511").length, 512);
  Object.assign(records[0], { cardTemplateVersion: null, tests: null });
  const segments = personalHistorySegments(records, "card-511");
  assert.equal(segments.length, 512); assert.equal(segments[511].currentAdoptedCardTemplateVersion, null);
  assert.deepEqual(segments[511].tests, []);
  assert.equal(personalHistorySegments([...records, records[0]], "card-511").length, 511);
});

test("retained Step state follows a continuing lineage even when the current adoption no longer displays that Step", () => {
  const adopted = createDefaultCardContent(["a", "b", "new"]), data = initialCardData("source", 3, adopted, now);
  data.items.push({ stepId: "c", completionStatus: "skipped" }); data.signalReadings.push({ stepId: "c", reading: 7 });
  const earlier = { cardTemplateId: "source", version: 1 };
  const target = inheritForkCardData("target", forkCardContent(source, earlier, ["x", "y", "z"]), earlier, source, adopted, data, now);
  assert.equal(target.items[2].completionStatus, "skipped"); assert.equal(target.signalReadings[2].reading, 7);
});
