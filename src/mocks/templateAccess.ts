import type { DeckTemplate } from "@/components/decks/types";

export const userTemplateAccess: Record<string, string[]> = {
  Peter: [],
};

export function getVisibleDeckTemplatesForUser(username: string, templates: DeckTemplate[]) {
  const allowedTemplateIds = userTemplateAccess[username];

  if (allowedTemplateIds === undefined) {
    return templates;
  }

  return templates.filter((template) => allowedTemplateIds.includes(template.deckTemplateId));
}