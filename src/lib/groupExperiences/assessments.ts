import type { ClientSession } from "mongodb";
import type { CardTest } from "../cards/model";
import { CardArchitectureError, nonblank, requireCondition } from "../cards/domain";
import { AssessmentConflict, assessmentRevision, assessmentTarget, assertAssessmentId, assertAssessmentSource,
  newestAssessmentsFirst, reconcileAssessment, sameAssessmentSource, type AssessmentList, type AssessmentSource } from "../assessments/contracts";
import { assertStoredAssessmentTests } from "../assessments/repository";
import { orderHistoryResults, type AssessmentHistory, type HistoryResult } from "../assessments/history";
import { projectAssessmentOrigin, manualAssessmentProvenance } from "../assessments/provenance";
import { getFrameworks, type Framework } from "../frameworks/configuration";
import type { GroupCardData, GroupExperience, GroupItemTest, GroupMember } from "./model";
import type { GroupExperienceRepository } from "./repository";
import { groupCapabilities } from "./policy";
import { currentGroupAssessmentContext } from "./assessmentContext";
import { assertGroupAssessmentCommand, groupAssessmentSource, storedGroupAssessmentCommand, type GroupAssessmentCommand } from "./assessmentContracts";

export type GroupAssessmentList = AssessmentList & {
  experienceId: string; owner: { kind: "group"; experienceId: string }; target: ReturnType<typeof assessmentTarget>;
  groupCapabilities: ReturnType<typeof groupCapabilities>;
};
async function storage(repo: GroupExperienceRepository, actor: string, experience: GroupExperience, member: GroupMember,
  source: AssessmentSource, session: ClientSession, cachedStates?: ReadonlyMap<string, GroupCardData>) {
  const row = source.kind === "card" ? cachedStates ? cachedStates.get(source.cardTemplateId)
    : await repo.cardData().findOne({ experienceId: experience.experienceId, cardTemplateId: source.cardTemplateId }, { session,
      projection: { _id: 0, cardTemplateId: 1, tests: 1, testsRevision: 1 } }) : undefined;
  const tests = source.kind === "card" ? row?.tests ?? [] : experience.itemTests ?? [];
  // Undefined additive fields are legacy defaults; null/malformed data is not.
  if (source.kind === "card") requireCondition(row?.tests !== null, "INVALID_STORED_ASSESSMENTS");
  else requireCondition(experience.itemTests !== null, "INVALID_STORED_ASSESSMENTS");
  assertStoredAssessmentTests(tests);
  if (source.kind === "item") {
    for (const test of tests) assertAssessmentId((test as GroupItemTest).frameworkItemId);
    requireCondition(experience.itemAssessmentSourceIds === undefined || Array.isArray(experience.itemAssessmentSourceIds), "INVALID_GROUP_ASSESSMENT_SOURCES");
    for (const id of experience.itemAssessmentSourceIds ?? []) assertAssessmentId(id);
  }
  const revision = assessmentRevision(source.kind === "card" ? row?.testsRevision : experience.itemTestsRevision);
  const visible = source.kind === "card" ? tests : tests.filter(test => (test as GroupItemTest).frameworkItemId === source.itemId);
  const known = source.kind === "card" ? row?.tests !== undefined || row?.testsRevision !== undefined
    : Boolean(experience.itemAssessmentSourceIds?.includes(source.itemId) || visible.length);
  const list: GroupAssessmentList = { viewerUserId: actor, experienceId: experience.experienceId, owner: { kind: "group", experienceId: experience.experienceId },
    target: assessmentTarget(source), source, revision, tests: newestAssessmentsFirst(visible.map(test => ({ id: test.id, date: test.date,
      result: test.result, createdAt: new Date(test.createdAt).toISOString(), ...(test.provenance ? { provenance: test.provenance } : {}) }))),
    groupCapabilities: groupCapabilities(experience, member) };
  return { tests, known, row, list };
}
function publicList(list: GroupAssessmentList, experience: GroupExperience): GroupAssessmentList {
  const names = new Map([[experience.experienceId, experience.name]]);
  return { ...list, tests: list.tests.map(test => projectAssessmentOrigin(test, names)) };
}

