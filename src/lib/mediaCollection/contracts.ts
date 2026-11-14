import type { MediaItem } from "../media";
export type MediaSource = { kind: "personal"; cardTemplateId: string; mediaItemId: string }
  | { kind: "group"; experienceId: string; contributionId: string };
export type MediaCollectionContext = { viewerUserId: string; cardTemplateId: string; kind: "owner"; experienceId?: string; accessEpoch?: number }
  | { viewerUserId: string; cardTemplateId: string; kind: "group"; experienceId: string; subjectUserId?: string; accessEpoch: number; adoptionRevision: number; structureRevision?: number;
    // Follower inspection with the Include Group content toggle on (checkpoint 4.5c): the Group's Admin contributions
    // join the inspected follower's own. Never prepared in advance; read from the Group feed when first shown.
    includeGroupContent?: true };
export type MediaCollectionItem = {
  source: MediaSource; authorUserId: string; mediaType: "image" | "video"; description: string;
  originalFilename?: string; authorName?: string;
  uploadedAt: string | null; originName: string | null; private: boolean;
  revision?: number; media?: MediaItem;
  // Group contributions only: the identity that created it (contributionIdentity.ts). Missing reads as "self".
  creationContext?: import("../groupExperiences/media/contributionIdentity").CreationContext;
};
export type MediaCollectionPage = { capabilities?: import("./permissions").MediaCapabilities; viewerUserId: string; cardTemplateId: string; total: number; olderCount: number;
  items: MediaCollectionItem[]; start?: number; refresh?: string | null; older: string | null; newer: string | null;
  experienceId?: string; subjectUserId?: string | null; accessEpoch?: number; adoptionRevision?: number; structureRevision?: number };
// An Admin contribution of the current Group shown in a follower's Me (V1, checkpoint 4.5b). It is Group content:
// another identity's item, read and delivered through the Group, never private and never managed from Me.
export function isFollowerSharedAdminItem(item: Pick<MediaCollectionItem, "source" | "creationContext" | "private">, experienceId?: string) {
  return !!experienceId && item.source.kind === "group" && item.source.experienceId === experienceId && item.creationContext === "group" && !item.private;
}
// An Admin contribution of the current Group added to a follower inspection by Include Group content (4.5c).
export function isIncludedGroupAdminItem(item: Pick<MediaCollectionItem, "source" | "creationContext" | "private">, context: MediaCollectionContext) {
  return context.kind === "group" && !!context.subjectUserId && !!context.includeGroupContent && item.creationContext === "group"
    && item.source.kind === "group" && item.source.experienceId === context.experienceId && !item.private;
}
export function collectionKey(item: Pick<MediaCollectionItem, "source">) {
  const s = item.source; return JSON.stringify(s.kind === "personal" ? ["personal", s.cardTemplateId, s.mediaItemId] : ["group", s.experienceId, s.contributionId]);
}

export function normaliseCollectionSelectionKey(key: string, cardTemplateId: string) {
  try { const parsed = JSON.parse(key); if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[1] === "string") return collectionKey({ source: { kind: "personal", cardTemplateId: parsed[0] ?? cardTemplateId, mediaItemId: parsed[1] } }); } catch { /* Existing collection keys are already typed. */ }
  return key;
}
