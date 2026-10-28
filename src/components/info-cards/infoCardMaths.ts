import type { MathsPresentation, MathsResult } from "../maths-renderer/types";

export const infoMathsPresentation: MathsPresentation = {
  fontFamily: '"Switchplay Liberation Sans", "Switchplay Liberation Serif"',
  fontSizePx: 9.5, fontWeight: 400, lineHeight: 1.25,
  mathScale: 1, paragraphGapEm: .8, displayIndentEm: 1, displayGapEm: .6,
};
export type InfoMathsMeasurement = { result: MathsResult; safe: boolean; headerFits: boolean };

// Consumer collision policy, using only the renderer's returned maths bounds.
// Normal wrapping/padding never changes. Existing blank padding may be used.
export function infoMathsMeasurement(result: MathsResult, face: HTMLElement, body: HTMLElement): InfoMathsMeasurement {
  if (result.status !== "ready") return { result, safe: false, headerFits: false };
  const box = face.getBoundingClientRect(), origin = body.getBoundingClientRect();
  const scale = origin.width / result.layout.available.width;
  const css = getComputedStyle(face);
  const header = face.querySelector<HTMLElement>("[data-info-card-header]")!;
  const title = face.querySelector<HTMLElement>("[data-info-card-title]")!;
  const media = face.querySelector<HTMLElement>("[data-info-card-media]");
  // Stay inside the flat part of the rounded border, even when borrowing
  // bottom padding. This uses the existing radius, not an added safety margin.
  const inset = Math.max(parseFloat(css.borderRadius) || 0, parseFloat(css.borderLeftWidth), parseFloat(css.borderRightWidth));
  const { left, right, top, bottom } = result.layout.bounds;
  const headerFits = title.getBoundingClientRect().right <= box.right - (12 + 1 + 28) * scale;
  const safe = origin.left + left * scale >= box.left + inset * scale
    && origin.left + right * scale <= box.right - inset * scale
    && origin.top + top * scale >= Math.max(header.getBoundingClientRect().bottom, box.top + 32 * scale)
    && origin.top + bottom * scale <= (media ? media.getBoundingClientRect().top : box.bottom - parseFloat(css.borderBottomWidth) * scale);
  return { result, safe, headerFits };
}
