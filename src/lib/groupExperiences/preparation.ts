import { content, ownDates } from "./presentationReads";
import { personalLearningForUsers } from "./learningReads";
import { activeIdentities } from "./identities";
import { entry, identity, aggregateLearning } from "./readModels";
import { canInspectPeers, assertSelection, canSelect } from "./policy";
import { restoredPerspective } from "./navigation";
import type { GroupExperienceRepository } from "./repository";
import type { PerspectiveSelection } from "./model";
import { ownerPreviewPages, sharedPreviewPages } from "../mediaCollection/preparation";
import { readReflectionFeedsInSession } from "../reflections/reads";
import { ensureGroupReadiness } from "./readiness";

export async function prepareGroup(repo: GroupExperienceRepository, actor: string, experienceId: string, requested?: PerspectiveSelection, opening?: { cardTemplateId?: string }) {
  await ensureGroupReadiness(repo.cards, "media"); await ensureGroupReadiness(repo.cards, "reflections");
  return repo.transaction(async session => {
    const authority = await repo.access(actor, experienceId, "member", session), { experience, member } = authority;
    const selected = await content(repo, experience, session, 0, true), ids = selected.cards.map(card => card.cardTemplateId);
    let selection = requested ?? await restoredPerspective(repo, experience, member, session);
    let subject = selection.perspective === "follower" ? await repo.members().findOne({ experienceId, userId: selection.subjectUserId }, { session }) : undefined;
    if (requested && !canSelect(experience, member, selection, subject)) {
      selection = await restoredPerspective(repo, experience, member, session);
      subject = selection.perspective === "follower" ? await repo.members().findOne({ experienceId, userId: selection.subjectUserId }, { session }) : undefined;
    }
    assertSelection(experience, member, selection, subject);
    if (opening) await repo.openSelectedInSession(actor, experience, member, selected.cards, session, opening.cardTemplateId && ids.includes(opening.cardTemplateId) ? opening.cardTemplateId : undefined);
    const group = await repo.groupLearning(experienceId, selected.cards, session);
    // Preserve the current picker and comparison scalar matrix until CP3. This
    // does not prepare other perspectives' media/reflections or private fields.
    const followerIds = await repo.members().find({ experienceId, followerStatus: "active" }, { session, projection: { userId: 1 } }).toArray();
    const learning = await personalLearningForUsers(repo.cards, followerIds.map(row => row.userId), selected.cards, session);
    const followers = []; let cursor: string | undefined;
    do {
      const page = await activeIdentities(repo, experience, member, session, cursor, 100);
      followers.push(...page.followers.map(row => ({ ...row, learning: learning.get(row.userId)! }))); cursor = page.nextCursor ?? undefined;
    } while (cursor);
    const own = member.followerStatus === "active" ? learning.get(actor)! : null;
    const bootstrap = { ...entry(actor, experience, member), canInspectFollowers: canInspectPeers(experience, member), allowFollowerInspection: experience.allowFollowerInspection === true,
      selection, deck: selected.deck, group, own, ownDates: own ? await ownDates(repo, actor, ids, session) : null, nextCardOffset: null, deferred: ["assessments", "private-content", "group-contributions"] as const };
    const owner = selection.perspective === "self", subjectUserId = selection.perspective === "follower" ? selection.subjectUserId : undefined;
    const media = owner ? await ownerPreviewPages(repo.cards, actor, ids, session, true, authority) : await sharedPreviewPages(repo.cards, actor, ids, session, authority, subjectUserId);
    const reflections = await readReflectionFeedsInSession(repo, actor, ids, { kind: "group", experienceId, accessEpoch: member.accessEpoch, mode: owner ? "own" : subjectUserId ? "inspection" : "group", ...(subjectUserId ? { subjectUserId } : {}) }, session, authority, true);
    return { ...identity(actor, experience, member), bootstrap, followers, aggregates: aggregateLearning(group, [...learning.values()]).cards, contributions: { media, reflections } };
  });
}
export type PreparedGroup = Awaited<ReturnType<typeof prepareGroup>>;
