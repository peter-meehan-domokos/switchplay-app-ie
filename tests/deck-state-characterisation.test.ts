import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeDeckTemplate, UserDeckData } from "../src/components/decks/types";
import { buildDeckLayout } from "../src/components/decks/deckLayout";
import { buildMyDecksLayout } from "../src/components/decks/myDecksLayout";
import { createCreatorBoardFromTemplate, creatorBoardToDeckTemplate, moveCreatorStepToEmptyCell } from "../src/components/creator/creatorBoardState";
import { clientDeckDataStepsToServerDeckDataItems, normalizeDeckTemplateForRuntime, serverDeckDataItemsToClientDeckDataSteps } from "../src/lib/deckApiTransforms";
import { createEmptyClientUserCardDataFromTemplate, mergeDeckTemplatesWithUserData } from "../src/lib/deckData";
import { reconcileDeckDataWithTemplate } from "../src/lib/deckDataReconciliation";
import { getDeckConfidenceScore } from "../src/lib/signals";
import { createCurrentDeckFixture } from "./fixtures/currentDeck";

function reconcile(oldTemplate: RuntimeDeckTemplate, newTemplate: RuntimeDeckTemplate, existingDeckData: UserDeckData) {
  return reconcileDeckDataWithTemplate({ oldTemplate, newTemplate, existingDeckData, outputDeckTemplateId: newTemplate.deckTemplateId });
}

function resolve(template: RuntimeDeckTemplate, data: UserDeckData) {
  return mergeDeckTemplatesWithUserData([template], serverDeckDataItemsToClientDeckDataSteps([data]), "user-1")[0];
}

test("unchanged template reconciliation preserves completion and retained personal state without mutating inputs", () => {
  const { template, data } = createCurrentDeckFixture();
  const before = structuredClone({ template, data });
  assert.deepEqual(reconcile(template, template, data), data);
  assert.deepEqual({ template, data }, before);
});

test("same-Card reorder preserves completion by Step ID, independent of position", () => {
  const { template, data } = createCurrentDeckFixture();
  data.cards[0].items[0].completionStatus = "inProgress";
  const next = structuredClone(template);
  next.cards[0].steps.reverse();
  assert.deepEqual(reconcile(template, next, data).cards[0].items, [...data.cards[0].items].reverse());
});

for (const field of ["title", "description"] as const) {
  test(`changing Step ${field} resets its completion but preserves other Steps`, () => {
    const { template, data } = createCurrentDeckFixture();
    const next = structuredClone(template);
    next.cards[0].steps[0][field] = "Changed content";
    assert.deepEqual(reconcile(template, next, data).cards[0].items.map((item) => item.completionStatus), ["todo", "done", "done"]);
  });
}

test("rich-text/media-only edits do not currently reset completion", () => {
  const { template, data } = createCurrentDeckFixture();
  const next = structuredClone(template);
  next.cards[0].steps[0].descriptionContent = [{ type: "text", text: "Different rich text" }];
  next.cards[0].steps[0].mediaItem = null;
  assert.deepEqual(reconcile(template, next, data).cards[0].items, data.cards[0].items);
});

test("removed Cards and Steps lose personal state, and a removed active Card falls back to the first Card", () => {
  const { template, data } = createCurrentDeckFixture();
  const next = structuredClone(template);
  next.cards.pop();
  next.cards[0].steps.splice(1, 1);
  const result = reconcile(template, next, data);
  assert.deepEqual(result.cards.map((card) => card.cardId), ["card-001"]);
  assert.deepEqual(result.cards[0].items.map((item) => item.itemId), ["a-1", "a-empty"]);
  assert.equal(result.activeCardId, "card-001");
  next.cards = [];
  assert.equal(reconcile(template, next, data).activeCardId, "");
});

test("new Card state starts fresh with suggested date, todo completion, null signals and no personal media", () => {
  const { template, data } = createCurrentDeckFixture();
  const next = structuredClone(template);
  next.cards[1].cardId = "new-card";
  const fresh = reconcile(template, next, data).cards[1];
  assert.equal(fresh.targetDate, "2026-06-08");
  assert.deepEqual(fresh.items.map((item) => item.completionStatus), ["todo", "todo", "todo"]);
  assert.deepEqual(fresh.signalReadings.map((signal) => signal.reading), [null, null, null]);
  assert.deepEqual([fresh.reflection, fresh.mediaItems, fresh.chats], ["", [], []]);
});

test("legacy cross-Card Step drag resets moved Step completion in both Cards during reconciliation", () => {
  const { template, data } = createCurrentDeckFixture();
  const board = moveCreatorStepToEmptyCell(createCreatorBoardFromTemplate(template), "a-1", "card-2:1");
  const next = normalizeDeckTemplateForRuntime(creatorBoardToDeckTemplate(board));
  const result = reconcile(template, next, data);
  assert.deepEqual(result.cards[0].items[0], { itemId: "b-empty", completionStatus: "todo" });
  assert.deepEqual(result.cards[1].items[1], { itemId: "a-1", completionStatus: "todo" });
  assert.equal(result.cards[0].items[1].completionStatus, "done");
});

