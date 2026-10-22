"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./InfoCardFace.module.css";

// Presentation only: no publication, ownership or backend DTO assumptions.
export type InfoCardFaceContent = {
  title: string;
  seriesTitle: string;
  seriesCreatorUsername: string;
  body: string;
  mediaKind?: "image" | "video";
};

export default function InfoCardFace({ card, onOpenMedia }: {
  card: InfoCardFaceContent;
  onOpenMedia?: () => void;
}) {
  const titleId = useId();
  const tooltipId = useId();
  const attribution = useRef<HTMLSpanElement>(null);
  const [showCreator, setShowCreator] = useState(false);

  useEffect(() => {
    if (!showCreator) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!attribution.current?.contains(event.target as Node)) setShowCreator(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [showCreator]);

  return (
    <article className={styles.face} aria-labelledby={titleId} data-info-card-face="">
      <h3 id={titleId} className={styles.header} data-info-card-header="">
        <span
          ref={attribution}
          className={styles.attribution}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") setShowCreator(true); }}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") setShowCreator(false); }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setShowCreator(false); }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && showCreator) {
              event.stopPropagation();
              event.preventDefault();
              setShowCreator(false);
            }
          }}
        >
          <button
            type="button"
            className={styles.series}
            aria-label={`Series ${card.seriesTitle}; show series creator`}
            aria-expanded={showCreator}
            aria-describedby={showCreator ? tooltipId : undefined}
            onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setShowCreator(true); }}
            onClick={() => setShowCreator((value) => !value)}
          >{card.seriesTitle}</button>
          {showCreator ? <span className={styles.tooltip} id={tooltipId} role="tooltip">{card.seriesCreatorUsername}</span> : null}
        </span>
        <span className={styles.separator} aria-hidden="true"> · </span>
        <span className={styles.title} data-info-card-title="">{card.title}</span>
      </h3>
      <div className={styles.body} data-info-card-body="">
        {card.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      {card.mediaKind ? (
        <button className={styles.media} type="button" onClick={onOpenMedia} disabled={!onOpenMedia}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            {card.mediaKind === "video" ? <path d="M6 3.5 16 10 6 16.5Z" /> : <><rect x="2" y="3" width="16" height="14" rx="2" /><path d="m3 14 4-5 4 4 3-3 3 4" /><circle cx="13" cy="7" r="1" /></>}
          </svg>
          {card.mediaKind === "video" ? "Watch video" : "View image"}
        </button>
      ) : null}
    </article>
  );
}
