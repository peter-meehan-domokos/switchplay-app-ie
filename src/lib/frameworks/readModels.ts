import type { ClientSession, Collection, Document, Filter } from "mongodb";
import { CardArchitectureError, isRecord, nonblank, requireCondition } from "../cards/domain";
import type { CardData, CardTemplateRoot, CardTemplateVersion, DeckData, DeckTemplateRoot, DeckTemplateVersion, PersonalUser } from "../cards/model";
import type { CardRepository } from "../cards/repository";
import { assertCardVersionAccess } from "../cards/versionAccess";
import { assertAssessmentId } from "../assessments/contracts";
import { collectCardHistory, compactAssessmentHistory, projectAssessmentHistory, unavailableCardTitle, type HistoryIssue, type SourceTitle } from "../assessments/history";
import { assertFrameworkConfiguration, getFrameworks, type Framework } from "./configuration";
import { collectPersonalEligibility, type PersonalEligibility } from "./eligibility";
import { calculateMappedProgress, resolveAdoptedCardCalculation } from "./calculations";
import { resolveEffectiveMapping, validateFrameworkAncestry, type CanonicalAncestry } from "./mapping";
import { readCanonicalAncestry } from "./mappingRepository";

export function frameworkMetadata(frameworks: readonly Framework[] = getFrameworks()) {
  assertFrameworkConfiguration(frameworks);
  return frameworks.map(({ id, title, areas }) => ({ id, title,
    areas: areas.map(({ id, title, items }) => ({ id, title, items: items.map(({ id, title }) => ({ id, title })) })) }));
}

// All queries share one snapshot. Queries within a Mongo transaction remain
// sequential, with bounded batches rather than one database call per Card.
async function batches<T extends Document>(collection: Collection<T>, clauses: Document[], session: ClientSession, projection?: Document) {
  const results: T[] = [];
  const distinct = [...new Map(clauses.map((clause) => [JSON.stringify(clause), clause])).values()];
  for (let offset = 0; offset < distinct.length; offset += 100) {
    results.push(...await collection.find({ $or: distinct.slice(offset, offset + 100) } as Filter<T>, { session, projection }).toArray() as T[]);
  }
  return results;
}
async function personalUser(repo: CardRepository, actor: string, session: ClientSession) {
  const user = await repo.getPersonalUser(actor, session);
  requireCondition(user && Array.isArray(user.cardsData) && Array.isArray(user.decksData), "PERSONAL_DATA_CONTEXT_REQUIRED");
  // A malformed anonymous entry cannot satisfy a required identity. Referenced
  // Cards still resolve as missing/incomplete, without breaking unrelated Items.
  return { ...user, cardsData: user.cardsData.filter((data) => isRecord(data) && nonblank(data.cardTemplateId)) };
}
async function adoptedCards(repo: CardRepository, user: PersonalUser, ids: readonly string[], session: ClientSession, titlesOnly = false) {
  const distinct = [...new Set(ids)];
  const roots = await batches<CardTemplateRoot>(repo.cards(), distinct.map((cardTemplateId) => ({ cardTemplateId })), session,
    { _id: 0, cardTemplateId: 1, ownerUserId: 1, visibility: 1 });
  const selected = new Set(distinct);
  const clauses = user.cardsData.filter((data) => selected.has(data.cardTemplateId) && Number.isInteger(data.cardTemplateVersion) && data.cardTemplateVersion > 0)
    .map((data) => ({ cardTemplateId: data.cardTemplateId, version: data.cardTemplateVersion }));
  const versions = await batches<CardTemplateVersion>(repo.cardVersions(), clauses, session, titlesOnly
    ? { _id: 0, cardTemplateId: 1, version: 1, visibility: 1, "content.intro.title": 1 } : { _id: 0 });
  return { roots, versions };
}
async function eligibility(repo: CardRepository, actor: string, user: PersonalUser, session: ClientSession): Promise<PersonalEligibility> {
  const valid = user.decksData.filter((data) => isRecord(data) && nonblank(data.deckTemplateId));
  const roots = await batches<DeckTemplateRoot>(repo.decks(), valid.map(({ deckTemplateId }) => ({ deckTemplateId })), session,
    { _id: 0, deckTemplateId: 1, ownerUserId: 1, visibility: 1 });
  const versions = await batches<DeckTemplateVersion>(repo.deckVersions(), valid.filter((data) => Number.isInteger(data.deckTemplateVersion) && data.deckTemplateVersion > 0)
    .map((data) => ({ deckTemplateId: data.deckTemplateId, version: data.deckTemplateVersion })), session, { _id: 0 });
  const result = collectPersonalEligibility(actor, valid as DeckData[], roots, versions);
  if (valid.length !== user.decksData.length) { result.issues.push({ code: "INVALID_DECK_MEMBERSHIP" }); result.unknownComposition = true; }
  return result;
}

