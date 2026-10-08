import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPreviewManifest, LibraryPreviewConflict } from "../src/lib/cards/libraryEntry";
const valid = { deckTemplateId: "deck", deckVersion: 1, cards: [{ cardTemplateId: "card", version: 2 }] };
test("entry manifests require exact stable identities, positive immutable versions and unique Cards", () => {
  for (const value of [valid, { ...valid, cards: [] }]) assert.doesNotThrow(() => assertPreviewManifest(value));
  for (const value of [null, [], {}, { ...valid, actor: "bob" }, { ...valid, deckVersion: 0 }, { ...valid, deckVersion: 1.5 },
    { ...valid, cards: [valid.cards[0], valid.cards[0]] }, { ...valid, cards: [{ cardTemplateId: "card", version: 0 }] },
    { ...valid, cards: [{ ...valid.cards[0], revision: 1 }] }, { ...valid, cards: [{ cardTemplateId: " ", version: 1 }] }]) {
    assert.throws(() => assertPreviewManifest(value), { code: "INVALID_PREVIEW_MANIFEST" });
  }
});
test("freshness conflicts identify canonical refresh data, not personal adoption", () => {
  const error = new LibraryPreviewConflict(valid); assert.equal(error.code, "LIBRARY_PREVIEW_CONFLICT"); assert.deepEqual(error.latestManifest, valid);
});
