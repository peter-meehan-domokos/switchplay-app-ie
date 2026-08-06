import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { getCloudflareStreamThumbnailUrl } from "@/components/media/CloudflareStreamPlayer";
import { DECK_GESTURE_THRESHOLDS } from "@/components/decks/gestures/gestureThresholds";
import type { WeeklyCard } from "@/components/decks/types";
import {
  getMediaTitle,
  isCloudflareStreamVideoMediaItem,
  isKnownPortraitCloudflareStreamVideoMediaItem,
} from "@/lib/media";

type IntroMediaBlockProps = {
  card: WeeklyCard;
  onIntroNavigateNext?: () => void;
  onIntroNavigatePrevious?: () => void;
  onOpenIntroView?: () => void;
};

type IntroGestureSession = {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  resolved: boolean;
};

function getIntroGestureAxis(deltaX: number, deltaY: number): "horizontal" | "vertical" | null {
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

export default function IntroMediaBlock({ card, onIntroNavigateNext, onIntroNavigatePrevious, onOpenIntroView }: IntroMediaBlockProps) {
  const mediaItem = card.intro.mediaItem;
  const introTitle = card.intro.title ?? "";
  const thumbnailSrc = isCloudflareStreamVideoMediaItem(mediaItem) ? getCloudflareStreamThumbnailUrl(mediaItem) : null;
  const isPortraitThumbnail = isCloudflareStreamVideoMediaItem(mediaItem) && isKnownPortraitCloudflareStreamVideoMediaItem(mediaItem);
  const identityClassName = `active-card-identity${isPortraitThumbnail ? " active-card-identity--portrait-intro" : ""}${!mediaItem ? " active-card-identity--no-media" : ""}`;
  const [failedThumbnailSrc, setFailedThumbnailSrc] = useState<string | null>(null);
  const shouldShowThumbnail = Boolean(thumbnailSrc && failedThumbnailSrc !== thumbnailSrc);
  const isIntroViewTrigger = typeof onOpenIntroView === "function";
  const introGestureSessionRef = useRef<IntroGestureSession | null>(null);
  const suppressNextClickRef = useRef(false);

  const releaseIntroGesture = () => {
    introGestureSessionRef.current = null;
  };

  const resolveMovedIntroGesture = (
    event: PointerEvent<HTMLDivElement>,
    session: IntroGestureSession,
    axis: "horizontal" | "vertical",
    deltaY: number
  ) => {
    suppressNextClickRef.current = true;
    introGestureSessionRef.current = {
      ...session,
      moved: true,
      resolved: true,
    };
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    releaseIntroGesture();

    if (axis === "vertical") {
      if (deltaY > 0) {
        onIntroNavigateNext?.();
      } else {
        onIntroNavigatePrevious?.();
      }
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isIntroViewTrigger) {
      return;
    }

    event.stopPropagation();

    if (event.button !== 0 || introGestureSessionRef.current) {
      return;
    }

    suppressNextClickRef.current = false;
    introGestureSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      resolved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isIntroViewTrigger) {
      return;
    }

    event.stopPropagation();

    const session = introGestureSessionRef.current;

    if (!session || session.pointerId !== event.pointerId || session.resolved) {
      return;
    }

    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    const moved = session.moved || Math.hypot(deltaX, deltaY) >= DECK_GESTURE_THRESHOLDS.deadZonePx;
    const axis = getIntroGestureAxis(deltaX, deltaY);

    introGestureSessionRef.current = {
      ...session,
      moved,
    };

    if (axis) {
      resolveMovedIntroGesture(event, { ...session, moved }, axis, deltaY);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isIntroViewTrigger) {
      return;
    }

    event.stopPropagation();

    const session = introGestureSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    const moved = session.moved || Math.hypot(deltaX, deltaY) >= DECK_GESTURE_THRESHOLDS.deadZonePx;
    const axis = getIntroGestureAxis(deltaX, deltaY);

    if (axis) {
      resolveMovedIntroGesture(event, { ...session, moved }, axis, deltaY);
      return;
    }

    if (moved) {
      suppressNextClickRef.current = true;
      event.preventDefault();
    }

    releaseIntroGesture();
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (!isIntroViewTrigger) {
      return;
    }

    event.stopPropagation();

    const session = introGestureSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (session.moved) {
      suppressNextClickRef.current = true;
    }

    releaseIntroGesture();
  };

  const handleLostPointerCapture = (event: PointerEvent<HTMLDivElement>) => {
    const session = introGestureSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    if (session.moved) {
      suppressNextClickRef.current = true;
    }

    releaseIntroGesture();
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!isIntroViewTrigger) {
      return;
    }

    if (suppressNextClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextClickRef.current = false;
      return;
    }

    event.stopPropagation();
    onOpenIntroView?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isIntroViewTrigger || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onOpenIntroView?.();
  };

  return (
    <div
      className={identityClassName}
      onClickCapture={isIntroViewTrigger ? handleClickCapture : undefined}
      onKeyDown={isIntroViewTrigger ? handleKeyDown : undefined}
      onLostPointerCapture={isIntroViewTrigger ? handleLostPointerCapture : undefined}
      onPointerCancel={isIntroViewTrigger ? handlePointerCancel : undefined}
      onPointerDown={isIntroViewTrigger ? handlePointerDown : undefined}
      onPointerMove={isIntroViewTrigger ? handlePointerMove : undefined}
      onPointerUp={isIntroViewTrigger ? handlePointerUp : undefined}
      role={isIntroViewTrigger ? "button" : undefined}
      tabIndex={isIntroViewTrigger ? 0 : undefined}
    >
      {mediaItem ? (
        <div
          className={`intro-media-thumb${isPortraitThumbnail ? " intro-media-thumb--portrait" : ""}`}
          aria-label={getMediaTitle(mediaItem, introTitle)}
        >
          {thumbnailSrc && shouldShowThumbnail ? (
            <img
              alt=""
              className="intro-media-thumbnail"
              loading="lazy"
              onError={() => setFailedThumbnailSrc(thumbnailSrc)}
              src={thumbnailSrc}
            />
          ) : null}
          <span className="intro-media-play" aria-hidden="true" />
        </div>
      ) : null}
      <div className="active-card-title-block">
        <p>{introTitle}</p>
      </div>
    </div>
  );
}
