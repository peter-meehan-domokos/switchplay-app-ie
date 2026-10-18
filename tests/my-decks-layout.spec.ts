import { expect, test } from "@playwright/test";

import type { DeckLayout } from "@/components/decks/deckLayout";
import { buildMyDecksLayout } from "@/components/decks/myDecksLayout";

function createDeckLayout(id: string, openedAt?: string | null, createdAt = "2026-01-01T00:00:00.000Z"): DeckLayout {
  return {
    id,
    deckTemplateId: id,
    hasUserDeckData: true,
    createdAt,
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
    confidenceScore: null,
  };
}

test.describe("My Decks collection layout", () => {
  test("places never-opened Decks first by personal creation time, then opened Decks by openedAt", () => {
    const decks = [
      createDeckLayout("missing-a"),
      createDeckLayout("older", "2026-01-02T00:00:00.000Z"),
      createDeckLayout("null", null, "2026-01-05T00:00:00.000Z"),
      createDeckLayout("newest", "2026-01-04T00:00:00.000Z"),
      createDeckLayout("missing-b"),
    ];

    expect(buildMyDecksLayout(decks).map((deck) => deck.id)).toEqual([
      "null",
      "missing-a",
      "missing-b",
      "newest",
      "older",
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
    expect(result.map((deck) => deck.id)).toEqual(["missing", "first", "second"]);
  });

  test("keeps stable ties for never-opened Decks and ignores creation time once opened", () => {
    const decks = [
      createDeckLayout("unopened-first", null), createDeckLayout("unopened-second"),
      createDeckLayout("recent-open", "2026-02-01T00:00:00.000Z"),
      createDeckLayout("recent-create", "2026-01-02T00:00:00.000Z", "2026-01-31T00:00:00.000Z"),
    ];
    expect(buildMyDecksLayout(decks).map((deck) => deck.id)).toEqual(["unopened-first", "unopened-second", "recent-open", "recent-create"]);
  });
});
