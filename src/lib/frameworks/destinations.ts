import { ObjectId, type ClientSession, type Collection, type Document, type Filter } from "mongodb";
import { CardArchitectureError, isRecord, nonblank, requireCondition } from "../cards/domain";
import type { CardRepository } from "../cards/repository";
import type { CardData, CardTemplateRoot, CardTemplateVersion, DeckTemplateRoot, DeckTemplateVersion } from "../cards/model";
import { canonicalIntroductionDTO } from "../cards/libraryProjection";
import { assertAssessmentId } from "../assessments/contracts";
import { assertFrameworkConfiguration, getFrameworks, type Framework } from "./configuration";
import { collectPersonalEligibility } from "./eligibility";
import { readCanonicalAncestry } from "./mappingRepository";
import { resolveEffectiveMapping, validateFrameworkAncestry, type CanonicalAncestry } from "./mapping";
import { calculateCardProgress, resolveAdoptedCardCalculation } from "./calculations";
import { getPlayableDeckIntroductionVideo } from "../../components/decks/deckIntroPreview";
import { getCloudflareStreamThumbnailUrl } from "../cloudflareStreamPlayback";
import type { DeckFrontPresentation } from "../../components/decks/deckFrontPresentation";

export type DestinationIssue = { code: string; deckTemplateId?: string };
export type AreaDeckDestination = { kind: "active" | "archived"; deckTemplateId: string; adoptedDeckVersion: number;
  membershipRevision: number; matchingCardCount: number; availability: "available" | "unavailable"; front: DeckFrontPresentation };
