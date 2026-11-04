import { isOriginalMediaFilename, type MediaItem } from "../media";
import type { PersonalMediaDisplayItem } from "../cards/personalHistoryProjection";

// Preserve filename-shaped legacy upload labels as a display fallback, without
// backfilling originalFilename or treating arbitrary descriptions as filenames.
// This presentation belongs to Media Centre only, never Card or Gallery captions.
export function mediaCentreMetadata(item: MediaItem, inGroup = false) {
  const collection = (item as PersonalMediaDisplayItem).collection;
  const original = collection?.originalFilename ?? item.originalFilename;
  const legacy = collection?.description ?? item.description;
  const legacyFilename = isOriginalMediaFilename(legacy) && /\.(?:jpe?g|png|gif|webp|avif|heic|heif|svg|bmp|tiff?|mp4|mov|m4v|webm|avi|mkv|mpeg|mpg|3gp)$/i.test(legacy) ? legacy : "Filename unavailable";
  return {
    filename: isOriginalMediaFilename(original) ? original : legacyFilename,
    ...(inGroup ? { uploader: collection?.authorName?.trim() || "Unknown user" } : {}),
    origin: collection?.source.kind === "group" ? collection.originName ?? "Group unavailable" : "Personal",
  };
}
