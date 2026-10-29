type Rectangle = Readonly<{ x: number; y: number; width: number; height: number }>;

/** Plain viewport geometry; the web adapter supplies measurements. */
export function tooltipLayout(anchor: Rectangle, popup: Readonly<{ width: number; height: number }>, viewport: Rectangle) {
  const margin = 8, gap = 8;
  const maxWidth = Math.max(1, viewport.width - 2 * margin);
  const maxHeight = Math.max(1, viewport.height - 2 * margin);
  const width = Math.min(popup.width, maxWidth), height = Math.min(popup.height, maxHeight);
  const above = anchor.y - viewport.y - margin - gap;
  const below = viewport.y + viewport.height - margin - anchor.y - anchor.height - gap;
  const side = above >= height || (below < height && above > below) ? "above" : "below";
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value));
  return Object.freeze({
    left: clamp(anchor.x + anchor.width / 2 - width / 2, viewport.x + margin, viewport.x + viewport.width - margin - width),
    top: clamp(side === "above" ? anchor.y - gap - height : anchor.y + anchor.height + gap, viewport.y + margin, viewport.y + viewport.height - margin - height),
    maxWidth, maxHeight, side,
  });
}
