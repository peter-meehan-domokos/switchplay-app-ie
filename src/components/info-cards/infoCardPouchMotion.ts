import type { AnimationSequence } from "motion/react";

// The single definition of how an Info Card surface leaves and returns to the pouch. The physical stack and
// the empty-pouch panel both use it, so the two openings cannot drift apart.
export const POUCH_ANGLE_DEGREES = 12;

type Offset = { x: number; y: number };

// Place the surface's top-right corner just behind the real pocket's upper endpoint. The existing rounded
// Step View clip and foreground pouch mask the surface while it is hidden.
export function hiddenPouchOffset(surface: HTMLElement, pouch: HTMLElement): Offset {
  const parent = surface.parentElement!;
  const parentRect = parent.getBoundingClientRect(), pouchRect = pouch.getBoundingClientRect();
  const scale = parentRect.width / parent.clientWidth;
  const angle = POUCH_ANGLE_DEGREES * Math.PI / 180;
  const width = surface.offsetWidth, height = surface.offsetHeight;
  return {
    x: (pouchRect.left - parentRect.left) / scale - surface.offsetLeft - width * Math.cos(angle) - height * Math.sin(angle) - 2,
    y: (pouchRect.top - parentRect.top) / scale - surface.offsetTop - height - width * Math.sin(angle) + height * Math.cos(angle) + 2,
  };
}

// The first opening: a two-stage translation into place with rotation aligned over the whole journey.
export function pouchOpeningStep(surface: Element, reduced: boolean, firstOpening: boolean): AnimationSequence[number] {
  return [surface, firstOpening && !reduced
    ? { x: [null, -4, 0], y: [null, 3, 0], rotate: [null, 0], opacity: [1, 1, 1] }
    : { x: 0, y: 0, rotate: 0, opacity: 1 },
  firstOpening && !reduced ? { duration: 0.48, times: [0, 0.65, 1], ease: "easeInOut", rotate: { times: [0, 1] } }
    : { duration: reduced ? 0.08 : 0.48, ease: "easeInOut" }] as AnimationSequence[number];
}

export function pouchClosingStep(surface: Element, hidden: Offset, reduced: boolean): AnimationSequence[number] {
  return [surface, reduced ? { opacity: 0 } : { x: hidden.x, y: hidden.y, rotate: POUCH_ANGLE_DEGREES },
    { duration: reduced ? 0.08 : 0.3, ease: "easeInOut" }] as AnimationSequence[number];
}
