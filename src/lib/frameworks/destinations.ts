import { ObjectId, type ClientSession, type Collection, type Document, type Filter } from "mongodb";
import { CardArchitectureError, isRecord, nonblank, requireCondition } from "../cards/domain";
import type { CardRepository } from "../cards/repository";
import type { CardData, CardTemplateRoot, CardTemplateVersion, DeckTemplateRoot, DeckTemplateVersion } from "../cards/model";
import { canonicalIntroductionDTO, cardContentPresentation } from "../cards/libraryProjection";
import { cardCreatorAttributions } from "../cards/creatorAttribution";
import { layoutCardLabels } from "../cards/layout";
import type { CanonicalCardPresentation } from "../../components/decks/presentation";
import { assertAssessmentId } from "../assessments/contracts";
import { assertFrameworkConfiguration, getFrameworks, type Framework } from "./configuration";
import { collectPersonalEligibility } from "./eligibility";
import { readCanonicalAncestry } from "./mappingRepository";
import { resolveEffectiveMapping, validateFrameworkAncestry, type CanonicalAncestry } from "./mapping";
import { calculateCardProgress, resolveAdoptedCardCalculation } from "./calculations";
import { getPlayableDeckIntroductionVideo } from "../../components/decks/deckIntroPreview";
import { getCloudflareStreamThumbnailUrl } from "../cloudflareStreamPlayback";
import type { DeckFrontPresentation } from "../../components/decks/deckFrontPresentation";
import { deckFrontPresentation } from "../../components/decks/deckFrontPresentation";
import { publishedLibraryEntries } from "../cards/libraryReadModels";
import type { LibraryPreviewManifest } from "../cards/libraryProjection";

export type DestinationIssue = { code: string; deckTemplateId?: string; cardTemplateId?: string };
export type AreaDeckDestination = { kind: "active" | "archived"; deckTemplateId: string; adoptedDeckVersion: number;
  membershipRevision: number; matchingCardCount: number; availability: "available" | "unavailable"; front: DeckFrontPresentation };
export type DestinationSection = { state: "complete" | "empty" | "incomplete"; count: number | null; entries: AreaDeckDestination[]; issues: DestinationIssue[] };
export type LibraryDeckDestination = { kind: "library"; deckTemplateId: string; matchingCardCount: number;
  manifest: LibraryPreviewManifest; front: DeckFrontPresentation };
export type LibraryDestinationSection = Omit<DestinationSection, "entries"> & { entries: LibraryDeckDestination[] };
export type AreaDestinations = { viewerUserId: string; frameworkId: string; areaId: string; myDecks: DestinationSection; archived: DestinationSection; library: LibraryDestinationSection };
export type ItemDeckContext = (AreaDeckDestination | LibraryDeckDestination) & { cardVersion: number };
export type ItemCardDestination = { cardTemplateId: string; presentation: CanonicalCardPresentation;
  presentationContext: "active" | "archived" | "library"; versionsDiffer: boolean; contexts: ItemDeckContext[] };
export type ItemDestinations = { viewerUserId: string; frameworkId: string; areaId: string; itemId: string;
  state: "complete" | "empty" | "incomplete"; count: number | null; cards: ItemCardDestination[]; issues: DestinationIssue[] };
