import { collectionKey, type MediaCollectionItem, type MediaCollectionContext } from "./contracts";
import type { PersonalMediaDisplayItem } from "../cards/personalHistoryProjection";
import type { GalleryMediaRequest as CardMediaRequest } from "../cardMediaViewer";
export function groupMediaUrl(source: { contributionId: string }, action: string, authority?: { experienceId: string; subjectUserId?: string }, file = false) {
  return `/api/group-media/${encodeURIComponent(source.contributionId)}${file ? "/file" : ""}?${new URLSearchParams({ action,
    ...(authority ? { experienceId: authority.experienceId, ...(authority.subjectUserId ? { subjectUserId: authority.subjectUserId } : {}) } : {}) })}`;
}
export function collectionDisplayItem(item: MediaCollectionItem, context: MediaCollectionContext): PersonalMediaDisplayItem {
  if (item.source.kind === "personal" && item.media) return { ...item.media, sourceCardTemplateId: item.source.cardTemplateId, collection: item };
  if (item.source.kind !== "group") throw Error("Invalid media collection source");
  const authority = context.kind === "group" ? { experienceId: context.experienceId, subjectUserId: context.subjectUserId } : undefined;
  const src = groupMediaUrl(item.source, "playback", authority);
  // A presentation-only reference. The selected-video adapter resolves the real
  // provider asset from its authorised grant; this object is never persisted.
  return item.mediaType === "image" ? { id: collectionKey(item), mediaType: "image", src, description: item.description, collection: item }
    : { id: collectionKey(item), mediaType: "video", provider: "cloudflare-stream", assetId: item.source.contributionId,
      src, thumbnailSrc: groupMediaUrl(item.source, "thumbnail", authority), description: item.description, collection: item };
}
export function collectionTarget(item: PersonalMediaDisplayItem, target: CardMediaRequest, context?: MediaCollectionContext): CardMediaRequest {
  const source = item.collection?.source;
  if (source?.kind !== "group") return target;
  return { ...target, groupMedia: { contributionId: source.contributionId, mediaType: item.mediaType,
    ...(context?.kind === "group" ? { experienceId: context.experienceId, subjectUserId: context.subjectUserId } : {}) } };
}
