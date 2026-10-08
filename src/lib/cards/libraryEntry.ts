import { CardArchitectureError, isRecord, nonblank, requireCondition } from "./domain";
import type { LibraryPreviewManifest } from "./libraryProjection";

export function assertPreviewManifest(value: unknown): asserts value is LibraryPreviewManifest {
  requireCondition(isRecord(value) && Object.keys(value).every((key) => ["deckTemplateId", "deckVersion", "cards"].includes(key))
    && nonblank(value.deckTemplateId) && value.deckTemplateId.length <= 200
    && Number.isSafeInteger(value.deckVersion) && (value.deckVersion as number) >= 1 && Array.isArray(value.cards), "INVALID_PREVIEW_MANIFEST");
  const ids = new Set<string>();
  for (const card of value.cards) {
    requireCondition(isRecord(card) && Object.keys(card).length === 2 && nonblank(card.cardTemplateId) && card.cardTemplateId.length <= 200
      && Number.isSafeInteger(card.version) && (card.version as number) >= 1 && !ids.has(card.cardTemplateId), "INVALID_PREVIEW_MANIFEST");
    ids.add(card.cardTemplateId);
  }
}

export class LibraryPreviewConflict extends CardArchitectureError {
  constructor(readonly latestManifest: LibraryPreviewManifest) { super("LIBRARY_PREVIEW_CONFLICT"); }
}

export type PersonalEntryResult = {
  viewerUserId: string;
  deckTemplateId: string;
  outcome: "added" | "already-active" | "archived" | "restored";
  membershipRevision: number;
  adoptedDeckVersion: number;
  adoptedCards: { cardTemplateId: string; version: number }[];
};
