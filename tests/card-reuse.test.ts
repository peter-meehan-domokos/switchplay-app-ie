import assert from "node:assert/strict";
import { test } from "node:test";
import { deckContentHash } from "../src/lib/cards/cardReuse";
import { swapConstructionSteps } from "../src/lib/cards/domain";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import type { CardTemplateRoot, DeckTemplateRoot } from "../src/lib/cards/model";

test("reuse blocks either Card independently of content versions; initial construction still works", () => {
  const now = new Date(), base = { ownerUserId: "alice", visibility: "private" as const, latestVersion: 0, revision: 0, forkedFrom: null, createdAt: now, updatedAt: now };
  const a: CardTemplateRoot = { ...base, cardTemplateId: "a", stepIds: ["a1", "a2", "a3"], draft: createDefaultCardContent(["a1", "a2", "a3"]) };
  const b: CardTemplateRoot = { ...base, cardTemplateId: "b", stepIds: ["b1", "b2", "b3"], draft: createDefaultCardContent(["b1", "b2", "b3"]) };
  const deck: DeckTemplateRoot = { ...base, deckTemplateId: "deck", draft: createDefaultDeckContent([]) };
  assert.equal(swapConstructionSteps(a, b, deck, 0, 0).source.steps[0].stepId, "b1");
  for (const [source, destination] of [[{ ...a, firstReusedAt: now }, b], [a, { ...b, firstReusedAt: now }]]) {
    assert.throws(() => swapConstructionSteps(source, destination, deck, 0, 0), { code: "CROSS_CARD_MOVE_AFTER_REUSE" });
  }
});
test("copy comparison token ignores object-key order while preserving exact ordered composition", () => {
  const content = { ...createDefaultDeckContent([]), cards: [{ cardTemplateId: "a" }, { cardTemplateId: "b" }] };
  assert.equal(deckContentHash(content), deckContentHash({ ...content, cadence: { intervalDays: 7 } }));
  assert.equal(deckContentHash(content), deckContentHash(Object.fromEntries(Object.entries(content).reverse()) as typeof content));
  assert.notEqual(deckContentHash(content), deckContentHash({ ...content, cards: [...content.cards].reverse() }));
});
