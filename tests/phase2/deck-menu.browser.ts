import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });

for (const width of [1280, 320]) test(`My Decks menu confirms Archive, preserves cancellation and retries safely at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
  const id = randomUUID(), title = `Practice ${id}`, other = randomUUID();
  await repo.createPrivateGraph(actor, id, { ...createDefaultDeckContent([]), title }, []);
  await repo.createPrivateGraph(actor, other, { ...createDefaultDeckContent([]), title: `Other ${other}` }, []);
  for (const deckId of [id, other]) {
    await repo.publishDeck(actor, deckId, 0);
    await repo.ensureDeckData(actor, deckId, 1);
  }
  const membership = async (deckId = id) => (await repo.getPersonalUser(actor))!.decksData.find(deck => deck.deckTemplateId === deckId)!;
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/decks");
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).click();
  await expect(page.locator(".deck-detail h1")).toHaveText(title);
  await expect(page.getByRole("button", { name: "Archive Deck", exact: true })).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "Deck menu", exact: true });
  await trigger.press("Enter");
  await expect(page.getByRole("menuitem")).toHaveText(["Edit", "Archive"]);
  await expect(page.getByRole("menuitem", { name: "Edit", exact: true })).toHaveAttribute("href", new RegExp(`/creator/edit/${id}`));
  const padding = await page.getByRole("menuitem").evaluateAll(items => items.map(item => getComputedStyle(item).padding));
  expect(padding[0]).toBe(padding[1]);
  await page.screenshot({ path: `/tmp/switchplay-deck-menu-${width}.png` });
  await page.getByRole("menuitem", { name: "Archive", exact: true }).press("Enter");
  const dialog = page.getByRole("dialog", { name: `Archive ${title}`, exact: true });
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(dialog).toContainText("Your learning progress is kept");
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  const bounds = await dialog.boundingBox(); expect(bounds!.width).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `/tmp/switchplay-archive-dialog-${width}.png` });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  expect((await membership()).archivedAt).toBeNull();
  await trigger.click(); await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  expect((await membership()).archivedAt).toBeNull();
  let attempts = 0, release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/decks-data/${id}`, async route => {
    if (route.request().method() !== "PATCH") return route.continue();
    expect(route.request().postDataJSON()).toEqual({ type: "archive" }); attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: "fixture failure" } });
    await waiting; await route.continue();
  });
  try {
    await trigger.click(); await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
    await dialog.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Unable to archive");
    expect((await membership()).archivedAt).toBeNull();
    await dialog.getByRole("button", { name: "Archive", exact: true }).click();
    await expect.poll(() => attempts).toBe(2);
    await expect(dialog.getByRole("button", { name: "Archiving…", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Archiving…", exact: true }).dispatchEvent("click");
    await page.keyboard.press("Escape"); await expect(dialog).toBeVisible(); expect(attempts).toBe(2);
    release();
    await expect(page.locator(".deck-detail")).toHaveCount(0);
    await expect.poll(async () => (await membership()).archivedAt !== null).toBe(true);
    expect((await membership(other)).archivedAt).toBeNull();
    await page.getByText("Archived decks", { exact: true }).click();
    await expect(page.getByRole("button", { name: `Restore ${title}`, exact: true })).toBeVisible();
  } finally { release(); }
});

test("Library menu supports touch, explicit Add/Open and existing Edit ordering", async ({ browser }) => {
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
  const title = `Library menu ${randomUUID()}`;
  const deck = await repo.createDeckDraft(actor, { ...createDefaultDeckContent([]), title }, "public");
  await repo.publishDeck(actor, deck.deckTemplateId, 0);
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    await page.goto(`/library/${deck.deckTemplateId}`);
    await expect(page.locator(".deck-detail h1")).toHaveText(title);
    await expect(page.getByRole("button", { name: "Add to My Decks", exact: true })).toHaveCount(0);
    const trigger = page.getByRole("button", { name: "Deck menu", exact: true });
    await trigger.tap();
    await expect(page.getByRole("menuitem")).toHaveText(["Edit", "Add to My Decks"]);
    expect((await repo.getPersonalUser(actor))!.decksData.some(data => data.deckTemplateId === deck.deckTemplateId)).toBe(false);
    await page.screenshot({ path: "/tmp/switchplay-library-menu-390.png" });
    await page.getByRole("menuitem", { name: "Add to My Decks", exact: true }).tap();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.tap();
    await expect(page.getByRole("menuitem")).toHaveText(["Edit", "Open in My Decks"]);
    await expect(page).toHaveURL(new RegExp(`/library/${deck.deckTemplateId}$`));
    const data = (await repo.getPersonalUser(actor))!.decksData.find(item => item.deckTemplateId === deck.deckTemplateId)!;
    expect(data.openedAt).toBeNull();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "/tmp/switchplay-library-menu-1280.png" });
    await page.getByRole("menuitem", { name: "Open in My Decks", exact: true }).tap();
    await expect(page.locator(".app-shell:not(.library-shell) .deck-detail h1")).toHaveText(title);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.tap(); await expect(page.getByRole("menuitem")).toHaveText(["Edit", "Archive"]);
  } finally { await context.close(); }
});
