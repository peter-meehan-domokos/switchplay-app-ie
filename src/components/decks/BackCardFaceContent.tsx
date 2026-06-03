import {
  clampReadingToSignalRange,
  normalizedToReading,
  snapReadingToInteger,
  type CardLayout,
} from "@/components/cards/cardLayout";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import BackCardExternalComment from "@/components/decks/BackCardExternalComment";
import BackCardMediaTrace from "@/components/decks/BackCardMediaTrace";
import BackCardReflectionFragment from "@/components/decks/BackCardReflectionFragment";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import PulseFieldSignal, {
  getSignalValuePositionPercent,
  SIGNAL_FIELD_VIEWBOX_WIDTH,
  SIGNAL_FIELD_WIDTH,
} from "@/components/decks/PulseFieldSignal";

const SIGNAL_VALUE_VISIBILITY_MS = 3000;
const SIGNAL_DRAG_THRESHOLD_PX = 8;
const isSignalGestureShieldDebug = process.env.NODE_ENV !== "production";
const signalFieldMovementRatio = SIGNAL_FIELD_WIDTH / SIGNAL_FIELD_VIEWBOX_WIDTH;

type SignalGestureIntent = "pending" | "signal" | "vertical" | "cancelled";

type SignalDragSession = {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startNormalized: number;
  movementRangePx: number;
  intent: SignalGestureIntent;
  moved: boolean;
};

