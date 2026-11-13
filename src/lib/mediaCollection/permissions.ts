import type { MediaCollectionItem } from "./contracts";
import { sameIdentity, type CreationContext } from "../groupExperiences/media/contributionIdentity";
export type MediaCapabilities = { canUpload: boolean; canRemoveOwn: boolean; canHideOthers: boolean; canManage: boolean };
// Delete is offered only to the author acting as the identity that created the item (R1): Admin contributions in
// the Group perspective of their Group, Follower contributions in Me (their Group) or on the standalone Card.
// Anything else in this Group's feed, including the same user's other identity, can only be hidden by an admin.
export function mediaRemoveOperation(viewer: string, item: MediaCollectionItem, capabilities: MediaCapabilities, experienceId?: string, identity: CreationContext = "self"): "delete" | "hide" | null {
  if (sameIdentity(item, viewer, identity)) return capabilities.canRemoveOwn && (!experienceId || (item.source.kind === "group" && item.source.experienceId === experienceId)) ? "delete" : null;
  // The viewer's own other identity seen from a Follower view (Me, standalone): neither delete nor hide.
  if (item.authorUserId === viewer && identity === "self") return null;
  return capabilities.canHideOthers && item.source.kind === "group" && item.source.experienceId === experienceId ? "hide" : null;
}
export function memberMediaCapabilities(member: { userId: string; isAdmin: boolean; followerStatus: string }, subjectUserId?: string, hasOwnShared = false): MediaCapabilities {
  const own = subjectUserId === member.userId;
  const canUpload = subjectUserId ? own && member.followerStatus === "active" : member.isAdmin;
  return { canUpload, canRemoveOwn: true, canHideOthers: member.isAdmin, canManage: canUpload || member.isAdmin || own || hasOwnShared };
}
