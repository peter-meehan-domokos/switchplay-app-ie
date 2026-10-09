import { ObjectId, type ClientSession } from "mongodb";
import { COLLECTIONS, type CardRepository } from "./repository";
import { nonblank } from "./domain";
import type { CardTemplateRoot } from "./model";
export const UNKNOWN_CREATOR = "Unknown creator";
export async function creatorUsernames(repo: CardRepository, ids: string[], session?: ClientSession) {
  const keys = [...new Set(ids.filter(nonblank))].map((id) => /^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : id);
  const users = keys.length ? await repo.db.collection<{ _id: ObjectId | string; username?: string }>(COLLECTIONS.users)
    .find({ _id: { $in: keys } }, { session, projection: { username: 1 } }).toArray() : [];
  return new Map(users.map((user) => [String(user._id), nonblank(user.username) ? user.username : UNKNOWN_CREATOR]));
}
export async function cardCreatorAttributions(repo: CardRepository, roots: CardTemplateRoot[], session?: ClientSession) {
  const ids = [...new Set(roots.flatMap((root) => root.forkedFrom ? [root.forkedFrom.cardTemplateId] : []))];
  const sources = ids.length ? await repo.cards().find({ cardTemplateId: { $in: ids } }, { session, projection: { cardTemplateId: 1, ownerUserId: 1 } }).toArray() : [];
  const owners = new Map(sources.map((root) => [root.cardTemplateId, root.ownerUserId]));
  const names = await creatorUsernames(repo, [...roots.map((root) => root.ownerUserId), ...sources.map((root) => root.ownerUserId)], session);
  return new Map(roots.map((root) => [root.cardTemplateId, { username: names.get(root.ownerUserId) ?? UNKNOWN_CREATOR,
    immediateSourceUsername: root.forkedFrom ? names.get(owners.get(root.forkedFrom.cardTemplateId) ?? "") ?? UNKNOWN_CREATOR : null }]));
}
