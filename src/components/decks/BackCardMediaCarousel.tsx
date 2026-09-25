import { isCloudflareStreamVideoMediaItem } from "@/lib/media";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";

type BackCardMediaCarouselProps = {
  items: ModernUserCardMediaItem[];
};

export default function BackCardMediaCarousel({ items }: BackCardMediaCarouselProps) {
  if (items.length === 0) {
    return null;
  }

  const visibleItems = items.slice(0, 3);
  const itemCount = items.length >= 3 ? 3 : items.length;
  
  return (
    <section 
      className={`back-card-media-carousel back-card-media-carousel--count-${itemCount}`} 
      aria-label="Card media"
    >
      {visibleItems.map((item) => {
        const isVideo = isCloudflareStreamVideoMediaItem(item);
        const src = isVideo ? getCloudflareStreamThumbnailUrl(item) : item.src;
        
        return (
          <div className="back-card-media-carousel-item" key={item.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={item.description || "Card media"} className="back-card-media-carousel-image" />
            {isVideo && (
              <div className="back-card-media-carousel-play-affordance">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
