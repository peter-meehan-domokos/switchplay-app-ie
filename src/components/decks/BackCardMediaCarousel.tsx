import { isCloudflareStreamVideoMediaItem } from "@/lib/media";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";

import type { SyntheticEvent } from "react";

type BackCardMediaCarouselProps = {
  items: ModernUserCardMediaItem[];
  onOpen?: (mediaItemId: string, source: HTMLButtonElement) => void;
};

type LayoutMode = "count-1" | "count-2" | "count-3" | "count-4" | "count-5";

function getLayoutMode(count: number): LayoutMode {
  if (count === 1) return "count-1";
  if (count === 2) return "count-2";
  if (count === 3) return "count-3";
  if (count === 4) return "count-4";
  return "count-5";
}

function MediaItem({ item, index, count, onOpen }: { item: ModernUserCardMediaItem; index: number; count: number; onOpen?: BackCardMediaCarouselProps["onOpen"] }) {
  const isVideo = isCloudflareStreamVideoMediaItem(item);
  const src = isVideo ? getCloudflareStreamThumbnailUrl(item) : item.src;

  const content = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={item.description || "Card media"} className="back-card-media-carousel-image" />
      {isVideo && (
        <div className="back-card-media-carousel-play-affordance">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </>
  );
  if (!onOpen) return <div className="back-card-media-carousel-item">{content}</div>;
  const isolate = (event: SyntheticEvent) => event.stopPropagation();
  return <button type="button" className="back-card-media-carousel-item back-card-media-carousel-item--button"
    aria-label={`Open ${isVideo ? "video" : "image"} ${index + 1} of ${count}: ${item.description || "Card media"}`}
    aria-haspopup="dialog" onClick={(event) => { event.stopPropagation(); onOpen(item.id, event.currentTarget); }}
    onPointerDown={isolate} onPointerMove={isolate} onPointerUp={isolate} onPointerCancel={isolate} onKeyDown={isolate} onKeyUp={isolate}>
    {content}
  </button>;
}

export default function BackCardMediaCarousel({ items, onOpen }: BackCardMediaCarouselProps) {
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
      {renderedItems.map((item, index) => (
        <MediaItem key={item.id} item={item} index={index} count={items.length} onOpen={onOpen} />
      ))}
    </section>
  );
}
