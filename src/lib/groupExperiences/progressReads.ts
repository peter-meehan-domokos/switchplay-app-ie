import { createHash } from "node:crypto";
import type { ClientSession } from "mongodb";
import { CardArchitectureError, requireCondition } from "../cards/domain";
import { projectLearning, type LearningFields } from "../cards/learning";
import { getFrameworks, type Framework } from "../frameworks/configuration";
import type { ProgressCoverage } from "../frameworks/scope";
import { groupProgressContext, progressItem, type GroupProgressContext, type ProgressPerspective } from "./progressContext";
import { personalLearningForUsers } from "./learningReads";
import { scopedMetrics, scopedCohortMetrics, type ProgressLearning } from "./progressMetrics";
import { groupAssessmentHistoryReader } from "./assessments";
import { personalProgressHistoryReader, scopeHistory, compactScopedHistory } from "./progressAssessments";
import type { GroupExperienceRepository } from "./repository";

async function playerLearning(repo: GroupExperienceRepository, users: string[], context: GroupProgressContext, ids: readonly string[], session: ClientSession) {
  try {
    const learning = await personalLearningForUsers(repo.cards, users, context.cards.filter(card => ids.includes(card.cardTemplateId)), session);
    return users.map(userId => ({ cards: new Map(learning.get(userId)!.map(card => [card.cardTemplateId, card])), issues: [] }) satisfies ProgressLearning);
  } catch (error) {
    if (!(error instanceof CardArchitectureError)) throw error;
    // The strict scalar reader remains unchanged. On corrupt input only, isolate
    // failed person/Card projections rather than poisoning unrelated Items or
    // silently dropping that person's observations from the cohort denominator.
    const result: ProgressLearning[] = [];
    const selected = context.cards.filter(card => ids.includes(card.cardTemplateId));
    for (const userId of users) {
      const cards: Map<string, LearningFields> = new Map();
      try {
        const values = await personalLearningForUsers(repo.cards, [userId], selected, session);
        for (const value of values.get(userId)!) cards.set(value.cardTemplateId, value);
      } catch (failure) {
        if (!(failure instanceof CardArchitectureError)) throw failure;
        for (const card of selected) {
          try {
            const values = await personalLearningForUsers(repo.cards, [userId], [card], session);
            const value = values.get(userId)![0]; cards.set(value.cardTemplateId, value);
          } catch (invalid) { if (!(invalid instanceof CardArchitectureError)) throw invalid; }
        }
      }
      result.push({ cards, issues: [] });
    }
    return result;
  }
}
async function groupLearning(repo: GroupExperienceRepository, context: GroupProgressContext, ids: readonly string[], session: ClientSession): Promise<ProgressLearning> {
  const rows = [];
  for (let start = 0; start < ids.length; start += 100) rows.push(...await repo.cardData().find({ experienceId: context.experience.experienceId,
    cardTemplateId: { $in: ids.slice(start, start + 100) } }, { session, projection: { _id: 0, cardTemplateId: 1, items: 1, signalReadings: 1 } }).toArray());
  const cards = new Map<string, LearningFields>();
  for (const card of context.cards.filter(card => ids.includes(card.cardTemplateId))) {
    const matches = rows.filter(row => row.cardTemplateId === card.cardTemplateId);
    try { requireCondition(matches.length <= 1, "AMBIGUOUS_GROUP_CARD_STATE"); cards.set(card.cardTemplateId, projectLearning(card.content, matches[0] ?? { items: [], signalReadings: [] })); }
    catch (error) { if (!(error instanceof CardArchitectureError)) throw error; /* Missing map entry explicitly marks affected scopes incomplete. */ }
  }
  return { cards, issues: [] };
}
async function historyReader(repo: GroupExperienceRepository, context: GroupProgressContext, ids: readonly string[], itemIds: readonly string[], session: ClientSession) {
  return context.perspective.kind === "group"
    ? groupAssessmentHistoryReader(repo, context.member.userId, context.experience, context.member, context.cards.filter(card => ids.includes(card.cardTemplateId)), session)
    : personalProgressHistoryReader(repo, context, session, ids, itemIds);
}
function metadata(context: GroupProgressContext, activeFollowerCount: number) {
  return { ...context.authority, owner: context.perspective.kind === "group" ? { kind: "group" as const, experienceId: context.experience.experienceId }
    : { kind: "personal" as const, userId: context.perspective.userId }, group: { name: context.experience.name, activeFollowerCount,
      deckTemplateId: context.experience.deckTemplateId, deckVersion: context.experience.deckVersion }, capabilities: context.capabilities,
    selectedCards: context.scope.cards, canCreateAssessments: context.perspective.kind === "group" ? context.capabilities.canManageGroupAssessments : context.perspective.userId === context.member.userId };
}
function revisionToken(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export async function readGroupProgressSummary(repo: GroupExperienceRepository, actor: string, experienceId: string, frameworkId: string,
  perspective: ProgressPerspective = { kind: "group" }, frameworks: readonly Framework[] = getFrameworks()) {
  return repo.transaction(async session => {
    const context = await groupProgressContext(repo, actor, experienceId, frameworkId, perspective, session, frameworks);
    const ids = [...new Set(context.scope.areas.flatMap(area => area.cardTemplateIds))];
    const items = context.scope.areas.flatMap(area => area.items).filter(item => item.coverage === "inside");
    const activeFollowerCount = await repo.members().countDocuments({ experienceId, followerStatus: "active" }, { session });
    let people: ProgressLearning[] = [], owned: ProgressLearning = { cards: new Map(), issues: [] };
    if (perspective.kind === "group") {
      const followers = await repo.members().find({ experienceId, followerStatus: "active" }, { session, projection: { _id: 0, userId: 1 } }).toArray();
      people = await playerLearning(repo, followers.map(member => member.userId), context, ids, session);
      owned = await groupLearning(repo, context, ids, session);
    } else owned = (await playerLearning(repo, [perspective.userId], context, ids, session))[0];
    // One reader loads the one owner's required sources in batches. Group mode
    // never loads personal assessment histories for its follower cohort.
    const histories = await historyReader(repo, context, ids, items.map(item => item.frameworkItemId), session);
    const metrics = (cards: string[], coverage: ProgressCoverage) => perspective.kind === "group"
      ? { groupScores: scopedMetrics(cards, coverage, owned), playerAverages: scopedCohortMetrics(cards, coverage, people, context.capabilities.canViewConfidenceExtrema) }
      : { player: scopedMetrics(cards, coverage, owned) };
    const areas = [];
    for (const area of context.scope.areas) {
      const definition = context.framework.areas.find(value => value.id === area.areaId)!;
      const rows = [];
      for (const item of area.items) {
        const history = item.coverage === "inside" ? scopeHistory(await histories(item.cardTemplateIds, item.frameworkItemId), context) : null;
        rows.push({ ...item, title: definition.items.find(value => value.id === item.frameworkItemId)!.title,
          ...metrics(item.cardTemplateIds, item.coverage), assessments: history ? compactScopedHistory(history) : null,
          assessmentRevision: history ? revisionToken(history.sources) : null });
      }
      areas.push({ areaId: area.areaId, title: definition.title, coverage: area.coverage, cardTemplateIds: area.cardTemplateIds, ...metrics(area.cardTemplateIds, area.coverage), items: rows });
    }
    const coverage: ProgressCoverage = context.scope.areas.some(area => area.coverage === "unknown") ? "unknown" : ids.length ? "inside" : "outside";
    const framework = { frameworkId, title: context.framework.title, coverage, ...metrics(ids, coverage), areas };
    return { ...metadata(context, activeFollowerCount), framework, issues: context.scope.issues.map(issue => ({ code: issue.code })), revisionToken: revisionToken(framework) };
  });
}
export async function readScopedAssessmentHistory(repo: GroupExperienceRepository, actor: string, experienceId: string, frameworkId: string,
  perspective: ProgressPerspective, target: { frameworkItemId: string } | { cardTemplateId: string }, frameworks: readonly Framework[] = getFrameworks()) {
  return repo.transaction(async session => {
    const context = await groupProgressContext(repo, actor, experienceId, frameworkId, perspective, session, frameworks);
    requireCondition(!context.scope.areas.some(area => area.coverage === "unknown"), "GROUP_PROGRESS_SCOPE_UNAVAILABLE");
    const item = "frameworkItemId" in target ? progressItem(context, target.frameworkItemId) : context.scope.areas.flatMap(area => area.items).find(value => value.cardTemplateIds.includes(target.cardTemplateId));
    requireCondition(item, "GROUP_PROGRESS_SOURCE_FORBIDDEN");
    requireCondition(item.coverage !== "unknown", "GROUP_PROGRESS_SCOPE_UNAVAILABLE");
    requireCondition(item.coverage === "inside", "GROUP_PROGRESS_SOURCE_FORBIDDEN");
    const ids = "cardTemplateId" in target ? [target.cardTemplateId] : item.cardTemplateIds;
    const reader = await historyReader(repo, context, ids, "frameworkItemId" in target ? [target.frameworkItemId] : [], session);
    const history = scopeHistory(await reader(ids, "frameworkItemId" in target ? target.frameworkItemId : undefined), context);
    const count = await repo.members().countDocuments({ experienceId, followerStatus: "active" }, { session });
    return { ...metadata(context, count), target, history, revisionToken: revisionToken(history) };
  });
}
export type GroupProgressSummary = Awaited<ReturnType<typeof readGroupProgressSummary>>;
export type ScopedProgressAssessmentHistory = Awaited<ReturnType<typeof readScopedAssessmentHistory>>;
