import { descending, sort } from "d3-array";
import type { DeckLayout } from "@/components/decks/deckLayout";

const compareOpenedAt = descending as (
  a: string | null | undefined,
  b: string | null | undefined,
) => number;

export function buildMyDecksLayout(decks: DeckLayout[]): DeckLayout[] {
  return sort(decks, (a, b) => compareOpenedAt(a.openedAt, b.openedAt));
}