export type DestinationSection = { state: "complete" | "empty" | "incomplete"; count: number | null; entries: AreaDeckDestination[]; issues: DestinationIssue[] };
export type AreaDestinations = { viewerUserId: string; frameworkId: string; areaId: string; myDecks: DestinationSection; archived: DestinationSection };
export function matchingAreaCards(framework: Framework, areaId: string, ids: readonly string[], graph: CanonicalAncestry) {
  const matched = new Set<string>(); let incomplete = false;
  for (const id of new Set(ids)) {
    const mapping = resolveEffectiveMapping(framework, id, graph);
    if (mapping.state === "incomplete") incomplete = true;
    else if (mapping.state === "mapped" && mapping.areaId === areaId) matched.add(id);
  }
  return { cardTemplateIds: [...matched], incomplete };
}
export function rankAreaDecks(entries: readonly AreaDeckDestination[]) {
  return [...entries].sort((a, b) => b.matchingCardCount - a.matchingCardCount || a.front.title.localeCompare(b.front.title)
    || a.deckTemplateId.localeCompare(b.deckTemplateId));
}
const section = (): DestinationSection => ({ state: "empty", count: 0, entries: [], issues: [] });
async function batches<T extends Document>(collection: Collection<T>, clauses: Document[], session: ClientSession, projection?: Document) {
  const result: T[] = [];
  const distinct = [...new Map(clauses.map((clause) => [JSON.stringify(clause), clause])).values()];
  for (let offset = 0; offset < distinct.length; offset += 100)
    result.push(...await collection.find({ $or: distinct.slice(offset, offset + 100) } as Filter<T>, { session, projection }).toArray() as T[]);
  return result;
}
// Read-only snapshot of retained personal compositions. No Library discovery or
// personal-history traversal, and no use of current drafts/latest Card versions.
export async function readAreaDestinations(repo: CardRepository, actor: string, frameworkId: string, areaId: string,
  frameworks: readonly Framework[] = getFrameworks()): Promise<AreaDestinations> {
  assertAssessmentId(actor); assertAssessmentId(frameworkId); assertAssessmentId(areaId); assertFrameworkConfiguration(frameworks);
  const framework = frameworks.find((item) => item.id === frameworkId), area = framework?.areas.find((item) => item.id === areaId);
  requireCondition(framework && area, "FRAMEWORK_AREA_CONTEXT_FORBIDDEN");
  return repo.transaction(async (session) => {
    const user = await repo.users().findOne({ _id: /^[a-f\d]{24}$/i.test(actor) ? new ObjectId(actor) : actor }, { session, projection: {
      decksData: 1, "cardsData.cardTemplateId": 1, "cardsData.cardTemplateVersion": 1, "cardsData.items": 1, "cardsData.signalReadings": 1,
    } });
    requireCondition(user && Array.isArray(user.decksData) && Array.isArray(user.cardsData), "PERSONAL_DATA_CONTEXT_REQUIRED");
    const result: AreaDestinations = { viewerUserId: actor, frameworkId, areaId, myDecks: section(), archived: section() };
    // An Area without explicit mappings cannot acquire a matching descendant.
    if (!area.items.some((item) => item.cardTemplateIds.length)) return result;
    const memberships = user.decksData.filter((data) => isRecord(data) && nonblank(data.deckTemplateId));
    if (memberships.length !== user.decksData.length) {
      result.myDecks.issues.push({ code: "INVALID_DECK_MEMBERSHIP" }); result.archived.issues.push({ code: "INVALID_DECK_MEMBERSHIP" });
    }
    const roots = await batches<DeckTemplateRoot>(repo.decks(), memberships.map(({ deckTemplateId }) => ({ deckTemplateId })), session,
      { _id: 0, deckTemplateId: 1, ownerUserId: 1, visibility: 1, latestVersion: 1 });
    const versions = await batches<DeckTemplateVersion>(repo.deckVersions(), memberships.filter((data) => Number.isInteger(data.deckTemplateVersion) && data.deckTemplateVersion > 0)
      .map((data) => ({ deckTemplateId: data.deckTemplateId, version: data.deckTemplateVersion })), session, { _id: 0 });
    const selections = memberships.map((data) => ({ data, eligible: collectPersonalEligibility(actor, [data], roots, versions) }));
    const ids = [...new Set(selections.flatMap(({ eligible }) => eligible.cardTemplateIds))];
    const graph = await readCanonicalAncestry(repo, [framework], ids, session);
    const configurationIssues = validateFrameworkAncestry(framework, graph);
    if (configurationIssues.length) {
      for (const target of [result.myDecks, result.archived]) { target.state = "incomplete"; target.count = null;
        target.issues.push(...configurationIssues.map(({ code }) => ({ code }))); }
      return result;
    }
    const cardRoots = await batches<CardTemplateRoot>(repo.cards(), ids.map((cardTemplateId) => ({ cardTemplateId })), session,
      { _id: 0, cardTemplateId: 1, ownerUserId: 1, visibility: 1 });
    const personal = user.cardsData.filter((data) => isRecord(data) && nonblank(data.cardTemplateId));
    const cardVersions = await batches<CardTemplateVersion>(repo.cardVersions(), personal.filter((data) => ids.includes(data.cardTemplateId)
      && Number.isInteger(data.cardTemplateVersion) && data.cardTemplateVersion > 0)
      .map((data) => ({ cardTemplateId: data.cardTemplateId, version: data.cardTemplateVersion })), session, { _id: 0 });
    const calculations = new Map(ids.map((id) => [id, resolveAdoptedCardCalculation(actor, id, cardRoots, cardVersions, personal as CardData[])]));
    const duplicates = new Set(memberships.filter((data, index) => memberships.findIndex((other) => other.deckTemplateId === data.deckTemplateId) !== index).map((data) => data.deckTemplateId));
    for (const { data, eligible } of selections) {
      const target = data.archivedAt === null ? result.myDecks : data.archivedAt instanceof Date ? result.archived : null;
      if (!target) { for (const section of [result.myDecks, result.archived]) section.issues.push({ code: "INVALID_ARCHIVE_STATE" }); continue; }
      if (duplicates.has(data.deckTemplateId)) { target.issues.push({ code: "AMBIGUOUS_DECK_MEMBERSHIP", deckTemplateId: data.deckTemplateId }); continue; }
      if (eligible.unknownComposition) { target.issues.push(...eligible.issues.map(({ code }) => ({ code, deckTemplateId: data.deckTemplateId }))); continue; }
      const matching = matchingAreaCards(framework, areaId, eligible.cardTemplateIds, graph);
      if (matching.incomplete) { target.issues.push({ code: "UNRESOLVED_CARD_MAPPING", deckTemplateId: data.deckTemplateId }); continue; }
      if (!matching.cardTemplateIds.length) continue;
      try {
        const revision = data.membershipRevision ?? 0;
        requireCondition(Number.isSafeInteger(revision) && revision >= 0, "INVALID_MEMBERSHIP_REVISION");
        const version = versions.find((version) => version.deckTemplateId === data.deckTemplateId && version.version === data.deckTemplateVersion)!;
        const intro = canonicalIntroductionDTO(version.content.introduction), video = getPlayableDeckIntroductionVideo({ introduction: intro });
        const progress = calculateCardProgress(eligible.cardTemplateIds.map((id) => calculations.get(id)!));
        const unavailable = progress.state === "incomplete";
        if (unavailable) target.issues.push({ code: "ADOPTED_CARDS_UNAVAILABLE", deckTemplateId: data.deckTemplateId });
        target.entries.push({ kind: target === result.myDecks ? "active" : "archived", deckTemplateId: data.deckTemplateId,
          adoptedDeckVersion: data.deckTemplateVersion, membershipRevision: revision, matchingCardCount: matching.cardTemplateIds.length,
          availability: unavailable ? "unavailable" : "available", front: { context: "personal", id: data.deckTemplateId,
            title: version.content.title, category: version.content.categories[0] ?? null, ownerUsername: "", showOwnerTag: false,
            cardCount: eligible.cardTemplateIds.length, cardIds: eligible.cardTemplateIds.slice(0, 3), themes: version.content.themes.slice(0, 3).map(({ id, title }) => ({ id, title })),
            posterSrc: intro?.image?.src ?? (video ? getCloudflareStreamThumbnailUrl(video) : null), hasIntroVideo: !!video,
            completion: progress.completion, confidence: progress.confidence } });
      } catch (cause) { if (!(cause instanceof CardArchitectureError)) throw cause;
        target.issues.push({ code: cause.code, deckTemplateId: data.deckTemplateId }); }
    }
    for (const target of [result.myDecks, result.archived]) {
      target.entries = rankAreaDecks(target.entries); target.count = target.issues.length ? null : target.entries.length;
      target.state = target.issues.length ? "incomplete" : target.entries.length ? "complete" : "empty";
    }
    return result;
  });
}
