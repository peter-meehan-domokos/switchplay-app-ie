"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InfoCardFaceContent } from "./InfoCardFace";
import InfoCardPouch from "./InfoCardPouch";
import InfoCardPhysicalStack from "./InfoCardPhysicalStack";
import InfoCardMediaViewer, { type InfoCardMedia } from "./InfoCardMediaViewer";
import { containInfoCardFocus, isolateInfoCardEvent, useInfoCardDialog } from "./useInfoCardDialog";
import styles from "./InfoCardConsultation.module.css";
import stepStyles from "@/components/decks/StepView.module.css";

// Presentation input, not an authorisation or persistence model. Phase 4 supplies
// an authorised publication snapshot. Phase 1 supplies temporary fixture data.
export type InfoCardConsultationCard = Omit<InfoCardFaceContent, "mediaKind"> & {
  id: string;
  media?: InfoCardMedia;
};

function measure(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect(), css = getComputedStyle(anchor);
  const width = parseFloat(css.width), height = parseFloat(css.height);
  return { left: rect.left, top: rect.top, width, height, scale: rect.width / width, borderRadius: css.borderRadius };
}

export default function InfoCardConsultation({ id, cards, anchor, source, onClose }: {
  id: string;
  cards: readonly InfoCardConsultationCard[];
  anchor: HTMLElement;
  source: HTMLElement;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [geometry, setGeometry] = useState(() => measure(anchor));
  const [pouchGeometry, setPouchGeometry] = useState(() => measure(anchor));
  const [media, setMedia] = useState<InfoCardMedia | null>(null);
  const [closing, setClosing] = useState(false);
  const [position, setPosition] = useState(1);
  const motionBusy = useRef(true);
  const onBusyChange = useCallback((busy: boolean) => { motionBusy.current = busy; }, []);
  const requestClose = () => { if (!media) setClosing(true); };
  useInfoCardDialog(dialog, closeButton, source, true);
  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      const next = measure(anchor);
      setPouchGeometry(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
      // Freeze rendered dimensions during each movement. Apply any viewport
      // change once settled, rather than scaling a pack in flight.
      if (!motionBusy.current) setGeometry(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [anchor]);

  return createPortal(<>
    <dialog ref={dialog} tabIndex={-1} className={styles.dialog} aria-label="Info card consultation" aria-modal="true"
      onClick={isolateInfoCardEvent} onPointerDown={isolateInfoCardEvent} onPointerMove={isolateInfoCardEvent}
      onPointerUp={isolateInfoCardEvent} onPointerCancel={isolateInfoCardEvent} onWheel={isolateInfoCardEvent}
      onKeyDown={event => {
        containInfoCardFocus(event);
        if (event.key === "Escape") { event.preventDefault(); requestClose(); }
      }} onKeyUp={isolateInfoCardEvent}
      onCancel={event => { event.preventDefault(); requestClose(); }}>
      <button className={styles.dismissSurface} tabIndex={-1} type="button" aria-label="Close information cards and return to step" onClick={requestClose} />
      <div className={styles.alignment} style={{ left: geometry.left, top: geometry.top, width: geometry.width,
        height: geometry.height, borderRadius: geometry.borderRadius, transform: `scale(${geometry.scale})` }}>
        <InfoCardPhysicalStack id={id} cards={cards} closing={closing} blocked={Boolean(media)} closeRef={closeButton} pouch={source} pouchGeometry={pouchGeometry}
          onRequestClose={requestClose} onExited={onClose} onBusyChange={onBusyChange} onOpenMedia={setMedia} onPositionChange={setPosition} />
      </div>
      <div className={styles.alignment} data-info-pouch-alignment="" style={{ left: pouchGeometry.left, top: pouchGeometry.top, width: pouchGeometry.width,
        height: pouchGeometry.height, borderRadius: pouchGeometry.borderRadius, transform: `scale(${pouchGeometry.scale})` }}>
        <div className={stepStyles.pouch}>
          <InfoCardPouch count={cards.length} position={position} expanded controlsId={id} onToggle={() => { if (!media) setClosing(value => !value); }} />
        </div>
      </div>
    </dialog>
    {media ? <InfoCardMediaViewer media={media} onClose={() => setMedia(null)} /> : null}
  </>, document.body);
}
