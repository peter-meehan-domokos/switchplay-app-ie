import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { deckDraftContent } from "../../src/lib/cards/publicationRules";
const fixture = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null") as { experienceId: string; secondId: string; cardIds: string[]; otherId: string; adminId: string; deckId: string } | null;
test.skip(!fixture, "Requires disposable --group-experiences fixture");
async function login(page: Page, user: string, experienceId = fixture!.experienceId) {
  await page.request.post("/api/auth/login", { data: { identifier: user, password: "local-test-only" } });
  await page.goto(`/decks?openExperience=${experienceId}`); await expect(page.locator(".group-picker-current")).toBeEnabled();
}
async function compare(page: Page) {
  await page.locator(".deck-card.is-active").focus(); await page.locator(".deck-card.is-active").press("Enter");
  await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
  await page.locator(".group-identity-card").filter({ hasText: "Alice" }).click();
  await expect(page.locator(".group-comparison-panel header")).toContainText("Alice");
}
test("remote peer revocation denies fresh requests and removes cached peer display within the authority window", async ({ page, browser }) => {
  await login(page, "other"); await compare(page);
  const admin = await browser.newContext();
  try {
    await admin.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    const context = await (await admin.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
    await admin.request.patch(`/api/group-experiences/${fixture!.experienceId}/settings`, { data: { operationId: "browser-policy-off", expectedStructureRevision: context.structureRevision, allowFollowerInspection: false } });
    const selected = await page.locator(".group-experience").getAttribute("data-perspective-key");
    expect((await page.request.get(`/api/group-experiences/${fixture!.experienceId}/cards/${fixture!.cardIds[0]}?perspective=follower&subjectUserId=${selected}`)).status()).toBe(403);
    await expect(page.locator(".group-experience")).toHaveAttribute("data-perspective-key", fixture!.otherId, { timeout: 6500 });
    await expect(page.locator(".group-comparison-panel")).toHaveCount(0);
  } finally {
    const current = await (await admin.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
    await admin.request.patch(`/api/group-experiences/${fixture!.experienceId}/settings`, { data: { operationId: "browser-policy-on", expectedStructureRevision: current.structureRevision, allowFollowerInspection: true } });
    await admin.close();
  }
});
test("unverifiable peer cache is hidden on expiry and reduced-motion keyboard collapse retains perspective", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await login(page, "other"); await compare(page);
  await page.getByRole("button", { name: "Collapse follower comparison" }).focus();
  await page.getByRole("button", { name: "Collapse follower comparison" }).press("Escape");
  await expect(page.locator(".group-comparison-panel")).toHaveCount(0); await expect(page.locator(".focused-card-layer")).toBeVisible();
  await expect(page.locator(".group-picker-current")).toHaveText(/Alice/);
  await page.route("**/api/group-experiences/**", async route => { if (route.request().method() === "GET") await route.abort(); else await route.continue(); });
  await expect(page.locator(".group-experience")).toHaveAttribute("data-perspective-key", fixture!.otherId, { timeout: 6500 });
  await expect(page.getByRole("button", { name: /Update step progress|Adjust .* reading/ })).toHaveCount(0);
});
test("group and own edits use separate APIs, retain private learning, and front counts stay on one line", async ({ page }) => {
  await login(page, "phase2");
  const metadata = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
  await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/navigation`, { data: { accessEpoch: metadata.accessEpoch, expectedStructureRevision: metadata.structureRevision,
    selection: { perspective: "group" }, activeCardId: fixture!.cardIds[0] } });
  await page.reload(); await expect(page.locator(".group-picker-current")).toBeEnabled();
  await page.locator(".deck-card.is-active").focus(); await page.locator(".deck-card.is-active").press("Enter");
  const row = page.locator(".focused-card-surface--front .group-step-learning").first();
  const inline = await row.evaluate(element => { const bar = element.querySelector(".step-progress-strip")!.getBoundingClientRect(), hitArea = element.querySelector(".step-progress-hit-area")!.getBoundingClientRect(), text = element.querySelector(".group-step-counts")!.getBoundingClientRect();
    return { barRight: hitArea.right, textLeft: text.left, centreDifference: Math.abs(bar.y+bar.height/2-text.y-text.height/2) }; });
  expect(inline.textLeft).toBeGreaterThanOrEqual(inline.barRight); expect(inline.centreDifference).toBeLessThan(2);
  const saved = page.waitForResponse(response => response.url().endsWith("/group-learning") && response.request().method() === "PATCH", { timeout: 15_000 });
  await row.getByRole("button").click(); expect((await saved).status()).toBe(200);
  await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/cards/${fixture!.cardIds[0]}/group-learning`, { data: { accessEpoch: metadata.accessEpoch, version: 1,
    change: { kind: "completion", stepId: "group-0-a", completionStatus: "todo" } } });
  const header = (await page.locator(".focused-card-surface--front .card-title-anchor").boundingBox())!;
  await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2); await page.mouse.down();
  await page.mouse.move(header.x + header.width / 2 + 180, header.y + header.height / 2, { steps: 12 }); await page.mouse.up();
  await expect(page.locator(".group-experience")).toHaveAttribute("data-face", "back");
  const signalSaved = page.waitForResponse(response => response.url().endsWith("/group-learning") && response.request().method() === "PATCH", { timeout: 15_000 });
  const signalControl = page.getByRole("button", { name: "Adjust Prepare reading", exact: true });
  await signalControl.hover();
  const track = (await signalControl.locator(".focused-card-signal-track").boundingBox())!;
  await page.mouse.move(track.x + track.width * .4, track.y + track.height / 2); await page.mouse.down();
  await page.mouse.move(track.x + track.width * .4 + 180, track.y + track.height / 2, { steps: 12 }); await page.mouse.up();
  expect((await signalSaved).status()).toBe(200);
  try {
    const group = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}/cards/${fixture!.cardIds[0]}?perspective=group`)).json();
    expect(group.learning.signalReadings.find((signal: { stepId: string }) => signal.stepId === "group-0-a").reading).toBe(10);
  } finally {
    await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/cards/${fixture!.cardIds[0]}/group-learning`, { data: { accessEpoch: metadata.accessEpoch, version: 1,
      change: { kind: "signal", stepId: "group-0-a", reading: 7 } } });
  }
  await login(page, "other", fixture!.secondId);
  await page.locator(".deck-card.is-active").focus(); await page.locator(".deck-card.is-active").press("Enter");
  const ownSaved = page.waitForResponse(response => response.url().endsWith("/personal-learning") && response.request().method() === "PATCH", { timeout: 15_000 });
  // A Step detail row is itself a role=button and inherits its child's name.
  // Anchor this selector to the actual progress control, not the enclosing row.
  await page.locator(".focused-card-surface--front").getByRole("button", { name: /^Update step progress/ }).first().click(); expect((await ownSaved).status()).toBe(200);
  try {
    const shared = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}/cards/${fixture!.cardIds[0]}?perspective=self`)).json();
    expect(shared.learning.items[0].completionStatus).toBe("done");
    await expect(page.locator(".focused-card-surface--front .group-private-mark")).toHaveAttribute("aria-label", "Private to you");
  } finally {
    const own = await (await page.request.get(`/api/group-experiences/${fixture!.secondId}`)).json();
    await page.request.patch(`/api/group-experiences/${fixture!.secondId}/cards/${fixture!.cardIds[0]}/personal-learning`, { data: { accessEpoch: own.accessEpoch, version: 1,
      change: { kind: "completion", stepId: "group-0-a", completionStatus: "inProgress" } } });
  }
});
test("an open ordinary peer list hides identities when its authority lease cannot be renewed", async ({ page }) => {
  await login(page, "other");
  await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
  await expect(page.locator(".group-perspective-list")).toContainText("Alice");
  await page.route("**/api/group-experiences/**", async route => { if (route.request().method() === "GET") await route.abort(); else await route.continue(); });
  await expect(page.locator(".group-perspective-list")).toHaveCount(0, { timeout: 6500 });
  await expect(page.locator(".group-picker-current")).toBeDisabled();
});
test("adoption removes an active Card without reviving its navigation grant or breaking later selection", async ({ page }) => {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client);
  await login(page, "phase2");
  const current = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
  await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch,
    expectedStructureRevision: current.structureRevision, selection: { perspective: "group" }, activeCardId: fixture!.cardIds[0] } });
  await page.reload(); await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", fixture!.cardIds[0]);
  async function adopt(ids: string[]) {
    const root = (await repo.decks().findOne({ deckTemplateId: fixture!.deckId }))!;
    const prior = (await repo.getDeckVersion(fixture!.deckId, root.latestVersion))!;
    await repo.saveDeckDraft(fixture!.adminId, fixture!.deckId, root.revision, { ...deckDraftContent(prior.content), cards: ids.map(cardTemplateId => ({ cardTemplateId })) });
    await repo.publishDeck(fixture!.adminId, fixture!.deckId, root.revision + 1);
    const review = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}/updates?kind=deck&entityId=${fixture!.deckId}&perspective=group`)).json();
    expect((await page.request.post(`/api/group-experiences/${fixture!.experienceId}/updates`, { data: { operationId: randomUUID(), review: review.review.command } })).status()).toBe(200);
  }
  try {
    await adopt(fixture!.cardIds.slice(1));
    await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", fixture!.cardIds[1]);
    await expect(page.locator(".deck-card.is-active")).toContainText("Control the movement");
    await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
    await page.locator(".group-perspective-list button").filter({ hasText: "Alice" }).click();
    await expect.poll(async () => (await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json()).activeCardId).toBe(fixture!.cardIds[1]);
    expect((await page.request.get(`/api/group-experiences/${fixture!.experienceId}/cards/${fixture!.cardIds[0]}?perspective=group`)).status()).toBe(403);
    await page.locator(".deck-card.is-active").press("Enter");
    await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
    await expect(page.locator(".group-comparison-panel")).toBeVisible();
    await adopt([]);
    await expect(page.locator(".group-experience .deck-card")).toHaveCount(0);
    await expect(page.locator(".focused-card-layer")).toHaveCount(0);
    await expect(page.locator(".group-comparison-panel")).toHaveCount(0);
  } finally { await adopt(fixture!.cardIds); await client.close(); }
});
