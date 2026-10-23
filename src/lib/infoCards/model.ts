import type { CloudflareR2ImageMediaItem, CloudflareStreamVideoMediaItem } from "../media";
import type { Visibility } from "../cards/model";

export type InfoMedia = CloudflareR2ImageMediaItem | CloudflareStreamVideoMediaItem;
export type InfoDraft = { title: string; body: string; seriesId: string | null; mediaItem: InfoMedia | null };
export type InfoContent = Omit<InfoDraft, "seriesId"> & { seriesId: string };
export type InfoRoot = {
  infoCardId: string; ownerUserId: string; visibility: Visibility; draftVisibility: Visibility;
  draft: InfoDraft | null; latestVersion: number; revision: number; referenceRevision: number;
  createdAt: Date; updatedAt: Date;
  // A content-free reservation after deletion prevents ID/publication reuse.
  deletedAt?: Date;
};
export type InfoPublication = {
  infoCardId: string; version: number; content: InfoContent; visibility: Visibility;
  publishedByUserId: string; publishedAt: Date; sourceRevision: number;
};
export type InfoSeries = { seriesId: string; title: string; normalisedTitle: string; createdByUserId: string; createdAt: Date };
export type PublishedInfo = {
  infoCardId: string; version: number; content: InfoContent; visibility: Visibility;
  ownerUserId: string; creatorUsername: string;
  series: { seriesId: string; title: string; createdByUserId: string; creatorUsername: string };
};
export type MediaContext = { infoCardId: string } & ({ kind: "draft"; revision: number } | { kind: "publication"; version: number });
export const EMPTY_INFO_DRAFT: InfoDraft = { title: "", body: "", seriesId: null, mediaItem: null };
