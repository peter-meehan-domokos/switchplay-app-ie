import type { MathsConstraints, MathsLayout } from "./types";

export class MeasurementError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

// Only positive axis-aligned transforms are supported. Relative rectangles are
// converted back to local CSS pixels; translations disappear on subtraction.
function scaleOf(element: HTMLElement) {
  let x = 1, y = 1;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const movingTransform = node.getAnimations().some(animation => {
      if (animation.playState !== "running" || !(animation.effect instanceof KeyframeEffect)) return false;
      return animation.effect.getKeyframes().some(frame => ["transform", "scale", "rotate", "translate", "perspective"].some(property => property in frame));
    });
    if (movingTransform) throw new MeasurementError("ANIMATED_TRANSFORM", "Wait for the ancestor transform animation to finish before measuring.");
    if (style.visibility !== "visible" || style.contentVisibility === "hidden") throw new MeasurementError("HIDDEN_CONTENT", "Content or an ancestor is hidden.");
    if (style.perspective !== "none") throw new MeasurementError("UNSUPPORTED_TRANSFORM", "Perspective cannot be measured reliably.");
    const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
    if (!matrix.is2D || Math.abs(matrix.b) > 1e-8 || Math.abs(matrix.c) > 1e-8 || matrix.a <= 0 || matrix.d <= 0 || (style.rotate !== "none" && !/^0(?:deg|rad|turn)?$/.test(style.rotate))) {
      throw new MeasurementError("UNSUPPORTED_TRANSFORM", "Rotation, skew, perspective and nonpositive scales are unsupported.");
    }
    const individual = style.scale === "none" ? [1, 1] : style.scale.split(/\s+/).map(Number);
    const zoom = style.zoom === "normal" ? 1 : Number(style.zoom || 1);
    if (individual.some(n => !Number.isFinite(n) || n <= 0) || !Number.isFinite(zoom) || zoom <= 0 || individual.length > 2) throw new MeasurementError("UNSUPPORTED_TRANSFORM", "The scale is not a positive two-dimensional scale.");
    x *= matrix.a * individual[0] * zoom;
    y *= matrix.d * (individual[1] ?? individual[0]) * zoom;
  }
  return { x, y };
}

export function resolveConstraints(root: HTMLElement, constraints: MathsConstraints) {
  if (!root.isConnected || !root.getClientRects().length) throw new MeasurementError("HIDDEN_CONTENT", "The content has no measurable layout box.");
  const scale = scaleOf(root);
  if (constraints.kind === "explicit") {
    if (!Number.isFinite(constraints.widthPx) || constraints.widthPx <= 0 || (constraints.heightPx !== null && (!Number.isFinite(constraints.heightPx) || constraints.heightPx < 0))) {
      throw new MeasurementError("INVALID_CONSTRAINTS", "Width must be positive and height nonnegative or explicitly unbounded.");
    }
    return { width: constraints.widthPx, height: constraints.heightPx, scale };
  }
  const host = constraints.elementRef.current;
  if (!host || host === root || !host.contains(root) || !host.isConnected || !host.getClientRects().length) throw new MeasurementError("UNRESOLVED_CONTAINER", "Supply a visible dedicated containing element.");
  scaleOf(host);
  const style = getComputedStyle(host);
  // Computed used dimensions retain fractional CSS pixels and exclude transforms.
  const horizontal = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  const vertical = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  const width = parseFloat(style.width) - (style.boxSizing === "border-box" ? horizontal : 0);
  const height = constraints.height === "unbounded" ? null : parseFloat(style.height) - (style.boxSizing === "border-box" ? vertical : 0);
  if (!Number.isFinite(width) || width <= 0 || (height !== null && (!Number.isFinite(height) || height < 0))) throw new MeasurementError("UNRESOLVED_CONTAINER", "The host content-box dimensions are unresolved.");
  return { width, height, scale };
}

export function measureLayout(root: HTMLElement, constraints: MathsConstraints): MathsLayout {
  const available = resolveConstraints(root, constraints);
  const origin = root.getBoundingClientRect();
  if (Math.abs(origin.width / available.scale.x - available.width) > 0.05) throw new MeasurementError("CONSTRAINT_MISMATCH", "The content wrapping width differs from the supplied content-box width.");
  let left = 0, top = 0, right = 0, bottom = origin.height / available.scale.y;
  function include(rect: DOMRect, element: Element) {
    if (!rect.width && !rect.height) return;
    let l = rect.left, r = rect.right, t = rect.top, b = rect.bottom;
    // KaTeX clips deliberately oversized radical SVGs inside .hide-tail. Count
    // the visible portion, never the 400em SVG's unpainted construction canvas.
    for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX === "hidden" || style.overflowX === "clip") { const box = node.getBoundingClientRect(); l = Math.max(l, box.left); r = Math.min(r, box.right); }
      if (style.overflowY === "hidden" || style.overflowY === "clip") { const box = node.getBoundingClientRect(); t = Math.max(t, box.top); b = Math.min(b, box.bottom); }
    }
    if (r < l || b < t) return;
    left = Math.min(left, (l - origin.left) / available.scale.x);
    right = Math.max(right, (r - origin.left) / available.scale.x);
    top = Math.min(top, (t - origin.top) / available.scale.y);
    bottom = Math.max(bottom, (b - origin.top) / available.scale.y);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    const parent = text.parentElement;
    if (!parent || !text.textContent || parent.closest(".katex-mathml, .pstrut, .vlist-s")) continue;
    const range = document.createRange(); range.selectNodeContents(text);
    for (const rect of range.getClientRects()) include(rect, parent);
  }
  for (const element of root.querySelectorAll<HTMLElement>("[data-maths-expression='inline']")) include(element.getBoundingClientRect(), element);
  for (const element of root.querySelectorAll<HTMLElement>(".katex-html *")) {
    if (element.closest(".pstrut, .vlist-s") || element.classList.contains("katex-strut") || element.classList.contains("katex-newline")) continue;
    // Bases carry intentional strut/phantom space. Empty leaves include rules,
    // accents and SVGs; nonvisual positioning stacks must not enlarge bounds.
    if (element.classList.contains("katex-base") || !element.childNodes.length || element.tagName.toLowerCase() === "svg") include(element.getBoundingClientRect(), element);
  }
  if (![left, right, top, bottom].every(Number.isFinite)) throw new MeasurementError("INVALID_GEOMETRY", "The browser returned nonfinite geometry.");
  const excess = { left: Math.max(0, -left), top: Math.max(0, -top), right: Math.max(0, right - available.width), bottom: available.height === null ? 0 : Math.max(0, bottom - available.height) };
  // Subpixel arithmetic only, not a visual fit allowance. Browser assertions
  // use a separate 0.5px tolerance when comparing independent geometry reads.
  const epsilon = 0.01;
  return { available: { width: available.width, height: available.height }, bounds: { left, top, right, bottom }, width: right - left, height: bottom - top,
    overflowX: excess.left > epsilon || excess.right > epsilon, overflowY: excess.top > epsilon || excess.bottom > epsilon, excess };
}
