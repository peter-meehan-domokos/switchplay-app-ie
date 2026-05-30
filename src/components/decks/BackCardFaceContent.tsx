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
import PulseFieldSignal, {
  getSignalValuePositionPercent,
  SIGNAL_FIELD_VIEWBOX_WIDTH,
  SIGNAL_FIELD_WIDTH,
} from "@/components/decks/PulseFieldSignal";

const SIGNAL_VALUE_VISIBILITY_MS = 3000;
const SIGNAL_DRAG_THRESHOLD_PX = 8;
const isSignalGestureShieldDebug = process.env.NODE_ENV !== "production";
const signalFieldMovementRatio = SIGNAL_FIELD_WIDTH / SIGNAL_FIELD_VIEWBOX_WIDTH;

type SignalDragSession = {
  pointerId: number;
  startPointerX: number;
  startNormalized: number;
  movementRangePx: number;
};

function clampNormalized(value: number) {
  return Math.min(Math.max(value, 0), 1);
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
  isSignalGeometryDebug: boolean;
  onCommitSignalReading: (cardId: string, signalId: string, reading: number) => void;
};

function FocusedSignalRow({ cardId, signal, isSignalGeometryDebug, onCommitSignalReading }: FocusedSignalRowProps) {
  const [isValueVisible, setIsValueVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentNormalized, setCurrentNormalized] = useState(signal.value);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragSessionRef = useRef<SignalDragSession | null>(null);
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
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    setCurrentNormalized(signal.value);
    releaseDragSession();
  }, [releaseDragSession, signal.id, signal.value]);

  useEffect(() => {
    return () => {
      clearHideTimer();
      releaseDragSession();
    };
  }, [clearHideTimer, releaseDragSession]);

  const effectiveNormalized = clampNormalized(currentNormalized);
  const displayedReading = useMemo(() => {
    const reading = normalizedToReading(effectiveNormalized, signal.minValue, signal.maxValue, signal.order);

    return clampReadingToSignalRange(snapReadingToInteger(reading), signal.minValue, signal.maxValue);
  }, [effectiveNormalized, signal.maxValue, signal.minValue, signal.order]);

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

  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const handleRowPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (event.button !== 0) {
      return;
    }

    showValueTemporarily();

    const movementRangePx = getMovementRangePx();

    if (movementRangePx <= 0) {
      return;
    }

    dragSessionRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startNormalized: effectiveNormalized,
      movementRangePx,
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
    const movementDistance = Math.abs(deltaX);

    if (!isDragging && movementDistance < SIGNAL_DRAG_THRESHOLD_PX) {
      return;
    }

    if (!isDragging) {
      isDraggingRef.current = true;
      setIsDragging(true);
    }

    keepValueVisible();
    event.preventDefault();

    const normalizedDelta = deltaX / session.movementRangePx;
    const nextNormalized = clampNormalized(session.startNormalized + normalizedDelta);
    setCurrentNormalized(nextNormalized);
  };

  const finishRowPointerInteraction = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const session = dragSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const deltaX = event.clientX - session.startPointerX;
    const normalizedDelta = deltaX / session.movementRangePx;
    const finalNormalized = clampNormalized(session.startNormalized + normalizedDelta);
    setCurrentNormalized(finalNormalized);

    const wasDragging = isDraggingRef.current;
    releaseDragSession();

    if (wasDragging) {
      onCommitSignalReading(cardId, signal.id, getFinalReadingFromNormalized(finalNormalized));
      showValueTemporarily();
    }
  };

  const handleRowPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    const session = dragSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const wasDragging = isDraggingRef.current;
    releaseDragSession();

    if (wasDragging) {
      showValueTemporarily();
    }
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    showValueTemporarily();
  };

  const signalRowClassName = ["focused-card-signal-slot", isSignalGeometryDebug ? "debug-signal-drag-region" : undefined]
    .filter(Boolean)
    .join(" ");
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
          {displayedReading}
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
};

export default function BackCardFaceContent({ card, dateLabel, variant = "focused", onCommitSignalReading }: BackCardFaceContentProps) {
  const isSignalGeometryDebug = process.env.NODE_ENV !== "production";
  const hasBackMediaTrace = Boolean(card.backMediaTrace);
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

  return (
    <div className={layoutClassName}>
      <CardSemanticAnchors card={card} dateLabel={dateLabel} showProgress={false} variant="back" />
      <div className="focused-card-back-shell">
        <BackCardMediaTrace trace={card.backMediaTrace} />
        <section
          className={backSignalsClassName}
          aria-label="Reflective card signals"
          onPointerDown={blockSignalBlockGesturePropagation}
          onPointerMove={blockSignalBlockGesturePropagation}
          onPointerUp={blockSignalBlockGesturePropagation}
          onPointerCancel={blockSignalBlockGesturePropagation}
        >
          {card.signals.map((signal) => (
            <FocusedSignalRow
              key={signal.id}
              cardId={card.id}
              signal={signal}
              isSignalGeometryDebug={isSignalGeometryDebug}
              onCommitSignalReading={commitSignalReading}
            />
          ))}
        </section>
        <BackCardExternalComment comment={card.externalComment} className={externalCommentClassName} />
        <BackCardReflectionFragment reflectionVerticalOffset={card.reflectionVerticalOffset} text={card.reflection} />
      </div>
    </div>
  );
}
