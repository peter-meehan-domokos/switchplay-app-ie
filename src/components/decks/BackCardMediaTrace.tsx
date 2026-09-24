import StreamVideoReadinessPreview from "@/components/media/StreamVideoReadinessPreview";
import { isCloudflareR2ImageMediaItem, isCloudflareStreamVideoMediaItem } from "@/lib/media";
import type { MediaUploadTarget } from "@/lib/mediaUploadClient";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";

type BackCardMediaTraceProps = {
  items: ModernUserCardMediaItem[];
  target: Extract<MediaUploadTarget, { scope: "user-card" }>;
};

export default function BackCardMediaTrace({ items, target }: BackCardMediaTraceProps) {
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
              <StreamVideoReadinessPreview mediaItem={item} target={target} />
            </div>
          );
        }

        return null;
      })}
    </section>
  );
}
