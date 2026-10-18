import { assertAdoption, assertDeckContent, CardArchitectureError, isRecord, nonblank, requireCondition } from "../cards/domain";
import type { DeckData, DeckTemplateRoot, DeckTemplateVersion } from "../cards/model";
import { deckDraftContent } from "../cards/publicationRules";
import { assertDeckVersionAccess } from "../cards/versionAccess";
import type { FrameworkIssue } from "./configuration";

export type PersonalEligibility = {
  cardTemplateIds: string[];
  // Membership composition is known only when all qualifying Decks resolve.
  unknownComposition: boolean;
  issues: FrameworkIssue[];
};

// Workload navigation uses active-only readers; learning eligibility does not.
// A future Discard policy belongs here, not in active working navigation.
export function membershipContributes(membership: DeckData): boolean {
  return membership.archivedAt === null || membership.archivedAt instanceof Date && Number.isFinite(membership.archivedAt.getTime());
}

// Supplied records must belong to the authenticated actor. Ownership, Library
// availability and orphan CardData are deliberately not inputs to eligibility.
// Loaded roots/versions are checked rather than treating inaccessible Decks as empty.
export function collectPersonalEligibility(actor: string, memberships: readonly DeckData[], roots: readonly DeckTemplateRoot[], versions: readonly DeckTemplateVersion[]): PersonalEligibility {
  const cards = new Set<string>(), issues: FrameworkIssue[] = [], seen = new Set<string>();
  for (const membership of memberships) {
    const id = membership.deckTemplateId;
    const fail = (code: string) => issues.push({ code, deckTemplateId: id });
    if (seen.has(id)) { fail("AMBIGUOUS_DECK_MEMBERSHIP"); continue; }
    seen.add(id);
    if (!membershipContributes(membership)) { fail("INVALID_ARCHIVE_STATE"); continue; }
    try {
      assertAdoption(membership.deckTemplateVersion);
      const selectedRoots = roots.filter((root) => root.deckTemplateId === id);
      if (selectedRoots.length !== 1) { fail("MISSING_OR_AMBIGUOUS_DECK_ROOT"); continue; }
      const root = selectedRoots[0];
      const selected = versions.filter((version) => version.deckTemplateId === id && version.version === membership.deckTemplateVersion);
      if (selected.length !== 1) { fail("MISSING_OR_AMBIGUOUS_DECK_VERSION"); continue; }
      const version = selected[0];
      assertDeckVersionAccess(actor, root, version);
      requireCondition(isRecord(version.content) && Array.isArray(version.content.cards)
        && version.content.cards.every((ref) => isRecord(ref) && nonblank(ref.cardTemplateId)
          && Number.isInteger(ref.cardVersionAtPublish) && ref.cardVersionAtPublish >= 1), "INVALID_ADOPTED_DECK_CONTENT");
      assertDeckContent(deckDraftContent(version.content));
      version.content.cards.forEach((ref) => cards.add(ref.cardTemplateId));
    } catch (error) {
      if (!(error instanceof CardArchitectureError)) throw error;
      fail(error.code);
    }
  }
  return { cardTemplateIds: [...cards], unknownComposition: issues.length > 0, issues };
}
