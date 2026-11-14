import VisibilityIndicator from "@/components/media/VisibilityIndicator";
import { personalMediaKey } from "@/lib/cards/personalHistoryProjection";
import { imageDeliveryUrl } from "@/lib/mediaDelivery";
import { isCloudflareStreamVideoMediaItem, isVideoMediaItem } from "@/lib/media";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";
import type { PersonalMediaDisplayItem } from "@/lib/cards/personalHistoryProjection";

type BackCardMediaCarouselProps = {
  items: PersonalMediaDisplayItem[];
  showPrivate?: boolean;
  onOpen?: (mediaKey: string, source: HTMLButtonElement) => void;
};

type LayoutMode = "count-1" | "count-2" | "count-3" | "count-4" | "count-5";

function getLayoutMode(count: number): LayoutMode {
  if (count === 1) return "count-1";
  if (count === 2) return "count-2";
  if (count === 3) return "count-3";
  if (count === 4) return "count-4";
  return "count-5";
}

function MediaItem({ item, index, count, onOpen }: { item: PersonalMediaDisplayItem; index: number; count: number; onOpen?: BackCardMediaCarouselProps["onOpen"] }) {
  const isVideo = isVideoMediaItem(item);
  const src = item.collection?.source.kind === "group" && item.mediaType === "video" ? item.thumbnailSrc : isCloudflareStreamVideoMediaItem(item) ? getCloudflareStreamThumbnailUrl(item) : isVideoMediaItem(item) ? item.thumbnailSrc : imageDeliveryUrl(item.src);

  const contents = (<>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={item.description || "Card media"} className="back-card-media-carousel-image" /> : <span>{item.description || "Video"}</span>}
      {isVideo && (
        <div className="back-card-media-carousel-play-affordance">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </>);
  return onOpen ? <button type="button" className="back-card-media-carousel-item back-card-media-carousel-item--button"
    aria-label={`Open ${isVideo ? "video" : "image"} ${index + 1} of ${count}: ${item.description}`}
    aria-haspopup="dialog" onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()}
    onPointerUp={event => event.stopPropagation()} onPointerCancel={event => event.stopPropagation()}
    onKeyDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); onOpen(personalMediaKey(item), event.currentTarget); }}>{contents}</button>
    : <div className="back-card-media-carousel-item">{contents}</div>;
}

export default function BackCardMediaCarousel({ items, onOpen, showPrivate = false }: BackCardMediaCarouselProps) {
  if (items.length === 0) {
    return null;
  }

  const renderedItems = items.slice(0, 5);
  const mode = getLayoutMode(renderedItems.length);
  const privateLabels = showPrivate;

  return (
    <section
      className={`back-card-media-carousel back-card-media-carousel--${mode}${privateLabels ? " back-card-media-carousel--private" : ""}`}
      aria-label="Card media"
    >
      {renderedItems.map((item, index) => privateLabels ? <span className="media-private-slot" key={personalMediaKey(item)}>
        <MediaItem index={index} count={items.length} onOpen={onOpen} item={item} />
        <span className="media-private-label">{item.collection?.creationContext === "group" ? null
          /* Group content in Me (V1): the slot keeps the geometry, but no visibility indicator. */
          : <VisibilityIndicator visible={item.collection?.private === false} />}</span>
      </span> : <MediaItem index={index} count={items.length} onOpen={onOpen} key={personalMediaKey(item)} item={item} />)}
    </section>
  );
}
