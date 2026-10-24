import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMyDecksLayout } from "../src/components/decks/myDecksLayout";
import type { DeckLayout } from "../src/components/decks/deckLayout";
test("unified membership recency uses max creation/open and a stable ID tie-breaker", () => {
  const rows = [
    { id: "old-unopened", createdAt: "2025-01-01", openedAt: null },
    { id: "recent-open", createdAt: "2025-01-01", openedAt: "2026-01-01" },
    { id: "new-member", createdAt: "2026-02-01", openedAt: "2025-01-01" },
    { id: "a", createdAt: "2026-02-01", openedAt: null },
  ] as DeckLayout[];
  assert.deepEqual(buildMyDecksLayout(rows).map(item => item.id), ["a", "new-member", "recent-open", "old-unopened"]);
});
