import { expect, test } from "@playwright/test";

import type { DeckLayout } from "@/components/decks/deckLayout";
import { buildMyDecksLayout } from "@/components/decks/myDecksLayout";

function createDeckLayout(id: string, openedAt?: string | null): DeckLayout {
  return {
    id,
    deckTemplateId: id,
    hasUserDeckData: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    openedAt,
    canMutate: true,
    isOwnedByCurrentUser: true,
    ownerUserId: "user-1",
    ownerUsername: "User",
    showOwnerTag: false,
    activeCardId: "",
    title: id,
    category: null,
    introduction: null,
    streams: [],
    cards: [],
    progressPercentage: 0,
  };
}

test.describe("My Decks collection layout", () => {
  test("orders newest openedAt first and leaves null or undefined values last", () => {
    const decks = [
      createDeckLayout("missing-a"),
      createDeckLayout("older", "2026-01-02T00:00:00.000Z"),
      createDeckLayout("null", null),
      createDeckLayout("newest", "2026-01-04T00:00:00.000Z"),
      createDeckLayout("missing-b"),
    ];

    expect(buildMyDecksLayout(decks).map((deck) => deck.id)).toEqual([
      "newest",
      "older",
      "missing-a",
      "null",
      "missing-b",
    ]);
  });

  test("does not mutate its input and preserves equivalent timestamps in existing order", () => {
    const openedAt = "2026-01-03T00:00:00.000Z";
    const decks = [
      createDeckLayout("first", openedAt),
      createDeckLayout("second", openedAt),
      createDeckLayout("missing"),
    ];
    const originalOrder = [...decks];
    const result = buildMyDecksLayout(decks);

    expect(result).not.toBe(decks);
    expect(decks).toEqual(originalOrder);
    expect(result.map((deck) => deck.id)).toEqual(["first", "second", "missing"]);
  });
});
