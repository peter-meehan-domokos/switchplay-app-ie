export type BackCardMediaTraceItem = {
  id: string;
  mediaType: "image" | "video";
  description: string;
  src: string;
};

type BackCardMediaTraceProps = {
  trace?: BackCardMediaTraceItem | null;
};

export default function BackCardMediaTrace({ trace }: BackCardMediaTraceProps) {
  if (!trace) {
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
