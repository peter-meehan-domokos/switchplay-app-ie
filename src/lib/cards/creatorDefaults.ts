import type { CardContent, DeckContent } from "./model";

// Creation/edit defaults only: never apply these while reading persisted content.
export const DEFAULT_CREATOR_DECK_TITLE = "My Next Path";
export const DEFAULT_CREATOR_CARD_TITLE = "My Next Card";
export const DEFAULT_CREATOR_THEME_TITLES = ["Theme 1", "Theme 2", "Theme 3"] as const;
export const DEFAULT_DECK_CADENCE_DAYS = 7;
export const DEFAULT_CARD_LABEL_PREFIX = "Card";

export function defaultCreatorThemeTitle(index: number): string {
  return DEFAULT_CREATOR_THEME_TITLES[index] ?? `Theme ${index + 1}`;
}

export function createDefaultDeckContent(themeIds: readonly string[]): DeckContent {
  return {
    title: DEFAULT_CREATOR_DECK_TITLE,
    introduction: null,
    categories: [],
    themes: themeIds.map((id, index) => ({ id, title: defaultCreatorThemeTitle(index) })),
    cadence: { intervalDays: DEFAULT_DECK_CADENCE_DAYS },
    labelPrefix: DEFAULT_CARD_LABEL_PREFIX,
    cards: [],
  };
}

export function createDefaultCardContent(stepIds: readonly string[]): CardContent {
  return {
    intro: { title: DEFAULT_CREATOR_CARD_TITLE, description: null, mediaItem: null },
    suggestedTargetDate: "",
    steps: stepIds.map((stepId) => ({ stepId, description: null, mediaItem: null })),
  };
}

function restoreTitle(value: string | null, publishedTitle: string | null | undefined, fallback: string): string {
  if (value?.trim()) return value;
  return publishedTitle?.trim() ? publishedTitle : fallback;
}

export function restoreCreatorDeckTitle(value: string, publishedTitle?: string | null): string {
  return restoreTitle(value, publishedTitle, DEFAULT_CREATOR_DECK_TITLE);
}

export function restoreCreatorCardTitle(value: string | null, publishedTitle?: string | null): string {
  return restoreTitle(value, publishedTitle, DEFAULT_CREATOR_CARD_TITLE);
}
