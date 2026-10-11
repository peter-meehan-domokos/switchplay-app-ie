import type { ClientSession } from "mongodb";
import type { CardRepository } from "../cards/repository";
import type { CardData, CardTest, ItemTest } from "../cards/model";
import { isRecord, requireCondition } from "../cards/domain";
import { isIsoDateOnlyString } from "../dateOnly";
import { getFrameworks, assertFrameworkConfiguration, type Framework } from "../frameworks/configuration";
import { AssessmentConflict, assessmentRevision, assertAssessmentCommand, assertAssessmentId, assertAssessmentSource,
  newestAssessmentsFirst, reconcileAssessment, type AssessmentCommand, type AssessmentList, type AssessmentSource,
  type AssessmentMutationResult } from "./contracts";

function storedTests(value: unknown, item = false): asserts value is (CardTest | ItemTest)[] {
  requireCondition(Array.isArray(value), "INVALID_STORED_ASSESSMENTS");
  const seen = new Set<string>();
  for (const test of value) {
    requireCondition(isRecord(test) && isIsoDateOnlyString(test.date) && test.date === test.date.trim()
      && typeof test.result === "boolean", "INVALID_STORED_ASSESSMENTS");
    const createdAt = test.createdAt instanceof Date ? test.createdAt
      : typeof test.createdAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(test.createdAt) ? new Date(test.createdAt) : null;
    requireCondition(createdAt && Number.isFinite(createdAt.getTime()), "INVALID_STORED_ASSESSMENTS");
    assertAssessmentId(test.id); if (item) assertAssessmentId(test.itemId);
    requireCondition(!seen.has(test.id), "DUPLICATE_ASSESSMENT_ID_CONFLICT"); seen.add(test.id);
  }
}
async function assessmentStorage(repo: CardRepository, actor: string, source: AssessmentSource, session: ClientSession) {
  assertAssessmentId(actor); assertAssessmentSource(source);
  const user = await repo.getPersonalUser(actor, session);
  requireCondition(user, "ASSESSMENT_FORBIDDEN");
  let card: CardData | undefined;
  if (source.kind === "card") {
    requireCondition(Array.isArray(user.cardsData), "INVALID_PERSONAL_ASSESSMENT_STORAGE");
    const candidates = user.cardsData.filter((card) => card.cardTemplateId === source.cardTemplateId);
    requireCondition(candidates.length === 1, "ASSESSMENT_FORBIDDEN"); card = candidates[0];
  }
  const tests = card ? card.tests : user.itemTests === undefined ? [] : user.itemTests;
  storedTests(tests, !card);
  const revision = assessmentRevision(card ? card.testsRevision : user.itemTestsRevision);
  const visible = source.kind === "card" ? tests : tests.filter((test) => (test as ItemTest).itemId === source.itemId);
  const list: AssessmentList = { viewerUserId: actor, source, revision, tests: newestAssessmentsFirst(visible.map((test) => ({
    id: test.id, date: test.date, result: test.result, createdAt: new Date(test.createdAt).toISOString() }))) };
  return { user, card, tests, list };
}
export async function readAssessmentList(repo: CardRepository, actor: string, source: AssessmentSource): Promise<AssessmentList> {
  return repo.transaction(async (session) => (await assessmentStorage(repo, actor, source, session)).list);
}

export async function mutateAssessment(repo: CardRepository, actor: string, command: AssessmentCommand,
  frameworks: readonly Framework[] = getFrameworks()): Promise<AssessmentMutationResult> {
  assertAssessmentCommand(command); requireCondition(command.viewerUserId === actor, "ASSESSMENT_SESSION_CONFLICT");
  assertFrameworkConfiguration(frameworks);
  return repo.transaction(async (session) => {
    const { user, tests, list } = await assessmentStorage(repo, actor, command.source, session);
    const existing = tests.find((test) => test.id === command.id);
    // An Item test ID is unique across the user's entire direct Item list.
    requireCondition(command.source.kind !== "item" || !existing || (existing as ItemTest).itemId === command.source.itemId,
      "ASSESSMENT_SOURCE_CONFLICT");
    if (list.revision !== command.expectedRevision) {
      const outcome = reconcileAssessment(command, list);
      if (outcome) return { ...list, outcome };
      throw new AssessmentConflict(list);
    }
    if (command.action === "add") {
      // Reconciliation above is read-only; a previously committed Add can still
      // be acknowledged after archival or configuration removal.
      if (command.source.kind === "card") await repo.assessmentWorkingCard(actor, command.deckTemplateId!, command.source.cardTemplateId, session);
      else {
        const itemId = command.source.itemId;
        requireCondition(frameworks.some((framework) => framework.areas.some((area) => area.items.some((item) => item.id === itemId))),
          "ITEM_ASSESSMENT_CONTEXT_REQUIRED");
      }
      requireCondition(!existing, "DUPLICATE_ASSESSMENT_ID_CONFLICT");
    } else requireCondition(existing, "ASSESSMENT_NOT_FOUND");
    requireCondition(list.revision < Number.MAX_SAFE_INTEGER, "ASSESSMENT_REVISION_EXHAUSTED");
    const now = new Date();
    const next = command.action === "delete" ? tests.filter((test) => test.id !== command.id)
      : command.action === "update" ? tests.map((test) => test.id === command.id ? { ...test, date: command.date, result: command.result } : test)
      : [...tests, { id: command.id, date: command.date, result: command.result, createdAt: now,
        ...(command.source.kind === "item" ? { itemId: command.source.itemId } : {}) }];
    // Narrow fields only. Mongo retries re-read the list; the CAS also explicitly
    // accepts absent legacy counters as zero. Never replace User or CardData.
    const revisionFilter = (field: string) => list.revision === 0 ? { $or: [{ [field]: 0 }, { [field]: { $exists: false } }] } : { [field]: list.revision };
    const update = command.source.kind === "card"
      ? await repo.users().updateOne({ _id: user._id, cardsData: { $elemMatch: { cardTemplateId: command.source.cardTemplateId, ...revisionFilter("testsRevision") } } },
        { $set: { "cardsData.$[card].tests": next as CardTest[], "cardsData.$[card].testsRevision": list.revision + 1, "cardsData.$[card].updatedAt": now } },
        { session, arrayFilters: [{ "card.cardTemplateId": command.source.cardTemplateId }] })
      : await repo.users().updateOne({ _id: user._id, ...revisionFilter("itemTestsRevision") },
        { $set: { itemTests: next as ItemTest[], itemTestsRevision: list.revision + 1 } }, { session });
    requireCondition(update.matchedCount === 1, "ASSESSMENT_REVISION_CONFLICT");
    return { ...(await assessmentStorage(repo, actor, command.source, session)).list, outcome: "changed" };
  });
}
