import type { CanonicalDeckPresentation } from "../../src/components/decks/presentation";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";

// Deliberately content-only: no personal records or invented learning values.
export function canonicalPresentationFixture(width: number): CanonicalDeckPresentation {
  const id = `presentation-foundation-${width}`;
  return {
    surface: "canonical", id, deckTemplateId: id, version: 1,
    title: `Presentation ${width}`, category: null, introduction: null,
    streams: createDefaultDeckContent(["theme-1", "theme-2", "theme-3"]).themes,
    ownerUsername: "phase2", showOwnerTag: false,
    cards: [0, 1, 2].map((index) => {
      const cardTemplateId = `${id}-card-${index}`;
      const content = createDefaultCardContent([0, 1, 2].map((step) => `${cardTemplateId}-step-${step}`));
      return {
        surface: "canonical", id: cardTemplateId, cardTemplateId, version: 1, label: `Card ${index + 1}`,
        intro: { ...content.intro, title: `Practice ${index + 1}` },
        steps: content.steps.map((step, position) => ({ ...step, title: `Step ${position + 1}`, description: `Instruction ${position + 1}` })),
      };
    }),
  };
}