test("null differs from real 1 in both resolution and reconciliation; confidence excludes unset readings", () => {
  const { template, data } = createCurrentDeckFixture();
  data.cards = [data.cards[0]];
  template.cards = [template.cards[0]];
  const deck = resolve(template, data);
  assert.deepEqual(deck.cards[0].signals.map((signal) => [signal.id, signal.reading, signal.rawReading]), [
    ["0", null, null], ["1", 1, 1], ["2", 9, 9],
  ]);
  assert.deepEqual(reconcile(template, template, data).cards[0].signalReadings, data.cards[0].signalReadings);
  assert.equal(getDeckConfidenceScore(deck.cards), 5);
  data.cards[0].signalReadings.forEach((signal) => { signal.reading = null; });
  assert.equal(getDeckConfidenceScore(resolve(template, data).cards), null);
});

test("signal lookup falls back by legacy signal position; an explicit fixed null takes precedence", () => {
  const { template, data } = createCurrentDeckFixture();
  template.cards[0].signals = ["legacy-a", "legacy-b", "legacy-c"].map((signalId) => ({
    signalId, title: signalId, order: null, minValue: null, maxValue: null, unit: null,
  }));
  data.cards[0].signalReadings = [{ signalId: "legacy-c", reading: 9 }, { signalId: "legacy-a", reading: 1 }, { signalId: "legacy-b", reading: 7 }];
  assert.deepEqual(resolve(template, data).cards[0].signals.map((signal) => signal.reading), [1, 7, 9]);
  data.cards[0].signalReadings.push({ signalId: "1", reading: null });
  assert.deepEqual(resolve(template, data).cards[0].signals.map((signal) => signal.reading), [1, null, 9]);
  assert.deepEqual(reconcile(template, template, data).cards[0].signalReadings, [
    { signalId: "0", reading: 1 }, { signalId: "1", reading: null }, { signalId: "2", reading: 9 },
  ]);
});

test("reordering Steps changes positional signal meaning while numeric readings stay in the same slots", () => {
  const { template, data } = createCurrentDeckFixture();
  const next = structuredClone(template);
  [next.cards[0].steps[0], next.cards[0].steps[1]] = [next.cards[0].steps[1], next.cards[0].steps[0]];
  const before = resolve(template, data).cards[0].signals;
  const after = resolve(next, reconcile(template, next, data)).cards[0].signals;
  assert.deepEqual(after.map((signal) => signal.rawReading), before.map((signal) => signal.rawReading));
  assert.deepEqual(after.slice(0, 2).map((signal) => signal.title), ["Try", "Read"]);
});

test("personal target date survives template date edits, without shifting surrounding Cards", () => {
  const { template, data } = createCurrentDeckFixture();
  const next = structuredClone(template);
  next.cards[0].suggestedTargetDate = "2027-01-01";
  const result = reconcile(template, next, data);
  assert.deepEqual(result.cards.map((card) => card.targetDate), ["2026-12-25", "2026-06-08"]);
  assert.deepEqual(resolve(next, result).cards.map((card) => card.targetDate), ["2026-12-25", "2026-06-08"]);
});

test("invalid personal target date falls back to suggested date in reconciliation and runtime resolution", () => {
  const { template, data } = createCurrentDeckFixture();
  data.cards[0].targetDate = "2026-02-30";
  assert.equal(reconcile(template, template, data).cards[0].targetDate, "2026-06-01");
  assert.equal(resolve(template, data).cards[0].targetDate, "2026-06-01");
  assert.equal(createEmptyClientUserCardDataFromTemplate(template.cards[0]).targetDate, "2026-06-01");
});

test("owned templates appear in My Decks layout without persisted DeckData", () => {
  const { template } = createCurrentDeckFixture();
  const decks = mergeDeckTemplatesWithUserData([template], [], "user-1", { currentUserId: "user-1", ownerUserId: "user-1" });
  const tiles = buildMyDecksLayout(decks.map((deck) => buildDeckLayout(deck, { currentUserId: "user-1", users: [] })));
  assert.equal(tiles.length, 1);
  assert.equal(tiles[0].deckTemplateId, template.deckTemplateId);
  assert.equal(tiles[0].hasUserDeckData, false);
  assert.equal(tiles[0].isOwnedByCurrentUser, true);
  assert.equal(tiles[0].createdAt, null);
  assert.equal(tiles[0].activeCardId, "card-001");
  assert.deepEqual(tiles[0].cards.map((card) => card.targetDate), ["2026-06-01", "2026-06-08"]);
});

test("trusted personal and canonical media metadata survives API transforms, reconciliation and runtime layout", () => {
  const { template, data } = createCurrentDeckFixture();
  const client = serverDeckDataItemsToClientDeckDataSteps([data]);
  const server = clientDeckDataStepsToServerDeckDataItems(client)[0];
  assert.deepEqual(server.cards[0].items, data.cards[0].items);
  assert.deepEqual(server.cards[0].mediaItems, data.cards[0].mediaItems);
  assert.deepEqual(server.cards[0].chats, data.cards[0].chats);
  assert.equal(server.cards[0].reflection, data.cards[0].reflection);
  const deck = resolve(normalizeDeckTemplateForRuntime(template), reconcile(template, template, server));
  const layout = buildDeckLayout(deck, { currentUserId: "user-1", users: [] });
  assert.deepEqual(layout.introduction, template.introduction);
  assert.deepEqual(layout.cards[0].intro.mediaItem, template.cards[0].intro.mediaItem);
  assert.deepEqual(layout.cards[0].steps[0].mediaItem, template.cards[0].steps[0].mediaItem);
  assert.deepEqual(layout.cards[0].steps[0].descriptionContent, template.cards[0].steps[0].descriptionContent);
  assert.deepEqual(layout.cards[0].mediaItems, data.cards[0].mediaItems);
  assert.deepEqual(layout.cards[0].backMediaItems, data.cards[0].mediaItems);
});
