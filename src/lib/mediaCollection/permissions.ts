import type { MediaCollectionItem } from "./contracts";
export type MediaCapabilities = { canUpload: boolean; canRemoveOwn: boolean; canHideOthers: boolean; canManage: boolean };
export function mediaRemoveOperation(viewer: string, item: MediaCollectionItem, capabilities: MediaCapabilities, experienceId?: string): "delete" | "hide" | null {
  if (item.authorUserId === viewer) return capabilities.canRemoveOwn ? "delete" : null;
  return capabilities.canHideOthers && item.source.kind === "group" && item.source.experienceId === experienceId ? "hide" : null;
}
export function memberMediaCapabilities(member: { userId: string; isAdmin: boolean; followerStatus: string }, subjectUserId?: string, hasOwnShared = false): MediaCapabilities {
  const own = subjectUserId === member.userId;
  const canUpload = subjectUserId ? own && member.followerStatus === "active" : member.isAdmin;
  return { canUpload, canRemoveOwn: true, canHideOthers: member.isAdmin, canManage: canUpload || member.isAdmin || own || hasOwnShared };
}
