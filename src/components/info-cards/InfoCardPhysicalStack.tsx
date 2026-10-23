"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type Ref } from "react";
import { motion, useAnimate, useMotionValue, useReducedMotion, useTransform, type AnimationSequence } from "motion/react";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import InfoCardFace from "./InfoCardFace";
import type { InfoCardConsultationCard } from "./InfoCardConsultation";
import type { InfoCardMedia } from "./InfoCardMediaViewer";
import stepStyles from "@/components/decks/StepView.module.css";
import styles from "./InfoCardPhysicalStack.module.css";

type Turn = { to: number; direction: -1 | 1; height: number };
type PointerSession = { id: number; x: number; y: number; time: number; axis: "x" | "y" | null; moved: boolean };

// Motion/selection only. The parent keeps the pinned consultation, media and
// playback suspension alive until onExited, including while this pack returns.
export default function InfoCardPhysicalStack({ id, cards, closing, blocked, closeRef, pouch, pouchGeometry, onRequestClose, onExited, onBusyChange, onOpenMedia, onPositionChange }: {
  id: string;
  cards: readonly InfoCardConsultationCard[];
  closing: boolean;
  blocked: boolean;
  closeRef: Ref<HTMLButtonElement>;
  pouch: HTMLElement;
  pouchGeometry: { left: number; top: number; scale: number };
  onRequestClose: () => void;
  onExited: () => void;
  onBusyChange: (busy: boolean) => void;
  onOpenMedia: (media: InfoCardMedia) => void;
  onPositionChange: (position: number) => void;
}) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const reduced = Boolean(useReducedMotion());
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [phase, setPhase] = useState("opening");
  const busy = useRef(true);
  const pointer = useRef<PointerSession | null>(null);
  const suppressClick = useRef(false);
  const positioned = useRef(false);
  const generation = useRef(0);
  const turnAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const callbacks = useRef({ onExited, onBusyChange, onPositionChange });
  const packX = useMotionValue(0), packY = useMotionValue(0), packRotation = useMotionValue(0), opacity = useMotionValue(0);
  const dragY = useMotionValue(0);
  const dragRotation = useTransform(dragY, [-100, 0, 100], [-2, 0, 2]);
  const returnGeometry = closing ? pouchGeometry : null;
  useLayoutEffect(() => { callbacks.current = { onExited, onBusyChange, onPositionChange }; }, [onExited, onBusyChange, onPositionChange]);

  // The parent shows the native modal in its layout effect. Measure afterwards;
  // a child layout effect would see a still-hidden dialog with zero dimensions.
  useEffect(() => {
    const pack = scope.current;
    if (!pack) return;
    let active = true;
    generation.current++;
    pointer.current = null;
    turnAnimation.current?.stop();
    busy.current = true;
    callbacks.current.onBusyChange(true);
    // This phase mirrors an imperative animation; it does not own Step state.
    setPhase(closing ? "closing" : "opening");
    const parent = pack.parentElement!;
    const parentRect = parent.getBoundingClientRect(), pouchRect = pouch.getBoundingClientRect();
    const scale = parentRect.width / parent.clientWidth;
    const angle = 12 * Math.PI / 180;
    const width = pack.offsetWidth, height = pack.offsetHeight;
    // Place the top-right corner just behind the real pocket's upper endpoint.
    // The existing rounded Step View clip and foreground pouch mask the bundle.
    const hidden = {
      x: (pouchRect.left - parentRect.left) / scale - pack.offsetLeft - width * Math.cos(angle) - height * Math.sin(angle) - 2,
      y: (pouchRect.top - parentRect.top) / scale - pack.offsetTop - height - width * Math.sin(angle) + height * Math.cos(angle) + 2,
    };
    const firstOpening = !positioned.current;
    if (firstOpening) {
      positioned.current = true;
      packX.set(reduced ? 0 : hidden.x);
      packY.set(reduced ? 0 : hidden.y);
      packRotation.set(reduced ? 0 : 12);
    }
    if (!closing) opacity.set(reduced ? 0 : 1);
    const sequence: AnimationSequence = [];
    sequence.push([pack.querySelector<HTMLElement>('[data-info-card-current="true"]')!, { zIndex: 3 }, { at: 0, duration: 0 }]);
    const adjacent = pack.querySelector<HTMLElement>('[data-info-card-current="false"]');
    if (adjacent) sequence.push([adjacent, { zIndex: 2 }, { at: 0, duration: 0 }]);
    if (closing) {
      // A close may interrupt a drag or turn: gather before returning the pack.
      sequence.push([pack.querySelectorAll<HTMLElement>("[data-info-card-layer]"), { x: 0, y: 0, rotate: 0 }, { duration: reduced ? 0 : 0.1 }]);
      sequence.push([pack, reduced ? { opacity: 0 } : { x: hidden.x, y: hidden.y, rotate: 12 }, { duration: reduced ? 0.08 : 0.3, ease: "easeInOut" }]);
    } else {
      sequence.push([pack, firstOpening && !reduced
        ? { x: [null, -4, 0], y: [null, 3, 0], rotate: [null, 0], opacity: [1, 1, 1] }
        : { x: 0, y: 0, rotate: 0, opacity: 1 },
      firstOpening && !reduced ? {
        duration: 0.48, times: [0, 0.65, 1], ease: "easeInOut",
        // Keep the two-stage translation/contact, but align rotation over the
        // full journey instead of accelerating through 9 degrees at the end.
        rotate: { times: [0, 1] },
      } : { duration: reduced ? 0.08 : 0.48, ease: "easeInOut" }]);
      // Reversing a not-yet-complete return keeps this same session mounted.
      sequence.push([pack.querySelectorAll<HTMLElement>("[data-info-card-layer]"), { x: 0, y: 0, rotate: 0 }, { at: 0, duration: reduced ? 0 : 0.1 }]);
    }
    const control = animate(sequence);
    void control.then(() => {
      if (!active) return;
      if (closing) callbacks.current.onExited();
      else {
        dragY.set(0);
        setTurn(null);
        setPhase("open");
        busy.current = false;
        callbacks.current.onBusyChange(false);
      }
    });
    return () => { active = false; control.stop(); turnAnimation.current?.stop(); };
    // Retarget a return if resizing moves the real pouch; never resize the pack.
  }, [animate, closing, reduced, scope, packX, packY, packRotation, opacity, dragY, pouch, returnGeometry]);

  useLayoutEffect(() => {
    if (!turn || closing) return;
    const pack = scope.current!;
    const current = pack.querySelector<HTMLElement>('[data-info-card-current="true"]')!;
    const adjacent = pack.querySelector<HTMLElement>('[data-info-card-current="false"]')!;
    let active = true;
    const duration = reduced ? 0.09 : 0.18;
    const distance = reduced ? 12 : turn.height * 0.72;
    const sequence: AnimationSequence = turn.direction === 1 ? [
      [current, { x: reduced ? 0 : 8, y: distance, rotate: reduced ? 0 : 3 }, { duration, ease: "easeOut" }],
      [adjacent, { x: 0, y: 0, rotate: 0 }, { at: 0, duration, ease: "easeOut" }],
      [current, { zIndex: 0 }, { duration: 0 }],
      [current, { x: 3, y: -3, rotate: 0.4 }, { duration, ease: "easeInOut" }],
    ] : [
      [adjacent, { zIndex: 4 }, { duration: 0 }],
      [adjacent, { x: 0, y: 0, rotate: 0 }, { duration: duration * 2, ease: "easeInOut" }],
      [current, { x: -2, y: -6, rotate: -0.35 }, { at: 0, duration: duration * 2, ease: "easeInOut" }],
    ];
    if (!reduced) pack.querySelectorAll<HTMLElement>("[data-info-card-backing]").forEach((backing, position) => {
      const y = position === 0 ? -6 : -3;
      sequence.push([backing, { y: [y, y + 1.5, y] }, { at: 0, duration: duration * 2, ease: "easeInOut" }]);
    });
    const control = animate(sequence);
    turnAnimation.current = control;
    void control.then(() => {
      if (!active) return;
      dragY.set(0);
      setIndex(turn.to);
      callbacks.current.onPositionChange(turn.to + 1);
      setTurn(null);
      setPhase("open");
      busy.current = false;
      callbacks.current.onBusyChange(false);
    });
    return () => { active = false; control.stop(); };
  }, [animate, closing, reduced, scope, turn, dragY]);

  function browse(direction: -1 | 1) {
    if (busy.current || closing || blocked || cards.length < 2) return;
    busy.current = true;
    callbacks.current.onBusyChange(true);
    setPhase("browsing");
    setTurn({ to: (index + direction + cards.length) % cards.length, direction, height: scope.current!.offsetHeight });
  }

  function restoreDrag() {
    if (!dragY.get()) { callbacks.current.onBusyChange(busy.current); return; }
    busy.current = true;
    callbacks.current.onBusyChange(true);
    setPhase("settling");
    const token = ++generation.current;
    const control = animate(scope.current!.querySelector<HTMLElement>('[data-info-card-current="true"]')!, { y: 0, rotate: 0 }, { duration: reduced ? 0 : 0.13 });
    turnAnimation.current = control;
    void control.then(() => {
      if (token !== generation.current || !scope.current?.isConnected) return;
      dragY.set(0);
      setPhase("open");
      busy.current = false;
      callbacks.current.onBusyChange(false);
    });
  }

  function endPointer(event: PointerEvent<HTMLElement>, cancelled = false) {
    const session = pointer.current;
    if (!session || session.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (session.moved) { event.preventDefault(); suppressClick.current = true; }
    const dy = event.clientY - session.y, dx = event.clientX - session.x;
    const threshold = Math.min(56, scope.current!.getBoundingClientRect().height * 0.2);
    const velocity = Math.abs(dy) / Math.max(1, performance.now() - session.time);
    if (!cancelled && cards.length > 1 && session.axis === "y" && Math.abs(dy) > Math.abs(dx) * DECK_GESTURE_THRESHOLDS.axisLockRatio &&
      (Math.abs(dy) >= threshold || (Math.abs(dy) >= 20 && velocity >= DECK_GESTURE_THRESHOLDS.velocityAssistThresholdPxPerMs))) {
      browse(dy > 0 ? 1 : -1);
    } else restoreDrag();
  }

  const visible = turn ? [index, turn.to] : [index];
  const locked = closing || phase !== "open" || blocked;
  return <motion.section ref={scope} id={id} className={`${stepStyles.preview} ${styles.pack}`} aria-label="Information cards"
    data-info-card-stack="" data-info-stack-phase={closing ? "closing" : phase} aria-busy={phase !== "open" || closing}
    style={{ x: packX, y: packY, rotate: packRotation, opacity }}
    onKeyDown={event => {
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault(); event.stopPropagation(); browse(event.key === "ArrowDown" ? 1 : -1);
      }
    }}
    onPointerDown={event => {
      suppressClick.current = false;
      if (!event.isPrimary) { pointer.current = null; restoreDrag(); return; }
      if (locked || busy.current || event.button !== 0 || (event.target as Element).closest("[data-info-stack-close]")) return;
      callbacks.current.onBusyChange(true);
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), axis: null, moved: false };
    }}
    onPointerMove={event => {
      const session = pointer.current;
      if (!session || session.id !== event.pointerId) return;
      const dx = event.clientX - session.x, dy = event.clientY - session.y;
      if (Math.hypot(dx, dy) < DECK_GESTURE_THRESHOLDS.deadZonePx) return;
      session.moved = true;
      suppressClick.current = true;
      session.axis ??= Math.abs(dy) >= Math.abs(dx) * DECK_GESTURE_THRESHOLDS.axisLockRatio ? "y" : Math.abs(dx) >= Math.abs(dy) * DECK_GESTURE_THRESHOLDS.axisLockRatio ? "x" : null;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      if (session.axis === "y" && cards.length > 1) {
        const scale = event.currentTarget.getBoundingClientRect().width / event.currentTarget.offsetWidth;
        const limit = event.currentTarget.offsetHeight * 0.45;
        dragY.set(reduced ? 0 : Math.max(-limit, Math.min(limit, dy / scale * 0.5)));
      }
    }} onPointerUp={event => endPointer(event)} onPointerCancel={event => endPointer(event, true)}
    onLostPointerCapture={event => {
      // Touch starts with implicit capture on the body text/control. Its loss
      // bubbles when this pack takes capture; only losing our own cancels it.
      if (event.target === event.currentTarget && pointer.current?.id === event.pointerId) { pointer.current = null; restoreDrag(); }
    }}
    onClickCapture={event => {
      if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
    }}>
    {Array.from({ length: Math.min(2, cards.length - 1) }, (_, backing) => <div key={backing} className={stepStyles.backing} aria-hidden="true" data-info-card-backing="" />)}
    <div className={styles.cards} inert={locked}>
      {visible.map(cardIndex => {
        const card = cards[cardIndex], current = cardIndex === index;
        return <motion.div key={card.id} className={`${styles.card} ${stepStyles.topCard}`} data-info-card-layer="" data-info-card-id={card.id}
          data-info-card-current={current} aria-hidden={!current || undefined} inert={!current}
          initial={current ? false : { x: turn?.direction === -1 ? 8 : -2, y: turn?.direction === -1 ? (reduced ? 12 : turn.height * 0.72) : -6, rotate: turn?.direction === -1 ? (reduced ? 0 : 3) : -0.35 }}
          style={current ? { zIndex: 3, y: dragY, rotate: dragRotation } : { zIndex: 2 }}>
          <InfoCardFace card={{ ...card, mediaKind: card.media?.mediaType }} onOpenMedia={card.media ? () => { if (!busy.current && !closing && !blocked) onOpenMedia(card.media!); } : undefined} />
        </motion.div>;
      })}
    </div>
    <button ref={closeRef} className={`${stepStyles.consultationClose} ${styles.close}`} data-info-stack-close="" type="button" aria-label="Close information card stack" onClick={onRequestClose}>×</button>
    <span className={styles.announcement} role="status" aria-live="polite">{cards[index].title}</span>
  </motion.section>;
}
