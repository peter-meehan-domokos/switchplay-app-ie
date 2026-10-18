import { requireCondition } from "./domain";
import type { CardTemplateRoot, CardTemplateVersion, DeckTemplateRoot, DeckTemplateVersion } from "./model";

// Public root visibility never retroactively authorizes private (or unclassified)
// immutable versions. Missing legacy visibility fails closed for foreign reads.
export function assertCardVersionAccess(actor: string | null, root: CardTemplateRoot, version: CardTemplateVersion) {
  requireCondition(root.ownerUserId === actor || root.visibility === "public" && version.visibility === "public", "CARD_VERSION_FORBIDDEN");
}

export function assertDeckVersionAccess(actor: string | null, root: DeckTemplateRoot, version: DeckTemplateVersion) {
  requireCondition(root.ownerUserId === actor || root.visibility === "public" && version.visibility === "public", "DECK_VERSION_FORBIDDEN");
}
