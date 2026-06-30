import { motion, type Transition } from "motion/react";
import type { PointerEvent, MouseEvent } from "react";
import type { CardLayout } from "@/components/cards/cardLayout";
import CloudflareStreamPlayer from "@/components/media/CloudflareStreamPlayer";
import { isCloudflareStreamVideoMediaItem } from "@/lib/media";

export type StepViewItem =
  | { type: "intro" }
  | { type: "step"; stepIndex: number };

type StepViewProps = {
  card: CardLayout;
  item: StepViewItem;
  itemIndex: number;
  itemCount: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

const stepViewTransition: Transition = {
  duration: 0.28,
  ease: [0.22, 0.72, 0.18, 1],
};

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

function renderStepViewMedia(card: CardLayout, item: StepViewItem) {
  const mediaItem = getStepViewMediaItem(card, item);

  if (!mediaItem) {
    return "Video placeholder";
  }

  if (isCloudflareStreamVideoMediaItem(mediaItem)) {
    return <CloudflareStreamPlayer controlsMode="switchplay" mediaItem={mediaItem} />;
  }

  return mediaItem.mediaType === "video" ? "Video not ready yet" : "Unsupported media";
}

export default function StepView({
  card,
  item,
  itemIndex,
  itemCount,
  onClose,
  onNext,
  onPrevious,
}: StepViewProps) {
  const itemLabel = getStepViewItemLabel(item);
  const itemText = getStepViewItemText(card, item);

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
      <main className="step-view-body">
        <h2 className="step-view-title">{itemText || "No description yet."}</h2>
        <div
          className="step-view-video-placeholder"
          onClick={stopStepViewPropagation}
          onPointerDown={stopStepViewPropagation}
          onPointerMove={stopStepViewPropagation}
          onPointerUp={stopStepViewPropagation}
          onPointerCancel={stopStepViewPropagation}
        >
          {renderStepViewMedia(card, item)}
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
