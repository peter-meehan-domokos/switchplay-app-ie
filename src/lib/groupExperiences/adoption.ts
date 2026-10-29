import { isDeepStrictEqual } from "node:util";
import type { ClientSession } from "mongodb";
import type { CardTemplateRoot } from "../cards/model";
import { CardArchitectureError, requireCondition } from "../cards/domain";
import { mergeRetainedAssignments } from "../cards/retainedAssignments";
import { adoptionCommand, hash, id } from "./contracts";
import { publicCards, publicDeck, selectedContent } from "./publicVersions";
import type { GroupExperienceRepository } from "./repository";
import type { GroupExperience, GroupUpdateCommand } from "./model";

export class GroupUpdateConflict extends CardArchitectureError {
  constructor(readonly latestReview: Awaited<ReturnType<typeof reviewInSession>>) { super("GROUP_UPDATE_CONFLICT"); }
}
export async function reviewInSession(repo: GroupExperienceRepository, actor: string, experience: GroupExperience,
  kind: "card" | "deck", entityId: string, session: ClientSession) {
  id(entityId); requireCondition(kind === "card" || kind === "deck", "INVALID_GROUP_UPDATE");
  const current = await selectedContent(repo.cards, experience, session);
  let sourceVersion: number, targetVersion: number, title: string, cards: GroupUpdateCommand["cards"] = [];
  if (kind === "card") {
    const selected = current.cards.find(card => card.cardTemplateId === entityId); requireCondition(selected, "GROUP_CARD_FORBIDDEN");
    const root = (await repo.cards.cards().findOne({ cardTemplateId: entityId }, { session }))!;
    const target = (await publicCards(repo.cards, [{ cardTemplateId: entityId, version: root.latestVersion }], session))[0];
    sourceVersion = selected.version; targetVersion = target.version; title = target.content.intro.title ?? "Card";
  } else {
    requireCondition(entityId === experience.deckTemplateId, "GROUP_DECK_FORBIDDEN");
    const root = (await repo.cards.decks().findOne({ deckTemplateId: entityId }, { session }))!;
    const target = (await publicDeck(repo.cards, entityId, root.latestVersion, session)).selected;
    sourceVersion = experience.deckVersion; targetVersion = target.version; title = target.content.title;
    const missing = target.content.cards.filter(ref => !experience.cardSelections.some(selected => selected.cardTemplateId === ref.cardTemplateId));
    const roots: CardTemplateRoot[] = [];
    for (let start = 0; start < missing.length; start += 100) roots.push(...await repo.cards.cards().find({ cardTemplateId: { $in: missing.slice(start, start + 100).map(ref => ref.cardTemplateId) } }, { session }).toArray());
    cards = target.content.cards.map(({ cardTemplateId }) => {
      const retained = experience.cardSelections.find(ref => ref.cardTemplateId === cardTemplateId);
      const root = roots.find(root => root.cardTemplateId === cardTemplateId);
      requireCondition(retained || root, "GROUP_PUBLIC_CONTENT_FORBIDDEN");
      return { cardTemplateId, version: retained?.version ?? root!.latestVersion };
    });
    await publicCards(repo.cards, cards, session);
  }
  requireCondition(targetVersion >= sourceVersion, "GROUP_VERSION_CONFLICT");
  if (targetVersion === sourceVersion) return { viewerUserId: actor, experienceId: experience.experienceId, review: null };
  const filter = { visibility: "public" as const, version: { $gt: sourceVersion, $lte: targetVersion } };
  const notes = kind === "card" ? await repo.cards.cardVersions().find({ cardTemplateId: entityId, ...filter }, { session, projection: { version: 1, updateNote: 1 } }).sort({ version: 1 }).toArray()
    : await repo.cards.deckVersions().find({ deckTemplateId: entityId, ...filter }, { session, projection: { version: 1, updateNote: 1 } }).sort({ version: 1 }).toArray();
  const command: GroupUpdateCommand = { viewerUserId: actor, experienceId: experience.experienceId, perspective: "group", kind, entityId,
    sourceVersion, targetVersion, expectedAdoptionRevision: experience.adoptionRevision, expectedStructureRevision: experience.structureRevision, cards };
  return { viewerUserId: actor, experienceId: experience.experienceId, review: { command, title,
    notes: notes.flatMap(({ version, updateNote }) => updateNote?.trim() ? [{ version, updateNote: updateNote.trim() }] : []) } };
}
export async function reviewGroupUpdate(repo: GroupExperienceRepository, actor: string, experienceId: string, kind: "card" | "deck", entityId: string) {
  return repo.transaction(async session => {
    const { experience } = await repo.access(actor, experienceId, "admin", session);
    return reviewInSession(repo, actor, experience, kind, entityId, session);
  });
}
export async function adoptGroupUpdate(repo: GroupExperienceRepository, actor: string, experienceId: string, input: unknown) {
  const command = adoptionCommand(input), review = command.review, commandHash = hash(command), now = new Date();
  requireCondition(review.viewerUserId === actor && review.experienceId === experienceId, "GROUP_UPDATE_SESSION_CONFLICT");
  return repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, experienceId, "admin", session);
    const replay = await repo.replay(actor, experience, command.operationId, commandHash, session);
    if (replay) return { ...replay, outcome: replay.outcome === "already-applied" ? "already-adopted" : "superseded", adoptionRevision: experience.adoptionRevision };
    const latest = await reviewInSession(repo, actor, experience, review.kind, review.entityId, session);
    if (!isDeepStrictEqual(latest.review?.command, review)) throw new GroupUpdateConflict(latest);
    const followers = await repo.members().find({ experienceId, followerStatus: "active" }, { session }).sort({ userId: 1 }).toArray();
    await repo.fence([member, ...followers], session);
    const old = (await selectedContent(repo.cards, experience, session)).cards.map(({ cardTemplateId, version }) => ({ cardTemplateId, version }));
    const selections = review.kind === "card" ? mergeRetainedAssignments(experience.cardSelections, [{ cardTemplateId: review.entityId, version: review.targetVersion }])
      : mergeRetainedAssignments(experience.cardSelections, review.cards);
    const nextRefs = review.kind === "card" ? old.map(ref => selections.find(selected => selected.cardTemplateId === ref.cardTemplateId)!) : review.cards;
    const guardRefs = review.kind === "card" ? [{ cardTemplateId: review.entityId, version: review.targetVersion }]
      : review.cards.filter(ref => !experience.cardSelections.some(selected => selected.cardTemplateId === ref.cardTemplateId));
    for (const ref of [...guardRefs].sort((a, b) => a.cardTemplateId.localeCompare(b.cardTemplateId))) {
      const guarded = await repo.cards.cards().updateOne({ cardTemplateId: ref.cardTemplateId, visibility: "public", latestVersion: ref.version }, { $inc: { referenceRevision: 1 } }, { session });
      requireCondition(guarded.matchedCount === 1, "GROUP_UPDATE_CONFLICT");
    }
    if (review.kind === "deck") {
      const guarded = await repo.cards.decks().updateOne({ deckTemplateId: experience.deckTemplateId, visibility: "public", latestVersion: review.targetVersion }, { $inc: { publicationGuard: 1 } }, { session });
      requireCondition(guarded.matchedCount === 1, "GROUP_UPDATE_CONFLICT");
    }
    for (const follower of followers) await repo.members().updateOne({ experienceId, userId: follower.userId }, { $set: {
      retainedCardAssignments: mergeRetainedAssignments(follower.retainedCardAssignments, [...old, ...nextRefs]),
      activeCardId: nextRefs.some(ref => ref.cardTemplateId === follower.activeCardId) ? follower.activeCardId : nextRefs[0]?.cardTemplateId ?? null,
    } }, { session });
    const updated = await repo.experiences().updateOne({ experienceId, structureRevision: review.expectedStructureRevision, adoptionRevision: review.expectedAdoptionRevision }, {
      $set: { cardSelections: selections, deckVersion: review.kind === "deck" ? review.targetVersion : experience.deckVersion, updatedAt: now },
      $inc: { structureRevision: 1, adoptionRevision: 1 },
    }, { session });
    requireCondition(updated.matchedCount === 1, "GROUP_UPDATE_CONFLICT");
    await repo.record(actor, experienceId, command.operationId, commandHash, experience.structureRevision + 1, now, session);
    return { viewerUserId: actor, experienceId, outcome: "updated", structureRevision: experience.structureRevision + 1, adoptionRevision: experience.adoptionRevision + 1 };
  });
}