type HistorySelection = { cardIds: string[]; issues: HistoryIssue[] };
function selectItemHistory(framework: Framework, itemId: string, graph: CanonicalAncestry, eligible: PersonalEligibility): HistorySelection {
  const configurationIssues = validateFrameworkAncestry(framework, graph);
  const issues: HistoryIssue[] = configurationIssues.map((issue) => ({ code: issue.code, frameworkId: framework.id, itemId }));
  const item = framework.areas.flatMap((area) => area.items).find((item) => item.id === itemId)!;
  if (!item.cardTemplateIds.length) return { cardIds: [], issues };
  issues.push(...eligible.issues.map((issue) => ({ code: issue.code, frameworkId: framework.id, itemId })));
  const cardIds: string[] = [];
  for (const id of eligible.cardTemplateIds) {
    const mapping = resolveEffectiveMapping(framework, id, graph);
    if (mapping.state === "incomplete") issues.push(...mapping.issues.map((issue) => ({ code: issue.code, frameworkId: framework.id, itemId, cardTemplateId: id })));
    else if (mapping.state === "mapped" && mapping.itemId === itemId) cardIds.push(id);
  }
  return { cardIds, issues };
}
async function sourceTitles(repo: CardRepository, actor: string, user: PersonalUser, histories: readonly ReturnType<typeof collectCardHistory>[], session: ClientSession) {
  const ids = [...new Set(histories.flatMap((history) => history.segments.map((segment) => segment.cardTemplateId)))];
  const { roots, versions } = await adoptedCards(repo, user, ids, session, true);
  const titles = new Map<string, SourceTitle>();
  for (const id of ids) {
    const data = user.cardsData.filter((data) => data.cardTemplateId === id), foundRoots = roots.filter((root) => root.cardTemplateId === id);
    const foundVersions = versions.filter((version) => version.cardTemplateId === id && version.version === data[0]?.cardTemplateVersion);
    let title = unavailableCardTitle;
    if (data.length === 1 && foundRoots.length === 1 && foundVersions.length === 1) {
      try {
        assertCardVersionAccess(actor, foundRoots[0], foundVersions[0]);
        const content = foundVersions[0].content;
        if (isRecord(content) && isRecord(content.intro) && (typeof content.intro.title === "string" || content.intro.title === null)) title = nonblank(content.intro.title)
          ? { title: content.intro.title, availability: "available" } : { title: "Untitled Card", availability: "untitled" };
      } catch (error) { if (!(error instanceof CardArchitectureError)) throw error; }
    }
    titles.set(id, title);
  }
  return titles;
}

