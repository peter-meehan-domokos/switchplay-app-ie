import StepItem from "@/components/cards/StepItem";
import { useRef, type MouseEvent, type PointerEvent } from "react";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import type { WeeklyCard } from "@/components/decks/types";

type StepListProps = {
  steps: WeeklyCard["steps"];
  linksEnabled?: boolean;
  onCycleStepStatus?: (stepId: string) => void;
  onOpenStepView?: (stepIndex: number) => void;
  onStepNavigateNext?: () => void;
  onStepNavigatePrevious?: () => void;
};

const isContentGestureShieldDebug = process.env.NODE_ENV === "development";

type StepGestureSession = {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  resolved: boolean;
};

function getStepGestureAxis(deltaX: number, deltaY: number): "horizontal" | "vertical" | null {
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

  if (absoluteX >= absoluteY * DECK_GESTURE_THRESHOLDS.axisLockRatio && hasClearHorizontalLead) {
    return "horizontal";
  }

  if (absoluteY >= absoluteX * DECK_GESTURE_THRESHOLDS.axisLockRatio && hasClearVerticalLead) {
    return "vertical";
  }

  return null;
}

function blockContentGesturePropagation(event: PointerEvent<HTMLOListElement>) {
  event.stopPropagation();

  if (isContentGestureShieldDebug && event.type === "pointerdown") {
    console.debug("Step block captured gesture", {
      pointerType: event.pointerType,
    });
  }
}

function getStepItemIndexFromEventTarget(eventTarget: EventTarget | null) {
  if (!(eventTarget instanceof HTMLElement)) {
    return null;
  }

  if (eventTarget.closest(".step-progress-hit-area, .step-description-link")) {
    return null;
  }

  const stepItem = eventTarget.closest(".active-step-item");

  if (!stepItem?.parentElement) {
    return null;
  }

  return Array.from(stepItem.parentElement.children).indexOf(stepItem);
}

export default function StepList({
  steps,
  linksEnabled,
  onCycleStepStatus,
  onOpenStepView,
  onStepNavigateNext,
  onStepNavigatePrevious,
}: StepListProps) {
  const isInteractive = typeof onCycleStepStatus === "function";
  const stepGestureSessionRef = useRef<StepGestureSession | null>(null);
  const pendingTapStepIndexRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);

  const releaseStepGesture = () => {
    stepGestureSessionRef.current = null;
  };

  const handleInteractivePointerDown = (event: PointerEvent<HTMLOListElement>) => {
    blockContentGesturePropagation(event);

    if (event.button !== 0 || stepGestureSessionRef.current) {
      return;
    }

    suppressNextClickRef.current = false;
    pendingTapStepIndexRef.current = getStepItemIndexFromEventTarget(event.target);
    stepGestureSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      resolved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const resolveMovedStepGesture = (
    event: PointerEvent<HTMLOListElement>,
    session: StepGestureSession,
    axis: "horizontal" | "vertical",
    deltaY: number
  ) => {
    suppressNextClickRef.current = true;
    stepGestureSessionRef.current = {
      ...session,
      moved: true,
      resolved: true,
    };
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    releaseStepGesture();

    if (axis === "vertical") {
      if (deltaY > 0) {
        onStepNavigateNext?.();
      } else {
        onStepNavigatePrevious?.();
      }
    }
  };

  const handleInteractivePointerMove = (event: PointerEvent<HTMLOListElement>) => {
    blockContentGesturePropagation(event);

    const session = stepGestureSessionRef.current;

    if (!session || session.pointerId !== event.pointerId || session.resolved) {
      return;
    }

    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    const moved = session.moved || Math.hypot(deltaX, deltaY) >= DECK_GESTURE_THRESHOLDS.deadZonePx;
    const axis = getStepGestureAxis(deltaX, deltaY);

    stepGestureSessionRef.current = {
      ...session,
      moved,
    };

    if (axis) {
      resolveMovedStepGesture(event, { ...session, moved }, axis, deltaY);
    }
  };

  const handleInteractivePointerUp = (event: PointerEvent<HTMLOListElement>) => {
    blockContentGesturePropagation(event);

    const session = stepGestureSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    const moved = session.moved || Math.hypot(deltaX, deltaY) >= DECK_GESTURE_THRESHOLDS.deadZonePx;
    const axis = getStepGestureAxis(deltaX, deltaY);

    if (axis) {
      resolveMovedStepGesture(event, { ...session, moved }, axis, deltaY);
      return;
    }

    if (moved) {
      suppressNextClickRef.current = true;
      event.preventDefault();
    }

    releaseStepGesture();
  };

  const handleInteractivePointerCancel = (event: PointerEvent<HTMLOListElement>) => {
    blockContentGesturePropagation(event);

    const session = stepGestureSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (session.moved) {
      suppressNextClickRef.current = true;
      pendingTapStepIndexRef.current = null;
    }

    releaseStepGesture();
  };

  const handleInteractiveLostPointerCapture = (event: PointerEvent<HTMLOListElement>) => {
    const session = stepGestureSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    if (session.moved) {
      suppressNextClickRef.current = true;
      pendingTapStepIndexRef.current = null;
    }

    releaseStepGesture();
  };

  const handleInteractiveClickCapture = (event: MouseEvent<HTMLOListElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest(".step-description-link")) {
      pendingTapStepIndexRef.current = null;
      return;
    }

    if (suppressNextClickRef.current) {
      // Vertical or horizontal movement suppresses the eventual click so swipe
      // navigation/cancel never triggers a step action.
      event.preventDefault();
      event.stopPropagation();
      suppressNextClickRef.current = false;
      pendingTapStepIndexRef.current = null;
      return;
    }

    const stepIndex = pendingTapStepIndexRef.current;

    if (stepIndex === null || stepIndex < 0) {
      return;
    }

    pendingTapStepIndexRef.current = null;
    event.stopPropagation();
    onOpenStepView?.(stepIndex);
  };

  // When no cycle callback is supplied, steps are visual-only active/deck
  // content. Parent card gestures must remain in charge.
  const gestureShieldHandlers = isInteractive
    ? {
        // Focused step regions own step-start gestures. They either perform
        // a step action, trigger vertical navigation, or cancel.
        onPointerDown: handleInteractivePointerDown,
        onPointerMove: handleInteractivePointerMove,
        onPointerUp: handleInteractivePointerUp,
        onPointerCancel: handleInteractivePointerCancel,
        onLostPointerCapture: handleInteractiveLostPointerCapture,
        onClickCapture: handleInteractiveClickCapture,
      }
    : undefined;

  return (
    <ol
      className="active-step-list"
      {...gestureShieldHandlers}
    >
      {steps.map((step, index) => (
        <StepItem
          key={step.stepId}
          index={index}
          linksEnabled={linksEnabled}
          onOpenStepView={onOpenStepView}
          step={step}
          onCycleStatus={onCycleStepStatus}
        />
      ))}
    </ol>
  );
}