export function matchingAreaCards(framework: Framework, areaId: string, ids: readonly string[], graph: CanonicalAncestry) {
  const matched = new Set<string>(); let incomplete = false;
  for (const id of new Set(ids)) {
    const mapping = resolveEffectiveMapping(framework, id, graph);
    if (mapping.state === "incomplete") incomplete = true;
    else if (mapping.state === "mapped" && mapping.areaId === areaId) matched.add(id);
  }
  return { cardTemplateIds: [...matched], incomplete };
}
export function rankAreaDecks<T extends { matchingCardCount: number; deckTemplateId: string; front: { title: string } }>(entries: readonly T[]): T[] {
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
// Personal compositions use independent adopted versions; Library uses the
// existing public canonical projection. Both are read in one snapshot, never drafts.
export async function readAreaDestinations(repo: CardRepository, actor: string, frameworkId: string, areaId: string,
  frameworks: readonly Framework[] = getFrameworks()): Promise<AreaDestinations> {
  return (await readDestinations(repo, actor, frameworkId, areaId, frameworks)).area;
}
export async function readItemDestinations(repo: CardRepository, actor: string, frameworkId: string, itemId: string,
  frameworks: readonly Framework[] = getFrameworks()): Promise<ItemDestinations> {
  assertAssessmentId(itemId); assertFrameworkConfiguration(frameworks);
  const area = frameworks.find((framework) => framework.id === frameworkId)?.areas.find((area) => area.items.some((item) => item.id === itemId));
  requireCondition(area, "FRAMEWORK_ITEM_CONTEXT_FORBIDDEN");
  return (await readDestinations(repo, actor, frameworkId, area.id, frameworks, itemId)).item!;
}
async function readDestinations(repo: CardRepository, actor: string, frameworkId: string, areaId: string,
  frameworks: readonly Framework[], itemId?: string) {
  assertAssessmentId(actor); assertAssessmentId(frameworkId); assertAssessmentId(areaId); assertFrameworkConfiguration(frameworks);
  const framework = frameworks.find((item) => item.id === frameworkId), area = framework?.areas.find((item) => item.id === areaId);
  requireCondition(framework && area, "FRAMEWORK_AREA_CONTEXT_FORBIDDEN");
  return repo.transaction(async (session) => {
    const user = await repo.users().findOne({ _id: /^[a-f\d]{24}$/i.test(actor) ? new ObjectId(actor) : actor }, { session, projection: {
      decksData: 1, "cardsData.cardTemplateId": 1, "cardsData.cardTemplateVersion": 1, "cardsData.items": 1, "cardsData.signalReadings": 1,
    } });
    requireCondition(user && Array.isArray(user.decksData) && Array.isArray(user.cardsData), "PERSONAL_DATA_CONTEXT_REQUIRED");
    const result: AreaDestinations = { viewerUserId: actor, frameworkId, areaId, myDecks: section(), archived: section(),
      library: { state: "empty", count: 0, entries: [], issues: [] } };
    const item: ItemDestinations | null = itemId ? { viewerUserId: actor, frameworkId, areaId, itemId,
      state: "empty", count: 0, cards: [], issues: [] } : null;
    const finish = () => ({ area: result, item });
    const mappedItems = itemId ? area.items.filter((entry) => entry.id === itemId) : area.items;
    // Unmapped scopes cannot acquire matching descendants through Deck position.
    if (!mappedItems.some((entry) => entry.cardTemplateIds.length)) return finish();
    const matchingCards = (ids: readonly string[], graph: CanonicalAncestry) => {
      if (!itemId) return matchingAreaCards(framework, areaId, ids, graph);
      const cardTemplateIds: string[] = []; let incomplete = false;
      for (const id of new Set(ids)) {
        const mapping = resolveEffectiveMapping(framework, id, graph);
        if (mapping.state === "mapped" && mapping.itemId === itemId) cardTemplateIds.push(id);
        if (mapping.state === "incomplete" && mapping.issues.some((issue) => issue.code !== "MAPPING_CONFLICT" || !issue.itemIds?.length || issue.itemIds.includes(itemId))) incomplete = true;
      }
      return { cardTemplateIds, incomplete };
    };
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
    // Progress offers each Deck in its personal membership context when present.
    // Exclude by identity before relevance/diagnostics/counts, even if its adopted
    // composition is unavailable or differs from the current public composition.
    // The ordinary Library reader remains independent of personal membership.
    const membershipIds = new Set(memberships.map(({ deckTemplateId }) => deckTemplateId));
    const publicEntries = (await publishedLibraryEntries(repo, actor, session))
      .filter((entry) => !membershipIds.has(entry.deckTemplateId));
    const publicCardIds = publicEntries.flatMap((entry) => entry.availability === "available" ? entry.manifest.cards.map((card) => card.cardTemplateId) : []);
    const graph = await readCanonicalAncestry(repo, [framework], [...ids, ...publicCardIds], session);
    const configurationIssues = validateFrameworkAncestry(framework, graph).filter((issue) => !itemId || !issue.itemIds?.length || issue.itemIds.includes(itemId));
    if (configurationIssues.length) {
      for (const target of [result.myDecks, result.archived, result.library]) { target.state = "incomplete"; target.count = null;
        target.issues.push(...configurationIssues.map(({ code }) => ({ code }))); }
      if (item) { item.state = "incomplete"; item.count = null; item.issues = result.library.issues; }
      return finish();
    }
    for (const entry of publicEntries) {
      if (entry.availability !== "available") {
        result.library.issues.push({ code: "PUBLIC_CONTENT_UNAVAILABLE", deckTemplateId: entry.deckTemplateId });
        continue;
      }
      const matching = matchingCards(entry.manifest.cards.map((card) => card.cardTemplateId), graph);
      if (matching.incomplete) {
        result.library.issues.push({ code: "UNRESOLVED_CARD_MAPPING", deckTemplateId: entry.deckTemplateId });
        continue;
      }
      if (matching.cardTemplateIds.length) result.library.entries.push({ kind: "library", deckTemplateId: entry.deckTemplateId,
        matchingCardCount: matching.cardTemplateIds.length, manifest: entry.manifest, front: deckFrontPresentation(entry.deck) });
    }
    result.library.entries = rankAreaDecks(result.library.entries);
    result.library.count = result.library.issues.length ? null : result.library.entries.length;
    result.library.state = result.library.issues.length ? "incomplete" : result.library.entries.length ? "complete" : "empty";
    const cardRoots = await batches<CardTemplateRoot>(repo.cards(), ids.map((cardTemplateId) => ({ cardTemplateId })), session,
      { _id: 0, cardTemplateId: 1, ownerUserId: 1, visibility: 1, forkedFrom: 1 });
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
      const matching = matchingCards(eligible.cardTemplateIds, graph);
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
    if (item) {
      const creators = await cardCreatorAttributions(repo, cardRoots, session);
      const cards = new Map<string, ItemCardDestination>();
      const attach = (presentation: CanonicalCardPresentation, context: ItemDeckContext) => {
        const id = presentation.cardTemplateId, existing = cards.get(id);
        if (existing) existing.contexts.push(context);
        else cards.set(id, { cardTemplateId: id, presentation, presentationContext: context.kind, versionsDiffer: false, contexts: [context] });
      };
      // Active contexts precede archived and public contexts. Shared CardData pins
      // the same personal Card version independently of every adopted Deck version.
      for (const entry of [...result.myDecks.entries, ...result.archived.entries]) {
        if (entry.availability !== "available") continue;
        const deck = versions.find((version) => version.deckTemplateId === entry.deckTemplateId && version.version === entry.adoptedDeckVersion)!;
        for (const ref of layoutCardLabels(deck.content.labelPrefix, deck.content.cards)) {
          const mapping = resolveEffectiveMapping(framework, ref.cardTemplateId, graph);
          if (mapping.state !== "mapped" || mapping.itemId !== itemId) continue;
          const adopted = personal.find((record) => record.cardTemplateId === ref.cardTemplateId);
          const version = cardVersions.find((version) => version.cardTemplateId === ref.cardTemplateId && version.version === adopted?.cardTemplateVersion)!;
          attach(cardContentPresentation(version, ref.label, creators.get(ref.cardTemplateId)!), { ...entry, cardVersion: version.version });
        }
      }
      for (const entry of result.library.entries) {
        const published = publicEntries.find((candidate) => candidate.deckTemplateId === entry.deckTemplateId)!;
        if (published.availability !== "available") continue;
        for (const card of published.deck.cards) {
          const mapping = resolveEffectiveMapping(framework, card.cardTemplateId, graph);
          if (mapping.state === "mapped" && mapping.itemId === itemId) attach(card, { ...entry, cardVersion: card.version });
        }
      }
      item.cards = [...cards.values()].map((card) => ({ ...card, versionsDiffer: new Set(card.contexts.map((context) => context.cardVersion)).size > 1 }));
      item.issues = [...result.myDecks.issues, ...result.archived.issues, ...result.library.issues];
      item.state = item.issues.length ? "incomplete" : item.cards.length ? "complete" : "empty";
      item.count = item.issues.length ? null : item.cards.length;
    }
    return finish();
  });
}
