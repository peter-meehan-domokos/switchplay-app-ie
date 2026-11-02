import { expect, test, chromium, webkit, type Page } from "@playwright/test";
import { groupDeckHref } from "../../src/lib/frameworks/progressNavigation";
const live = JSON.parse(process.env.PHASE5_LIVE_PROGRESS ?? "null") as { experienceId: string; frameworkId: string; personalDeckId: string; skippedCardId: string; cardIds: string[]; followers: string[]; followerLogin: string } | null;
test.skip(!live, "Requires the disposable --group-progress-live catalogue");
const url = () => `/group-experiences/${live!.experienceId}/progress?framework=${live!.frameworkId}`;
const row = (page: Page, id = "review-item-1-1") => page.locator(`tr[data-item-id="${id}"]`);
const dialog = (page: Page) => page.getByRole("dialog", { name: "Assessment history", exact: true });
async function login(page: Page, user = "phase2") { expect((await page.request.post("/api/auth/login", { data: { identifier: user === "other" ? live!.followerLogin : user, password: "local-test-only" } })).status()).toBe(200); }
async function form(page: Page, date: string, result: "Pass" | "Fail") { await dialog(page).getByLabel("Date", { exact: true }).fill(date); await dialog(page).getByLabel("Result", { exact: true }).selectOption({ label: result }); }
for (const engine of ["chromium", "webkit"] as const) for (const width of [390, 1280]) test(`actual Group table, modes, touch comparisons and sticky controls: ${engine} ${width}`, async () => {
  const browser = await (engine === "webkit" ? webkit : chromium).launch();
  try {
    const page = await browser.newPage({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width, height: 844 }, isMobile: width === 390, hasTouch: true });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await login(page); await page.goto(url()); await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue("group");
    await expect(row(page).locator(".assessment-pass, .assessment-fail")).toHaveCount(3);
    const before = await row(page).locator("td").evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().width));
    const beforeRows = await page.locator(".progress-table tr").evaluateAll(rows => rows.map(row => ({ top: row.getBoundingClientRect().top, height: row.getBoundingClientRect().height })));
    await row(page).getByRole("button", { name: /^Completion comparison\./ }).tap();
    const completion = page.getByRole("dialog", { name: "Completion comparison", exact: true }); await expect(completion).toContainText(/\d+ doing, \d+ done/);
    expect(await completion.textContent()).not.toMatch(/total|followers/i);
    const bounds = await completion.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(7); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 7);
    await page.getByRole("heading", { name: "Progress", exact: true }).tap(); await expect(completion).toHaveCount(0);
    await row(page).getByRole("button", { name: /^Confidence comparison\./ }).tap();
    await expect(page.getByRole("dialog", { name: "Confidence comparison", exact: true })).toContainText("Lowest:"); await page.keyboard.press("Escape");
    await expect(page.locator(".progress-comparison")).toHaveCount(0);
    await page.getByRole("button", { name: "Player averages", exact: true }).tap();
    await expect(row(page).locator(".assessment-pass, .assessment-fail")).toHaveCount(3);
    await row(page).getByRole("button", { name: /^Confidence comparison\./ }).tap(); await expect(page.locator(".progress-comparison")).toContainText("Group confidence:");
    await page.getByLabel("Progress perspective", { exact: true }).selectOption(live!.followers[0]);
    await expect(page.locator(".progress-comparison")).toHaveCount(0); await expect(page.getByRole("group", { name: "Group metric display", exact: true })).toHaveCount(0);
    await expect(row(page).getByRole("button", { name: /comparison/ })).toHaveCount(0);
    const after = await row(page).locator("td").evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().width));
    expect(after.map((value, index) => Math.abs(value - before[index]))).toEqual([0, 0, 0]);
    const afterRows = await page.locator(".progress-table tr").evaluateAll(rows => rows.map(row => ({ top: row.getBoundingClientRect().top, height: row.getBoundingClientRect().height })));
    expect(afterRows).toEqual(beforeRows);
    await expect(row(page, "review-item-3-1").locator("td").first()).toHaveText("skip");
    const outside = row(page, "review-outside-item"); await expect(outside.locator("td")).toHaveText(["—", "—", "—"]);
    expect(await outside.locator(".progress-content-title").evaluate(element => getComputedStyle(element).textDecorationLine)).toBe("line-through");
    await row(page).locator(".progress-tests-trigger").click();
    const longOrigin = dialog(page).locator(".assessment-origin").filter({ hasText: "Connacht U18 Regional Basketball Development Squad" }).first();
    await expect(longOrigin).toBeVisible();
    expect(await longOrigin.evaluate(element => { const style = getComputedStyle(element); return style.textOverflow === "ellipsis" && element.scrollWidth > element.clientWidth; })).toBe(true);
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 700));
    const controls = await page.locator(".group-progress-controls").boundingBox(); expect(controls!.y).toBeGreaterThanOrEqual(-1); expect(controls!.y).toBeLessThan(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `phase2-test-results/progress-live-${engine}-${width}.png`, fullPage: true });
  } finally { await browser.close(); }
});

