import MediaCentreControl from "@/components/media/MediaCentreControl";
import { useMediaCollection } from "@/components/media/useMediaCollection";
import { collectionDisplayItem } from "@/lib/mediaCollection/presentation";
import type { OpenCardMedia } from "@/lib/cardMediaViewer";
import { snapReadingToInteger, type CardLayout } from "@/components/cards/cardLayout";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import BackCardExternalComment from "@/components/decks/BackCardExternalComment";
import BackCardMediaCarousel from "@/components/decks/BackCardMediaCarousel";
import BackCardReflectionFragment from "@/components/decks/BackCardReflectionFragment";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import PulseFieldSignal, {
  getSignalValuePositionPercent,
  SIGNAL_FIELD_VIEWBOX_WIDTH,
  SIGNAL_FIELD_WIDTH,
} from "@/components/decks/PulseFieldSignal";
import { clampSignalReading, normalizedToSignalReading, roundSignalReadingForStorage, SIGNAL_MAX, SIGNAL_MIN } from "@/lib/signals";

const SIGNAL_VALUE_VISIBILITY_MS = 3000;
const SIGNAL_DRAG_THRESHOLD_PX = 8;
const isSignalGestureShieldDebug = process.env.NODE_ENV !== "production";
const signalFieldMovementRatio = SIGNAL_FIELD_WIDTH / SIGNAL_FIELD_VIEWBOX_WIDTH;

type SignalGestureIntent = "pending" | "signal" | "vertical" | "cancelled";

type SignalDragSession = {
  sourceIdentity?: string;
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startNormalized: number;
  movementRangePx: number;
  intent: SignalGestureIntent;
  moved: boolean;
};

export function clampNormalized(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function formatDisplayedSignalReading(signal: CardLayout["signals"][number], displayedReading: number) {
  if (displayedReading === SIGNAL_MIN) {
    return "Hang in there";
  }

  if (displayedReading === SIGNAL_MAX) {
    return "That's great!";
  }

  return "";
}

export function getSignalGestureAxis(deltaX: number, deltaY: number): "horizontal" | "vertical" | null {
  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);
  const distance = Math.hypot(deltaX, deltaY);

  if (distance < DECK_GESTURE_THRESHOLDS.deadZonePx) {
    return null;
  }

  const horizontalLead = absoluteX - absoluteY;
  const verticalLead = absoluteY - absoluteX;
  const hasClearHorizontalLead =
    horizontalLead >= DECK_GESTURE_THRESHOLDS.diagonalTolerancePx ||
    absoluteY <= DECK_GESTURE_THRESHOLDS.deadZonePx / 2;
  const hasClearVerticalLead =
    verticalLead >= DECK_GESTURE_THRESHOLDS.diagonalTolerancePx ||
    absoluteX <= DECK_GESTURE_THRESHOLDS.deadZonePx / 2;

  if (
    absoluteX >= absoluteY * DECK_GESTURE_THRESHOLDS.axisLockRatio &&
    hasClearHorizontalLead &&
    absoluteX >= SIGNAL_DRAG_THRESHOLD_PX
  ) {
    return "horizontal";
  }

  if (absoluteY >= absoluteX * DECK_GESTURE_THRESHOLDS.axisLockRatio && hasClearVerticalLead) {
    return "vertical";
  }

  return null;
}

function blockSignalBlockGesturePropagation(event: PointerEvent<HTMLElement>) {
  event.stopPropagation();

  if (isSignalGestureShieldDebug && event.type === "pointerdown") {
    console.debug("Signal block captured gesture", {
      eventType: event.type,
    });
  }
}

type FocusedSignalRowProps = {
  readOnly?: boolean;
  readOnlyReason?: string;
  interactionIdentity?: string;
  heading?: import("react").ReactNode;
  cardId: string;
  signal: CardLayout["signals"][number];
  onCommitSignalReading: (cardId: string, signalId: string, reading: number) => void;
  onSignalNavigateNext?: () => void;
  onSignalNavigatePrevious?: () => void;
};

