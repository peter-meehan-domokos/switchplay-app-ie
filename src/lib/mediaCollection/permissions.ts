import type { MediaCollectionItem } from "./contracts";
import { actingOrigin, mediaOrigin, sameOrigin, type CreationContext } from "../groupExperiences/media/contributionIdentity";
export type MediaCapabilities = { canUpload: boolean; canRemoveOwn: boolean; canHideOthers: boolean; canManage: boolean };
// Delete and Hide are separate operations (C2). Delete is offered only to the author acting in the exact context
// the item was created in (C1): the standalone Card for standalone media, Me in its Group for Follower
// contributions, the Group perspective of its Group for Admin contributions. Hide is offered to admins in the
// Group perspective for any other item originating in this Group, including their own Follower contribution.
export function mediaRemoveOperation(viewer: string, item: MediaCollectionItem, capabilities: MediaCapabilities, experienceId?: string, identity: CreationContext = "self"): "delete" | "hide" | null {
  if (item.authorUserId === viewer && sameOrigin(mediaOrigin(item), actingOrigin(experienceId, identity))) return capabilities.canRemoveOwn ? "delete" : null;
  // The viewer's own item seen from a Follower view (Me, standalone): neither delete nor hide.
  if (item.authorUserId === viewer && identity === "self") return null;
  return capabilities.canHideOthers && item.source.kind === "group" && item.source.experienceId === experienceId ? "hide" : null;
}
// The viewer's own item outside its creation context: Media Centre shows where it was created instead of Delete.
export function outsideCreationContext(viewer: string, item: MediaCollectionItem, experienceId?: string, identity: CreationContext = "self") {
  return item.authorUserId === viewer && !sameOrigin(mediaOrigin(item), actingOrigin(experienceId, identity));
}
export function memberMediaCapabilities(member: { userId: string; isAdmin: boolean; followerStatus: string }, subjectUserId?: string, hasOwnShared = false): MediaCapabilities {
  const own = subjectUserId === member.userId;
  const canUpload = subjectUserId ? own && member.followerStatus === "active" : member.isAdmin;
  return { canUpload, canRemoveOwn: true, canHideOthers: member.isAdmin, canManage: canUpload || member.isAdmin || own || hasOwnShared };
}
