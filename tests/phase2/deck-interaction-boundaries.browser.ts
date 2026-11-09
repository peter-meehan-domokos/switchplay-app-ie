import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { PerspectiveSelection } from "../../src/lib/groupExperiences/model";

const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null");
const media = JSON.parse(process.env.PHASE7_MEDIA_REVIEW ?? "null");
test.skip(!group || !media, "Requires disposable --group-media --complete-loading fixtures");

const roles = ["Admin Group", "Follower Me", "Follower Group", "Personal"] as const;
const active = (page: Page) => page.locator(".deck-card.is-active");
const back = (page: Page) => active(page).locator(".deck-card-surface--back");
const focusedBack = (page: Page) => page.locator(".focused-card-surface--back");

type Target = Locator | { element: Locator; x: number; y: number };
async function point(target: Target) {
  const custom = "element" in target, box = (await (custom ? target.element : target).boundingBox())!;
  return { x: box.x + box.width * (custom ? target.x : .5), y: box.y + box.height * (custom ? target.y : .5) };
}
async function touch(page: Page, target: Target) {
  const p = await point(target); await page.touchscreen.tap(p.x, p.y);
}
async function swipe(page: Page, context: BrowserContext, engine: string, target: Target, dx: number, dy: number) {
  const { x, y } = await point(target);
  if (engine === "chromium") {
    // Native touch input exercises pointer capture/cancellation on mobile Chrome.
    const cdp = await context.newCDPSession(page);
    try {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 12; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12 }] });
        await page.waitForTimeout(15);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally { await cdp.detach(); }
  } else {
    // Playwright WebKit exposes native taps but not a native touch-drag API.
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
  }
}
async function closeFocus(page: Page) {
  await page.getByRole("button", { name: "Close focused card", exact: true }).click({ position: { x: 10, y: 12 } });
  await expect(page.locator(".focused-card-layer")).toHaveCount(0);
  await page.waitForTimeout(700); // Existing focus/layout transition, unchanged.
}

