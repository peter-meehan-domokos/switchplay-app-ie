import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCardMediaViewerLayout, type WorkingMediaSelection } from "../src/lib/cardMediaViewerLayout";
import { personalMediaKey } from "../src/lib/cards/personalHistoryProjection";
import type { DeckLayout } from "../src/components/decks/deckLayout";
const image = { id: "same", description: "Current", mediaType: "image" as const, src: "https://images.example/current.png" };
const inherited = { ...image, description: "Inherited", src: "https://images.example/source.png" };
const deck = { dataOwnerUserId: "alice", deckTemplateId: "deck", cards: [{ id: "fork", adoptedVersion: 2, mediaItems: [image], personalHistory: [{ cardTemplateId: "source", mediaItems: [inherited] }] }] } as unknown as DeckLayout;
const context = { activeCardId: "fork", focused: false, transitioning: false };
const selection: WorkingMediaSelection = { viewerUserId: "alice", deckTemplateId: "deck", cardId: "fork", version: 2, activeCardId: "fork", focused: false, mediaItemId: personalMediaKey({ ...inherited, sourceCardTemplateId: "source" }), index: 1 };
test("viewer projection preserves full current/inherited order and distinct source identity without mutating layouts", () => {
  const before = structuredClone(deck);
  const layout = buildCardMediaViewerLayout(deck, selection, context);
  assert.equal(layout.valid, true); assert.equal(layout.resolved?.index, 1);
  assert.deepEqual(layout.items.map(item => item.description), ["Current", "Inherited"]);
  assert.deepEqual(deck, before);
});
test("learner, Deck, adopted version and active/focused context changes invalidate an old selection", () => {
  for (const patch of [{ viewerUserId: "bob" }, { deckTemplateId: "other" }, { version: 3 }, { activeCardId: "other" }, { focused: true }])
    assert.equal(buildCardMediaViewerLayout(deck, { ...selection, ...patch }, context).valid, false);
  assert.equal(buildCardMediaViewerLayout(deck, selection, { ...context, transitioning: true }).valid, false);
});
test("removed media chooses the nearest remaining position, while an empty or missing Card closes", () => {
  const removed = { ...deck, cards: [{ ...deck.cards[0], personalHistory: [] }] };
  const layout = buildCardMediaViewerLayout(removed, selection, context);
  assert.equal(layout.valid, true); assert.equal(layout.resolved?.index, 0);
  assert.equal(layout.resolved?.mediaItemId, personalMediaKey(image));
  assert.equal(buildCardMediaViewerLayout({ ...deck, cards: [] }, selection, context).valid, false);
  assert.equal(buildCardMediaViewerLayout({ ...removed, cards: [{ ...removed.cards[0], mediaItems: [] }] }, selection, context).valid, false);
});
