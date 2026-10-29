import { createHash } from "node:crypto";
import { isRecord, nonblank, requireCondition } from "../cards/domain";
import { assertPreviewManifest } from "../cards/libraryEntry";
import type { CreateExperience, LearningCommand, MemberCommand } from "./model";

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
  requireCondition(value.kind === "add-follower" && value.isAdmin === undefined
    || value.kind === "set-admin" && typeof value.isAdmin === "boolean", "INVALID_GROUP_MEMBER_COMMAND");
  return value as MemberCommand;
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
