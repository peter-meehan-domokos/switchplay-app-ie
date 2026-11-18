import { motion, type Transition } from "motion/react";
import { type PointerEvent, type MouseEvent, type ReactNode, type RefCallback, type CSSProperties } from "react";
import type { StepMediaItem } from "@/lib/stepMedia";
import { selectedStepMedia } from "@/lib/stepMediaPresentation";
import InfoCardPouch, { type InfoCardPouchProps } from "@/components/info-cards/InfoCardPouch";
import InfoCardStack from "@/components/info-cards/InfoCardStack";
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
  surfaceRef?: RefCallback<HTMLElement>;
  activity?: ReactNode;
  selectedMedia?: StepMediaItem | null;
  mediaTabs?: ReactNode;
  mediaPanelId?: string;
  mediaTabIndex?: number;
  mediaScale?: number;
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

function getStepViewMediaItem(card: PresentedCard, item: StepViewItem, selection?: StepMediaItem | null) {
  const attachment = selection ?? selectedStepMedia(item.type === "intro" ? card.intro : card.steps[item.stepIndex]);
  return attachment && attachment.kind !== "activity" ? attachment.media : null;
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
  useCloudflareVideoHost = false,
  selection?: StepMediaItem | null,
) {
  const mediaItem = getStepViewMediaItem(card, item, selection);

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
  surfaceRef,
  activity,
  selectedMedia,
  mediaTabs,
  mediaPanelId,
  mediaTabIndex,
  mediaScale = 1,
}: StepViewProps) {
  const itemLabel = getStepViewItemLabel(item);
  const itemTitle = getStepViewItemTitle(card, item);
  const itemText = getStepViewItemText(card, item);
  const itemContent = getStepViewItemContent(card, item);
  const hasItemContent = Boolean(itemContent?.length);
  const mediaItem = getStepViewMediaItem(card, item, selectedMedia);
  const cloudflareVideoMediaItem = isCloudflareStreamVideoMediaItem(mediaItem) ? mediaItem : null;
  const videoSurfaceModifierClass = getStepViewVideoSurfaceModifierClass(cloudflareVideoMediaItem);
  const videoPlaceholderClassName = `step-view-video-placeholder${videoSurfaceModifierClass ? ` ${videoSurfaceModifierClass}` : ""}`;
  const mediaSurface = <div
    id={mediaTabs ? mediaPanelId : undefined} role={mediaTabs ? "tabpanel" : undefined}
    aria-labelledby={mediaTabs ? `${mediaPanelId}-tab-${mediaTabIndex}` : undefined}
    className={`${videoPlaceholderClassName}${mediaPreview ? ` ${styles.mediaPreview}` : ""}${selectedMedia?.kind === "activity" ? ` ${styles.interactiveThumbnail}` : ""}`}
    onClick={stopStepViewPropagation} onPointerDown={stopStepViewPropagation} onPointerMove={stopStepViewPropagation}
    onPointerUp={stopStepViewPropagation} onPointerCancel={stopStepViewPropagation}>
    {activity ?? mediaPreview ?? renderStepViewMedia(card, item, cloudflareVideoAnchorRef, useCloudflareVideoHost, selectedMedia)}
  </div>;

  return (
    <motion.section
      ref={surfaceRef}
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
        {mediaTabs ? <div className={styles.multimedia} style={{ "--step-media-scale": mediaScale } as CSSProperties}>{mediaTabs}{mediaSurface}</div> : mediaSurface}
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
        <InfoCardStack id={infoCards.controlsId} onClose={infoCards.onToggle}>{infoCards.content}</InfoCardStack>
      ) : null}
    </motion.section>
  );
}
