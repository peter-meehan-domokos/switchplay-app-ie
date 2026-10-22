import { motion, type Transition } from "motion/react";
import { type PointerEvent, type MouseEvent, type ReactNode, type RefCallback } from "react";
import InfoCardPouch, { type InfoCardPouchProps } from "@/components/info-cards/InfoCardPouch";
import styles from "./StepView.module.css";
import type { PresentedCard } from "./presentation";
import StepDescriptionText from "@/components/cards/StepDescriptionText";
import CloudflareStreamPlayer from "@/components/media/CloudflareStreamPlayer";
import {
  type CloudflareStreamVideoMediaItem,
  isCloudflareStreamVideoMediaItem,
  isKnownLandscapeCloudflareStreamVideoMediaItem,
  isKnownPortraitCloudflareStreamVideoMediaItem,
} from "@/lib/media";

export type StepViewItem =
  | { type: "intro" }
  | { type: "step"; stepIndex: number };

export type StepViewInfoCards = InfoCardPouchProps & { content?: ReactNode };

type StepViewProps = {
  card: PresentedCard;
  cloudflareVideoAnchorRef?: RefCallback<HTMLDivElement>;
  item: StepViewItem;
  itemIndex: number;
  itemCount: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  useCloudflareVideoHost?: boolean;
  infoCards?: StepViewInfoCards;
  mediaPreview?: ReactNode;
};

const stepViewTransition: Transition = {
  duration: 0.28,
  ease: [0.22, 0.72, 0.18, 1],
};

function getStepViewItemLabel(item: StepViewItem) {
  if (item.type === "intro") {
    return "INTRO";
  }

  return `STEP ${item.stepIndex + 1}`;
}

function getStepViewItemTitle(card: PresentedCard, item: StepViewItem) {
  return item.type === "step" ? card.steps[item.stepIndex]?.title : null;
}

function getStepViewItemText(card: PresentedCard, item: StepViewItem) {
  if (item.type === "intro") {
    return card.intro.title ?? card.label;
  }

  return card.steps[item.stepIndex]?.description ?? "";
}

function getStepViewItemContent(card: PresentedCard, item: StepViewItem) {
  return item.type === "step" ? card.steps[item.stepIndex]?.descriptionContent : undefined;
}

function getStepViewMediaItem(card: PresentedCard, item: StepViewItem) {
  return item.type === "intro" ? card.intro.mediaItem ?? null : card.steps[item.stepIndex]?.mediaItem ?? null;
}

function getStepViewVideoSurfaceModifierClass(mediaItem: CloudflareStreamVideoMediaItem | null) {
  if (!mediaItem) {
    return null;
  }

  if (isKnownPortraitCloudflareStreamVideoMediaItem(mediaItem)) {
    return "step-view-video-placeholder--portrait";
  }

  if (isKnownLandscapeCloudflareStreamVideoMediaItem(mediaItem)) {
    return "step-view-video-placeholder--landscape";
  }

  return "step-view-video-placeholder--landscape";
}

function stopStepViewPropagation(event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function renderStepViewMedia(
  card: PresentedCard,
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
  infoCards,
  mediaPreview,
}: StepViewProps) {
  const itemLabel = getStepViewItemLabel(item);
  const itemTitle = getStepViewItemTitle(card, item);
  const itemText = getStepViewItemText(card, item);
  const itemContent = getStepViewItemContent(card, item);
  const hasItemContent = Boolean(itemContent?.length);
  const mediaItem = getStepViewMediaItem(card, item);
  const cloudflareVideoMediaItem = isCloudflareStreamVideoMediaItem(mediaItem) ? mediaItem : null;
  const videoSurfaceModifierClass = getStepViewVideoSurfaceModifierClass(cloudflareVideoMediaItem);
  const videoPlaceholderClassName = `step-view-video-placeholder${videoSurfaceModifierClass ? ` ${videoSurfaceModifierClass}` : ""}`;

  return (
    <motion.section
      className={`step-view-layer${infoCards || mediaPreview ? ` ${styles.surface}` : ""}`}
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
        <button className="step-view-close" onClick={onClose} type="button" aria-label="Close step view">
          &times;
        </button>
      </header>
      <main className="step-view-body">
        <h2 className="step-view-title">
          {itemTitle ? <span className="step-title">{itemTitle}</span> : null}
          {itemText || hasItemContent ? (
            <StepDescriptionText content={itemContent} fallback={itemText} />
          ) : !itemTitle ? (
            "No description yet."
          ) : null}
        </h2>
        <div
          className={`${videoPlaceholderClassName}${mediaPreview ? ` ${styles.mediaPreview}` : ""}`}
          onClick={stopStepViewPropagation}
          onPointerDown={stopStepViewPropagation}
          onPointerMove={stopStepViewPropagation}
          onPointerUp={stopStepViewPropagation}
          onPointerCancel={stopStepViewPropagation}
        >
          {mediaPreview ?? renderStepViewMedia(card, item, cloudflareVideoAnchorRef, useCloudflareVideoHost)}
        </div>
      </main>
      <footer className={`step-view-actions ${styles.actions}`} data-info-open={Boolean(infoCards && infoCards.count > 0 && infoCards.expanded)}>
        {infoCards && infoCards.count > 0 ? <div className={styles.pouch}><InfoCardPouch {...infoCards} /></div> : null}
        <button className={styles.previous} disabled={itemIndex === 0} onClick={onPrevious} type="button">
          Previous
        </button>
        <span className={styles.index}>{itemIndex + 1}/{itemCount}</span>
        <button className={styles.next} disabled={itemIndex >= itemCount - 1} onClick={onNext} type="button">
          Next
        </button>
      </footer>
      {infoCards && infoCards.count > 0 && infoCards.expanded && infoCards.content ? (
        <section id={infoCards.controlsId} className={styles.preview} aria-label="Information cards" data-info-card-stack="">
          <div className={styles.backing} aria-hidden="true" data-info-card-backing="" />
          <div className={styles.backing} aria-hidden="true" data-info-card-backing="" />
          <div className={styles.topCard}>{infoCards.content}</div>
          <button className={styles.consultationClose} type="button" aria-label="Close information card stack" onClick={infoCards.onToggle}>×</button>
        </section>
      ) : null}
    </motion.section>
  );
}
