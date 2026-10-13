import { CardArchitectureError, isRecord } from "../cards/domain";
import { personalHistorySegments, type PersonalHistoryIssue } from "../cards/forks";
import { readablePersonalHistory } from "../cards/personalHistory";
import type { CardData, PersonalUser } from "../cards/model";
import { assessmentRevision, type AssessmentResult, type AssessmentSource } from "./contracts";
import { assertStoredAssessmentTests } from "./repository";

export type SourceTitle = { title: string; availability: "available" | "untitled" | "unavailable" };
export const unavailableCardTitle: SourceTitle = { title: "Card title unavailable", availability: "unavailable" };
export type HistoryIssue = { code: string; cardTemplateId?: string; itemId?: string; frameworkId?: string };
// canMutate describes retained-result edits/deletions only. New Card results
// still require the separate active working context enforced by Checkpoint 2.
export type AssessmentDependency = { source: AssessmentSource; revision: number | null; canMutate: boolean };
export type HistoryResult = AssessmentResult & {
  source: AssessmentSource;
  sourceRevision: number | null;
  canMutate: boolean;
  relationship: "direct-item" | "own-card" | "inherited-card";
  sourceTitle: string;
  titleAvailability: SourceTitle["availability"] | "not-applicable";
  exposedThroughCardTemplateIds: string[];
};
export type AssessmentHistory = {
  state: "complete" | "empty" | "incomplete";
  count: number | null;
  readableCount: number;
  results: HistoryResult[];
  latestThree: HistoryResult[];
  sources: AssessmentDependency[];
  issues: HistoryIssue[];
};
export type CompactAssessmentHistory = Pick<AssessmentHistory, "state" | "count" | "readableCount" | "latestThree" | "issues">;
export function assessmentSourceKey(source: AssessmentSource) {
  return JSON.stringify(source.kind === "card" ? ["card", source.cardTemplateId] : ["item", source.itemId]);
}
export function originatingAssessmentKey(result: Pick<HistoryResult, "source" | "id">) { return JSON.stringify([assessmentSourceKey(result.source), result.id]); }
export function orderHistoryResults(results: readonly HistoryResult[]) {
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return [...results].sort((a, b) => compare(b.date, a.date) || compare(b.createdAt, a.createdAt)
    || compare(originatingAssessmentKey(a), originatingAssessmentKey(b)));
}
export function compactAssessmentHistory(history: AssessmentHistory): CompactAssessmentHistory {
  const { state, count, readableCount, issues } = history;
  // Progress shows the latest readable events with an incomplete-history warning.
  // Full-history latestThree retains its certainty contract for Card controls.
  return { state, count, readableCount, latestThree: history.results.slice(0, 3).reverse(), issues };
}
type CardHistoryInput = { cardTemplateId: string; segments: ReturnType<typeof personalHistorySegments>; issues: PersonalHistoryIssue[] };
export function collectCardHistory(records: CardData[], cardTemplateId: string): CardHistoryInput {
  const issues: PersonalHistoryIssue[] = [];
  if (!records.some((data) => data.cardTemplateId === cardTemplateId)) return {
    cardTemplateId, segments: [], issues: [{ code: "MISSING_PERSONAL_HISTORY_SOURCE", cardTemplateId }] };
  return { cardTemplateId, segments: personalHistorySegments(records, cardTemplateId, issues), issues };
}
// The existing walker is the only personal ancestry traversal. Inputs are always
// the authenticated actor's own records; canonical ancestry is never consulted.
export function projectAssessmentHistory(user: PersonalUser, histories: readonly CardHistoryInput[], titles: ReadonlyMap<string, SourceTitle>,
  options: { itemId?: string; ownCardIds: readonly string[]; issues?: readonly HistoryIssue[] }): AssessmentHistory {
  const issues = [...(options.issues ?? []), ...histories.flatMap((history) => history.issues)];
  const dependencies = new Map<string, AssessmentDependency>(), events = new Map<string, HistoryResult>();
  const ownIds = new Set(options.ownCardIds);
  const sourceState = (source: AssessmentSource, tests: unknown, revisionValue: unknown, item = false) => {
    let revision: number | null = null, canMutate = true;
    try { revision = assessmentRevision(revisionValue); assertStoredAssessmentTests(tests, item); }
    catch (error) {
      if (!(error instanceof CardArchitectureError)) throw error;
      canMutate = false; issues.push({ code: error.code, ...(source.kind === "card" ? { cardTemplateId: source.cardTemplateId } : { itemId: source.itemId }) });
    }
    const dependency = { source, revision, canMutate }; dependencies.set(assessmentSourceKey(source), dependency); return dependency;
  };
  const add = (test: AssessmentResult, dependency: AssessmentDependency, exposedThroughCardTemplateId?: string) => {
    const { source, revision, canMutate } = dependency;
    const direct = source.kind === "item", title = direct ? null : titles.get(source.cardTemplateId) ?? unavailableCardTitle;
    const row: HistoryResult = { ...test, source, sourceRevision: revision, canMutate,
      relationship: direct ? "direct-item" : ownIds.has(source.cardTemplateId) ? "own-card" : "inherited-card",
      sourceTitle: direct ? "Item test" : title!.title, titleAvailability: direct ? "not-applicable" : title!.availability,
      exposedThroughCardTemplateIds: exposedThroughCardTemplateId ? [exposedThroughCardTemplateId] : [] };
    const key = originatingAssessmentKey(row), existing = events.get(key);
    if (existing && exposedThroughCardTemplateId) existing.exposedThroughCardTemplateIds = [...new Set([...existing.exposedThroughCardTemplateIds, exposedThroughCardTemplateId])].sort();
    else if (!existing) events.set(key, row);
  };
  if (options.itemId !== undefined) {
    const tests = user.itemTests === undefined ? [] : user.itemTests;
    const dependency = sourceState({ kind: "item", itemId: options.itemId }, tests, user.itemTestsRevision, true);
    // Keep readable results when another malformed event makes the list incomplete.
    const selected = Array.isArray(tests) ? tests.filter((test) => isRecord(test) && test.itemId === options.itemId) : [];
    const readable = readablePersonalHistory({ tests: selected } as unknown as CardData).tests;
    readable.forEach((test) => add({ ...test, createdAt: test.createdAt.toISOString() }, dependency));
  }
  for (const history of histories) {
    for (const segment of history.segments) {
      const source: AssessmentSource = { kind: "card", cardTemplateId: segment.cardTemplateId };
      let dependency = dependencies.get(assessmentSourceKey(source));
      if (!dependency) {
        const data = user.cardsData.find((data) => data.cardTemplateId === segment.cardTemplateId)!;
        dependency = sourceState(source, data.tests, data.testsRevision);
      }
      segment.tests.forEach((test) => add({ ...test, createdAt: test.createdAt.toISOString() }, dependency!, history.cardTemplateId));
    }
    // Include unreadable/missing sources as refresh dependencies too: a later
    // repair or creation must not leave an apparently complete cached history.
    for (const issue of history.issues) {
      const source: AssessmentSource = { kind: "card", cardTemplateId: issue.cardTemplateId };
      if (!dependencies.has(assessmentSourceKey(source))) dependencies.set(assessmentSourceKey(source), { source, revision: null, canMutate: false });
    }
  }
  const results = orderHistoryResults([...events.values()]);
  const uniqueIssues = [...new Map(issues.map((issue) => [JSON.stringify(issue), issue])).values()];
  const state = uniqueIssues.length ? "incomplete" : results.length ? "complete" : "empty";
  return { state, count: state === "incomplete" ? null : results.length, readableCount: results.length, results,
    latestThree: state === "incomplete" ? [] : results.slice(0, 3).reverse(),
    sources: [...dependencies.values()].sort((a, b) => assessmentSourceKey(a.source).localeCompare(assessmentSourceKey(b.source))), issues: uniqueIssues };
}
