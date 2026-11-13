import type { MathsDiagnostic, MathsPresentation, MathsResult } from "../maths-renderer/types";

export const infoMathsPresentation: MathsPresentation = {
  fontFamily: '"Switchplay Liberation Sans", "Switchplay Liberation Serif"',
  fontSizePx: 9.5, fontWeight: 400, lineHeight: 1.25,
  // No display indent: KaTeX centres display maths itself across the full width (checkpoint 9).
  mathScale: 1, paragraphGapEm: .8, displayIndentEm: 0, displayGapEm: .6,
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
  const footer = face.querySelector<HTMLElement>("[data-info-card-footer]");
  // Stay inside the flat part of the rounded border, even when borrowing
  // bottom padding. This uses the existing radius, not an added safety margin.
  const inset = Math.max(parseFloat(css.borderRadius) || 0, parseFloat(css.borderLeftWidth), parseFloat(css.borderRightWidth));
  const { left, right, top, bottom } = result.layout.bounds;
  const headerFits = title.getBoundingClientRect().right <= box.right - (12 + 1 + 28) * scale;
  const safe = origin.left + left * scale >= box.left + inset * scale
    && origin.left + right * scale <= box.right - inset * scale
    && origin.top + top * scale >= Math.max(header.getBoundingClientRect().bottom, box.top + 32 * scale)
    && origin.top + bottom * scale <= (footer ? footer.getBoundingClientRect().top - 4 * scale : box.bottom - parseFloat(css.borderBottomWidth) * scale);
  return { result, safe, headerFits };
}

// One renderer runs per content item (see infoCardContentLayout). Their results combine into the single
// measurement the editor and the server check consume: bounds in body coordinates, available space = the body.
export type InfoMathsPart = { result: MathsResult; root: HTMLElement | null; offset: number };
const shift = (diagnostics: readonly MathsDiagnostic[], offset: number) =>
  diagnostics.map(issue => issue.source ? { ...issue, source: { start: issue.source.start + offset, end: issue.source.end + offset } } : issue);

export function combineInfoMathsMeasurement(parts: readonly InfoMathsPart[], layoutDiagnostics: readonly MathsDiagnostic[], face: HTMLElement, body: HTMLElement): InfoMathsMeasurement {
  const diagnostics = [...layoutDiagnostics, ...parts.flatMap(part => shift(part.result.diagnostics, part.offset))];
  const generation = parts.reduce((sum, part) => sum + part.result.generation, 0);
  const statusOf = (status: MathsResult["status"]) => parts.find(part => part.result.status === status)?.result;
  if (layoutDiagnostics.some(issue => issue.severity === "error") || statusOf("invalid-input")) return { result: { status: "invalid-input", generation, diagnostics }, safe: false, headerFits: false };
  if (statusOf("pending")) return { result: { status: "pending", generation, diagnostics }, safe: false, headerFits: false };
  const unavailable = statusOf("measurement-unavailable");
  if (unavailable?.status === "measurement-unavailable") return { result: { status: "measurement-unavailable", reason: unavailable.reason, generation, diagnostics }, safe: false, headerFits: false };
  const ready = parts.flatMap(part => part.result.status === "ready" && part.root ? [{ layout: part.result.layout, root: part.root }] : []);
  if (!ready.length || ready.length !== parts.length) return { result: { status: "pending", generation, diagnostics }, safe: false, headerFits: false };
  const origin = body.getBoundingClientRect(), width = ready[0].layout.available.width, scale = origin.width / width;
  const height = parseFloat(getComputedStyle(body).height);
  const bounds = ready.reduce((union, { layout, root }) => {
    const box = root.getBoundingClientRect(), dx = (box.left - origin.left) / scale, dy = (box.top - origin.top) / scale;
    return { left: Math.min(union.left, layout.bounds.left + dx), top: Math.min(union.top, layout.bounds.top + dy),
      right: Math.max(union.right, layout.bounds.right + dx), bottom: Math.max(union.bottom, layout.bounds.bottom + dy) };
  }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const excess = { left: Math.max(0, -bounds.left), top: Math.max(0, -bounds.top), right: Math.max(0, bounds.right - width), bottom: Math.max(0, bounds.bottom - height) };
  const epsilon = 0.01, overflowX = excess.left > epsilon || excess.right > epsilon, overflowY = excess.top > epsilon || excess.bottom > epsilon;
  const result: MathsResult = { status: "ready", fits: !overflowX && !overflowY, generation, diagnostics,
    layout: { available: { width, height }, bounds, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top, overflowX, overflowY, excess } };
  return infoMathsMeasurement(result, face, body);
}
