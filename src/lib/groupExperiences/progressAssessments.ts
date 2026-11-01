import { createHash } from "node:crypto";
import type { ClientSession } from "mongodb";
import { CardArchitectureError, requireCondition } from "../cards/domain";
import type { CardData } from "../cards/model";
import { readablePersonalHistory } from "../cards/personalHistory";
import { resolveAssessmentEvidence } from "../frameworks/scope";
import { assessmentRevision, type AssessmentSource } from "../assessments/contracts";
import { assertStoredAssessmentTests } from "../assessments/repository";
import { orderHistoryResults, type AssessmentHistory, type HistoryResult } from "../assessments/history";
import { authorisedAssessmentOriginNames } from "../assessments/provenanceReads";
import { projectAssessmentOrigin } from "../assessments/provenance";
import { personalLearningForUsers, userKey } from "./learningReads";
import type { GroupExperienceRepository } from "./repository";
import type { GroupProgressContext } from "./progressContext";

export type ScopedHistoryResult = Omit<HistoryResult, "source" | "provenance"> & { source: AssessmentSource | null; rowKey: string };
export type ScopedAssessmentHistory = Omit<AssessmentHistory, "results" | "latestThree" | "sources"> & {
  results: ScopedHistoryResult[]; latestThree: ScopedHistoryResult[];
  sources: { key: string; source: AssessmentSource | null; revision: number | null; canMutate: boolean }[];
};
export function scopeHistory(history: AssessmentHistory, context: GroupProgressContext): ScopedAssessmentHistory {
  const personal = context.perspective.kind === "player", self = context.perspective.kind === "player" && context.perspective.userId === context.member.userId;
  const current = new Set(context.scope.cards.map(card => card.cardTemplateId));
  const key = (source: AssessmentSource, id = "") => createHash("sha256").update(JSON.stringify([
    context.experience.experienceId, context.perspective, source, id,
  ])).digest("hex");
  const visible = (source: AssessmentSource) => !personal || self || source.kind === "item" || current.has(source.cardTemplateId);
  const project = (row: HistoryResult): ScopedHistoryResult => {
    const allowed = visible(row.source), safe = projectAssessmentOrigin(row);
    // Histories supplied here already have independently authorised origin labels.
    // Never fall back to raw provenance to name an inaccessible source or Group.
    return { id: row.id, date: row.date, result: row.result, createdAt: row.createdAt,
      origin: row.origin ?? safe.origin, source: allowed ? row.source : null, rowKey: key(row.source, row.id),
      sourceRevision: row.sourceRevision, canMutate: row.canMutate && (!personal || self), relationship: row.relationship,
      sourceTitle: allowed ? row.sourceTitle : "Card title unavailable", titleAvailability: allowed ? row.titleAvailability : "unavailable",
      exposedThroughCardTemplateIds: row.exposedThroughCardTemplateIds.filter(id => current.has(id)) };
  };
  const results = history.results.map(project);
  return { state: history.state, count: history.count, readableCount: history.readableCount, results,
    latestThree: history.latestThree.map(project),
    sources: history.sources.map(dependency => ({ key: key(dependency.source), source: visible(dependency.source) ? dependency.source : null,
      revision: dependency.revision, canMutate: dependency.canMutate && (!personal || self) })),
    issues: history.issues.map(issue => ({ code: issue.code })) };
}
export function compactScopedHistory(history: ScopedAssessmentHistory) {
  return { state: history.state, count: history.count, readableCount: history.readableCount,
    latestThree: history.results.slice(0, 3).reverse(), issues: history.issues };
}

// The database boundary is deliberately separate from scalar learning and full
// owner CardData readers. Even malformed embedded events cannot pull media,
// private comments, scheduling or arbitrary provenance fields into Node memory.
const eventFields = (variable: string) => ({ id: `${variable}.id`, date: `${variable}.date`, result: `${variable}.result`, createdAt: `${variable}.createdAt`,
  provenance: { $cond: [{ $eq: [{ $type: `${variable}.provenance` }, "missing"] }, "$$REMOVE", {
    enteredByUserId: `${variable}.provenance.enteredByUserId`, entryMethod: `${variable}.provenance.entryMethod`,
    groupExperienceId: `${variable}.provenance.groupExperienceId`, deckTemplateId: `${variable}.provenance.deckTemplateId`,
  }] } });
type CardEvidence = { cardTemplateId: string; historySourceCardTemplateId?: string; tests: CardData["tests"]; testsRevision?: number; validTests: boolean };

