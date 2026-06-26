import type { ObjectId } from "mongodb";
import type { DeckTemplate } from "@/components/decks/types";

export const DECK_TEMPLATES_COLLECTION = "deckTemplates";

export type DeckTemplateVisibility = "private" | "public";

export type DeckTemplatePreviousVersion = {
  template: DeckTemplate;
  savedAt: Date;
};

export type DeckTemplateDocument = {
  _id?: ObjectId;
  deckTemplateId: string;
  ownerUserId: string;
  visibility: DeckTemplateVisibility;
  template: DeckTemplate;
  savedTemplate?: DeckTemplate;
  previousVersions?: DeckTemplatePreviousVersion[];
  savedAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SeedDeckTemplateOwnership = {
  ownerUsername: string;
  visibility: DeckTemplateVisibility;
  deckTemplateIds: string[];
};

export const seedDeckTemplateOwnership: SeedDeckTemplateOwnership[] = [
  {
    ownerUsername: "Peter",
    visibility: "private",
    deckTemplateIds: [
      "deck-2026-06-music-001",
      "deck-2026-06-switchplay-001",
      "deck-2026-06-tebo-studio-001",
      "deck-2026-06-health-fitness-001",
      "deck-2026-06-teaching-income-001",
      "deck-2026-06-open-loops-001",
    ],
  },
  {
    ownerUsername: "Michael",
    visibility: "public",
    deckTemplateIds: [
      "deck-001",
      "deck-002",
      "deck-003",
      "deck-004",
      "deck-005",
      "deck-006",
      "deck-007",
      "deck-008",
      "deck-009",
      "deck-010",
    ],
  },
];