export async function readFrameworkSummaries(repo: CardRepository, actor: string, frameworks: readonly Framework[] = getFrameworks()) {
  assertFrameworkConfiguration(frameworks);
  return repo.transaction(async (session) => {
    const user = await personalUser(repo, actor, session);
    if (!frameworks.length) return { viewerUserId: actor, frameworks: [] };
    const eligible = await eligibility(repo, actor, user, session);
    const graph = await readCanonicalAncestry(repo, frameworks, eligible.cardTemplateIds, session);
    const { roots, versions } = await adoptedCards(repo, user, eligible.cardTemplateIds, session);
    const calculations = new Map(eligible.cardTemplateIds.map((id) => [id, resolveAdoptedCardCalculation(actor, id, roots, versions, user.cardsData)]));
    const selections = new Map<string, HistorySelection>(), histories = new Map<string, ReturnType<typeof collectCardHistory>>();
    for (const framework of frameworks) for (const area of framework.areas) for (const item of area.items) {
      const selection = selectItemHistory(framework, item.id, graph, eligible); selections.set(item.id, selection);
      for (const id of selection.cardIds) if (!histories.has(id)) histories.set(id, collectCardHistory(user.cardsData, id));
    }
    const titles = await sourceTitles(repo, actor, user, [...histories.values()], session);
    return { viewerUserId: actor, frameworks: frameworks.map((framework) => ({ id: framework.id, title: framework.title,
      areas: framework.areas.map((area) => ({ id: area.id, title: area.title,
        progress: calculateMappedProgress(framework, { areaId: area.id }, graph, eligible, calculations),
        items: area.items.map((item) => {
          const selection = selections.get(item.id)!;
          const history = projectAssessmentHistory(user, selection.cardIds.map((id) => histories.get(id)!), titles,
            { itemId: item.id, ownCardIds: selection.cardIds, issues: selection.issues });
          return { id: item.id, title: item.title, progress: calculateMappedProgress(framework, { itemId: item.id }, graph, eligible, calculations),
            assessments: compactAssessmentHistory(history) };
        }) })) })) };
  });
}
export async function readFrameworkSummary(repo: CardRepository, actor: string, frameworkId: string, frameworks: readonly Framework[] = getFrameworks()) {
  assertAssessmentId(frameworkId);
  assertFrameworkConfiguration(frameworks);
  const framework = frameworks.find((framework) => framework.id === frameworkId);
  requireCondition(framework, "FRAMEWORK_CONTEXT_FORBIDDEN");
  const result = await readFrameworkSummaries(repo, actor, [framework]);
  return { viewerUserId: actor, framework: result.frameworks[0] };
}
export async function readItemAssessmentHistory(repo: CardRepository, actor: string, itemId: string, frameworks: readonly Framework[] = getFrameworks()) {
  assertAssessmentId(itemId); assertFrameworkConfiguration(frameworks);
  const framework = frameworks.find((framework) => framework.areas.some((area) => area.items.some((item) => item.id === itemId)));
  return repo.transaction(async (session) => {
    const user = await personalUser(repo, actor, session);
    requireCondition(framework || Array.isArray(user.itemTests) && user.itemTests.some((test) => isRecord(test) && test.itemId === itemId), "ITEM_CONTEXT_FORBIDDEN");
    let selection: HistorySelection = { cardIds: [], issues: [] };
    if (framework) {
      const eligible = await eligibility(repo, actor, user, session);
      const graph = await readCanonicalAncestry(repo, [framework], eligible.cardTemplateIds, session);
      selection = selectItemHistory(framework, itemId, graph, eligible);
    }
    const histories = selection.cardIds.map((id) => collectCardHistory(user.cardsData, id));
    const titles = await sourceTitles(repo, actor, user, histories, session);
    return { viewerUserId: actor, itemId, configured: !!framework,
      history: projectAssessmentHistory(user, histories, titles, { itemId, ownCardIds: selection.cardIds, issues: selection.issues }) };
  });
}
export async function readCardAssessmentHistory(repo: CardRepository, actor: string, cardTemplateId: string) {
  assertAssessmentId(cardTemplateId);
  return repo.transaction(async (session) => {
    const user = await personalUser(repo, actor, session);
    requireCondition(user.cardsData.filter((data: CardData) => data.cardTemplateId === cardTemplateId).length === 1, "CARD_CONTEXT_FORBIDDEN");
    const history = collectCardHistory(user.cardsData, cardTemplateId);
    const titles = await sourceTitles(repo, actor, user, [history], session);
    return { viewerUserId: actor, cardTemplateId,
      history: projectAssessmentHistory(user, [history], titles, { ownCardIds: [cardTemplateId] }) };
  });
}
