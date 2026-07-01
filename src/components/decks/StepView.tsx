import { motion, type Transition } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type MouseEvent, type RefCallback } from "react";
import type { CardLayout } from "@/components/cards/cardLayout";
import CloudflareStreamPlayer from "@/components/media/CloudflareStreamPlayer";
import {
  type CloudflareStreamVideoMediaItem,
  isCloudflareStreamVideoMediaItem,
  isKnownPortraitCloudflareStreamVideoMediaItem,
} from "@/lib/media";

export type StepViewItem =
  | { type: "intro" }
  | { type: "step"; stepIndex: number };

type StepViewProps = {
  card: CardLayout;
  cloudflareVideoAnchorRef?: RefCallback<HTMLDivElement>;
  item: StepViewItem;
  itemIndex: number;
  itemCount: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  useCloudflareVideoHost?: boolean;
};

const stepViewTransition: Transition = {
  duration: 0.28,
  ease: [0.22, 0.72, 0.18, 1],
};
const PORTRAIT_MEDIA_REFERENCE_HEIGHT_PX = 199;
const PORTRAIT_MEDIA_MIN_HEIGHT_PX = 160;

function getStepViewItemLabel(item: StepViewItem) {
  return item.type === "intro" ? "Intro" : `Step ${item.stepIndex + 1}`;
}

function getStepViewItemText(card: CardLayout, item: StepViewItem) {
  if (item.type === "intro") {
    return card.intro.title ?? card.label;
  }

  return card.steps[item.stepIndex]?.description ?? "";
}

function getStepViewMediaItem(card: CardLayout, item: StepViewItem) {
  return item.type === "intro" ? card.intro.mediaItem ?? null : card.steps[item.stepIndex]?.mediaItem ?? null;
}

function stopStepViewPropagation(event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function renderStepViewMedia(
  card: CardLayout,
  item: StepViewItem,
  cloudflareVideoAnchorRef?: RefCallback<HTMLDivElement>,
  useCloudflareVideoHost = false
) {
  const mediaItem = getStepViewMediaItem(card, item);

  if (!mediaItem) {
    return "Video placeholder";
  }

  if (isCloudflareStreamVideoMediaItem(mediaItem)) {
    if (useCloudflareVideoHost) {
      return <div className="step-view-video-anchor" ref={cloudflareVideoAnchorRef} aria-hidden="true" />;
    }

    return <CloudflareStreamPlayer controlsMode="switchplay" mediaItem={mediaItem} />;
  }

  return mediaItem.mediaType === "video" ? "Video not ready yet" : "Unsupported media";
}

function isStepViewPortraitMedia(card: CardLayout, item: StepViewItem) {
  const mediaItem = getStepViewMediaItem(card, item);

  return isCloudflareStreamVideoMediaItem(mediaItem) && isKnownPortraitCloudflareStreamVideoMediaItem(mediaItem);
}

export default function StepView({
  card,
  cloudflareVideoAnchorRef,
  item,
  itemIndex,
  itemCount,
  onClose,
  onNext,
  onPrevious,
  useCloudflareVideoHost = false,
}: StepViewProps) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [portraitMediaMaxHeight, setPortraitMediaMaxHeight] = useState(PORTRAIT_MEDIA_REFERENCE_HEIGHT_PX);
  const itemLabel = getStepViewItemLabel(item);
  const itemText = getStepViewItemText(card, item);
  const isPortraitMedia = isStepViewPortraitMedia(card, item);
  const bodyStyle = isPortraitMedia
    ? ({
        "--step-view-portrait-media-max-height": `${portraitMediaMaxHeight}px`,
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    if (!isPortraitMedia) {
      setPortraitMediaMaxHeight(PORTRAIT_MEDIA_REFERENCE_HEIGHT_PX);
      return;
    }

    const titleElement = titleRef.current;

    if (!titleElement) {
      return;
    }

    const updatePortraitMediaMaxHeight = () => {
      const titleHeight = titleElement.getBoundingClientRect().height;
      const lineHeight = Number.parseFloat(window.getComputedStyle(titleElement).lineHeight);
      const singleLineHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : titleHeight;
      const extraTitleHeight = Math.max(0, titleHeight - singleLineHeight);
      const nextMaxHeight = Math.max(
        PORTRAIT_MEDIA_MIN_HEIGHT_PX,
        Math.round(PORTRAIT_MEDIA_REFERENCE_HEIGHT_PX - extraTitleHeight)
      );

      setPortraitMediaMaxHeight(nextMaxHeight);
    };

    updatePortraitMediaMaxHeight();

    const resizeObserver = new ResizeObserver(updatePortraitMediaMaxHeight);
    resizeObserver.observe(titleElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isPortraitMedia, itemText]);

  return (
    <motion.section
      className="step-view-layer"
      data-step-view-item={item.type}
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={stepViewTransition}
      aria-label={`${itemLabel} detail`}
      onClick={stopStepViewPropagation}
      onPointerDown={stopStepViewPropagation}
      onPointerMove={stopStepViewPropagation}
      onPointerUp={stopStepViewPropagation}
      onPointerCancel={stopStepViewPropagation}
    >
      <header className="step-view-header">
        <p className="step-view-kicker">{itemLabel}</p>
        <button className="step-view-close" onClick={onClose} type="button" aria-label="Back to stage">
          Back
        </button>
      </header>
      <main className={`step-view-body${isPortraitMedia ? " step-view-body--portrait-media" : ""}`} style={bodyStyle}>
        <h2 className="step-view-title" ref={titleRef}>
          {itemText || "No description yet."}
        </h2>
        <div
          className={`step-view-video-placeholder${isPortraitMedia ? " step-view-video-placeholder--portrait" : ""}`}
          onClick={stopStepViewPropagation}
          onPointerDown={stopStepViewPropagation}
          onPointerMove={stopStepViewPropagation}
          onPointerUp={stopStepViewPropagation}
          onPointerCancel={stopStepViewPropagation}
        >
          {renderStepViewMedia(card, item, cloudflareVideoAnchorRef, useCloudflareVideoHost)}
        </div>
      </main>
      <footer className="step-view-actions">
        <button disabled={itemIndex === 0} onClick={onPrevious} type="button">
          Previous
        </button>
        <span>{itemIndex + 1}/{itemCount}</span>
        <button disabled={itemIndex >= itemCount - 1} onClick={onNext} type="button">
          Next
        </button>
      </footer>
    </motion.section>
  );
}