export async function readGroupAssessments(repo: GroupExperienceRepository, actor: string, experienceId: string, source: AssessmentSource,
  frameworks: readonly Framework[] = getFrameworks()) {
  assertAssessmentSource(source);
  return repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, experienceId, "member", session);
    const saved = await storage(repo, actor, experience, member, source, session);
    // Retained source access is an Admin capability, never a restored content
    // or navigation grant. Other members must resolve current mapped scope.
    if (!member.isAdmin || !saved.known) await currentGroupAssessmentContext(repo, actor, experienceId, source, "member", session, frameworks);
    return publicList(saved.list, experience);
  });
}

export async function mutateGroupAssessment(repo: GroupExperienceRepository, actor: string, experienceId: string,
  source: AssessmentSource, input: GroupAssessmentCommand, frameworks: readonly Framework[] = getFrameworks()) {
  assertAssessmentSource(source); assertGroupAssessmentCommand(input);
  requireCondition(input.viewerUserId === actor && sameAssessmentSource(groupAssessmentSource(input.target), source), "ASSESSMENT_SESSION_CONFLICT");
  return repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, experienceId, "admin", session);
    const command = storedGroupAssessmentCommand(input, experience.deckTemplateId);
    // Adoption always fences its acting Admin; scalar writes fence their actor.
    // Fencing the small current Admin set for a new source observation therefore
    // protects composition validation and first-row races across different Admins
    // without a new global lock or changing structural/list revision semantics.
    const fenced = command.action === "add" ? await repo.members().find({ experienceId, isAdmin: true }, { session }).toArray() : [member];
    await repo.fence(fenced, session);
    const saved = await storage(repo, actor, experience, member, source, session), existing = saved.tests.find(test => test.id === command.id);
    if (source.kind === "item" && existing) requireCondition((existing as GroupItemTest).frameworkItemId === source.itemId, "ASSESSMENT_SOURCE_CONFLICT");
    const context = { groupExperienceId: experienceId, deckTemplateId: source.kind === "card" ? experience.deckTemplateId : null };
    if (command.action === "add" && source.kind === "card") requireCondition(command.deckTemplateId === experience.deckTemplateId, "ASSESSMENT_SOURCE_CONFLICT");
    if (saved.list.revision !== command.expectedRevision) {
      const outcome = reconcileAssessment(command, saved.list, context);
      if (outcome && saved.known) return { ...publicList(saved.list, experience), outcome };
      throw new AssessmentConflict(publicList(saved.list, experience));
    }
    if (command.action === "add") {
      await currentGroupAssessmentContext(repo, actor, experienceId, source, "admin", session, frameworks);
      requireCondition(!existing, "DUPLICATE_ASSESSMENT_ID_CONFLICT");
    } else requireCondition(saved.known && existing, "ASSESSMENT_NOT_FOUND");
    requireCondition(saved.list.revision < Number.MAX_SAFE_INTEGER, "ASSESSMENT_REVISION_EXHAUSTED");
    const now = new Date();
    const tests = command.action === "delete" ? saved.tests.filter(test => test.id !== command.id)
      : command.action === "update" ? saved.tests.map(test => test.id === command.id ? { ...test, date: command.date, result: command.result } : test)
      : [...saved.tests, { id: command.id, date: command.date, result: command.result, createdAt: now,
        provenance: manualAssessmentProvenance(actor, context), ...(source.kind === "item" ? { frameworkItemId: source.itemId } : {}) }];
    const revision = saved.list.revision + 1;
    const guard = (field: string) => saved.list.revision === 0 ? { $or: [{ [field]: 0 }, { [field]: { $exists: false } }] } : { [field]: saved.list.revision };
    if (source.kind === "card") {
      if (!saved.row) await repo.cardData().insertOne({ experienceId, cardTemplateId: source.cardTemplateId, items: [], signalReadings: [], revision: 0,
        tests: tests as CardTest[], testsRevision: revision, createdAt: now, updatedAt: now }, { session });
      else requireCondition((await repo.cardData().updateOne({ experienceId, cardTemplateId: source.cardTemplateId, ...guard("testsRevision") },
        { $set: { tests, testsRevision: revision, updatedAt: now } }, { session })).matchedCount === 1, "ASSESSMENT_REVISION_CONFLICT");
    } else requireCondition((await repo.experiences().updateOne({ experienceId, ...guard("itemTestsRevision") }, {
      $set: { itemTests: tests as GroupItemTest[], itemTestsRevision: revision, updatedAt: now },
      $addToSet: { itemAssessmentSourceIds: source.itemId },
    }, { session })).matchedCount === 1, "ASSESSMENT_REVISION_CONFLICT");
    const latest = source.kind === "item" ? (await repo.experiences().findOne({ experienceId }, { session }))! : experience;
    return { ...publicList((await storage(repo, actor, latest, member, source, session)).list, latest), outcome: "changed" as const };
  });
}

