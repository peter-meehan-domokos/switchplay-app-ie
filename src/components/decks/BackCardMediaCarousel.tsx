import { isCloudflareStreamVideoMediaItem, isVideoMediaItem } from "@/lib/media";
import type { MediaItem } from "@/lib/media";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";

type BackCardMediaCarouselProps = {
  items: MediaItem[];
};

type LayoutMode = "count-1" | "count-2" | "count-3" | "count-4" | "count-5";

function getLayoutMode(count: number): LayoutMode {
  if (count === 1) return "count-1";
  if (count === 2) return "count-2";
  if (count === 3) return "count-3";
  if (count === 4) return "count-4";
  return "count-5";
}

function MediaItem({ item }: { item: MediaItem }) {
  const isVideo = isVideoMediaItem(item);
  const src = isCloudflareStreamVideoMediaItem(item) ? getCloudflareStreamThumbnailUrl(item) : isVideoMediaItem(item) ? item.thumbnailSrc : item.src;

  return (
    <div className="back-card-media-carousel-item">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={item.description || "Card media"} className="back-card-media-carousel-image" /> : <span>{item.description || "Video"}</span>}
      {isVideo && (
        <div className="back-card-media-carousel-play-affordance">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function BackCardMediaCarousel({ items }: BackCardMediaCarouselProps) {
  if (items.length === 0) {
    return null;
  }

  const renderedItems = items.slice(0, 5);
  const mode = getLayoutMode(renderedItems.length);

  return (
    <section
      className={`back-card-media-carousel back-card-media-carousel--${mode}`}
      aria-label="Card media"
    >
      {renderedItems.map((item) => (
        <MediaItem key={item.id} item={item} />
      ))}
    </section>
  );
}
