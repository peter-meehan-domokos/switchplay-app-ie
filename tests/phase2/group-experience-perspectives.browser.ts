import { expect, test } from "@playwright/test";
const fixture = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null") as { experienceId: string; secondId: string; zeroId: string; emptyId: string; cardIds: string[] } | null;
test.skip(!fixture, "Requires the disposable --group-experiences fixture");
test("named seeded group entries preserve category and open one authorised physical scene", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  const current = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
  await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch,
    expectedStructureRevision: current.structureRevision, selection: { perspective: "group" }, activeCardId: fixture!.cardIds[0] } });
  await page.goto("/decks");
  const tile = page.locator(`[data-collection-item-id="${fixture!.experienceId}"]`);
  await expect(tile.locator(".deck-owner-tag")).toHaveText("Galway U18"); await expect(tile.locator(".category-chip")).toHaveText("basketball");
  await tile.locator(".deck-tile-open-action").click();
  await expect(page.locator(".group-experience .deck-detail")).toBeVisible();
  await expect(page.locator(".group-experience .deck-detail")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Creator", exact: true })).toHaveCount(0);
  await expect(page.locator(".group-experience .group-step-counts").first()).toHaveText("3/14 doing · 2/14 done");
  await page.getByRole("button", { name: "Back to My Decks", exact: true }).click();
  await expect(tile).toBeVisible();
});
test("ordinary picker switches a complete warm Deck, restores selection and leaves no foreign edit affordances", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto(`/decks?openExperience=${fixture!.experienceId}`);
  const current = page.locator(".group-picker-current"); await expect(current).toBeEnabled();
  await current.click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
  const alice = page.locator(".group-perspective-list button").filter({ hasText: "Alice" });
  await alice.click(); await expect(current).toHaveText(/Alice/); await expect(page.locator(".group-perspective-list")).toHaveCount(0);
  await expect(page.locator(".deck-detail")).toHaveCount(1); await expect(page.locator(".focused-card-layer")).toHaveCount(0);
  await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", fixture!.cardIds[0]);
  await expect.poll(async () => (await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json()).selection.perspective).toBe("follower");
  await page.reload(); await expect(page.locator(".group-picker-current")).toHaveText(/Alice/);
});
test("peer-hidden follower receives Group/self choices; empty group keeps a named noninteractive identity", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  await page.goto(`/decks?openExperience=${fixture!.secondId}`);
  await expect(page.locator(".group-picker-current")).toHaveText(/other/);
  await page.locator(".group-picker-current").click();
  await expect(page.locator(".group-perspective-list button")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "All followers", exact: true })).toHaveCount(0);
  await expect(page.locator(".group-private-mark").first()).toHaveAttribute("title", "Private to you");
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto(`/decks?openExperience=${fixture!.zeroId}`);
  await expect(page.locator(".group-picker-static")).toHaveText(/Empty squad/);
  await expect(page.locator(".group-step-counts")).toHaveCount(0);
  await page.goto(`/decks?openExperience=${fixture!.emptyId}`);
  await expect(page.locator(".group-picker-static")).toHaveText(/No Cards yet/);
  await expect(page.locator(".group-experience .deck-card")).toHaveCount(0);
  await expect(page.locator(".focused-card-layer")).toHaveCount(0);
});