// Bounded source loading is shared by current Progress summaries and lazy history.
// Callers supply authorised scope Cards; this helper never discovers wider scope.
export async function groupAssessmentHistoryReader(repo: GroupExperienceRepository, actor: string, experience: GroupExperience,
  member: GroupMember, cards: Awaited<ReturnType<typeof currentGroupAssessmentContext>>["assessmentCards"], session: ClientSession) {
  const states = new Map<string, GroupCardData>();
  const ids = cards.map(card => card.cardTemplateId);
  for (let offset = 0; offset < ids.length; offset += 100) {
    const rows = await repo.cardData().find({ experienceId: experience.experienceId, cardTemplateId: { $in: ids.slice(offset, offset + 100) } }, { session,
      projection: { _id: 0, cardTemplateId: 1, tests: 1, testsRevision: 1 } }).toArray();
    for (const row of rows) states.set(row.cardTemplateId, row);
  }
  return async (cardIds: readonly string[], itemId?: string): Promise<AssessmentHistory> => {
    const sources: AssessmentSource[] = [...new Set(cardIds)].map(cardTemplateId => ({ kind: "card", cardTemplateId }));
    if (itemId !== undefined) sources.push({ kind: "item", itemId });
    const results: HistoryResult[] = [], dependencies: AssessmentHistory["sources"] = [], issues: AssessmentHistory["issues"] = [];
    for (const selected of sources) {
      try {
        const saved = publicList((await storage(repo, actor, experience, member, selected, session, states)).list, experience);
        dependencies.push({ source: selected, revision: saved.revision, canMutate: member.isAdmin });
        for (const test of saved.tests) {
          const rawTitle = selected.kind === "card" ? cards.find(card => card.cardTemplateId === selected.cardTemplateId)!.content.intro.title : null;
          const title = selected.kind === "item" ? "Item test" : nonblank(rawTitle) ? rawTitle : "Untitled Card";
          results.push({ ...test, source: selected, sourceRevision: saved.revision, canMutate: member.isAdmin,
            relationship: selected.kind === "item" ? "direct-item" : "own-card", sourceTitle: title,
            titleAvailability: selected.kind === "item" ? "not-applicable" : nonblank(rawTitle) ? "available" : "untitled", exposedThroughCardTemplateIds: selected.kind === "card" ? [selected.cardTemplateId] : [] });
        }
      } catch (error) {
        if (!(error instanceof CardArchitectureError)) throw error;
        issues.push({ code: error.code }); dependencies.push({ source: selected, revision: null, canMutate: false });
      }
    }
    const ordered = orderHistoryResults(results);
    return { state: issues.length ? "incomplete" : ordered.length ? "complete" : "empty", count: issues.length ? null : ordered.length,
      readableCount: ordered.length, results: ordered, latestThree: issues.length ? [] : ordered.slice(0, 3).reverse(), sources: dependencies, issues };
  };
}

// Combined histories are current-scope only. Exact source endpoints independently
// retain the approved Admin management rights without restoring navigation.
export async function readGroupAssessmentHistory(repo: GroupExperienceRepository, actor: string, experienceId: string, source: AssessmentSource,
  frameworks: readonly Framework[] = getFrameworks()) {
  return repo.transaction(async session => {
    const context = await currentGroupAssessmentContext(repo, actor, experienceId, source, "member", session, frameworks);
    const reader = await groupAssessmentHistoryReader(repo, actor, context.experience, context.member, context.assessmentCards, session);
    return { viewerUserId: actor, experienceId, owner: { kind: "group" as const, experienceId }, target: assessmentTarget(source),
      history: await reader(context.assessmentCards.map(card => card.cardTemplateId), source.kind === "item" ? source.itemId : undefined),
      groupCapabilities: groupCapabilities(context.experience, context.member) };
  });
}
