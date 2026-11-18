/**
 * Read-only checks of what the existing application is currently presenting. Nothing here changes,
 * listens to or focuses learning elements; it only looks, so onboarding can stay out of the way.
 */
export const ELIGIBLE_ROUTES: readonly string[] = ["/decks", "/library"];
/** Exactly these routes: not Creator, Progress, detail routes, Step Visuals or public pages. */
export const isEligibleRoute = (pathname: string | null | undefined) => !!pathname && ELIGIBLE_ROUTES.includes(pathname);

export const INTRO_HOST_SELECTORS = [".deck-grid-intro-host", ".deck-intro-viewer-host"] as const;
const EXPANDED = [".deck-grid-intro-host--expanded", ".deck-intro-viewer-host--expanded"] as const;
// Explicit coupling to the existing app's overlays, covered by browser regression tests.
const BLOCKING = ['[role="dialog"][aria-modal="true"]:not([data-onboarding])', ...EXPANDED] as const;

type Probe = Pick<Document, "querySelector"> & { fullscreenElement?: Element | null };
/** Fullscreen media, a modal dialog (native or not) or an expanded Deck introduction owns the interaction. */
export function isPresentationBlocked(doc: Probe): boolean {
  if (doc.fullscreenElement) return true;
  try { if (doc.querySelector("dialog:modal")) return true; } catch { /* :modal unsupported; the rendered-dialog checks below still apply */ }
  return BLOCKING.some(selector => !!doc.querySelector(selector));
}
/** Class-attribute observers on the two intro hosts only (when present), never the learning subtree generally. */
export function observeIntroHosts(doc: Pick<Document, "querySelector">, onChange: () => void): () => void {
  const observers = INTRO_HOST_SELECTORS.flatMap(selector => {
    const element = doc.querySelector(selector);
    if (!element) return [];
    const observer = new MutationObserver(onChange);
    observer.observe(element, { attributes: true, attributeFilter: ["class"] });
    return [observer];
  });
  return () => observers.forEach(observer => observer.disconnect());
}
