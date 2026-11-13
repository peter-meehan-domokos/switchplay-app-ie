"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./InfoCardFace.module.css";
import MathsRenderer from "../maths-renderer/MathsRenderer";
import mathsStyles from "./InfoCardMaths.module.css";
import VisibilityIndicator from "../media/VisibilityIndicator";
import { combineInfoMathsMeasurement, infoMathsPresentation, type InfoMathsMeasurement, type InfoMathsPart } from "./infoCardMaths";
import { buildInfoCardContentLayout, infoContentItems, type InfoCardContentLayout, type InfoContentItem } from "./infoCardContentLayout";
import type { MathsResult } from "../maths-renderer/types";
import InfoCardMenu, { type InfoCardActions } from "./InfoCardMenu";
import { buildInfoCardTypeLayout, infoCardType, type InfoCardType } from "./infoCardTypeLayout";

// Presentation only: no publication, ownership or backend DTO assumptions.
export type InfoCardFaceContent = {
  creatorUsername?: string;
  personal?: boolean;
  /** Overrides the type derived from `personal`; Group Admin cards set it. */
  infoType?: InfoCardType;
  title: string;
  seriesTitle: string;
  seriesCreatorUsername: string;
  body: string;
  bodyFormat?: "latex-v1";
  mediaKind?: "image" | "video";
  /** The viewer own Info Card shown inside a Group (Me): the existing media visibility indicator, eye when shared
   *  with this Group and eye-off when private (standalone, from another Group, or hidden here). */
  groupVisibility?: "visible" | "private";
};

export default function InfoCardFace({ card, onOpenMedia, onMathsResult, actions }: {
  card: InfoCardFaceContent;
  onOpenMedia?: () => void;
  onMathsResult?: (result: InfoMathsMeasurement) => void;
  actions?: InfoCardActions;
}) {
  const face = useRef<HTMLElement>(null), body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const tooltipId = useId();
  const creatorRef = useRef<HTMLDivElement>(null);
  const attribution = useRef<HTMLSpanElement>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [showAuthor, setShowAuthor] = useState(false), authorId = useId();
  const creator = card.creatorUsername || "Unknown creator";
  const type = buildInfoCardTypeLayout(infoCardType(card));

  // An outside tap closes the credit tooltip. iOS Safari does not blur a button on tap, so blur alone is not enough.
  useEffect(() => {
    if (!showAuthor) return;
    const close = (event: PointerEvent) => { if (!(event.target instanceof Node) || !creatorRef.current?.contains(event.target)) setShowAuthor(false); };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [showAuthor]);

  useEffect(() => {
    if (!showCreator) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!attribution.current?.contains(event.target as Node)) setShowCreator(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setShowCreator(false);
    };
    // Observe before the consultation consumes bubbling background events.
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [showCreator]);

  return (
    <article ref={face} className={`${styles.face}${type.type === "personal" ? ` ${styles.personal}` : type.type === "groupAdmin" ? ` ${styles.groupAdmin}` : ""}${card.bodyFormat ? ` ${mathsStyles.mathsFace}` : ""}`} aria-labelledby={titleId} data-info-card-face="" data-info-card-type={type.type}>
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
      <div ref={body} className={card.bodyFormat ? styles.mathsBody : styles.body} data-info-card-body="">
        {card.bodyFormat ? <InfoMathsBody body={card.body} renderKey={JSON.stringify([card.title, card.seriesTitle, card.mediaKind])}
          onMeasured={parts => { if (face.current && body.current) onMathsResult?.(combineInfoMathsMeasurement(parts.parts, parts.diagnostics, face.current, body.current)); }} />
          : card.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      <footer className={styles.footer} data-info-card-footer="">
      {card.mediaKind ? (
        <button className={styles.media} data-info-card-media="" type="button" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setShowCreator(false); onOpenMedia?.(); }} disabled={!onOpenMedia}
          aria-label={card.mediaKind === "video" ? "Watch video" : "View image"} data-media-kind={card.mediaKind}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            {card.mediaKind === "video" ? <path d="M6 3.5 16 10 6 16.5Z" /> : <><rect x="2" y="3" width="16" height="14" rx="2" /><path d="m3 14 4-5 4 4 3-3 3 4" /><circle cx="13" cy="7" r="1" /></>}
          </svg>
        </button>
      ) : null}
      <div className={styles.creator} ref={creatorRef} data-info-card-creator="" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
        onBlur={() => setShowAuthor(false)} onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); setShowAuthor(false); } }}>
        <span className={styles.typeLabel} data-info-card-type-label="">{type.label}{card.groupVisibility &&
          <span className={styles.visibility} data-info-card-visibility={card.groupVisibility}><VisibilityIndicator visible={card.groupVisibility === "visible"} /></span>}</span>
        <button type="button" aria-label={`Card by ${creator}`} aria-expanded={showAuthor} aria-describedby={showAuthor ? authorId : undefined}
          onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setShowAuthor(true); }}
          onClick={() => setShowAuthor(value => !value)}>{creator}</button>
        {showAuthor && <span id={authorId} role="tooltip" className={styles.authorTooltip}>{creator}</span>}
      </div>
      {actions && <InfoCardMenu {...actions} />}
      </footer>
    </article>
  );
}

