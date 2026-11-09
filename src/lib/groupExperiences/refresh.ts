import { requireCondition } from "../cards/domain";
import { selectedLearningContent } from "./publicVersions";
import { personalLearningForUsers } from "./learningReads";
import { ownDates } from "./presentationReads";
import { aggregateLearning, identity } from "./readModels";
import { assertSelection } from "./policy";
import type { PerspectiveSelection } from "./model";
import type { GroupExperienceRepository } from "./repository";
import { ensureGroupReadiness } from "./readiness";
import { ownerPreviewPages, sharedPreviewPages } from "../mediaCollection/preparation";
import { readReflectionFeedsInSession } from "../reflections/reads";
import { packPreparation, PREPARATION_PAGE_BYTES } from "./preparationPaging";

export type RefreshScope = { accessEpoch: number; adoptionRevision: number; structureRevision: number };
// One active perspective, across all Cards. No canonical presentation, owner
// history bodies or complete roster preparation is returned by routine polling.
export async function refreshGroup(repo: GroupExperienceRepository, actor: string, experienceId: string,
  selection: PerspectiveSelection, expected: RefreshScope, aggregates = true) {
  await ensureGroupReadiness(repo.cards, "media"); await ensureGroupReadiness(repo.cards, "reflections");
  return repo.transaction(async session => {
    const authority = await repo.access(actor, experienceId, "member", session), { experience, member } = authority;
    requireCondition(member.accessEpoch === expected.accessEpoch && experience.adoptionRevision === expected.adoptionRevision
      && experience.structureRevision === expected.structureRevision, "GROUP_SCOPE_CONFLICT");
    const subject = selection.perspective === "follower" ? await repo.members().findOne({ experienceId, userId: selection.subjectUserId }, { session }) : undefined;
    assertSelection(experience, member, selection, subject);
    const cards = await selectedLearningContent(repo.cards, experience, session), ids = cards.map(card => card.cardTemplateId);
    const group = await repo.groupLearning(experienceId, cards, session);
    const aggregate = selection.perspective === "group" && aggregates;
    const followers = aggregate ? await repo.members().find({ experienceId, followerStatus: "active" }, { session, projection: { userId: 1 } }).toArray() : [];
    const values = await personalLearningForUsers(repo.cards, aggregate ? followers.map(row => row.userId)
      : selection.perspective === "group" ? [] : [selection.perspective === "self" ? actor : selection.subjectUserId], cards, session);
    const owner = selection.perspective === "self", subjectUserId = selection.perspective === "follower" ? selection.subjectUserId : undefined;
    const media = owner ? await ownerPreviewPages(repo.cards, actor, ids, session, true, authority)
      : await sharedPreviewPages(repo.cards, actor, ids, session, authority, subjectUserId);
    const reflections = await readReflectionFeedsInSession(repo, actor, ids, { kind: "group", experienceId, accessEpoch: member.accessEpoch,
      mode: owner ? "own" : subjectUserId ? "inspection" : "group", ...(subjectUserId ? { subjectUserId } : {}) }, session, authority, true);
    return { ...identity(actor, experience, member), selection, cards: cards.map(({ cardTemplateId, version }) => ({ cardTemplateId, version })),
      group, learning: selection.perspective === "group" ? null : values.get(owner ? actor : subjectUserId!)!,
      ownDates: owner ? await ownDates(repo, actor, ids, session) : null,
      aggregates: aggregate ? aggregateLearning(group, [...values.values()]).cards : null, contributions: { media, reflections } };
  });
}
export type GroupRefresh = Awaited<ReturnType<typeof refreshGroup>>;
export function pageGroupRefresh(value: GroupRefresh, after?: string) {
  if (!after && Buffer.byteLength(JSON.stringify(value)) <= PREPARATION_PAGE_BYTES) return value;
  const { contributions, ...head } = value;
  const authority = { viewerUserId: value.viewerUserId, experienceId: value.experienceId, accessEpoch: value.accessEpoch,
    structureRevision: value.structureRevision, adoptionRevision: value.adoptionRevision };
  return packPreparation(authority, [value.cards, value.selection], [{ index: 0, value: head },
    ...value.cards.map((card, i) => ({ index: i + 1, value: { cardTemplateId: card.cardTemplateId,
      media: contributions.media[card.cardTemplateId], reflection: contributions.reflections[card.cardTemplateId] } }))], value.cards.length + 1, after, value.selection);
}
