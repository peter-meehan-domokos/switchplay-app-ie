import { isCloudflareStreamVideoMediaItem } from "./media";
import { stepMediaItems, type StepMediaDestination } from "./stepMedia";

export function selectedStepMedia(destination: StepMediaDestination | undefined, attachmentId?: string) {
  const items = destination ? stepMediaItems(destination) : [];
  return items.find(item => item.id === attachmentId) ?? items[0] ?? null;
}
/** Preserve four legacy preparations; add only the active item's immediate
 * neighbours. Never proactively decode all sixteen possible poster images. */
export function stepVideoPreparations(destinations: readonly StepMediaDestination[], selection?: { index: number; attachmentId?: string }) {
  const first = destinations.map(destination => stepMediaItems(destination).find(item => item.kind === "video"));
  const items = selection && destinations[selection.index] ? stepMediaItems(destinations[selection.index]) : [];
  const index = Math.max(0, items.findIndex(item => item.id === selection?.attachmentId));
  const candidates = [...first, ...items.slice(Math.max(0, index - 1), index + 2)];
  const videos = candidates.flatMap(item => item?.kind === "video" && isCloudflareStreamVideoMediaItem(item.media) ? [item.media] : []);
  return [...new Map(videos.map(item => [item.assetId, item])).values()];
}
