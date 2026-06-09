import type { CSSProperties } from "react";

// Creator Drag Lab geometry is centralized because drag/drop, auto-scroll,
// hit-testing, panning, and CSS layout must all agree on the same measurements.
// Do not duplicate these values in component CSS.
export const CREATOR_GEOMETRY = {
  creatorHeaderHeight: 106,
  rootPaddingTop: 14,
  rootPaddingBottom: 8,
  headerGap: 12,
  headerPaddingX: 16,
  headerPaddingBottom: 10,
  deckTitleMaxWidth: 420,
  backLinkPaddingY: 8,
  backLinkPaddingX: 12,
  scrollPaddingX: 16,
  scrollPaddingBottom: 8,
  columnWidth: 172,
  columnGap: 12,
  columnHeaderHeight: 80,
  cardMetaHeight: 18,
  cardTitleHeight: 42,
  cardHeaderGap: 2,
  columnHeaderPadding: 8,
  addCardControlWidth: 58,
  rowCount: 3,
  cellPadding: 6,
  channelHandleWidth: 28,
  channelHandleHeight: 32,
  channelHandleVisibleWidth: 24,
  channelHandleVisibleHeight: 24,
  channelHandleGap: 6,
  panGutterHeight: 60,
  panGutterMobileHeight: 60,
  panGutterGap: 8,
  pairHeight: 80,
  pairOverlayWidth: 150,
  pairInternalPadding: 4,
  pairContentGap: 2,
  pairTextPadding: 2,
  pairStepTrack: 7,
  pairSignalTrack: 3,
  pairStepMinHeight: 58,
  pairStepLineClamp: 3,
  pairSignalLineClamp: 1,
  pairHandleWidth: 44,
  pairHandleHeight: 34,
  pairHandleVisibleWidth: 24,
  pairHandleVisibleHeight: 18,
  pairHandleAreaHeight: 34,
  dragHandleDotSize: 3,
  dragHandleDotColumnGap: 3,
  dragHandleDotRowGap: 3,
  modalMaxWidth: 420,
  modalMaxHeight: 640,
  modalPadding: 18,
  modalGap: 12,
  modalTextareaMinHeight: 220,
  panStartThreshold: 4,
  pairDragActivationDistance: 4,
} as const;

export const CREATOR_DERIVED_GEOMETRY = {
  columnFixedHeight: CREATOR_GEOMETRY.columnHeaderHeight,
} as const;

type CreatorGeometryCssProperties = CSSProperties & {
  "--creator-root-padding-top": string;
  "--creator-root-padding-bottom": string;
  "--creator-header-height": string;
  "--creator-header-gap": string;
  "--creator-header-padding-x": string;
  "--creator-header-padding-bottom": string;
  "--creator-deck-title-max-width": string;
  "--creator-back-link-padding-y": string;
  "--creator-back-link-padding-x": string;
  "--creator-scroll-padding-x": string;
  "--creator-scroll-padding-bottom": string;
  "--creator-column-width": string;
  "--creator-column-gap": string;
  "--creator-column-header-height": string;
  "--creator-add-card-control-width": string;
  "--creator-card-meta-height": string;
  "--creator-card-title-height": string;
  "--creator-card-header-gap": string;
  "--creator-column-header-padding": string;
  "--creator-row-count": number;
  "--creator-cell-padding": string;
  "--creator-channel-handle-width": string;
  "--creator-channel-handle-height": string;
  "--creator-channel-handle-visible-width": string;
  "--creator-channel-handle-visible-height": string;
  "--creator-channel-handle-gap": string;
  "--creator-pan-gutter-height": string;
  "--creator-pan-gutter-mobile-height": string;
  "--creator-pan-gutter-gap": string;
  "--creator-pair-height": string;
  "--creator-pair-overlay-width": string;
  "--creator-pair-internal-padding": string;
  "--creator-pair-content-gap": string;
  "--creator-pair-text-padding": string;
  "--creator-pair-step-track": string;
  "--creator-pair-signal-track": string;
  "--creator-pair-step-min-height": string;
  "--creator-pair-step-line-clamp": number;
  "--creator-pair-signal-line-clamp": number;
  "--creator-pair-handle-width": string;
  "--creator-pair-handle-height": string;
  "--creator-pair-handle-visible-width": string;
  "--creator-pair-handle-visible-height": string;
  "--creator-pair-handle-area-height": string;
  "--creator-drag-handle-dot-size": string;
  "--creator-drag-handle-dot-column-gap": string;
  "--creator-drag-handle-dot-row-gap": string;
  "--creator-modal-max-width": string;
  "--creator-modal-max-height": string;
  "--creator-modal-padding": string;
  "--creator-modal-gap": string;
  "--creator-modal-textarea-min-height": string;
};

function toPx(value: number) {
  return `${value}px`;
}

function toFr(value: number) {
  return `${value}fr`;
}

