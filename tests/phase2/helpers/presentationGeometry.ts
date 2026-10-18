import type { Page } from "@playwright/test";
export async function geometry(page: Page, selectors: string[]) {
  await page.evaluate(() => document.fonts.ready);
  // Timer polls can sample the same unfinished Motion layout transform twice
  // between rendered frames, especially in a headed browser. Sample actual frames
  // and ancestor transforms as well as rectangles; a card's bounds alone cannot
  // tell us whether its flip or the containing shared-layout transition has ended.
  return page.evaluate((selectors) => new Promise<Record<string, number[]>>((resolve, reject) => {
    let previous = "", stableSince = 0, stableFrames = 0, frame = 0;
    let diagnostics: unknown;
    const timeout = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      reject(new Error(`Presentation did not settle: ${JSON.stringify(diagnostics)}`));
    }, 15_000);
    const sample = (timestamp: number) => {
      const ancestors = new Set<Element>();
      const rectangles: Record<string, number[]> = {};
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (!element) {
          clearTimeout(timeout);
          reject(new Error(`Missing geometry anchor: ${selector}`));
          return;
        }
        for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) ancestors.add(ancestor);
        const { x, y, width, height } = element.getBoundingClientRect();
        rectangles[selector] = [x, y, width, height].map((value) => Math.round(value * 10) / 10);
      }
      const transforms = Array.from(ancestors, (element) => {
        const style = getComputedStyle(element);
        return [style.transform, style.opacity];
      });
      const animating = Array.from(ancestors).some((element) => element.getAnimations().some((animation) =>
        (animation.playState === "running" || animation.pending) && animation.effect?.getTiming().iterations !== Infinity));
      const signature = JSON.stringify({ rectangles, transforms });
      if (!animating && signature === previous) stableFrames++;
      else { stableFrames = 0; stableSince = timestamp; }
      previous = signature;
      diagnostics = { rectangles, transforms, animating, stableFrames,
        viewport: [innerWidth, innerHeight], deviceScale: devicePixelRatio, visibility: document.visibilityState };
      if (stableFrames >= 8 && timestamp - stableSince >= 200) {
        clearTimeout(timeout);
        resolve(rectangles);
      } else frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
  }), selectors);
}

