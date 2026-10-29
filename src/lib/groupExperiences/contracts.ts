import { createHash } from "node:crypto";
import { isRecord, nonblank, requireCondition } from "../cards/domain";
import { assertPreviewManifest } from "../cards/libraryEntry";
import type { CreateExperience, GroupUpdateCommand, LearningCommand, MemberCommand } from "./model";

export function id(value: unknown): asserts value is string {
  requireCondition(nonblank(value) && value.length <= 200 && value === value.trim(), "INVALID_GROUP_ID");
}
export function revision(value: unknown): asserts value is number {
  requireCondition(Number.isSafeInteger(value) && Number(value) >= 0, "INVALID_GROUP_REVISION");
}
export function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  requireCondition(isRecord(value) && Object.keys(value).every(key => keys.includes(key)), "INVALID_GROUP_FIELDS");
}
export function hash(value: unknown): string {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : isRecord(v)
    ? Object.fromEntries(Object.keys(v).sort().map(key => [key, canonical(v[key])])) : v;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
export function createCommand(value: unknown): CreateExperience {
  exact(value, ["operationId", "name", "adminIds", "followerIds", "manifest"]); id(value.operationId);
  requireCondition(nonblank(value.name) && value.name.trim().length <= 120, "INVALID_GROUP_NAME");
  requireCondition(Array.isArray(value.adminIds) && Array.isArray(value.followerIds), "INVALID_GROUP_MEMBERS");
  for (const user of [...value.adminIds, ...value.followerIds]) id(user);
  assertPreviewManifest(value.manifest);
  return { operationId: value.operationId, name: value.name.trim(), adminIds: [...new Set(value.adminIds as string[])].sort(),
    followerIds: [...new Set(value.followerIds as string[])].sort(), manifest: value.manifest };
}
export function memberCommand(value: unknown): MemberCommand {
  exact(value, ["operationId", "expectedStructureRevision", "targetUserId", "kind", "isAdmin"]);
  id(value.operationId); id(value.targetUserId); revision(value.expectedStructureRevision);
  requireCondition((value.kind === "add-follower" || value.kind === "remove-follower") && value.isAdmin === undefined
    || value.kind === "set-admin" && typeof value.isAdmin === "boolean", "INVALID_GROUP_MEMBER_COMMAND");
  return value as MemberCommand;
}
export function adoptionCommand(value: unknown): { operationId: string; review: GroupUpdateCommand } {
  exact(value, ["operationId", "review"]); id(value.operationId);
  exact(value.review, ["viewerUserId", "experienceId", "perspective", "kind", "entityId", "sourceVersion", "targetVersion", "expectedAdoptionRevision", "expectedStructureRevision", "cards"]);
  const review = value.review; id(review.viewerUserId); id(review.experienceId); id(review.entityId);
  requireCondition(review.perspective === "group" && (review.kind === "card" || review.kind === "deck"), "INVALID_GROUP_UPDATE");
  revision(review.expectedAdoptionRevision); revision(review.expectedStructureRevision);
  requireCondition(Number.isSafeInteger(review.sourceVersion) && Number(review.sourceVersion) >= 1
    && Number.isSafeInteger(review.targetVersion) && Number(review.targetVersion) > Number(review.sourceVersion), "INVALID_GROUP_UPDATE");
  assertPreviewManifest({ deckTemplateId: review.entityId, deckVersion: review.targetVersion, cards: review.cards });
  requireCondition(review.kind === "deck" || (review.cards as unknown[]).length === 0, "INVALID_GROUP_UPDATE");
  return value as { operationId: string; review: GroupUpdateCommand };
}
export function learningCommand(value: unknown): LearningCommand {
  exact(value, ["accessEpoch", "version", "change"]); revision(value.accessEpoch);
  requireCondition(Number.isSafeInteger(value.version) && Number(value.version) >= 1, "INVALID_GROUP_VERSION");
  exact(value.change, ["kind", "stepId", "completionStatus", "reading"]);
  requireCondition(value.change.kind === "completion" && value.change.reading === undefined
    || value.change.kind === "signal" && value.change.completionStatus === undefined, "INVALID_GROUP_LEARNING");
  return value as LearningCommand;
}
export function page(after?: string, limit = 30) {
  if (after !== undefined) id(after);
  requireCondition(Number.isSafeInteger(limit) && limit >= 1 && limit <= 100, "INVALID_GROUP_PAGE");
  return { after, limit };
}
