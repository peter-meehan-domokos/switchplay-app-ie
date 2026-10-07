import type { DeckLayout } from "@/components/decks/deckLayout";

export function buildMyDecksLayout(decks: DeckLayout[]): DeckLayout[] {
  return [...decks].sort((a, b) => {
    const aUnopened = a.openedAt == null, bUnopened = b.openedAt == null;
    if (aUnopened !== bUnopened) return aUnopened ? -1 : 1;
    const aTime = aUnopened ? a.createdAt : a.openedAt;
    const bTime = bUnopened ? b.createdAt : b.openedAt;
    return Date.parse(bTime!) - Date.parse(aTime!);
  });
}
