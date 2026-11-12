import type { CardRepository } from "../cards/repository";
import { assertCardContent } from "../cards/domain";
import { assertCardVersionAccess, assertDeckVersionAccess } from "../cards/versionAccess";
import { getFrameworks, type Framework } from "../frameworks/configuration";
import { stepMediaItems } from "../stepMedia";
import { assertVisualSource, requireVisual } from "./contracts";
import type { LearnerPrincipal, VisualSource } from "./model";

/** Context is verified provenance, never a second record owner or an access token. */
export async function authorizeVisualSource(repo: CardRepository, actor: LearnerPrincipal, activityId: string, source: VisualSource,
  frameworks: readonly Framework[] = getFrameworks()): Promise<VisualSource> {
  assertVisualSource(source);
  // Journey IDs are reserved for the separately authorized demo-deck service.
  requireVisual(source.journeyId === undefined, "VISUAL_SOURCE_FORBIDDEN");
  if (source.kind === "direct") return { kind: "direct" };
  if (source.kind === "framework") {
    requireVisual(frameworks.some(f => f.id === source.frameworkId && f.areas.some(a => a.items.some(i => i.id === source.frameworkItemId && i.interactiveVisualIds?.includes(activityId)))), "VISUAL_SOURCE_FORBIDDEN");
    return source;
  }
  requireVisual(actor.kind === "account" && (source.mode === "working" || source.mode === "canonical"), "VISUAL_SOURCE_FORBIDDEN");
  return repo.transaction(async session => {
    let version;
    let verified = source;
    if (source.mode === "working") {
      requireVisual(source.deckId, "VISUAL_SOURCE_FORBIDDEN");
      const working = await repo.assessmentWorkingCard(actor.id, source.deckId, source.cardId!, session);
      version = working.cardVersion;
      requireVisual(version.version === source.cardVersion, "VISUAL_SOURCE_VERSION_CONFLICT");
      const user = await repo.getPersonalUser(actor.id, session);
      const membership = user?.decksData.find(d => d.deckTemplateId === source.deckId);
      requireVisual(membership && (source.deckVersion === undefined || source.deckVersion === membership.deckTemplateVersion), "VISUAL_SOURCE_VERSION_CONFLICT");
      verified = { ...source, deckVersion: membership.deckTemplateVersion };
    } else {
      const root = await repo.cards().findOne({ cardTemplateId: source.cardId }, { session });
      version = await repo.getCardVersion(source.cardId!, source.cardVersion!, session);
      requireVisual(root && version && version.version <= root.latestVersion, "VISUAL_SOURCE_FORBIDDEN");
      assertCardVersionAccess(actor.id, root, version);
      if (source.deckId) {
        requireVisual(source.deckVersion, "VISUAL_SOURCE_VERSION_REQUIRED");
        const deck = await repo.decks().findOne({ deckTemplateId: source.deckId }, { session });
        const deckVersion = await repo.getDeckVersion(source.deckId, source.deckVersion, session);
        requireVisual(deck && deckVersion && deckVersion.version <= deck.latestVersion, "VISUAL_SOURCE_FORBIDDEN");
        assertDeckVersionAccess(actor.id, deck, deckVersion);
        requireVisual(deckVersion.content.cards.some(c => c.cardTemplateId === source.cardId), "VISUAL_SOURCE_FORBIDDEN");
      }
    }
    assertCardContent(version.content);
    const destination = source.stepId === "intro" ? version.content.intro : version.content.steps.find(s => s.stepId === source.stepId);
    requireVisual(destination && stepMediaItems(destination).some(m => m.id === source.attachmentId && m.kind === "activity" && m.activityId === activityId), "VISUAL_SOURCE_FORBIDDEN");
    return verified;
  });
}
