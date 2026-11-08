import { expect, test, type Page } from "@playwright/test";
const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null");
const media = JSON.parse(process.env.PHASE7_MEDIA_REVIEW ?? "null");
test.skip(!group || !media, "Requires disposable --group-media fixture");
async function login(page: Page) { expect((await page.request.post("/api/auth/login", { data: { identifier: "Aoife Kelly", password: "local-test-only" } })).ok()).toBeTruthy();
  // Test-only HTTP transport for the signed production session cookie.
  if (process.env.PHASE2_OPTIMIZED === "1") await page.context().addCookies((await page.context().cookies()).map(cookie => ({ ...cookie, secure: false })));
}
const note = (page: Page) => page.locator(".focused-card-surface--back .reflection-area p");
async function seedNote(page: Page, personal: boolean, text: string) {
  const query = new URLSearchParams({ cardTemplateId: media.cardId, ...(personal ? {} : { experienceId: group.experienceId, mode: "own", accessEpoch: "0" }) });
  const feed = await (await page.request.get(`/api/reflections?${query}`)).json();
  const item = feed.items.find((item: { entry: { source: { kind: string; experienceId?: string } } }) => personal ? item.entry.source.kind === "personal" : item.entry.source.kind === "group" && item.entry.source.experienceId === group.experienceId);
  expect((await page.request.post("/api/reflections", { data: { action: "save", source: item.entry.source, text, expectedRevision: item.entry.revision,
    operationId: crypto.randomUUID(), ...(personal ? { deckTemplateId: group.deckId } : { accessEpoch: 0 }) } })).ok()).toBeTruthy();
}
async function flip(page: Page) {
  // Honour the established focus/flip gesture lock; metadata readiness does
  // not shorten the existing animation.
  await page.waitForTimeout(700);
  const box = (await page.locator(".focused-card-surface--front .card-title-anchor").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
  await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
}
for (const browserName of ["chromium", "webkit"] as const) test.describe(browserName, () => {
  for (const personal of [false, true]) test(`${personal ? "Personal" : "Group Me"} keeps notes and previews through remount and offline resume`, async ({ playwright }) => {
    const browser = await playwright[browserName].launch();
    const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    let releaseAll = () => {};
    try {
    await login(page); const text = `Retained ${personal ? "Personal" : "Group"} ${browserName}`; await seedNote(page, personal, text);
    const query = new URLSearchParams({ [personal ? "openDeck" : "openExperience"]: personal ? group.deckId : group.experienceId, openCard: media.cardId,
      ...(personal ? {} : { progressScene: "1", progressFocused: "1", progressFace: "back", progressPerspective: "self" }) });
    await page.goto(`/decks?${query}`);
    if (personal) { await page.locator(".deck-card.is-active").press("Enter"); await flip(page); }
    await expect(note(page)).toHaveText(text);
    await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(5);
    // Requests fail while the same client session remains alive; no real data
    // or membership changes. A remounted view must use its retained resource.
    await page.route("**/api/reflections?*", route => route.abort("failed"));
    await page.route("**/api/media/history?*", route => route.abort("failed"));
    await page.getByRole("button", { name: "Close focused card", exact: true }).click({ position: { x: 10, y: 12 } });
    await page.locator(".deck-card.is-active").press("Enter");
    await expect(page.locator(".focused-card-layer")).toBeVisible();
    // Focus keeps the current face; flip only if it returned to the front.
    if (!await page.locator(".focused-card-object").evaluate(n => n.classList.contains("is-flipped"))) await flip(page);
    await expect(note(page)).toHaveText(text);
    await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(5);
    await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("pageshow")); });
    await page.waitForTimeout(550);
    await expect(note(page)).toHaveText(text);
    await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(5);
    await page.getByRole("button", { name: "Close focused card", exact: true }).click({ position: { x: 10, y: 12 } });
    await page.getByRole("button", { name: personal ? "Back" : "Back to My Decks", exact: true }).click();
    const tile = page.locator(`[data-collection-item-id="${personal ? group.deckId : group.experienceId}"]`);
    await expect(tile).toBeVisible();
    let release = () => {};
    if (personal) {
      // Delay the existing protected open, keeping all animation clocks intact.
      const held = new Promise<void>(resolve => { release = resolve; releaseAll = resolve; });
      await page.route(`**/api/decks-data/${group.deckId}/preparation`, async route => { if (route.request().method() === "POST") await held; await route.continue(); });
    } else await page.route(`**/api/group-experiences/${group.experienceId}/preparation*`, route => route.abort("failed"));
    try {
      await tile.locator(".deck-tile-open-action").click();
      await expect(page.locator(".deck-card.is-active")).toBeVisible();
      await page.locator(".deck-card.is-active").press("Enter"); await flip(page);
      if (personal) {
        await expect(page.locator(".app-shell--deck")).toHaveAttribute("data-working-ready", "false");
        await expect(page.locator(".focused-card-surface--back .assessment-indicator")).toBeVisible();
        await expect(page.locator(".focused-card-surface--back .assessment-indicator")).toBeDisabled();
      }
      await expect(note(page)).toHaveText(text);
      await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(5);
    } finally { release(); }
    } finally { releaseAll(); await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); }
  });
});
