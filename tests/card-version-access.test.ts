import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCardVersionAccess, assertDeckVersionAccess } from "../src/lib/cards/versionAccess";
import type { CardTemplateRoot, CardTemplateVersion, DeckTemplateRoot, DeckTemplateVersion } from "../src/lib/cards/model";

test("foreign and anonymous access requires public visibility on both root and requested immutable version", () => {
  const root = { ownerUserId: "bob", visibility: "public" } as CardTemplateRoot;
  for (const actor of ["alice", null]) {
    for (const visibility of ["private", undefined] as const) {
      assert.throws(() => assertCardVersionAccess(actor, root, { visibility } as CardTemplateVersion), { code: "CARD_VERSION_FORBIDDEN" });
    }
    assert.doesNotThrow(() => assertCardVersionAccess(actor, root, { visibility: "public" } as CardTemplateVersion));
    assert.throws(() => assertCardVersionAccess(actor, { ...root, visibility: "private" }, { visibility: "public" } as CardTemplateVersion), { code: "CARD_VERSION_FORBIDDEN" });
  }
});

test("owner retains private and legacy unclassified immutable version access", () => {
  const root = { ownerUserId: "bob", visibility: "private" } as CardTemplateRoot;
  for (const visibility of ["private", "public", undefined] as const) {
    assert.doesNotThrow(() => assertCardVersionAccess("bob", root, { visibility } as CardTemplateVersion));
  }
});

test("Deck immutable privacy applies to anonymous/foreign readers, while owners retain unclassified history", () => {
  const root = { ownerUserId: "bob", visibility: "public" } as DeckTemplateRoot;
  for (const visibility of ["private", undefined, "public"] as const) {
    const version = { visibility } as DeckTemplateVersion;
    assert.doesNotThrow(() => assertDeckVersionAccess("bob", root, version));
    for (const actor of ["alice", null]) {
      if (visibility === "public") assert.doesNotThrow(() => assertDeckVersionAccess(actor, root, version));
      else assert.throws(() => assertDeckVersionAccess(actor, root, version), { code: "DECK_VERSION_FORBIDDEN" });
    }
  }
  assert.throws(() => assertDeckVersionAccess("alice", { ...root, visibility: "private" }, { visibility: "public" } as DeckTemplateVersion), { code: "DECK_VERSION_FORBIDDEN" });
});
