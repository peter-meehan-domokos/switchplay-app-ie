import { collectionKey, isFollowerSharedAdminItem, isIncludedGroupAdminItem, type MediaCollectionItem, type MediaCollectionContext } from "./contracts";
import type { PersonalMediaDisplayItem } from "../cards/personalHistoryProjection";
import type { GalleryMediaRequest as CardMediaRequest } from "../cardMediaViewer";
export function groupMediaUrl(source: { contributionId: string }, action: string, authority?: { experienceId: string; subjectUserId?: string }, file = false) {
  return `/api/group-media/${encodeURIComponent(source.contributionId)}${file ? "/file" : ""}?${new URLSearchParams({ action,
    ...(authority ? { experienceId: authority.experienceId, ...(authority.subjectUserId ? { subjectUserId: authority.subjectUserId } : {}) } : {}) })}`;
}
// Group contributions are delivered through the Group in the Group perspective and inspection, and so is an Admin
// contribution shown in a follower's Me (V1); the viewer's own Follower contributions use their owner route. An
// Admin contribution included in an inspection (4.5c) is Group content, so it is delivered without the subject.
function deliveryAuthority(item: MediaCollectionItem, context?: MediaCollectionContext) {
  return context?.kind === "group" ? { experienceId: context.experienceId, subjectUserId: isIncludedGroupAdminItem(item, context) ? undefined : context.subjectUserId }
    : context?.kind === "owner" && isFollowerSharedAdminItem(item, context.experienceId) ? { experienceId: context.experienceId! } : undefined;
}
export function collectionDisplayItem(item: MediaCollectionItem, context: MediaCollectionContext): PersonalMediaDisplayItem {
  if (item.source.kind === "personal" && item.media) return { ...item.media, sourceCardTemplateId: item.source.cardTemplateId, collection: item };
  if (item.source.kind !== "group") throw Error("Invalid media collection source");
  const authority = deliveryAuthority(item, context);
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
  const authority = deliveryAuthority(item.collection!, context);
  return { ...target, groupMedia: { contributionId: source.contributionId, mediaType: item.mediaType, ...(authority ?? {}) } };
}
