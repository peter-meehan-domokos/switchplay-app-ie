import { requireCondition } from "../cards/domain";
import type { GroupMember } from "./model";
export type GroupRole = "member" | "admin" | "follower";
export function authorize(member: GroupMember | null, role: GroupRole, epoch?: number): asserts member is GroupMember {
  if (member) requireCondition(typeof member.isAdmin === "boolean" && ["never", "active", "removed"].includes(member.followerStatus)
    && Number.isSafeInteger(member.accessEpoch) && member.accessEpoch >= 0, "INVALID_GROUP_MEMBERSHIP");
  requireCondition(member && (role === "admin" ? member.isAdmin : role === "follower" ? member.followerStatus === "active"
    : member.isAdmin || member.followerStatus === "active"), "GROUP_FORBIDDEN");
  requireCondition(epoch === undefined || member.accessEpoch === epoch, "GROUP_ACCESS_CONFLICT");
}
