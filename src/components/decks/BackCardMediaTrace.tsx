import CloudflareStreamPlayer from "@/components/media/CloudflareStreamPlayer";
import { isCloudflareR2ImageMediaItem, isCloudflareStreamVideoMediaItem } from "@/lib/media";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";

type BackCardMediaTraceProps = {
  items: ModernUserCardMediaItem[];
};

export default function BackCardMediaTrace({ items }: BackCardMediaTraceProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="focused-card-back-media" aria-label="Card media">
      {items.map((item) => {
        if (isCloudflareR2ImageMediaItem(item)) {
          return (
            <div className="back-card-media-trace back-card-media-trace--image" key={item.id}>
              {/* User uploads are delivered from the configured R2 custom domain. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.description} />
            </div>
          );
        }

        if (isCloudflareStreamVideoMediaItem(item)) {
          return (
            <div className="back-card-media-trace back-card-media-trace--video" data-creator-pan-exempt key={item.id}>
              <CloudflareStreamPlayer mediaItem={item} />
            </div>
          );
        }

        return null;
      })}
    </section>
  );
}
