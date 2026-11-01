import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import { MongoClient } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { groupProgressRoutes } from "./helpers/groupProgressRoutes";
const fixture = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null") as { experienceId: string; secondId: string; cardIds: string[]; adminId: string; otherId: string } | null;
test.skip(!fixture, "Requires disposable Group fixtures");
async function setup(page: import("@playwright/test").Page, user = "phase2") {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect(), repo = new CardRepository(client.db(process.env.MONGODB_DB!), client);
  const frameworks = [{ id: "practice", title: "Practice Framework", areas: [{ id: "skills", title: "Skills", items: [
    { id: "balance", title: "Balance", cardTemplateIds: fixture!.cardIds.slice(0, 1) }, { id: "movement", title: "Movement", cardTemplateIds: fixture!.cardIds.slice(1) },
    ...Array.from({ length: 25 }, (_, i) => ({ id: `outside-${i}`, title: `Outside skill ${i}`, cardTemplateIds: [] }))] }] }];
  await page.request.post("/api/auth/login", { data: { identifier: user, password: "local-test-only" } });
  await groupProgressRoutes(page, repo, frameworks); return { client, repo };
}
test("existing Deck menu enters fixed Group Progress with role defaults and personal entry remains personal", async ({ page }) => {
  const f = await setup(page);
  try {
    await page.goto(`/decks?openExperience=${fixture!.experienceId}`); await expect(page.locator(".group-picker-current")).toBeEnabled();
    await page.getByRole("button", { name: "Deck menu", exact: true }).click(); await expect(page.getByRole("menuitem", { name: "Group…", exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: "Progress", exact: true }).click();
    await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue("group");
    await expect(page.locator(".group-progress-metadata")).toContainText("Galway U18");
    await page.goto("/progress"); await expect(page.getByRole("heading", { name: "My Progress", exact: true })).toBeVisible();
    await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveCount(0);
    await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
    await page.goto(`/decks?openExperience=${fixture!.experienceId}`); await expect(page.locator(".group-picker-current")).toBeEnabled();
    await page.getByRole("button", { name: "Deck menu", exact: true }).click(); await expect(page.getByRole("menuitem", { name: "Group…", exact: true })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Progress", exact: true }).click();
    await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue(fixture!.otherId);
    await expect(page.getByLabel("Progress perspective", { exact: true }).locator("option:checked")).toHaveText("My Progress in Group");
  } finally { await f.client.close(); }
});
test("perspective changes retain table, Area expansion and scroll; Back restores the captured Deck scene", async ({ page }) => {
  const f = await setup(page);
  try {
    await page.goto(`/decks?openExperience=${fixture!.experienceId}&progressScene=1&openCard=${fixture!.cardIds[1]}&progressFace=back&progressPerspective=group&progressFocused=0`);
    await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", fixture!.cardIds[1]);
    await expect(page.locator(".group-experience")).toHaveAttribute("data-face", "back");
    await expect(page.locator(".group-picker-current")).toBeEnabled(); await page.getByRole("button", { name: "Deck menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Progress", exact: true }).click(); await expect(page.getByLabel("Progress perspective", { exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Collapse Skills", exact: true }).click();
    await page.getByLabel("Progress perspective", { exact: true }).selectOption(fixture!.otherId);
    await expect(page.getByRole("button", { name: "Expand Skills", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Expand Skills", exact: true }).click();
    await page.evaluate(() => { (window as unknown as { progressTable: Element | null }).progressTable = document.querySelector(".progress-table"); window.scrollTo(0, 600); });
    const before = await page.evaluate(() => window.scrollY);
    await page.getByLabel("Progress perspective", { exact: true }).selectOption("group");
    await expect(page.locator("section[aria-busy=false] .progress-table")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { progressTable: Element | null }).progressTable === document.querySelector(".progress-table"))).toBe(true);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(2);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.getByRole("button", { name: "Back to Group Deck", exact: true }).click();
    await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", fixture!.cardIds[1]);
    await expect(page.locator(".group-experience")).toHaveAttribute("data-face", "back");
  } finally { await f.client.close(); }
});

test("dual-role defaults remain self and revocation removes subjects and falls back safely", async ({ page }) => {
  const f = await setup(page, "other"), groups = new GroupExperienceRepository(f.repo);
  try {
    const template = await groups.get(fixture!.adminId, fixture!.experienceId);
    const created = await groups.create(fixture!.adminId, { operationId: randomUUID(), name: "Dual role review", adminIds: [fixture!.otherId], followerIds: [fixture!.otherId],
      manifest: { deckTemplateId: template.deckTemplateId, deckVersion: template.deckVersion, cards: template.cards.map(card => ({ cardTemplateId: card.cardTemplateId, version: card.version })) } });
    await page.goto(`/group-experiences/${created.experienceId}/progress`);
    await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue(fixture!.otherId);
    await groups.changeMember(fixture!.adminId, created.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "remove-follower", targetUserId: fixture!.otherId });
    await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue("group");
    await expect(page.getByLabel("Progress perspective", { exact: true }).locator(`option[value="${fixture!.otherId}"]`)).toHaveCount(0);
    await groups.changeMember(fixture!.adminId, created.experienceId, { operationId: randomUUID(), expectedStructureRevision: 1, kind: "set-admin", targetUserId: fixture!.otherId, isAdmin: false });
    await expect(page).toHaveURL(/\/decks$/);
  } finally { await f.client.close(); }
});

test("Item destinations preserve a fixed Group subject on the working Card and on return", async ({ page }) => {
  const f = await setup(page);
  try {
    await page.goto(`/group-experiences/${fixture!.experienceId}/progress?framework=practice&subjectUserId=${fixture!.otherId}`);
    await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue(fixture!.otherId);
    await page.locator('tr[data-item-id="balance"] .progress-content-title').click();
    const dialog = page.getByRole("dialog", { name: "Balance", exact: true }); await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Choose Find your balance", exact: true }).click();
    await expect(page.locator(".group-experience")).toHaveAttribute("data-perspective-key", fixture!.otherId);
    await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", fixture!.cardIds[0]);
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await expect(page.getByLabel("Progress perspective", { exact: true })).toHaveValue(fixture!.otherId);
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("practice");
  } finally { await f.client.close(); }
});
