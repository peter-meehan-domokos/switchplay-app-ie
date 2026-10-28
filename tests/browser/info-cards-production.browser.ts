import { expect, test, type Page, type Route } from "@playwright/test";

const dialog = (page: Page) => page.getByRole("dialog", { name: "Info card consultation", exact: true });
const stack = (page: Page) => page.locator("[data-info-card-stack]");
const titles = ["Signs", "Brackets", "Like terms", "Order", "Check"];
const ids = ["negative-signs", "brackets", "like-terms", "operation-order", "check-answer"];
function gate() { let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; }); return { wait, release }; }
async function response(route: Route, options: { unavailable?: number | "all"; title?: string } = {}) {
  const url = new URL(route.request().url());
  return route.fulfill({ headers: { "X-Personal-Viewer": "fixture-viewer-1" }, json: {
    mainCardId: url.pathname.split("/")[3], mainCardVersion: Number(url.searchParams.get("version")),
    entries: ids.map((infoCardId, index) => options.unavailable === "all" || index === options.unavailable ? { status: "unavailable" } : { status: "available", info: {
      infoCardId, version: 1, ownerUserId: "fixture-owner", creatorUsername: "peter", visibility: "public",
      content: { title: index === 0 && options.title ? options.title : titles[index], body: "Snapshot information.", seriesId: "series", mediaItem: null },
      series: { seriesId: "series", title: "Basics", createdByUserId: "fixture-owner", creatorUsername: "peter" },
    } }),
  } });
}
async function enter(page: Page, activity = false) {
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: { id: "fixture-viewer-1" } } }));
  await page.goto("/info-cards/integration?production");
  if (activity) await page.getByRole("combobox", { name: "Step content", exact: true }).selectOption("activity");
  await page.locator(".deck-card.is-active").click(); await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.locator(".step-view-layer")).toHaveCSS("transform", "none");
}
const pouch = (page: Page) => page.getByRole("button", { name: /^Open information cards/ });

test("production request keeps pouch closed and activity mounted, reveals loading only after one second, then opens existing physical stack", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const held = gate(), requested = gate();
  await page.route("**/api/card-templates/*/info-cards?*", async route => { requested.release(); await held.wait; await response(route); });
  await enter(page, true);
  const activity = page.locator("[data-test-activity]"); await page.getByLabel("Your answer").fill("Preserved");
  await page.getByRole("button", { name: "Attempts 0" }).click(); await activity.evaluate(el => { el.scrollTop = 90; });
  const before = await activity.evaluate(el => ({ mount: el.getAttribute("data-mount"), scroll: el.scrollTop }));
  await page.clock.install({ time: new Date("2026-10-24T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-24T12:00:01Z"));
  await pouch(page).click(); await requested.wait;
  await expect(dialog(page)).toBeVisible(); await expect(stack(page)).toHaveCount(0);
  const closePouch = dialog(page).getByRole("button", { name: /^Close information cards \(/ });
  await expect(closePouch).toHaveAttribute("aria-expanded", "false"); await expect(closePouch.locator("[data-info-card-pouch-icon]")).toHaveCount(1);
  await page.clock.runFor(999); await expect(page.getByText("Loading Info Cards…", { exact: true })).toHaveCount(0);
  await page.clock.runFor(2); const status = page.getByRole("status").filter({ hasText: /^Loading Info Cards…$/ }); await expect(status).toBeVisible();
  const bounds = await page.locator(".step-view-layer").boundingBox(), message = await status.boundingBox();
  expect(message!.y).toBeGreaterThanOrEqual(bounds!.y + bounds!.height);
  await page.screenshot({ path: test.info().outputPath("production-loading.png") });
  held.release(); await expect(stack(page)).toHaveCount(1); await page.clock.runFor(600);
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open"); await expect(status).toHaveCount(0);
  await page.getByRole("button", { name: "Close information card stack" }).click(); await page.clock.runFor(600);
  await expect(dialog(page)).toHaveCount(0); await expect(page.getByLabel("Your answer")).toHaveValue("Preserved");
  await expect(page.getByRole("button", { name: "Attempts 1" })).toBeVisible();
  expect(await activity.evaluate(el => ({ mount: el.getAttribute("data-mount"), scroll: el.scrollTop }))).toEqual(before);
});

test("fast snapshot has no loading flash, unavailable position keeps circular order/count, next opening gets a fresh snapshot", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/card-templates/*/info-cards?*", route => { calls++; return response(route, { unavailable: 1, title: calls > 1 ? "Fresh signs" : "Signs" }); });
  await enter(page, true);
  const messages: string[] = [];
  await page.exposeFunction("recordInfoLoading", (value: string) => messages.push(value));
  await page.evaluate(() => new MutationObserver(() => {
    if (document.body.textContent?.includes("Loading Info Cards…")) (window as unknown as { recordInfoLoading(v: string): void }).recordInfoLoading("loading");
  }).observe(document.body, { childList: true, subtree: true }));
  await pouch(page).click(); await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open");
  expect(messages).toEqual([]);
  await expect(stack(page).locator("[data-info-card-title]")).toHaveText("Signs");
  await page.keyboard.press("ArrowDown"); await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open");
  await expect(page.locator("[data-info-card-unavailable]")).toHaveText("This Info Card is unavailable.");
  await expect(dialog(page).locator("[data-info-card-pouch-count]")).toHaveText("2");
  await expect(dialog(page).getByRole("button", { name: "Close information cards (5 attached)", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown"); await expect(stack(page).locator('[data-info-card-current="true"] [data-info-card-title]')).toHaveText("Like terms");
  await page.getByRole("button", { name: "Close information card stack" }).click(); await expect(dialog(page)).toHaveCount(0);
  await pouch(page).click(); await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open");
  await expect(stack(page).locator("[data-info-card-title]")).toHaveText("Fresh signs"); expect(calls).toBe(2);
  await expect(dialog(page).locator("[data-info-card-pouch-count]")).toHaveText("1");
});

for (const action of ["pouch", "background", "Escape"] as const) test(`loading cancellation via ${action} ignores a late response and reopening starts fresh`, async ({ page }) => {
  const held = gate(), requested = gate(); let calls = 0;
  await page.route("**/api/card-templates/*/info-cards?*", async route => {
    calls++; if (calls === 1) { requested.release(); await held.wait; }
    await response(route, { title: calls > 1 ? "Fresh signs" : "Old signs" }).catch(() => {});
  });
  await enter(page, true); await pouch(page).click(); await requested.wait;
  if (action === "pouch") await dialog(page).getByRole("button", { name: /^Close information cards \(/ }).click();
  else if (action === "background") await dialog(page).getByRole("button", { name: "Close information cards and return to step", exact: true }).click({ position: { x: 12, y: 12 } });
  else await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0); await expect(pouch(page)).toBeFocused();
  held.release(); await expect(stack(page)).toHaveCount(0);
  await pouch(page).click(); await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open");
  await expect(stack(page).locator("[data-info-card-title]")).toHaveText("Fresh signs"); expect(calls).toBe(2);
});

test("whole-request error retains a closed pouch; closing/reopening retries without a new control", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/card-templates/*/info-cards?*", route => ++calls === 1 ? route.fulfill({ status: 503, json: { error: "Request failed" } }) : response(route));
  await enter(page); await pouch(page).click(); await expect(dialog(page).getByRole("alert")).toContainText("Unable to load Info Cards");
  await expect(stack(page)).toHaveCount(0); await expect(dialog(page).getByRole("button", { name: /Retry/ })).toHaveCount(0);
  await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0);
  await pouch(page).click(); await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open"); expect(calls).toBe(2);
});