// Formatted maths body: one MathsRenderer per content item, laid out by buildInfoCardContentLayout. Untagged
// content without extra blank lines is a single item, exactly as before. Results are reported once every item
// has measured, so the combined measurement always describes the whole body.
function InfoMathsBody({ body, renderKey, onMeasured }: {
  body: string;
  renderKey: string;
  onMeasured: (measured: { parts: InfoMathsPart[]; diagnostics: InfoCardContentLayout["diagnostics"] }) => void;
}) {
  const layout = useMemo(() => {
    const built = buildInfoCardContentLayout(body);
    // An empty body still renders (and measures) one empty item.
    return infoContentItems(built).length ? built : { ...built, blocks: [{ vCentre: false, items: [{ kind: "content" as const, source: body, offset: 0, centre: false }] }] };
  }, [body]);
  const items = infoContentItems(layout);
  const key = `${renderKey}:${body}`;
  const results = useRef<{ key: string; parts: Map<number, InfoMathsPart> }>({ key, parts: new Map() });
  const report = (index: number, part: InfoMathsPart) => {
    if (results.current.key !== key) results.current = { key, parts: new Map() };
    results.current = { key, parts: new Map(results.current.parts).set(index, part) };
    if (results.current.parts.size === items.length) onMeasured({ parts: items.map((_, i) => results.current.parts.get(i)!), diagnostics: layout.diagnostics });
  };
  const indexOf = (item: InfoContentItem) => items.indexOf(item);
  return <>{layout.blocks.map((block, blockIndex) => <div key={blockIndex} className={block.vCentre ? styles.vCentre : styles.contentBlock} data-info-content-block={block.vCentre ? "v-centre" : ""}>
    <div className={block.vCentre ? styles.vCentreInner : undefined}>
      {block.items.map((item, itemIndex) => item.kind === "spacer"
        ? <div key={itemIndex} aria-hidden="true" data-info-content-spacer={item.blankLines} style={{ height: item.heightEm * infoMathsPresentation.fontSizePx }} />
        : <InfoMathsItem key={`${key}:${itemIndex}`} item={item} onResult={(result, root) => report(indexOf(item), { result, root, offset: item.offset })} />)}
    </div>
  </div>)}</>;
}

function InfoMathsItem({ item, onResult }: { item: InfoContentItem; onResult: (result: MathsResult, root: HTMLElement | null) => void }) {
  const host = useRef<HTMLDivElement>(null);
  return <div ref={host} className={item.centre ? `${styles.contentItem} ${styles.centre}` : styles.contentItem} data-info-content-item={item.centre ? "centre" : ""}>
    <MathsRenderer content={item.source} presentation={infoMathsPresentation} constraints={{ kind: "container", elementRef: host, height: "unbounded" }}
      onResult={result => onResult(result, host.current?.querySelector<HTMLElement>("[data-maths-renderer]") ?? null)} />
  </div>;
}