export async function personalProgressHistoryReader(repo: GroupExperienceRepository, context: GroupProgressContext, session: ClientSession,
  rootIds: readonly string[], itemIds: readonly string[]) {
  requireCondition(context.perspective.kind === "player", "GROUP_PROGRESS_PLAYER_CONTEXT_REQUIRED");
  const subject = context.perspective.userId, rows: CardEvidence[] = [], requested = new Set<string>(), virtual: string[] = [];
  const globalIssues: { code: string }[] = [];
  let pending = [...new Set(rootIds)];
  while (pending.length) {
    const next = new Set<string>();
    for (let offset = 0; offset < pending.length; offset += 100) {
      const ids = pending.slice(offset, offset + 100); ids.forEach(id => requested.add(id));
      const users = await repo.cards.users().aggregate<{ valid: boolean; cards: CardEvidence[] }>([
        { $match: { _id: userKey(subject) } }, { $project: { _id: 0, valid: { $isArray: "$cardsData" }, cards: { $map: {
          input: { $filter: { input: { $cond: [{ $isArray: "$cardsData" }, "$cardsData", []] }, as: "card", cond: { $in: ["$$card.cardTemplateId", { $literal: ids }] } } },
          as: "card", in: { cardTemplateId: "$$card.cardTemplateId", historySourceCardTemplateId: "$$card.historySourceCardTemplateId", testsRevision: "$$card.testsRevision",
            validTests: { $isArray: "$$card.tests" }, tests: { $map: { input: { $cond: [{ $isArray: "$$card.tests" }, "$$card.tests", []] }, as: "test", in: eventFields("$$test") } } },
        } } } },
      ], { session }).toArray();
      if (users.length !== 1 || !users[0].valid) { globalIssues.push({ code: "INVALID_GROUP_ASSESSMENT_DATA" }); continue; }
      rows.push(...users[0].cards);
      for (const id of ids) {
        const matches = users[0].cards.filter(row => row.cardTemplateId === id);
        if (matches.length === 1 && typeof matches[0].historySourceCardTemplateId === "string" && matches[0].historySourceCardTemplateId.trim()) next.add(matches[0].historySourceCardTemplateId);
      }
    }
    pending = [...next].filter(id => !requested.has(id));
  }
  // Only absent current roots may be legitimate unstarted Group-only records.
  // A dangling inherited source never becomes a virtual assignment.
  const missingRoots = rootIds.filter(id => !rows.some(row => row.cardTemplateId === id));
  if (missingRoots.length) {
    try {
      await personalLearningForUsers(repo.cards, [subject], context.cards.filter(card => missingRoots.includes(card.cardTemplateId)), session);
      virtual.push(...missingRoots);
    } catch (error) { if (!(error instanceof CardArchitectureError)) throw error; globalIssues.push({ code: error.code }); }
  }
  const itemRows = itemIds.length ? await repo.cards.users().aggregate<{ valid: boolean; tests: (CardData["tests"][number] & { itemId: string })[]; revision?: number }>([
    { $match: { _id: userKey(subject) } }, { $project: { _id: 0,
      valid: { $or: [{ $eq: [{ $type: "$itemTests" }, "missing"] }, { $isArray: "$itemTests" }] }, revision: "$itemTestsRevision",
      tests: { $map: { input: { $filter: { input: { $cond: [{ $isArray: "$itemTests" }, "$itemTests", []] }, as: "test", cond: { $in: ["$$test.itemId", { $literal: itemIds }] } } },
        as: "test", in: { ...eventFields("$$test"), itemId: "$$test.itemId" } } },
    } },
  ], { session }).toArray() : [];
  const direct = itemRows[0];
  const names = await authorisedAssessmentOriginNames(repo.cards, context.member.userId, [...rows.flatMap(row => row.tests), ...(direct?.tests ?? [])], session);
  return (ids: readonly string[], itemId?: string): AssessmentHistory => {
    const evidence = resolveAssessmentEvidence(ids, rows, virtual), issues: { code: string }[] = [...globalIssues, ...evidence.issues.map(issue => ({ code: issue.code }))];
    const results: HistoryResult[] = [], sources: AssessmentHistory["sources"] = [];
    const append = (source: AssessmentSource, tests: CardData["tests"], revisionValue: unknown, valid: boolean, exposed: string[]) => {
      let revision: number | null = null, readable = true;
      try { requireCondition(valid, "INVALID_STORED_ASSESSMENTS"); revision = assessmentRevision(revisionValue); assertStoredAssessmentTests(tests); }
      catch (error) { if (!(error instanceof CardArchitectureError)) throw error; issues.push({ code: error.code }); readable = false; }
      const canMutate = readable && subject === context.member.userId;
      sources.push({ source, revision, canMutate });
      const title = source.kind === "card" ? context.cards.find(card => card.cardTemplateId === source.cardTemplateId)?.content.intro.title : null;
      for (const test of readablePersonalHistory({ tests } as CardData).tests) results.push({ ...projectAssessmentOrigin({ ...test, createdAt: test.createdAt.toISOString() }, names), source,
        sourceRevision: revision, canMutate, relationship: source.kind === "item" ? "direct-item" : ids.includes(source.cardTemplateId) ? "own-card" : "inherited-card",
        sourceTitle: source.kind === "item" ? "Item test" : title || "Card title unavailable", titleAvailability: source.kind === "item" ? "not-applicable" : title ? "available" : "unavailable",
        exposedThroughCardTemplateIds: exposed });
    };
    for (const dependency of evidence.sources) {
      const row = rows.find(row => row.cardTemplateId === dependency.cardTemplateId)!;
      append({ kind: "card", cardTemplateId: row.cardTemplateId }, row.tests, row.testsRevision, row.validTests, dependency.exposedThroughCardTemplateIds);
    }
    for (const issue of evidence.issues) if (!sources.some(value => value.source.kind === "card" && value.source.cardTemplateId === issue.cardTemplateId)) sources.push({ source: { kind: "card", cardTemplateId: issue.cardTemplateId }, revision: null, canMutate: false });
    if (itemId !== undefined) append({ kind: "item", itemId }, direct?.tests.filter(test => test.itemId === itemId) ?? [], direct?.revision, Boolean(direct?.valid), []);
    const ordered = orderHistoryResults(results), distinctIssues = [...new Map(issues.map(issue => [issue.code, issue])).values()];
    return { state: distinctIssues.length ? "incomplete" : ordered.length ? "complete" : "empty", count: distinctIssues.length ? null : ordered.length,
      readableCount: ordered.length, results: ordered, latestThree: distinctIssues.length ? [] : ordered.slice(0, 3).reverse(), sources, issues: distinctIssues };
  };
}