function clampNormalized(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function formatSignalMinLabel(signal: CardLayout["signals"][number]) {
  return signal.isTheoreticalMin === true ? `${signal.minValue}` : `${signal.minValue}-`;
}

function formatSignalMaxLabel(signal: CardLayout["signals"][number]) {
  return signal.isTheoreticalMax === true ? `${signal.maxValue}` : `${signal.maxValue}+`;
}

function formatDisplayedSignalReading(signal: CardLayout["signals"][number], displayedReading: number) {
  if (displayedReading === signal.minValue) {
    return formatSignalMinLabel(signal);
  }

  if (displayedReading === signal.maxValue) {
    return formatSignalMaxLabel(signal);
  }

  return `${displayedReading}`;
}

function getSignalGestureAxis(deltaX: number, deltaY: number): "horizontal" | "vertical" | null {
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
  cardId: string;
  signal: CardLayout["signals"][number];
  onCommitSignalReading: (cardId: string, signalId: string, reading: number) => void;
  onSignalNavigateNext?: () => void;
  onSignalNavigatePrevious?: () => void;
};

function PassiveSignalRow({ signal }: { signal: CardLayout["signals"][number] }) {
  const displayedReading = snapReadingToInteger(signal.reading);
  const displayedReadingLabel = formatDisplayedSignalReading(signal, displayedReading);

  return (
    <div className="focused-card-signal-slot">
      <p>{signal.title}</p>
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

function FocusedSignalRow({
  cardId,
  signal,
  onCommitSignalReading,
  onSignalNavigateNext,
  onSignalNavigatePrevious,
}: FocusedSignalRowProps) {
  const [isValueVisible, setIsValueVisible] = useState(false);
  const [previewNormalized, setPreviewNormalized] = useState<number | null>(null);
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
    releaseDragSession();
  }, [releaseDragSession, signal.id, signal.value]);

  useEffect(() => {
    return () => {
      clearHideTimer();
      releaseDragSession();
    };
  }, [clearHideTimer, releaseDragSession]);

  const effectiveNormalized = clampNormalized(previewNormalized ?? signal.value);
  const displayedReading = useMemo(() => {
    const reading = normalizedToReading(effectiveNormalized, signal.minValue, signal.maxValue, signal.order);

    return clampReadingToSignalRange(snapReadingToInteger(reading), signal.minValue, signal.maxValue);
  }, [effectiveNormalized, signal.maxValue, signal.minValue, signal.order]);
  const displayedReadingLabel = useMemo(
    () => formatDisplayedSignalReading(signal, displayedReading),
    [displayedReading, signal]
  );

  const getMovementRangePx = () => {
    const trackWidth = signalTrackRef.current?.getBoundingClientRect().width ?? 0;

    return trackWidth * signalFieldMovementRatio;
  };

  const getFinalReadingFromNormalized = useCallback(
    (normalizedValue: number) => {
      const reading = normalizedToReading(normalizedValue, signal.minValue, signal.maxValue, signal.order);
      const clampedReading = clampReadingToSignalRange(reading, signal.minValue, signal.maxValue);

      return Number(clampedReading.toFixed(2));
    },
    [signal.maxValue, signal.minValue, signal.order]
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
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startNormalized: effectiveNormalized,
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

    releaseDragSession();

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
      onCommitSignalReading(cardId, signal.id, getFinalReadingFromNormalized(finalNormalized));
      showValueTemporarily();
    } else if (wasMoved) {
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

  const signalRowClassName = "focused-card-signal-slot";
  const signalValueClassName = [
    "focused-card-signal-value",
    isValueVisible ? "focused-card-signal-value--visible" : "focused-card-signal-value--hidden",
  ].join(" ");

  return (
    <div
      className={signalRowClassName}
      role="button"
      tabIndex={0}
      aria-label={`Show ${signal.title} value`}
      onPointerDown={handleRowPointerDown}
      onPointerMove={handleRowPointerMove}
      onPointerUp={finishRowPointerInteraction}
      onPointerCancel={handleRowPointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
    >
      <p>{signal.title}</p>
      <div
        ref={signalTrackRef}
        className="focused-card-signal-track"
        style={{ "--signal-value-position": getSignalValuePositionPercent(effectiveNormalized) } as CSSProperties}
      >
        <span className={signalValueClassName} aria-hidden={!isValueVisible}>
          {displayedReadingLabel}
        </span>
        <PulseFieldSignal value={effectiveNormalized} variant={signal.variant} className="focused-card-signal-trace" />
      </div>
    </div>
  );
}

type BackCardFaceContentProps = {
  card: CardLayout;
  dateLabel: string;
  variant?: "focused" | "deck" | "preview";
  onCommitSignalReading?: (cardId: string, signalId: string, reading: number) => void;
  onSignalNavigateNext?: () => void;
  onSignalNavigatePrevious?: () => void;
};

export default function BackCardFaceContent({
  card,
  dateLabel,
  variant = "focused",
  onCommitSignalReading,
  onSignalNavigateNext,
  onSignalNavigatePrevious,
}: BackCardFaceContentProps) {
  const hasBackMediaTrace = Boolean(card.backMediaTrace);
  const isFocusedVariant = variant === "focused";
  const layoutClassName = ["focused-card-back-layout", "back-card-face-content", `back-card-face-content--${variant}`].join(" ");
  const backSignalsClassName = [
    "focused-card-back-signals",
    !hasBackMediaTrace ? "focused-card-back-signals--no-media" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const externalCommentClassName =
    !hasBackMediaTrace && card.externalComment ? "focused-card-back-external-comment--no-media" : undefined;
  const commitSignalReading = onCommitSignalReading ?? (() => {});
  // Deck/preview signals are passive markings. Only focused signals
  // participate in signal gesture handling.
  const signalGestureShieldHandlers = isFocusedVariant
    ? {
        onPointerDown: blockSignalBlockGesturePropagation,
        onPointerMove: blockSignalBlockGesturePropagation,
        onPointerUp: blockSignalBlockGesturePropagation,
        onPointerCancel: blockSignalBlockGesturePropagation,
      }
    : undefined;

  return (
    <div className={layoutClassName}>
      <CardSemanticAnchors card={card} dateLabel={dateLabel} showProgress={false} variant="back" />
      <div className="focused-card-back-shell">
        <BackCardMediaTrace trace={card.backMediaTrace} />
        <section
          className={backSignalsClassName}
          aria-label="Reflective card signals"
          {...signalGestureShieldHandlers}
        >
          {card.signals.map((signal) =>
            isFocusedVariant ? (
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
        <BackCardReflectionFragment reflectionVerticalOffset={card.reflectionVerticalOffset} text={card.reflection} />
      </div>
    </div>
  );
}