test("Group editor uses the real Group Item API on HTTP, preserves history and never writes personal assessments", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true }); });
  await login(page); await page.goto(url()); await expect(page.getByLabel("Progress perspective", { exact: true })).toBeEnabled();
  const listUrl = `/api/group-experiences/${live!.experienceId}/items/review-item-1-1/tests`;
  const before = await (await page.request.get(listUrl)).json();
  await row(page).locator(".progress-tests-trigger").click(); await expect(dialog(page).getByRole("button", { name: "Add test", exact: true })).toBeEnabled();
  await expect(dialog(page).getByText("Unknown", { exact: true })).not.toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await form(page, "2026-11-02", "Pass"); await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
  await expect(dialog(page).getByRole("form", { name: "Add assessment", exact: true })).toHaveCount(0);
  await expect(dialog(page).locator("tbody tr").filter({ hasText: "2 Nov 2026" }).locator(".assessment-origin")).toHaveText("Galway U18");
  const after = await (await page.request.get(listUrl)).json(); expect(after.revision).toBe(before.revision + 1); expect(after.tests.length).toBe(before.tests.length + 1);
  const saved = after.tests.find((value: { date: string }) => value.date === "2026-11-02");
  const target = dialog(page).locator("tbody tr").filter({ hasText: "2 Nov 2026" }); await target.getByRole("button", { name: /^Edit test/ }).click(); await form(page, "2026-11-03", "Fail"); await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
  await expect(dialog(page).locator("tbody tr").filter({ hasText: "3 Nov 2026" })).toBeVisible();
  const edited = (await (await page.request.get(listUrl)).json()).tests.find((value: { id: string }) => value.id === saved.id); expect(edited.createdAt).toBe(saved.createdAt); expect(edited.result).toBe(false);
  await dialog(page).locator("tbody tr").filter({ hasText: "3 Nov 2026" }).getByRole("button", { name: /^Delete test/ }).click();
  await dialog(page).getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(dialog(page).locator("tbody tr").filter({ hasText: "3 Nov 2026" })).toHaveCount(0);
  const removed = await (await page.request.get(listUrl)).json(); expect(removed.tests.some((value: { id: string }) => value.id === saved.id)).toBe(false);
  expect(removed.revision).toBe(before.revision + 3);
  await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
});

test("self personal Item entry is shared with My Progress while foreign history remains read-only and redacted", async ({ page }) => {
  await login(page, "other"); await page.goto(url()); await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue(live!.followers[0]);
  await row(page).locator(".progress-tests-trigger").click(); await expect(dialog(page).getByRole("button", { name: "Add test", exact: true })).toBeEnabled();
  await expect(dialog(page).getByText("Other group", { exact: true })).not.toHaveCount(0);
  await expect(dialog(page).getByText("Personal", { exact: true })).not.toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await form(page, "2026-11-04", "Pass"); await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
  await expect(dialog(page).locator("tbody tr").filter({ hasText: "4 Nov 2026" })).toBeVisible(); await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
  await page.goto(`/progress?framework=${live!.frameworkId}`); await expect(page.getByRole("heading", { name: "My Progress", exact: true })).toBeVisible();
  await row(page).locator(".progress-tests-trigger").click(); await expect(dialog(page).locator("tbody tr").filter({ hasText: "4 Nov 2026" })).toBeVisible(); await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
  await page.goto(url()); await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue(live!.followers[0]);
  await page.getByLabel("Progress perspective", { exact: true }).selectOption(live!.followers[1]); await row(page).locator(".progress-tests-trigger").click();
  await expect(dialog(page).getByRole("button", { name: "Add test", exact: true })).toBeDisabled();
  for (const button of await dialog(page).getByRole("button", { name: /^(Edit|Delete) test/ }).all()) await expect(button).toBeDisabled();
  await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Progress perspective", { exact: true }).selectOption("group");
  await row(page).getByRole("button", { name: /^Confidence comparison\./ }).click();
  await expect(page.locator(".progress-comparison")).not.toContainText("Lowest:"); await expect(page.locator(".progress-comparison")).not.toContainText("Highest:");
});

test("personal all-skipped Framework, Card and Deck use explicit states without changing geometry", async ({ page }) => {
  await login(page); await page.goto(`/progress?framework=${live!.frameworkId}`);
  await expect(row(page).locator("td").first()).toHaveText("skip");
  await page.goto(`/decks?openDeck=${live!.personalDeckId}`);
  await expect(page.locator(".completion-strip--skipped").first()).toBeVisible();
  await expect(page.locator(".detail-progress")).toBeHidden();
  const strip = page.locator(".deck-card.is-active .completion-strip").first(); const height = await strip.evaluate(element => getComputedStyle(element).height); expect(height).toBe("2.25px");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  const tile = page.locator(`[data-collection-item-id="${live!.personalDeckId}"]`);
  await expect(tile.locator(".deck-tile-meta .personal-layout-slot")).toBeHidden();
  await expect(tile.locator(".deck-tile-meta-confidence")).toHaveText("6");
});

test("Group-owned and self Card indicators paint explicit skip on both ordinary and focused surfaces", async ({ page }) => {
  for (const user of ["phase2", "other"]) {
    await login(page, user);
    for (const focused of [false, true]) {
      await page.goto(groupDeckHref({ experienceId: live!.experienceId, cardId: live!.cardIds[9], rotation: 0, focused,
        selection: { perspective: user === "phase2" ? "group" : "self" } }));
      const surface = page.locator(focused ? ".focused-card-content .active-card-front" : ".deck-card.is-active .active-card-front");
      await expect(surface.locator(".completion-strip--skipped")).toBeVisible();
      await expect(surface.locator(".completion-strip")).toHaveAttribute("aria-label", "All Steps skipped");
      expect(await surface.locator(".completion-strip").evaluate(element => getComputedStyle(element).height)).toBe("2.25px");
    }
  }
});