for (const engine of ["chromium", "webkit"] as const) for (const role of roles) {
  test(`${engine}: ${role} keeps Deck navigation outside focused content controls`, async ({ playwright }) => {
    const browser = await playwright[engine].launch();
    const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    let originalNavigation: { selection: PerspectiveSelection; activeCardId: string | null } | undefined;
    try {
      expect((await page.request.post("/api/auth/login", { data: { identifier: role === "Admin Group" ? "phase2" : "Aoife Kelly", password: "local-test-only" } })).ok()).toBeTruthy();
      if (process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
      const personal = role === "Personal";
      if (!personal) originalNavigation = await (await page.request.get(`/api/group-experiences/${group.experienceId}`)).json();
      const query = new URLSearchParams({ [personal ? "openDeck" : "openExperience"]: personal ? group.deckId : group.experienceId, openCard: group.cardIds[0],
        ...(personal ? {} : { progressScene: "1", progressPerspective: role === "Follower Me" ? "self" : "group" }) });
      await page.goto(`/decks?${query}`);
      await expect(active(page)).toBeVisible();
      const frontTitle = () => active(page).locator(".deck-card-surface--front .card-title-anchor");
      await expect(frontTitle()).toContainText("Card 1");
      await page.waitForTimeout(700);
      for (const dy of [170, -170]) {
        await swipe(page, context, engine, frontTitle(), 0, dy);
        await expect(frontTitle()).toContainText(dy > 0 ? "Card 2" : "Card 1", { timeout: 2000 });
        await page.waitForTimeout(450);
      }
      // Enter focus, flip, then return with the back showing. Personal focus
      // keeps its own flip state, so use its existing Deck flip on return.
      await touch(page, frontTitle()); await expect(page.locator(".focused-card-object")).toBeVisible();
      await page.waitForTimeout(700);
      await swipe(page, context, engine, page.locator(".focused-card-surface--front .card-title-anchor"), 150, 0);
      await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/); await page.waitForTimeout(700);
      await closeFocus(page);
      if (await active(page).getAttribute("data-deck-flipped") !== "true") {
        await swipe(page, context, engine, frontTitle(), 150, 0);
        await expect(active(page)).toHaveAttribute("data-deck-flipped", "true"); await page.waitForTimeout(700);
      }
      await expect(back(page).locator(".back-card-media-carousel-item")).toHaveCount(5);
      await expect(back(page).locator("button.back-card-media-carousel-item")).toHaveCount(0);
      await expect(back(page).locator(".focused-card-signal-slot--read-only")).toHaveCount(0);
      await expect(back(page).locator(".reflection-editor-modal")).toHaveCount(0);
      const targets: (() => Target)[] = [
        () => back(page).locator(".focused-card-signal-track").first(),
        () => back(page).locator(".back-card-media-carousel-item").first(),
        () => back(page).locator(".reflection-area p, .focused-card-back-reflection-fragment").last(),
        () => ({ element: back(page).locator(".back-card-face-content"), x: .5, y: .96 }),
      ];
      if (await back(page).locator(".media-centre-control").count()) targets.push(() => back(page).locator(".media-centre-control"));
      const initialPreviews = await back(page).locator(".back-card-media-carousel-image").evaluateAll(nodes => nodes.map(node => node.getAttribute("src")));
      for (const getTarget of targets) {
        for (const dy of [170, -170]) {
          await swipe(page, context, engine, getTarget(), 0, dy);
          await expect(back(page).locator(".card-title-anchor")).toContainText(dy > 0 ? "Card 2" : "Card 1", { timeout: 2000 });
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await page.waitForTimeout(450);
        }
        await touch(page, getTarget());
        await expect(page.locator(".focused-card-object")).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await closeFocus(page);
      }
      expect(await back(page).locator(".back-card-media-carousel-image").evaluateAll(nodes => nodes.map(node => node.getAttribute("src")))).toEqual(initialPreviews);
      // Focused controls still work, including read-only Group inspection.
      await touch(page, back(page).locator(".card-title-anchor"));
      await expect(page.locator(".focused-card-object")).toBeVisible(); await page.waitForTimeout(700);
      await expect(focusedBack(page).locator("button.back-card-media-carousel-item")).toHaveCount(5);
      await touch(page, focusedBack(page).getByRole("button", { name: /^Open image/ }).first());
      const gallery = page.getByRole("dialog", { name: "Card media viewer", exact: true }); await expect(gallery).toBeVisible();
      await gallery.getByRole("button", { name: "Close media viewer", exact: true }).click(); await expect(gallery).toHaveCount(0);
      const note = focusedBack(page).locator(".reflection-area p");
      await touch(page, note);
      const editor = page.getByRole("dialog", { name: role === "Follower Group" ? "View reflection" : "Edit reflection", exact: true });
      await expect(editor).toBeVisible();
      if (role === "Follower Group") await expect(editor.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
      await editor.locator(".creator-modal-close").click();
      if (role === "Follower Group") {
        await expect(focusedBack(page).getByRole("button", { name: /Adjust .* reading/ })).toHaveCount(0);
        await swipe(page, context, engine, focusedBack(page).locator(".focused-card-signal-track").first(), 100, 0);
        await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
        await expect(focusedBack(page).getByRole("tooltip")).toContainText("Only a Group Admin");
      } else {
        await expect(focusedBack(page).getByRole("button", { name: /Adjust .* reading/ })).toHaveCount(3);
        await touch(page, focusedBack(page).getByRole("button", { name: "Media Centre", exact: true }));
        await expect(page.getByRole("dialog", { name: "Card media", exact: true })).toBeVisible();
      }
    } finally {
      try {
        await page.close();
        // These cases deliberately persist picker/Card navigation. Restore the
        // member preference so later tests do not inherit a different intent.
        if (originalNavigation) {
          const current = await (await context.request.get(`/api/group-experiences/${group.experienceId}`)).json();
          expect((await context.request.patch(`/api/group-experiences/${group.experienceId}/navigation`, { data: {
            accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision,
            selection: originalNavigation.selection,
            ...(originalNavigation.activeCardId ? { activeCardId: originalNavigation.activeCardId } : {}),
          } })).ok()).toBeTruthy();
        }
      } finally { await context.close(); await browser.close(); }
    }
  });
}
