import type { ClientSession } from "mongodb";
import { requireCondition } from "../cards/domain";
import { page } from "./contracts";
import { canInspectPeers } from "./policy";
import type { GroupExperienceRepository } from "./repository";
import type { GroupExperience, GroupMember } from "./model";

export async function activeIdentities(repo: GroupExperienceRepository, experience: GroupExperience, viewer: GroupMember,
  session: ClientSession, after?: string, limit = 30) {
  page(undefined, limit);
  let cursor: { sortName: string; userId: string } | undefined;
  if (after !== undefined) {
    requireCondition(after.length <= 2000, "INVALID_GROUP_PAGE");
    try { cursor = JSON.parse(Buffer.from(after, "base64url").toString()); } catch { requireCondition(false, "INVALID_GROUP_PAGE"); }
    requireCondition(cursor && typeof cursor.sortName === "string" && typeof cursor.userId === "string", "INVALID_GROUP_PAGE");
  }
  const rows = await repo.members().aggregate<{ userId: string; username: string; sortName: string }>([
    { $match: { experienceId: experience.experienceId, followerStatus: "active", ...(!canInspectPeers(experience, viewer) ? { userId: viewer.userId } : {}) } },
    { $lookup: { from: "users", let: { key: { $convert: { input: "$userId", to: "objectId", onError: "$userId" } } },
      pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$key"] } } }, { $project: { _id: 0, username: 1 } }], as: "identity" } },
    { $project: { _id: 0, userId: 1, username: { $ifNull: [{ $arrayElemAt: ["$identity.username", 0] }, "Unknown user"] } } },
    { $set: { sortName: { $toLower: "$username" } } },
    ...(cursor ? [{ $match: { $or: [{ sortName: { $gt: cursor.sortName } }, { sortName: cursor.sortName, userId: { $gt: cursor.userId } }] } }] : []),
    { $sort: { sortName: 1, userId: 1 } }, { $limit: limit + 1 },
  ], { session }).toArray();
  const visible = rows.slice(0, limit), last = visible.at(-1);
  return { followers: visible.map(({ userId, username }) => ({ userId, username })),
    nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ sortName: last.sortName, userId: last.userId })).toString("base64url") : null };
}