export function getCreatorGeometryStyle(): CreatorGeometryCssProperties {
  return {
    "--creator-root-padding-top": toPx(CREATOR_GEOMETRY.rootPaddingTop),
    "--creator-root-padding-bottom": toPx(CREATOR_GEOMETRY.rootPaddingBottom),
    "--creator-header-height": toPx(CREATOR_GEOMETRY.creatorHeaderHeight),
    "--creator-header-gap": toPx(CREATOR_GEOMETRY.headerGap),
    "--creator-header-padding-x": toPx(CREATOR_GEOMETRY.headerPaddingX),
    "--creator-header-padding-bottom": toPx(CREATOR_GEOMETRY.headerPaddingBottom),
    "--creator-deck-title-max-width": toPx(CREATOR_GEOMETRY.deckTitleMaxWidth),
    "--creator-back-link-padding-y": toPx(CREATOR_GEOMETRY.backLinkPaddingY),
    "--creator-back-link-padding-x": toPx(CREATOR_GEOMETRY.backLinkPaddingX),
    "--creator-scroll-padding-x": toPx(CREATOR_GEOMETRY.scrollPaddingX),
    "--creator-scroll-padding-bottom": toPx(CREATOR_GEOMETRY.scrollPaddingBottom),
    "--creator-column-width": toPx(CREATOR_GEOMETRY.columnWidth),
    "--creator-column-gap": toPx(CREATOR_GEOMETRY.columnGap),
    "--creator-column-header-height": toPx(CREATOR_GEOMETRY.columnHeaderHeight),
    "--creator-add-card-control-width": toPx(CREATOR_GEOMETRY.addCardControlWidth),
    "--creator-card-meta-height": toPx(CREATOR_GEOMETRY.cardMetaHeight),
    "--creator-card-title-height": toPx(CREATOR_GEOMETRY.cardTitleHeight),
    "--creator-card-header-gap": toPx(CREATOR_GEOMETRY.cardHeaderGap),
    "--creator-column-header-padding": toPx(CREATOR_GEOMETRY.columnHeaderPadding),
    "--creator-row-count": CREATOR_GEOMETRY.rowCount,
    "--creator-cell-padding": toPx(CREATOR_GEOMETRY.cellPadding),
    "--creator-channel-handle-width": toPx(CREATOR_GEOMETRY.channelHandleWidth),
    "--creator-channel-handle-height": toPx(CREATOR_GEOMETRY.channelHandleHeight),
    "--creator-channel-handle-visible-width": toPx(CREATOR_GEOMETRY.channelHandleVisibleWidth),
    "--creator-channel-handle-visible-height": toPx(CREATOR_GEOMETRY.channelHandleVisibleHeight),
    "--creator-channel-handle-gap": toPx(CREATOR_GEOMETRY.channelHandleGap),
    "--creator-pan-gutter-height": toPx(CREATOR_GEOMETRY.panGutterHeight),
    "--creator-pan-gutter-mobile-height": toPx(CREATOR_GEOMETRY.panGutterMobileHeight),
    "--creator-pan-gutter-gap": toPx(CREATOR_GEOMETRY.panGutterGap),
    "--creator-pair-height": toPx(CREATOR_GEOMETRY.pairHeight),
    "--creator-pair-overlay-width": toPx(CREATOR_GEOMETRY.pairOverlayWidth),
    "--creator-pair-internal-padding": toPx(CREATOR_GEOMETRY.pairInternalPadding),
    "--creator-pair-content-gap": toPx(CREATOR_GEOMETRY.pairContentGap),
    "--creator-pair-text-padding": toPx(CREATOR_GEOMETRY.pairTextPadding),
    "--creator-pair-step-track": toFr(CREATOR_GEOMETRY.pairStepTrack),
    "--creator-pair-signal-track": toFr(CREATOR_GEOMETRY.pairSignalTrack),
    "--creator-pair-step-min-height": toPx(CREATOR_GEOMETRY.pairStepMinHeight),
    "--creator-pair-step-line-clamp": CREATOR_GEOMETRY.pairStepLineClamp,
    "--creator-pair-signal-line-clamp": CREATOR_GEOMETRY.pairSignalLineClamp,
    "--creator-pair-handle-width": toPx(CREATOR_GEOMETRY.pairHandleWidth),
    "--creator-pair-handle-height": toPx(CREATOR_GEOMETRY.pairHandleHeight),
    "--creator-pair-handle-visible-width": toPx(CREATOR_GEOMETRY.pairHandleVisibleWidth),
    "--creator-pair-handle-visible-height": toPx(CREATOR_GEOMETRY.pairHandleVisibleHeight),
    "--creator-pair-handle-area-height": toPx(CREATOR_GEOMETRY.pairHandleAreaHeight),
    "--creator-drag-handle-dot-size": toPx(CREATOR_GEOMETRY.dragHandleDotSize),
    "--creator-drag-handle-dot-column-gap": toPx(CREATOR_GEOMETRY.dragHandleDotColumnGap),
    "--creator-drag-handle-dot-row-gap": toPx(CREATOR_GEOMETRY.dragHandleDotRowGap),
    "--creator-modal-max-width": toPx(CREATOR_GEOMETRY.modalMaxWidth),
    "--creator-modal-max-height": toPx(CREATOR_GEOMETRY.modalMaxHeight),
    "--creator-modal-padding": toPx(CREATOR_GEOMETRY.modalPadding),
    "--creator-modal-gap": toPx(CREATOR_GEOMETRY.modalGap),
    "--creator-modal-textarea-min-height": toPx(CREATOR_GEOMETRY.modalTextareaMinHeight),
  };
}

export function getCreatorRows(): number[] {
  return Array.from({ length: CREATOR_GEOMETRY.rowCount }, (_, index) => index);
}
