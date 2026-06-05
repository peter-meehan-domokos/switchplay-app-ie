import type { DeckTemplate } from "@/components/decks/types";

export const userTemplateAccess: Record<string, string[]> = {
  Peter: ['deck-2026-06-music-001', 'deck-2026-06-switchplay-001', "deck-2026-06-tebo-studio-001", "deck-2026-06-health-fitness-001", "deck-2026-06-teaching-income-001", "deck-2026-06-open-loops-001"],
  Michael:["deck-001", "deck-002", "deck-003", "deck-004", "deck-005", "deck-006", "deck-007", "deck-008", "deck-009", "deck-010"],
  dev:["deck-001", "deck-002", "deck-003", "deck-004", "deck-005", "deck-006", "deck-007", "deck-008", "deck-009", "deck-010"],
};

export function getVisibleDeckTemplatesForUser(username: string, templates: DeckTemplate[]) {
  const allowedTemplateIds = userTemplateAccess[username];

  if (allowedTemplateIds === undefined) {
    return []; // No access for this user
  }

  return templates.filter((template) => allowedTemplateIds.includes(template.deckTemplateId));
}