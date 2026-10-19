import type { LibraryEntry } from "../../src/lib/cards/libraryProjection";
import { canonicalPresentationFixture } from "./canonicalPresentation";

export function navigationEntry(index: number, version = 1): Extract<LibraryEntry, { availability: "available" }> {
  const source = canonicalPresentationFixture(390), id = `programme-${index}`;
  const cards = source.cards.map((card, position) => ({ ...card, id: `${id}-card-${position}`,
    cardTemplateId: `${id}-card-${position}`, version, creator: { username: "Creator", immediateSourceUsername: null },
    intro: { ...card.intro, title: `Instruction ${index}-${position}` } }));
  return { availability: "available", deckTemplateId: id, publishedAt: "2026-10-18T00:00:00.000Z",
    deck: { ...source, id, deckTemplateId: id, version, title: `Programme ${index}${version > 1 ? ` revised ${version}` : ""}`, cards },
    manifest: { deckTemplateId: id, deckVersion: version, cards: cards.map(card => ({ cardTemplateId: card.id, version })) } };
}
