import { expect, test, chromium, webkit, request, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const live = JSON.parse(process.env.PHASE5_LIVE_PROGRESS ?? "null") as {
  experienceId: string; frameworkId: string; followers: string[]; followerLogin: string;
} | null;
test.skip(!live, "Requires disposable --group-progress-live fixtures");
const itemId = "review-item-1-1";
const history = (page: Page) => page.getByRole("dialog", { name: "Assessment history", exact: true });
const itemRow = (page: Page) => page.locator(`tr[data-item-id="${itemId}"]`);
async function login(client: APIRequestContext, identifier = "phase2") {
  expect((await client.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).status()).toBe(200);
}
async function isolatedGroup(admin: APIRequestContext) {
  const selected = await (await admin.get(`/api/group-experiences/${live!.experienceId}`)).json();
  const response = await admin.post("/api/group-experiences", { data: {
    operationId: randomUUID(), name: "Galway U18", adminIds: [], followerIds: live!.followers.slice(0, 2), allowFollowerInspection: true,
    manifest: { deckTemplateId: selected.deckTemplateId, deckVersion: selected.deckVersion,
      cards: selected.cards.map((card: { cardTemplateId: string; version: number }) => ({ cardTemplateId: card.cardTemplateId, version: card.version })) },
  } });
  expect(response.status()).toBe(200);
  return (await response.json()).experienceId as string;
}
const progressUrl = (experienceId: string) => `/group-experiences/${experienceId}/progress?framework=${live!.frameworkId}`;

for (const engine of ["chromium", "webkit"] as const) {
  test(`lost Group assessment response reconciles one event and preserves personal storage: ${engine}`, async () => {
    const browser = await (engine === "chromium" ? chromium : webkit).launch();
    try {
      const page = await browser.newPage({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await login(page.request);
      const experienceId = await isolatedGroup(page.request);
      const listUrl = `/api/group-experiences/${experienceId}/items/${itemId}/tests`;
      const personalUrl = `/api/items-data/${itemId}/tests`;
      const personalBefore = await (await page.request.get(personalUrl)).json();
      const before = await (await page.request.get(listUrl)).json();
      const submitted: unknown[] = [];
      await page.route(`**${listUrl}`, async route => {
        if (route.request().method() !== "POST") return route.continue();
        submitted.push(route.request().postDataJSON());
        if (submitted.length !== 1) return route.continue();
        // Commit through the real API, then lose only its acknowledgement.
        const committed = await route.fetch(); expect(committed.status()).toBe(200);
        await route.abort("failed");
      });
      await page.goto(progressUrl(experienceId));
      await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue("group");
      await itemRow(page).locator(".progress-tests-trigger").click();
      await history(page).getByRole("button", { name: "Add test", exact: true }).click();
      await history(page).getByLabel("Date", { exact: true }).fill("2026-11-05");
      await history(page).getByLabel("Result", { exact: true }).selectOption({ label: "Pass" });
      await history(page).getByRole("button", { name: "Save test", exact: true }).click();
      await expect(history(page).getByRole("form", { name: "Add assessment", exact: true })).toHaveCount(0);
      await expect(history(page).locator("tbody tr").filter({ hasText: "5 Nov 2026" })).toHaveCount(1);
      expect(submitted).toHaveLength(2); expect(submitted[1]).toEqual(submitted[0]);
      const after = await (await page.request.get(listUrl)).json();
      expect(after.revision).toBe(before.revision + 1); expect(after.tests).toHaveLength(before.tests.length + 1);
      expect(await (await page.request.get(personalUrl)).json()).toEqual(personalBefore);
      await history(page).getByRole("button", { name: "Close", exact: true }).click();
    } finally { await browser.close(); }
  });

  test(`revocation closes foreign history and rejects a delayed pre-removal response: ${engine}`, async () => {
    const browser = await (engine === "chromium" ? chromium : webkit).launch();
    const admin = await request.newContext({ baseURL: process.env.PHASE2_BASE_URL });
    let release: (() => void) | undefined;
    try {
      await login(admin); const experienceId = await isolatedGroup(admin);
      const page = await browser.newPage({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await login(page.request, live!.followerLogin); await page.goto(progressUrl(experienceId));
      const picker = page.getByLabel("Progress perspective", { exact: true });
      await expect(picker).toHaveValue(live!.followers[0]); await picker.selectOption(live!.followers[1]);
      await itemRow(page).locator(".progress-tests-trigger").click();
      await expect(history(page).locator("tbody tr").first()).toBeVisible();
      await expect(history(page).getByRole("button", { name: "Add test", exact: true })).toBeDisabled();
      const historyUrl = `/api/group-experiences/${experienceId}/frameworks/${live!.frameworkId}/items/${itemId}/history?subjectUserId=${live!.followers[1]}`;
      let captured = false, held = false;
      const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route(`**${historyUrl}`, async route => {
        if (held) return route.continue(); held = true;
        const response = await route.fetch(); expect(response.status()).toBe(200); captured = true;
        await gate;
        // The original fetch can have been aborted when authority changed.
        try { await route.fulfill({ response }); }
        catch (error) { if (!route.request().failure()) throw error; }
      });
      // Complete histories refresh through the existing four-second poll; the
      // Refresh history button is reserved for errors/incomplete history.
      await expect.poll(() => captured).toBe(true);
      const remove = async (userId: string, expectedStructureRevision: number) => {
        const response = await admin.post(`/api/group-experiences/${experienceId}/members`, { data: {
          operationId: randomUUID(), expectedStructureRevision, targetUserId: userId, kind: "remove-follower",
        } });
        expect(response.status()).toBe(200);
      };
      await remove(live!.followers[1], 0);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(history(page)).toHaveCount(0); await expect(picker).toHaveValue(live!.followers[0]);
      await expect(picker.locator(`option[value="${live!.followers[1]}"]`)).toHaveCount(0);
      release!();
      expect((await page.request.get(historyUrl)).status()).toBe(403);
      await expect(history(page)).toHaveCount(0);
      // Removing the viewer then revokes the whole Group, not their personal history.
      await itemRow(page).locator(".progress-tests-trigger").click(); await expect(history(page).locator("tbody tr").first()).toBeVisible();
      await remove(live!.followers[0], 1);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page).toHaveURL(/\/decks$/); await expect(history(page)).toHaveCount(0);
      expect((await page.request.get(`/api/group-experiences/${experienceId}/progress-navigation`)).status()).toBe(403);
      await page.goto(`/progress?framework=${live!.frameworkId}`);
      await expect(page.getByRole("heading", { name: "My Progress", exact: true })).toBeVisible();
      await itemRow(page).locator(".progress-tests-trigger").click(); await expect(history(page).locator("tbody tr").first()).toBeVisible();
    } finally { release?.(); await admin.dispose(); await browser.close(); }
  });
}
