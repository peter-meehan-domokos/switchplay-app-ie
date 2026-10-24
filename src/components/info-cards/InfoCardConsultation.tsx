"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InfoCardFaceContent } from "./InfoCardFace";
import type { InfoMedia, MediaContext } from "@/lib/infoCards/model";
import InfoCardPouch from "./InfoCardPouch";
import InfoCardPhysicalStack from "./InfoCardPhysicalStack";
import InfoCardMediaViewer, { type InfoCardMedia } from "./InfoCardMediaViewer";
import InfoCardRemoteMediaViewer from "./InfoCardRemoteMediaViewer";
import { containInfoCardFocus, isolateInfoCardEvent, useInfoCardDialog } from "./useInfoCardDialog";
import styles from "./InfoCardConsultation.module.css";
import stepStyles from "@/components/decks/StepView.module.css";

// Presentation input, not an authorisation or persistence model. Phase 4 supplies
// an authorised publication snapshot. Phase 1 supplies temporary fixture data.
export type AvailableConsultationCard = Omit<InfoCardFaceContent, "mediaKind"> & {
  id: string;
  unavailable?: false;
} & ({ publication: MediaContext; media?: InfoMedia } | { publication?: undefined; media?: InfoCardMedia });
export type InfoCardConsultationCard = AvailableConsultationCard | { id: string; unavailable: true };

function measure(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect(), css = getComputedStyle(anchor);
  const width = parseFloat(css.width), height = parseFloat(css.height);
  return { left: rect.left, top: rect.top, width, height, scale: rect.width / width, borderRadius: css.borderRadius };
}

export default function InfoCardConsultation({ id, cards, anchor, source, onClose, status = "ready", loadingMessage = false, count = cards.length, actor }: {
  id: string;
  cards: readonly InfoCardConsultationCard[];
  anchor: HTMLElement;
  source: HTMLElement;
  onClose: () => void;
  status?: "pending" | "ready" | "failed";
  loadingMessage?: boolean;
  count?: number;
  actor?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [geometry, setGeometry] = useState(() => measure(anchor));
  const [pouchGeometry, setPouchGeometry] = useState(() => measure(anchor));
  const [media, setMedia] = useState<AvailableConsultationCard | null>(null);
  const [mediaSource, setMediaSource] = useState<HTMLElement | undefined>(undefined);
  const openMedia = (card: AvailableConsultationCard) => {
    // Capture before the stack becomes inert for the nested modal.
    setMediaSource(document.activeElement instanceof HTMLElement ? document.activeElement : undefined);
    setMedia(card);
  };
  const [closing, setClosing] = useState(false);
  const [position, setPosition] = useState(1);
  const motionBusy = useRef(true);
  const onBusyChange = useCallback((busy: boolean) => { motionBusy.current = busy; }, []);
  const requestClose = () => { if (!media) { if (status === "ready") setClosing(true); else onClose(); } };
  useInfoCardDialog(dialog, closeButton, source, true);
  useLayoutEffect(() => {
    (status === "ready" ? closeButton.current : dialog.current?.querySelector<HTMLElement>("[data-info-card-pouch]"))?.focus({ preventScroll: true });
  }, [status]);
  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      const next = measure(anchor);
      setPouchGeometry(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
      // Freeze rendered dimensions during each movement. Apply any viewport
      // change once settled, rather than scaling a pack in flight.
      if (status !== "ready" || !motionBusy.current) setGeometry(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [anchor, status]);

  const bottom = pouchGeometry.top + pouchGeometry.height * pouchGeometry.scale;
  const below = bottom + 36 < (window.visualViewport?.height ?? window.innerHeight);
  const statusStyle = below ? { left: pouchGeometry.left, top: bottom + 8, maxWidth: pouchGeometry.width * pouchGeometry.scale }
    : { left: 8, top: bottom - 36, maxWidth: Math.max(0, pouchGeometry.left - 16) };

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
      {status === "ready" && <div className={styles.alignment} style={{ left: geometry.left, top: geometry.top, width: geometry.width,
        height: geometry.height, borderRadius: geometry.borderRadius, transform: `scale(${geometry.scale})` }}>
        <InfoCardPhysicalStack id={id} cards={cards} closing={closing} blocked={Boolean(media)} closeRef={closeButton} pouch={source} pouchGeometry={pouchGeometry}
          onRequestClose={requestClose} onExited={onClose} onBusyChange={onBusyChange} onOpenMedia={openMedia} onPositionChange={setPosition} />
      </div>}
      {(status === "failed" || status === "pending" && loadingMessage) && <p className={styles.status} style={statusStyle}
        role={status === "failed" ? "alert" : "status"}>{status === "failed" ? "Unable to load Info Cards." : "Loading Info Cards…"}</p>}
      <div className={styles.alignment} data-info-pouch-alignment="" style={{ left: pouchGeometry.left, top: pouchGeometry.top, width: pouchGeometry.width,
        height: pouchGeometry.height, borderRadius: pouchGeometry.borderRadius, transform: `scale(${pouchGeometry.scale})` }}>
        <div className={stepStyles.pouch}>
          <InfoCardPouch count={count} position={position} expanded={status === "ready"} pending={status !== "ready"} controlsId={id}
            onToggle={() => { if (!media) { if (status === "ready") setClosing(value => !value); else onClose(); } }} />
        </div>
      </div>
    </dialog>
    {media?.media ? media.publication
      ? <InfoCardRemoteMediaViewer media={media.media} context={media.publication} actor={actor ?? ""} onClose={() => setMedia(null)} returnFocus={mediaSource} />
      : <InfoCardMediaViewer media={media.media} onClose={() => setMedia(null)} returnFocus={mediaSource} /> : null}
  </>, document.body);
}
