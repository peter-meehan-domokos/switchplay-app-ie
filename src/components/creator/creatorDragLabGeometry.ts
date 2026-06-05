import type { CSSProperties } from "react";

// Creator Drag Lab geometry is centralized because drag/drop, auto-scroll,
// hit-testing, panning, and CSS layout must all agree on the same measurements.
// Do not duplicate these values in component CSS.
export const CREATOR_GEOMETRY = {
  rootPaddingTop: 16,
  rootPaddingBottom: 28,
  headerGap: 16,
  headerPaddingX: 16,
  headerPaddingBottom: 16,
  backLinkPaddingY: 8,
  backLinkPaddingX: 12,
  scrollPaddingX: 16,
  scrollPaddingBottom: 18,
  columnWidth: 172,
  columnGap: 12,
  columnHeaderHeight: 40,
  columnHeaderPadding: 10,
  rowHeight: 112,
  rowCount: 3,
  cellPadding: 10,
  panGutterHeight: 104,
  panGutterMobileHeight: 128,
  panGutterGap: 12,
  pairHeight: 80,
  pairOverlayWidth: 150,
  pairInternalPadding: 6,
  pairHandleWidth: 44,
  pairHandleHeight: 34,
  panStartThreshold: 4,
  pairDragActivationDistance: 4,
} as const;

export const CREATOR_DERIVED_GEOMETRY = {
  columnBodyHeight: CREATOR_GEOMETRY.rowHeight * CREATOR_GEOMETRY.rowCount,
  columnTotalHeight: CREATOR_GEOMETRY.columnHeaderHeight + CREATOR_GEOMETRY.rowHeight * CREATOR_GEOMETRY.rowCount,
} as const;

type CreatorGeometryCssProperties = CSSProperties & {
  "--creator-root-padding-top": string;
  "--creator-root-padding-bottom": string;
  "--creator-header-gap": string;
  "--creator-header-padding-x": string;
  "--creator-header-padding-bottom": string;
  "--creator-back-link-padding-y": string;
  "--creator-back-link-padding-x": string;
  "--creator-scroll-padding-x": string;
  "--creator-scroll-padding-bottom": string;
  "--creator-column-width": string;
  "--creator-column-gap": string;
  "--creator-column-header-height": string;
  "--creator-column-header-padding": string;
  "--creator-row-height": string;
  "--creator-cell-padding": string;
  "--creator-pan-gutter-height": string;
  "--creator-pan-gutter-mobile-height": string;
  "--creator-pan-gutter-gap": string;
  "--creator-pair-height": string;
  "--creator-pair-overlay-width": string;
  "--creator-pair-internal-padding": string;
  "--creator-pair-handle-width": string;
  "--creator-pair-handle-height": string;
};

function toPx(value: number) {
  return `${value}px`;
}

export function getCreatorGeometryStyle(): CreatorGeometryCssProperties {
  return {
    "--creator-root-padding-top": toPx(CREATOR_GEOMETRY.rootPaddingTop),
    "--creator-root-padding-bottom": toPx(CREATOR_GEOMETRY.rootPaddingBottom),
    "--creator-header-gap": toPx(CREATOR_GEOMETRY.headerGap),
    "--creator-header-padding-x": toPx(CREATOR_GEOMETRY.headerPaddingX),
    "--creator-header-padding-bottom": toPx(CREATOR_GEOMETRY.headerPaddingBottom),
    "--creator-back-link-padding-y": toPx(CREATOR_GEOMETRY.backLinkPaddingY),
    "--creator-back-link-padding-x": toPx(CREATOR_GEOMETRY.backLinkPaddingX),
    "--creator-scroll-padding-x": toPx(CREATOR_GEOMETRY.scrollPaddingX),
    "--creator-scroll-padding-bottom": toPx(CREATOR_GEOMETRY.scrollPaddingBottom),
    "--creator-column-width": toPx(CREATOR_GEOMETRY.columnWidth),
    "--creator-column-gap": toPx(CREATOR_GEOMETRY.columnGap),
    "--creator-column-header-height": toPx(CREATOR_GEOMETRY.columnHeaderHeight),
    "--creator-column-header-padding": toPx(CREATOR_GEOMETRY.columnHeaderPadding),
    "--creator-row-height": toPx(CREATOR_GEOMETRY.rowHeight),
    "--creator-cell-padding": toPx(CREATOR_GEOMETRY.cellPadding),
    "--creator-pan-gutter-height": toPx(CREATOR_GEOMETRY.panGutterHeight),
    "--creator-pan-gutter-mobile-height": toPx(CREATOR_GEOMETRY.panGutterMobileHeight),
    "--creator-pan-gutter-gap": toPx(CREATOR_GEOMETRY.panGutterGap),
    "--creator-pair-height": toPx(CREATOR_GEOMETRY.pairHeight),
    "--creator-pair-overlay-width": toPx(CREATOR_GEOMETRY.pairOverlayWidth),
    "--creator-pair-internal-padding": toPx(CREATOR_GEOMETRY.pairInternalPadding),
    "--creator-pair-handle-width": toPx(CREATOR_GEOMETRY.pairHandleWidth),
    "--creator-pair-handle-height": toPx(CREATOR_GEOMETRY.pairHandleHeight),
  };
}

export function getCreatorRows(): number[] {
  return Array.from({ length: CREATOR_GEOMETRY.rowCount }, (_, index) => index);
}
