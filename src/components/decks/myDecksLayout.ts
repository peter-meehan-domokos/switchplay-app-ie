import type { DeckLayout } from "@/components/decks/deckLayout";

export function buildMyDecksLayout(decks: DeckLayout[]): DeckLayout[] {
  return [...decks].sort((a, b) => {
    const time = (value: string | null | undefined) => value ? Date.parse(value) || 0 : 0;
    const recency = (deck: DeckLayout) => Math.max(time(deck.createdAt), time(deck.openedAt));
    return recency(b) - recency(a) || a.id.localeCompare(b.id);
  });
}
