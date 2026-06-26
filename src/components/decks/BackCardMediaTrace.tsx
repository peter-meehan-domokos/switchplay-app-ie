import type { MediaItem } from "@/lib/media";
import { isImageMediaItem } from "@/lib/media";

export type BackCardMediaTraceItem = MediaItem;

type BackCardMediaTraceProps = {
  trace?: BackCardMediaTraceItem | null;
};

export default function BackCardMediaTrace({ trace }: BackCardMediaTraceProps) {
  if (!isImageMediaItem(trace)) {
    return null;
  }

  return (
    <section className="focused-card-back-media" aria-label={trace.description}>
      <div className={`back-card-media-trace back-card-media-trace--${trace.mediaType}`} role="img">
        <img src={trace.src} alt="" aria-hidden="true" />
      </div>
    </section>
  );
}
