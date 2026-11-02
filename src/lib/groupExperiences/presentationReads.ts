import type { ClientSession } from "mongodb";
import { requireCondition } from "../cards/domain";
import { cardCreatorAttributions } from "../cards/creatorAttribution";
import { cardContentPresentation, canonicalIntroductionDTO } from "../cards/libraryProjection";
import { layoutCardLabels } from "../cards/layout";
import { isIsoDateOnlyString } from "../dateOnly";
import { progressObservationState } from "../frameworks/progressState";
import { classifyProgress } from "../progress";
import { selectedContent } from "./publicVersions";
import { personalLearningForUsers, userKey } from "./learningReads";
import { activeIdentities } from "./identities";
import { identity, entry, metrics, aggregateLearning } from "./readModels";
import { canInspectPeers } from "./policy";
import { restoredPerspective } from "./navigation";
import type { GroupExperienceRepository } from "./repository";
import type { GroupExperience } from "./model";

const CARD_PAGE = 20;
function cardWindow(length: number, offset: number) {
  requireCondition(Number.isSafeInteger(offset) && offset >= 0 && (offset === 0 || offset < length), "INVALID_GROUP_PAGE");
  return { start: offset, end: offset + CARD_PAGE, nextCardOffset: offset + CARD_PAGE < length ? offset + CARD_PAGE : null };
}
async function content(repo: GroupExperienceRepository, experience: GroupExperience, session: ClientSession, offset = 0) {
  const selected = await selectedContent(repo.cards, experience, session), window = cardWindow(selected.cards.length, offset);
  const cards = selected.cards.slice(window.start, window.end);
  const roots = cards.length ? await repo.cards.cards().find({ cardTemplateId: { $in: cards.map(card => card.cardTemplateId) } }, { session }).toArray() : [];
  const creators = await cardCreatorAttributions(repo.cards, roots, session);
  const labels = layoutCardLabels(selected.deck.content.labelPrefix, selected.deck.content.cards);
  const deck = { surface: "canonical" as const, id: experience.deckTemplateId, deckTemplateId: experience.deckTemplateId,
    version: experience.deckVersion, title: selected.deck.content.title, category: selected.deck.content.categories[0] ?? null,
    introduction: canonicalIntroductionDTO(selected.deck.content.introduction), streams: selected.deck.content.themes.map(({ id, title }) => ({ id, title })),
    ownerUsername: experience.name, showOwnerTag: true,
    cards: cards.map((card, i) => cardContentPresentation(card, labels[offset + i].label, creators.get(card.cardTemplateId)!)) };
  return { deck, cards, allCards: selected.cards, nextCardOffset: window.nextCardOffset };
}
// Owner dates are deliberately separate from foreign learning. Selecting a group
// context never creates a second personal CardData or makes this private field
// part of the reusable peer matrix. Later personal/group contribution sources
// require separate typed loaders, not widening this owner allowlist.
async function ownDates(repo: GroupExperienceRepository, actor: string, ids: string[], session: ClientSession) {
  const rows = await repo.cards.users().aggregate<{ cards: { cardTemplateId: string; targetDate: string | null }[] }>([
    { $match: { _id: userKey(actor) } }, { $project: { _id: 0, cards: { $map: {
      input: { $filter: { input: "$cardsData", as: "card", cond: { $in: ["$$card.cardTemplateId", { $literal: ids }] } } },
      as: "card", in: { cardTemplateId: "$$card.cardTemplateId", targetDate: { $ifNull: ["$$card.targetDate", null] } },
    } } } },
  ], { session }).toArray();
  requireCondition(rows.length === 1, "INVALID_GROUP_PERSONAL_DATA");
  return ids.map(cardTemplateId => {
    const matching = rows[0].cards.filter(card => card.cardTemplateId === cardTemplateId);
    requireCondition(matching.length <= 1, "INVALID_GROUP_PERSONAL_DATA");
    const targetDate = matching[0]?.targetDate ?? null;
    requireCondition(targetDate === null || isIsoDateOnlyString(targetDate), "INVALID_TARGET_DATE");
    return { cardTemplateId, targetDate };
  });
}
export async function bootstrap(repo: GroupExperienceRepository, actor: string, experienceId: string, offset = 0) {
  return repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, experienceId, "member", session);
    const selected = await content(repo, experience, session, offset);
    const group = await repo.groupLearning(experienceId, selected.cards, session);
    const own = member.followerStatus === "active" ? (await personalLearningForUsers(repo.cards, [actor], selected.cards, session)).get(actor)! : null;
    return { ...entry(actor, experience, member), canInspectFollowers: canInspectPeers(experience, member),
      allowFollowerInspection: experience.allowFollowerInspection === true, selection: await restoredPerspective(repo, experience, member, session),
      deck: selected.deck, group, own, ownDates: own ? await ownDates(repo, actor, selected.cards.map(card => card.cardTemplateId), session) : null,
      nextCardOffset: selected.nextCardOffset, deferred: ["assessments", "private-content", "group-contributions"] as const };
  });
}
export async function perspectivePage(repo: GroupExperienceRepository, actor: string, experienceId: string, after?: string, limit?: number, offset = 0) {
  return repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, experienceId, "member", session);
    const { cards: all } = await selectedContent(repo.cards, experience, session), window = cardWindow(all.length, offset), cards = all.slice(window.start, window.end);
    const identities = await activeIdentities(repo, experience, member, session, after, limit);
    const values = await personalLearningForUsers(repo.cards, identities.followers.map(row => row.userId), cards, session);
    return { ...identity(actor, experience, member), followers: identities.followers.map(row => ({ ...row, learning: values.get(row.userId)! })),
      nextCursor: identities.nextCursor, nextCardOffset: window.nextCardOffset };
  });
}
export async function cardAggregates(repo: GroupExperienceRepository, actor: string, experienceId: string, offset = 0) {
  return repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, experienceId, "member", session);
    const { cards: all } = await selectedContent(repo.cards, experience, session), window = cardWindow(all.length, offset), cards = all.slice(window.start, window.end);
    const followers = await repo.members().find({ experienceId, followerStatus: "active" }, { session, projection: { userId: 1 } }).toArray();
    const personal = await personalLearningForUsers(repo.cards, followers.map(row => row.userId), cards, session);
    return { ...identity(actor, experience, member), ...aggregateLearning(await repo.groupLearning(experienceId, cards, session), [...personal.values()]), nextCardOffset: window.nextCardOffset };
  });
}
export async function collectionTiles(repo: GroupExperienceRepository, actor: string, after?: string) {
  const listed = await repo.list(actor, after);
  const tiles = [];
  for (const value of listed.entries) tiles.push(await repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, value.experienceId, "member", session);
    const selected = await content(repo, experience, session);
    const group = await repo.groupLearning(experience.experienceId, selected.allCards, session);
    return { ...entry(actor, experience, member), deck: selected.deck, cardCount: selected.allCards.length, group: metrics(group),
      // Tiles contain only the first content page. Completion must cover every
      // selected Step, not just the visible page or a rounded percentage.
      isComplete: classifyProgress(group.flatMap(card => card.items)).isComplete, allSkipped: progressObservationState(group.flatMap(card => card.items)).state === "skipped",
      groupLearning: group.slice(0, selected.cards.length) };
  }));
  return { viewerUserId: actor, entries: tiles, nextCursor: listed.nextCursor };
}
export type GroupBootstrap = Awaited<ReturnType<typeof bootstrap>>;
export type GroupPerspectivePage = Awaited<ReturnType<typeof perspectivePage>>;
export type GroupAggregates = Awaited<ReturnType<typeof cardAggregates>>;
export type GroupTiles = Awaited<ReturnType<typeof collectionTiles>>;
