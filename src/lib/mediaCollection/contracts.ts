import type { MediaItem } from "../media";
export type MediaSource = { kind: "personal"; cardTemplateId: string; mediaItemId: string }
  | { kind: "group"; experienceId: string; contributionId: string };
export type MediaCollectionContext = { viewerUserId: string; cardTemplateId: string; kind: "owner"; experienceId?: string; accessEpoch?: number }
  | { viewerUserId: string; cardTemplateId: string; kind: "group"; experienceId: string; subjectUserId?: string; accessEpoch: number; adoptionRevision: number; structureRevision?: number };
export type MediaCollectionItem = {
  source: MediaSource; authorUserId: string; mediaType: "image" | "video"; description: string;
  originalFilename?: string; authorName?: string;
  uploadedAt: string | null; originName: string | null; private: boolean;
  revision?: number; media?: MediaItem;
};
export type MediaCollectionPage = { capabilities?: import("./permissions").MediaCapabilities; viewerUserId: string; cardTemplateId: string; total: number; olderCount: number;
  items: MediaCollectionItem[]; start?: number; refresh?: string | null; older: string | null; newer: string | null;
  experienceId?: string; subjectUserId?: string | null; accessEpoch?: number; adoptionRevision?: number; structureRevision?: number };
export function collectionKey(item: Pick<MediaCollectionItem, "source">) {
  const s = item.source; return JSON.stringify(s.kind === "personal" ? ["personal", s.cardTemplateId, s.mediaItemId] : ["group", s.experienceId, s.contributionId]);
}

export function normaliseCollectionSelectionKey(key: string, cardTemplateId: string) {
  try { const parsed = JSON.parse(key); if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[1] === "string") return collectionKey({ source: { kind: "personal", cardTemplateId: parsed[0] ?? cardTemplateId, mediaItemId: parsed[1] } }); } catch { /* Existing collection keys are already typed. */ }
  return key;
}