export function PassiveSignalRow({ signal, heading, readOnlyReason, interactionIdentity }: { signal: CardLayout["signals"][number]; heading?: import("react").ReactNode; readOnlyReason?: string; interactionIdentity?: string }) {
  const guard = useReadOnlySignalGesture(Boolean(readOnlyReason), readOnlyReason, `${interactionIdentity ?? "preview"}:${signal.id}`);
  const displayedReading = signal.reading === null ? null : snapReadingToInteger(signal.reading);
  const displayedReadingLabel = displayedReading === null ? "" : formatDisplayedSignalReading(signal, displayedReading);

  return (
    <div className={`focused-card-signal-slot${readOnlyReason ? " focused-card-signal-slot--read-only" : ""}`}
      aria-describedby={guard.visible ? guard.id : undefined} {...(readOnlyReason ? guard.bindings : {})}>
      {guard.visible ? <span className="read-only-signal-tooltip" role="tooltip" id={guard.id}>{readOnlyReason}</span> : null}
      <p>{heading ?? signal.title}</p>
      <div
        className="focused-card-signal-track"
        style={{ "--signal-value-position": getSignalValuePositionPercent(signal.value) } as CSSProperties}
      >
        <span className="focused-card-signal-value focused-card-signal-value--hidden" aria-hidden="true">
          {displayedReadingLabel}
        </span>
        <PulseFieldSignal value={signal.value} variant={signal.variant} className="focused-card-signal-trace" />
      </div>
    </div>
  );
}

export function getFocusedSignalDisplayState(
  signal: CardLayout["signals"][number],
  previewNormalized: number | null,
  isValueVisible: boolean
) {
  const effectiveNormalized = clampNormalized(previewNormalized ?? signal.value);

  const displayedReading = signal.reading === null && previewNormalized === null
    ? null
    : clampSignalReading(snapReadingToInteger(normalizedToSignalReading(effectiveNormalized)));

  const label = displayedReading === null ? "Drag to set" : formatDisplayedSignalReading(signal, displayedReading);
  const isUnset = signal.reading === null && previewNormalized === null;
  const isVisible = isValueVisible || isUnset;

  return { label, isVisible, isUnset, effectiveNormalized };
}

// Read-only signals still own their pointer sequence. They explain the existing
// permission without starting a learning drag or the ancestor Card gesture.
function useReadOnlySignalGesture(readOnly: boolean, reason: string | undefined, identity: string | undefined) {
  const key = JSON.stringify([readOnly, reason, identity]);
  const id = useId();
  const [hint, setHint] = useState({ key, visible: false });
  if (hint.key !== key) setHint({ key, visible: false });
  const row = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<{ id: number; x: number; y: number; shown: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  const dismiss = useCallback(() => { clearTimer(); setHint({ key, visible: false }); }, [clearTimer, key]);
  useEffect(() => () => { clearTimer(); pointer.current = null; }, [clearTimer, key]);
  const visible = readOnly && Boolean(reason) && hint.key === key && hint.visible;
  useEffect(() => {
    if (!visible) return;
    const outside = (event: globalThis.PointerEvent) => { if (!row.current?.contains(event.target as Node)) dismiss(); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); dismiss(); } };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", escape, true); };
  }, [visible, dismiss]);
  const cancel = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!pointer.current) return;
    pointer.current = null; dismiss();
  };
  return { id, visible, bindings: {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.stopPropagation(); if (event.button !== 0) return;
      row.current = event.currentTarget; clearTimer(); pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, shown: false };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      event.stopPropagation(); const start = pointer.current;
      if (!start || start.id !== event.pointerId || start.shown || !reason) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= DECK_GESTURE_THRESHOLDS.deadZonePx) {
        start.shown = true; setHint({ key, visible: true });
      }
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      event.stopPropagation(); const start = pointer.current; pointer.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (start?.shown) { clearTimer(); timer.current = setTimeout(dismiss, 2500); }
    },
    onPointerCancel: cancel, onLostPointerCapture: cancel,
    onClick: (event: MouseEvent<HTMLDivElement>) => { event.stopPropagation(); event.preventDefault(); },
  } };
}

