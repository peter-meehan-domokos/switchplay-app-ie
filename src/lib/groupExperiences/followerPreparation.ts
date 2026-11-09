import type { GroupExperienceRepository } from "./repository";
import { content } from "./presentationReads";
import { activeIdentities } from "./identities";
import { canInspectPeers } from "./policy";
import { requireCondition } from "../cards/domain";
import { personalLearningForUsers, type LearningProjection } from "./learningReads";
import { subjectPreviewPages } from "../mediaCollection/preparation";
import { subjectReflectionFeeds, type ReflectionFeed } from "../reflections/reads";
import type { MediaCollectionPage } from "../mediaCollection/contracts";
import { ensureGroupReadiness } from "./readiness";
import { identity } from "./readModels";
import { packPreparation, preparationCursor } from "./preparationPaging";
export type FollowerPreparationHeader = { cards: { cardTemplateId: string; version: number }[]; followers: { userId: string; username: string }[] };
export type FollowerPreparationCard = { subjectUserId: string; cardTemplateId: string; learning: LearningProjection; media: MediaCollectionPage; reflection: ReflectionFeed };
const QUERY_CARD_SUBJECTS = 128; // Bounded query work; normal 16–20 × six Cards fits one request.
export async function prepareFollowers(repo: GroupExperienceRepository, actor: string, experienceId: string, after?: string) {
  await ensureGroupReadiness(repo.cards, "media"); await ensureGroupReadiness(repo.cards, "reflections");
  return repo.transaction(async session => {
    const authority = await repo.access(actor, experienceId, "member", session), { experience, member } = authority;
    requireCondition(canInspectPeers(experience, member), "GROUP_PERSPECTIVE_FORBIDDEN");
    const selected = await content(repo, experience, session, 0, true);
    const followers: FollowerPreparationHeader["followers"] = []; let cursor: string | undefined;
    do { const page = await activeIdentities(repo, experience, member, session, cursor, 100); followers.push(...page.followers); cursor = page.nextCursor ?? undefined; } while (cursor);
    const header: FollowerPreparationHeader = { cards: selected.cards.map(card => ({ cardTemplateId: card.cardTemplateId, version: card.version })), followers };
    // The actor's one roster identity uses complete Me, including owner history.
    // Foreign inspection never widens to Personal data or hidden Group entries.
    const targets = followers.filter(row => row.userId !== actor).flatMap(row => selected.cards.map(card => ({ subject: row.userId, card })));
    const position = preparationCursor(after)?.index ?? 0, total = targets.length + 1;
    requireCondition(position < total || position === 0, "INVALID_GROUP_PAGE");
    const slice = targets.slice(Math.max(0, position - 1), Math.max(0, position - 1) + QUERY_CARD_SUBJECTS);
    const subjects = [...new Set(slice.map(row => row.subject))], ids = [...new Set(slice.map(row => row.card.cardTemplateId))];
    const learning = await personalLearningForUsers(repo.cards, subjects, selected.cards.filter(card => ids.includes(card.cardTemplateId)), session);
    const media = await subjectPreviewPages(repo.cards, actor, ids, subjects, session, authority);
    const reflections = await subjectReflectionFeeds(repo, actor, ids, subjects, session, authority);
    const entries: { index: number; value: FollowerPreparationHeader | FollowerPreparationCard }[] = position === 0 ? [{ index: 0, value: header }] : [];
    for (const [i, row] of slice.entries()) entries.push({ index: Math.max(1, position) + i, value: { subjectUserId: row.subject, cardTemplateId: row.card.cardTemplateId,
      learning: learning.get(row.subject)!.find(value => value.cardTemplateId === row.card.cardTemplateId)!, media: media.get(row.subject)![row.card.cardTemplateId], reflection: reflections.get(row.subject)![row.card.cardTemplateId] } });
    return packPreparation(identity(actor, experience, member), header, entries, total, after);
  });
}
