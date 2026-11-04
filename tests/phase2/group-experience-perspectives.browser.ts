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
  await expect.poll(() => page.locator(".group-experience .group-step-counts").first().textContent()).toBe("3\u00a0\u00a02");
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
for (const pickerState of ["all", "closed", "all-then-closed", "compact-list"] as const) {
  test(`focus entry carries only an open All followers list into comparison: ${pickerState}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    const current = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
    await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/navigation`, { data: {
      accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision,
      selection: { perspective: "self" }, activeCardId: fixture!.cardIds[1],
    } });
    await page.goto(`/decks?openExperience=${fixture!.experienceId}`);
    const picker = page.locator(".group-picker-current"), scene = page.locator(".group-experience");
    await expect(picker).toBeEnabled();
    const selected = await scene.getAttribute("data-perspective-key");
    const cardId = await scene.getAttribute("data-current-card");
    const face = await scene.getAttribute("data-face");
    if (pickerState !== "closed") await picker.click();
    if (pickerState === "all" || pickerState === "all-then-closed") {
      await page.getByRole("button", { name: "All followers", exact: true }).click();
      await expect(page.getByLabel("All followers", { exact: true })).toBeVisible();
    }
    if (pickerState === "all-then-closed") await picker.click();
    await page.locator(".deck-card.is-active").press("Enter");
    await expect(page.locator(".focused-card-layer")).toBeVisible();
    const panel = page.getByRole("region", { name: "Follower comparison" });
    if (pickerState === "all") {
      await expect(panel).toBeVisible();
      await expect(page.locator(".group-perspective-list")).toHaveCount(0);
      await expect(panel.locator(`button[data-perspective-key="${selected}"]`)).toHaveAttribute("aria-pressed", "true");
      await expect.poll(async () => {
        const card = await page.locator(".focused-card-object").boundingBox(), grid = await panel.boundingBox();
        return card && grid ? card.y + card.height - grid.y : 100;
      }).toBeLessThan(10);
    } else await expect(panel).toHaveCount(0);
    await expect(scene).toHaveAttribute("data-perspective-key", selected!);
    await expect(scene).toHaveAttribute("data-current-card", cardId!);
    await expect(scene).toHaveAttribute("data-face", face!);
    await page.getByRole("button", { name: "Close focused card", exact: true }).click({ position: { x: 10, y: 12 } });
    await expect(panel).toHaveCount(0);
    await expect(picker).toBeVisible();
    await expect(scene).toHaveAttribute("data-perspective-key", selected!);
    await page.locator(".deck-card.is-active").press("Enter");
    await expect(page.locator(".focused-card-layer")).toBeVisible();
    await expect(panel).toHaveCount(0);
  });
}
test("peer-hidden follower receives Group/self choices; empty group keeps a named noninteractive identity", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  await page.goto(`/decks?openExperience=${fixture!.secondId}`);
  await expect(page.locator(".group-picker-current")).toHaveText(/other/);
  await page.locator(".group-picker-current").click();
  await expect(page.locator(".group-perspective-list button")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "All followers", exact: true })).toHaveCount(0);
  await expect(page.locator(".date-visibility-indicator svg").first()).toHaveAttribute("aria-label", "Private in this Group");
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto(`/decks?openExperience=${fixture!.zeroId}`);
  await expect(page.locator(".group-picker-static")).toHaveText(/Empty squad/);
  await expect(page.locator(".group-step-counts")).toHaveCount(0);
  await page.goto(`/decks?openExperience=${fixture!.emptyId}`);
  await expect(page.locator(".group-picker-static")).toHaveText(/No Cards yet/);
  await expect(page.locator(".group-experience .deck-card")).toHaveCount(0);
  await expect(page.locator(".focused-card-layer")).toHaveCount(0);
});