export function FocusedSignalRow({
  readOnlyReason,
  readOnly = false,
  interactionIdentity,
  heading,
  cardId,
  signal,
  onCommitSignalReading,
  onSignalNavigateNext,
  onSignalNavigatePrevious,
}: FocusedSignalRowProps) {
  const readOnlyGesture = useReadOnlySignalGesture(readOnly, readOnlyReason, `${interactionIdentity ?? cardId}:${signal.id}`);
  const [isValueVisible, setIsValueVisible] = useState(false);
  const [previewNormalized, setPreviewNormalized] = useState<number | null>(null);
  const [previewSource, setPreviewSource] = useState({ id: signal.id, value: signal.value, interactionIdentity, readOnly });
  // Reset only gesture-local preview when its canonical signal changes, before
  // rendering children. Keep the value-visibility timer's existing behaviour.
  if (previewSource.id !== signal.id || previewSource.value !== signal.value || previewSource.interactionIdentity !== interactionIdentity || previewSource.readOnly !== readOnly) {
    setPreviewSource({ id: signal.id, value: signal.value, interactionIdentity, readOnly });
    setPreviewNormalized(null);
    if (previewSource.interactionIdentity !== interactionIdentity || previewSource.readOnly !== readOnly) setIsValueVisible(false);
  }
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSessionRef = useRef<SignalDragSession | null>(null);
  const suppressNextClickRef = useRef(false);
  const signalTrackRef = useRef<HTMLDivElement | null>(null);

  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) {
      return;
    }

    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const scheduleValueHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setIsValueVisible(false);
      hideTimerRef.current = null;
    }, SIGNAL_VALUE_VISIBILITY_MS);
  }, [clearHideTimer]);

  const showValueTemporarily = useCallback(() => {
    setIsValueVisible(true);
    scheduleValueHide();
  }, [scheduleValueHide]);

  const keepValueVisible = useCallback(() => {
    setIsValueVisible(true);
    clearHideTimer();
  }, [clearHideTimer]);

  const releaseDragSession = useCallback(() => {
    dragSessionRef.current = null;
    setPreviewNormalized(null);
  }, []);

  const hideValueNow = useCallback(() => {
    clearHideTimer();
    setIsValueVisible(false);
  }, [clearHideTimer]);

  useEffect(() => {
    dragSessionRef.current = null;
  }, [signal.id, signal.value, interactionIdentity, readOnly]);

  useEffect(() => {
    return () => {
      clearHideTimer();
      dragSessionRef.current = null;
    };
  }, [clearHideTimer]);

  const displayState = useMemo(
    () => getFocusedSignalDisplayState(signal, previewNormalized, isValueVisible),
    [signal, previewNormalized, isValueVisible]
  );

  const displayedReadingLabel = displayState.label;
  const isUnset = displayState.isUnset;

  const getMovementRangePx = () => {
    const trackWidth = signalTrackRef.current?.getBoundingClientRect().width ?? 0;

    return trackWidth * signalFieldMovementRatio;
  };

  const getFinalReadingFromNormalized = useCallback(
    (normalizedValue: number) => {
      const reading = normalizedToSignalReading(normalizedValue);

      return roundSignalReadingForStorage(reading);
    },
    []
  );

  // Focused signal rows own signal-start gestures so mobile pointer capture
  // stays deterministic. Signal-start gestures do not flip the focused card.
  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      event.preventDefault();
      suppressNextClickRef.current = false;
    }

    event.stopPropagation();
  };

  const handleRowPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (event.button !== 0 || dragSessionRef.current) {
      return;
    }

    suppressNextClickRef.current = false;
    showValueTemporarily();

    const movementRangePx = getMovementRangePx();

    if (movementRangePx <= 0) {
      return;
    }

    dragSessionRef.current = {
      sourceIdentity: interactionIdentity,
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startNormalized: displayState.effectiveNormalized,
      movementRangePx,
      intent: "pending",
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleRowPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const session = dragSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    if (session.sourceIdentity !== interactionIdentity) { releaseDragSession(); hideValueNow(); return; }

    const deltaX = event.clientX - session.startPointerX;
    const deltaY = event.clientY - session.startPointerY;
    const movementDistance = Math.hypot(deltaX, deltaY);
    const nextMoved = session.moved || movementDistance >= DECK_GESTURE_THRESHOLDS.deadZonePx;
    const nextAxis = getSignalGestureAxis(deltaX, deltaY);
    const nextNormalized = clampNormalized(session.startNormalized + deltaX / session.movementRangePx);

    if (nextMoved) {
      suppressNextClickRef.current = true;
    }

    if (session.intent === "pending" && nextAxis === "vertical") {
      dragSessionRef.current = {
        ...session,
        intent: "vertical",
        moved: nextMoved,
      };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      releaseDragSession();
      hideValueNow();
      event.preventDefault();

      if (deltaY > 0) {
        onSignalNavigateNext?.();
      } else {
        onSignalNavigatePrevious?.();
      }

      return;
    }

    if (session.intent === "pending" && nextAxis === "horizontal") {
      dragSessionRef.current = {
        ...session,
        intent: "signal",
        moved: nextMoved,
      };
    } else {
      dragSessionRef.current = {
        ...session,
        moved: nextMoved,
      };
    }

    // Preview is gesture-local: it gives immediate tactile feedback, but is
    // discarded unless horizontal signal intent wins and the pointer ends.
    setPreviewNormalized(nextNormalized);

    if (dragSessionRef.current?.intent === "signal") {
      keepValueVisible();
      event.preventDefault();
    }
  };

  const finishRowPointerInteraction = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const session = dragSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    if (session.sourceIdentity !== interactionIdentity) { releaseDragSession(); hideValueNow(); return; }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const deltaX = event.clientX - session.startPointerX;
    const deltaY = event.clientY - session.startPointerY;
    const finalAxis = session.intent === "pending" ? getSignalGestureAxis(deltaX, deltaY) : null;
    const finalIntent: SignalGestureIntent =
      session.intent === "signal" || finalAxis === "horizontal" ? "signal" : "cancelled";
    const finalNormalized = clampNormalized(session.startNormalized + deltaX / session.movementRangePx);
    const wasMoved = session.moved || Math.hypot(deltaX, deltaY) >= DECK_GESTURE_THRESHOLDS.deadZonePx;

    if (wasMoved) {
      suppressNextClickRef.current = true;
      event.preventDefault();
    }

    // End pointer ownership immediately, but keep preview when a signal commit
    // is about to happen so the row does not momentarily fall back to stale
    // signal.value before parent state updates propagate.
    dragSessionRef.current = null;

    if (finalAxis === "vertical") {
      hideValueNow();

      if (deltaY > 0) {
        onSignalNavigateNext?.();
      } else {
        onSignalNavigatePrevious?.();
      }

      return;
    }

    if (finalIntent === "signal") {
      setPreviewNormalized(finalNormalized);
      onCommitSignalReading(cardId, signal.id, getFinalReadingFromNormalized(finalNormalized));
      showValueTemporarily();
    } else if (wasMoved) {
      setPreviewNormalized(null);
      hideValueNow();
    }
  };

  const handleRowPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const session = dragSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const wasMoved = session.moved;

    if (wasMoved) {
      suppressNextClickRef.current = true;
    }

    releaseDragSession();
    hideValueNow();
  };

  const handleLostPointerCapture = (event: PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    if (session.moved) {
      suppressNextClickRef.current = true;
    }

    releaseDragSession();
    hideValueNow();
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    showValueTemporarily();
  };

  const signalRowClassName = `focused-card-signal-slot${readOnly ? " focused-card-signal-slot--read-only" : ""}`;
  const signalValueClassName = readOnly ? "focused-card-signal-value" : [
    "focused-card-signal-value",
    isValueVisible || isUnset ? "focused-card-signal-value--visible" : "focused-card-signal-value--hidden",
    isUnset ? "focused-card-signal-value--unset" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={signalRowClassName}
      aria-describedby={readOnlyGesture.visible ? readOnlyGesture.id : undefined}
      role={readOnly ? undefined : "button"}
      tabIndex={readOnly ? undefined : 0}
      aria-label={readOnly ? undefined : `Adjust ${signal.title} reading`}
      onPointerDown={readOnly ? readOnlyGesture.bindings.onPointerDown : handleRowPointerDown}
      onPointerMove={readOnly ? readOnlyGesture.bindings.onPointerMove : handleRowPointerMove}
      onPointerUp={readOnly ? readOnlyGesture.bindings.onPointerUp : finishRowPointerInteraction}
      onPointerCancel={readOnly ? readOnlyGesture.bindings.onPointerCancel : handleRowPointerCancel}
      onLostPointerCapture={readOnly ? readOnlyGesture.bindings.onLostPointerCapture : handleLostPointerCapture}
      onClick={readOnly ? readOnlyGesture.bindings.onClick : handleRowClick}
      onKeyDown={readOnly ? undefined : handleRowKeyDown}
    >
      {readOnlyGesture.visible ? <span className="read-only-signal-tooltip" role="tooltip" id={readOnlyGesture.id}>{readOnlyReason}</span> : null}
      <p>{heading ?? signal.title}</p>
      <div
        ref={signalTrackRef}
        className="focused-card-signal-track"
        style={{ "--signal-value-position": getSignalValuePositionPercent(displayState.effectiveNormalized) } as CSSProperties}
      >
        <span className={signalValueClassName} aria-hidden={readOnly || !(isValueVisible || isUnset)}>
          {readOnly && isUnset ? "" : displayedReadingLabel}
        </span>
        <PulseFieldSignal value={displayState.effectiveNormalized} variant={signal.variant} className="focused-card-signal-trace" />
      </div>
    </div>
  );
}