test("video pauses as soon as loading starts and remains mounted/paused after cancellation", async ({ page }) => {
  const held = gate(); await page.route("**/api/card-templates/*/info-cards?*", async route => { await held.wait; await response(route).catch(() => {}); });
  await enter(page); const video = page.locator(".switchplay-video-host-layer video");
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(async (el: HTMLVideoElement) => { (window as unknown as { originalVideo: HTMLVideoElement }).originalVideo = el; el.currentTime = 1; await el.play(); });
  await pouch(page).click(); await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  const time = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
  await page.keyboard.press("Escape"); held.release(); await expect(dialog(page)).toHaveCount(0);
  expect(await video.evaluate((el: HTMLVideoElement) => el === (window as unknown as { originalVideo: HTMLVideoElement }).originalVideo)).toBe(true);
  expect(await video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeCloseTo(time, 1);
  expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
});

for (const width of [844, 932]) test(`loading status stays outside the main card in ${width}px landscape`, async ({ page }) => {
  await page.setViewportSize({ width, height: 390 }); const held = gate();
  await page.route("**/api/card-templates/*/info-cards?*", async route => { await held.wait; await response(route).catch(() => {}); });
  await enter(page, true); await pouch(page).click();
  const status = dialog(page).getByRole("status"); await expect(status).toHaveText("Loading Info Cards…");
  const main = (await page.locator(".step-view-layer").boundingBox())!, text = (await status.boundingBox())!;
  expect(text.width).toBeGreaterThan(0);
  expect(text.x + text.width <= main.x || text.y >= main.y + main.height).toBe(true);
  expect(text.x).toBeGreaterThanOrEqual(0); expect(text.x + text.width).toBeLessThanOrEqual(width);
  expect(text.y).toBeGreaterThanOrEqual(0); expect(text.y + text.height).toBeLessThanOrEqual(390);
  await page.screenshot({ path: test.info().outputPath("production-loading-landscape.png") });
  await page.keyboard.press("Escape"); held.release(); await expect(dialog(page)).toHaveCount(0);
});

test("all unavailable attachments still form a circular pack without protected metadata", async ({ page }) => {
  await page.route("**/api/card-templates/*/info-cards?*", route => response(route, { unavailable: "all" }));
  await enter(page); await pouch(page).click(); await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open");
  await expect(stack(page).locator("[data-info-card-unavailable]")).toHaveText("This Info Card is unavailable.");
  await expect(stack(page).locator("[data-info-card-title]")).toHaveCount(0);
  await expect(stack(page).getByRole("button", { name: /Series|View image|Watch video/ })).toHaveCount(0);
  await page.keyboard.press("ArrowUp"); await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open");
  await expect(dialog(page).locator("[data-info-card-pouch-count]")).toHaveText("5");
  await page.keyboard.press("ArrowDown"); await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open");
  await expect(dialog(page).locator("[data-info-card-pouch-count]")).toHaveText("1");
  await page.getByRole("button", { name: "Close information card stack" }).click(); await expect(dialog(page)).toHaveCount(0);
});