type BackCardFaceContentProps = {
  assessment?: import("react").ReactNode;
  reflectionArea?: import("react").ReactNode | ((verticalOffset: number) => import("react").ReactNode);
  card: CardLayout;
  deckTemplateId?: string;
  dateLabel: string;
  variant?: "focused" | "deck" | "preview";
  canMutate?: boolean;
  onCommitSignalReading?: (cardId: string, signalId: string, reading: number) => void;
  onOpenMedia?: OpenCardMedia;
  onEditMedia?: (cardId: string) => void;
  onEditReflection?: (cardId: string) => void;
  onSignalNavigateNext?: () => void;
  onSignalNavigatePrevious?: () => void;
};

export default function BackCardFaceContent({
  assessment,
  reflectionArea,
  card,
  deckTemplateId,
  dateLabel,
  variant = "focused",
  canMutate = true,
  onCommitSignalReading,
  onOpenMedia,
  onEditMedia,
  onEditReflection,
  onSignalNavigateNext,
  onSignalNavigatePrevious,
}: BackCardFaceContentProps) {
  const mediaContext = card.dataOwnerUserId && onOpenMedia ? { kind: "owner" as const, viewerUserId: card.dataOwnerUserId, cardTemplateId: card.id } : null;
  const collection = useMediaCollection(mediaContext, 5, JSON.stringify(card.backMediaItems.map(i => [i.id, i.uploadedAt])));
  const mediaItems = collection.page && mediaContext ? collection.page.items.map(item => collectionDisplayItem(item, mediaContext)) : card.backMediaItems;
  const hasBackMedia = mediaItems.length > 0;
  const isFocusedVariant = variant === "focused";
  const shouldShowReflectionPlaceholder = variant === "deck" || isFocusedVariant;
  const canEditReflection = isFocusedVariant && Boolean(onEditReflection);
  const layoutClassName = ["focused-card-back-layout", "back-card-face-content", `back-card-face-content--${variant}`].join(" ");
  const backSignalsClassName = [
    "focused-card-back-signals",
    !hasBackMedia ? "focused-card-back-signals--no-media" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const externalCommentClassName =
    !hasBackMedia && card.externalComment ? "focused-card-back-external-comment--no-media" : undefined;
  const commitSignalReading = onCommitSignalReading ?? (() => {});
  const canAdjustSignals = isFocusedVariant && canMutate;
  // Deck/preview signals are passive markings. Only focused signals
  // participate in signal gesture handling.
  const signalGestureShieldHandlers = canAdjustSignals
    ? {
        onPointerDown: blockSignalBlockGesturePropagation,
        onPointerMove: blockSignalBlockGesturePropagation,
        onPointerUp: blockSignalBlockGesturePropagation,
        onPointerCancel: blockSignalBlockGesturePropagation,
      }
    : undefined;

  return (
    <div className={layoutClassName}>
      <CardSemanticAnchors assessment={assessment} card={card} dateLabel={dateLabel} showProgress={false} variant="back" />
      <div className="focused-card-back-shell">
        {canMutate && onEditMedia ? <MediaCentreControl total={collection.page?.total ?? card.backMediaItems.length} onOpen={() => onEditMedia(card.id)} /> : null}
        {deckTemplateId ? (
          <BackCardMediaCarousel
            items={mediaItems}
            onOpen={onOpenMedia ? (itemId, source) => onOpenMedia(card.id, itemId, source) : undefined}
          />
        ) : null}
        <section
          className={backSignalsClassName}
          aria-label="Reflective card signals"
          {...signalGestureShieldHandlers}
        >
          {card.signals.map((signal) =>
            canAdjustSignals ? (
              <FocusedSignalRow
                key={signal.id}
                cardId={card.id}
                signal={signal}
                onCommitSignalReading={commitSignalReading}
                onSignalNavigateNext={onSignalNavigateNext}
                onSignalNavigatePrevious={onSignalNavigatePrevious}
              />
            ) : (
              <PassiveSignalRow key={signal.id} signal={signal} />
            )
          )}
        </section>
        <BackCardExternalComment comment={card.externalComment} className={externalCommentClassName} />
        {(typeof reflectionArea === "function" ? reflectionArea(hasBackMedia ? 0 : card.reflectionVerticalOffset) : reflectionArea) ?? <BackCardReflectionFragment
          ariaLabel={card.reflection.trim() ? "Edit reflection" : "Add a reflection"}
          isEditable={canEditReflection}
          onClick={canEditReflection ? () => onEditReflection?.(card.id) : undefined}
          reflectionVerticalOffset={hasBackMedia ? 0 : card.reflectionVerticalOffset}
          showPlaceholder={shouldShowReflectionPlaceholder}
          text={card.reflection}
        />}
      </div>
    </div>
  );
}
