import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { cardFixture, deckFixture } from "../fixtures/frameworks";
import { itemFixtureRoutes } from "./helpers/assessmentFixtureRoutes";
import type { Framework } from "../../src/lib/frameworks/configuration";

async function fixture(page: Page) {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect(), repo = new CardRepository(client.db(process.env.MONGODB_DB!), client);
  const actor = new ObjectId(), username = `area-${randomUUID()}`;
  const original = cardFixture(randomUUID()), fork = cardFixture(randomUUID(), original.root.cardTemplateId), nested = cardFixture(randomUUID(), fork.root.cardTemplateId);
  const second = cardFixture(randomUUID()), unmapped = cardFixture(randomUUID()), cards = [original, fork, nested, second, unmapped];
  for (const [index, card] of cards.entries()) {
    card.root.ownerUserId = actor.toHexString(); card.version.publishedByUserId = actor.toHexString();
    card.root.draft!.intro.title = card.version.content.intro.title = `Practice Card ${index + 1}`;
    card.version.content.steps.forEach((step, position) => { step.title = ["Start", "Practice", "Reflect"][position]; card.root.draft!.steps[position].title = step.title; });
  }
  fork.data.signalReadings[0].reading = 7;
  const active = deckFixture(randomUUID(), [original.root.cardTemplateId, fork.root.cardTemplateId, unmapped.root.cardTemplateId]);
  const single = deckFixture(randomUUID(), [fork.root.cardTemplateId]);
  const archived = deckFixture(randomUUID(), [nested.root.cardTemplateId, second.root.cardTemplateId], true), decks = [active, single, archived];
  for (const [index, deck] of decks.entries()) {
    deck.root.ownerUserId = actor.toHexString(); deck.version.publishedByUserId = actor.toHexString();
    deck.version.content.title = deck.root.draft!.title = ["Shared practice", "One Card Path", "Archived practice"][index];
  }
  active.data.activeCardId = fork.root.cardTemplateId;
  archived.data.activeCardId = second.root.cardTemplateId;
  const user = { _id: actor, username, email: `${username}@example.invalid`, passwordHash: hashSync("local-test-only", 4),
    cardsData: cards.map((card) => card.data), decksData: decks.map((deck) => deck.data), itemTests: [], itemTestsRevision: 0, createdAt: new Date(), updatedAt: new Date() };
  await repo.users().insertOne(user);
  await repo.cards().insertMany(cards.map((card) => card.root)); await repo.cardVersions().insertMany(cards.map((card) => card.version));
  await repo.decks().insertMany(decks.map((deck) => deck.root)); await repo.deckVersions().insertMany(decks.map((deck) => deck.version));
  const frameworks: Framework[] = [{ id: "area-practice", title: "Area Practice Framework", areas: [
    { id: "practice", title: "Algebra", items: [
      { id: "area-original", title: "Original and inherited practice", cardTemplateIds: [original.root.cardTemplateId] },
      { id: "area-second", title: "More practice", cardTemplateIds: [second.root.cardTemplateId] }] },
    { id: "empty", title: "Empty Area", items: [] },
    ...Array.from({ length: 10 }, (_, index) => ({ id: `extra-${index}`, title: `Additional Area ${index}`,
      items: [{ id: `extra-item-${index}`, title: "Unmapped goal", cardTemplateIds: [] }] })) ] }];
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).status()).toBe(200);
  await itemFixtureRoutes(page, repo, actor.toHexString(), frameworks);
  return { client, repo, actor: actor.toHexString(), active, archived, fork, original, second, frameworks };
}
const dialog = (page: Page) => page.getByRole("dialog", { name: "Algebra", exact: true });
const areaTitle = (page: Page) => page.locator('tr[data-area-id="practice"] .progress-content-title');
async function dispose(page: Page, client: MongoClient) {
  // Drain in-memory fixture handlers before closing their Mongo connection.
  await page.unrouteAll({ behavior: "wait" });
  await client.close();
}
async function show(page: Page) { await page.goto("/progress"); await areaTitle(page).click(); await expect(dialog(page).getByRole("button", { name: "Open Shared practice", exact: true })).toBeEnabled(); }

test("Area title and chevron are independent; static ranked fronts and archive selection do not write, play media or import", async ({ page }) => {
  const f = await fixture(page);
  try {
    const before = await f.repo.getPersonalUser(f.actor); let writes = 0;
    page.on("request", (request) => { if (request.method() !== "GET" && /\/api\/(decks-data|cards-data)/.test(request.url())) writes++; });
    await show(page);
    expect(await dialog(page).locator('[data-context="active"]').evaluateAll((rows) => rows.map((element) => element.querySelector(".deck-tile-title")!.textContent?.trim()))).toEqual(["Shared practice ›", "One Card Path ›"]);
    await expect(dialog(page).getByText("2 matching Cards", { exact: true }).first()).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: /^My Decks/ })).toHaveAttribute("aria-expanded", "true");
    await expect(dialog(page).getByRole("button", { name: /^Archived/ })).toHaveAttribute("aria-expanded", "false");
    await expect(dialog(page).getByRole("button", { name: /^Library/ })).toHaveAttribute("aria-expanded", "false");
    await expect(dialog(page).locator("video, .tile-mini-card-action, .tile-mini-card-play-affordance")).toHaveCount(0);
    await dialog(page).getByRole("button", { name: /^Archived/ }).click();
    await dialog(page).getByRole("button", { name: "Select archived Archived practice", exact: true }).click();
    await expect(dialog(page).getByRole("button", { name: "Restore and open", exact: true })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before); expect(writes).toBe(0);
    await page.keyboard.press("Escape");
    await expect(areaTitle(page)).toBeFocused();
    await page.getByRole("button", { name: "Collapse Algebra", exact: true }).click();
    await areaTitle(page).click(); await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("button", { name: "Expand Algebra", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empty Area", exact: true })).toBeDisabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally { await dispose(page, f.client); }
});
test("Area opening preserves active Card and Back to Progress restores selection/expansion/scroll and refreshes saved completion/confidence", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto("/progress"); await expect(areaTitle(page)).toBeVisible();
    await page.getByRole("button", { name: "Collapse Additional Area 0", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 190));
    await areaTitle(page).click();
    const savedScroll = await page.evaluate(() => window.scrollY);
    await dialog(page).getByRole("button", { name: "Open Shared practice", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Shared practice");
    expect((await f.repo.getPersonalUser(f.actor))!.decksData.find((data) => data.deckTemplateId === f.active.root.deckTemplateId)!.activeCardId).toBe(f.fork.root.cardTemplateId);
    await page.locator(".deck-card[role=button]").press("Enter");
    const update = page.getByRole("button", { name: "Update step progress. Current status: todo", exact: true }).first();
    await update.click();
    await expect.poll(async () => (await f.repo.getPersonalUser(f.actor))!.cardsData.find((data) => data.cardTemplateId === f.fork.root.cardTemplateId)!.items[0].completionStatus).toBe("inProgress");
    await page.getByRole("button", { name: "Update step progress. Current status: inProgress", exact: true }).first().click();
    await expect.poll(async () => (await f.repo.getPersonalUser(f.actor))!.cardsData.find((data) => data.cardTemplateId === f.fork.root.cardTemplateId)!.items[0].completionStatus).toBe("done");
    // Existing persistence path changes a raw reading while working is open.
    await f.repo.setSignalReading(f.actor, f.active.root.deckTemplateId, f.fork.root.cardTemplateId, f.fork.version.content.steps[0].stepId, 9);
    await page.getByRole("button", { name: "Close focused card", exact: true }).press("Enter");
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("area-practice");
    await expect(page.getByRole("button", { name: "Expand Additional Area 0", exact: true })).toBeVisible();
    await expect(page.locator('tr[data-item-id="area-original"] td').nth(0)).toHaveText("11%");
    await expect(page.locator('tr[data-item-id="area-original"] td').nth(1)).toHaveText("9");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedScroll);
  } finally { await dispose(page, f.client); }
});
test("explicit Restore and open survives opening failure, supports retry, and leaves restoration intact", async ({ page }) => {
  const f = await fixture(page);
  try {
    await show(page); await dialog(page).getByRole("button", { name: /^Archived/ }).click();
    await dialog(page).getByRole("button", { name: "Select archived Archived practice", exact: true }).click();
    let fail = true;
    await page.route("**/api/decks-data", async (route) => {
      if (fail && route.request().method() === "POST") { fail = false; return route.fulfill({ status: 500, json: { error: "Simulated opening failure" } }); }
      return route.continue();
    });
    await dialog(page).getByRole("button", { name: "Restore and open", exact: true }).click();
    await expect(page.locator('main [role="alert"]')).toContainText("The Deck was restored, but opening failed");
    expect((await f.repo.getPersonalUser(f.actor))!.decksData.find((data) => data.deckTemplateId === f.archived.root.deckTemplateId)!.archivedAt).toBeNull();
    await page.getByRole("button", { name: "Retry opening Deck", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Archived practice");
    expect((await f.repo.getPersonalUser(f.actor))!.decksData.find((data) => data.deckTemplateId === f.archived.root.deckTemplateId)!.activeCardId).toBe(f.second.root.cardTemplateId);
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await areaTitle(page).click();
    const activeSection = dialog(page).getByRole("button", { name: /^My Decks/ });
    const archivedSection = dialog(page).getByRole("button", { name: /^Archived/ });
    await expect(activeSection.locator("span").first()).toHaveText("3");
    await expect(archivedSection.locator("span").first()).toHaveText("0");
    await expect(dialog(page).getByRole("button", { name: "Open Archived practice", exact: true })).toBeVisible();
    await archivedSection.click();
    await expect(dialog(page).getByRole("button", { name: "Select archived Archived practice", exact: true })).toHaveCount(0);
    await expect(dialog(page).locator('[data-context="archived"]')).toHaveCount(0);
  } finally { await dispose(page, f.client); }
});
test("stale archived membership requires refresh; unavailable discovery remains visibly incomplete", async ({ page }) => {
  const f = await fixture(page);
  try {
    await show(page); await dialog(page).getByRole("button", { name: /^Archived/ }).click();
    await dialog(page).getByRole("button", { name: "Select archived Archived practice", exact: true }).click();
    await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $inc: { "decksData.$[deck].membershipRevision": 1 } }, { arrayFilters: [{ "deck.deckTemplateId": f.archived.root.deckTemplateId }] });
    await dialog(page).getByRole("button", { name: "Restore and open", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("This Deck changed");
    expect((await f.repo.getPersonalUser(f.actor))!.decksData.find((data) => data.deckTemplateId === f.archived.root.deckTemplateId)!.archivedAt).not.toBeNull();
    await f.repo.deckVersions().deleteOne({ deckTemplateId: f.active.root.deckTemplateId, version: 1 });
    await dialog(page).getByRole("button", { name: "Refresh Decks", exact: true }).click();
    await expect(dialog(page).getByText(/Some Decks could not be checked/).first()).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Open One Card Path", exact: true })).toBeEnabled();
    await expect(dialog(page).getByRole("button", { name: "Refresh Decks", exact: true })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Refresh Decks", exact: true }).click();
    await expect(dialog(page).getByRole("button", { name: "Open One Card Path", exact: true })).toBeEnabled();
  } finally { await dispose(page, f.client); }
});
for (const width of [320, 390, 1280]) test(`Area modal visual/front selection, scrolling and keyboard focus at ${width}px`, async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.setViewportSize({ width, height: 800 }); await show(page);
    await dialog(page).getByRole("button", { name: /^Archived/ }).click();
    await dialog(page).getByRole("button", { name: /^Library/ }).click();
    await expect(dialog(page).getByText("No matching Library Decks.", { exact: true })).toBeVisible();
    const box = await dialog(page).boundingBox(); expect(box!.width).toBeLessThanOrEqual(width - 20);
    expect(await dialog(page).evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    // Natural tile height must keep personal metadata inside the visible front.
    const tile = dialog(page).locator('[data-context="active"] .deck-tile').first();
    expect(await tile.evaluate((element) => {
      const metadata = element.querySelector(".deck-tile-meta")!.getBoundingClientRect(), outer = element.getBoundingClientRect();
      return metadata.bottom <= outer.bottom;
    })).toBe(true);
    await page.screenshot({ path: `phase2-test-results/area-modal-${width}.png`, fullPage: true });
    await dialog(page).evaluate((element) => { element.scrollTop = 0; });
    await page.screenshot({ path: `phase2-test-results/area-modal-top-${width}.png`, fullPage: true });
    await dialog(page).getByRole("button", { name: "Close", exact: true }).focus(); await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
    await page.keyboard.press("Escape"); await expect(areaTitle(page)).toBeFocused();
  } finally { await dispose(page, f.client); }
});

test("same-Deck targeted URL navigation honors the new Card target and Creator retains Progress return context", async ({ page }) => {
  const f = await fixture(page);
  try {
    await show(page); await dialog(page).getByRole("button", { name: "Open Shared practice", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Shared practice");
    await page.evaluate(({ deck, card }) => {
      const url = new URL(window.location.href); url.searchParams.set("openDeck", deck); url.searchParams.set("openCard", card);
      window.history.pushState(null, "", url.pathname + url.search);
    }, { deck: f.active.root.deckTemplateId, card: f.original.root.cardTemplateId });
    await expect.poll(async () => (await f.repo.getPersonalUser(f.actor))!.decksData.find((data) => data.deckTemplateId === f.active.root.deckTemplateId)!.activeCardId).toBe(f.original.root.cardTemplateId);
    await expect(page.locator(".deck-card[role=button]")).toContainText("Practice Card 1");
    await page.getByRole("button", { name: "Deck menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await expect(page.locator(".creator-back-link")).toHaveAttribute("href", /progressFramework=area-practice/);
    await page.locator(".creator-back-link").click();
    await expect(page.getByRole("button", { name: "Back to Progress", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("area-practice");
  } finally { await dispose(page, f.client); }
});

test("an obsolete working-entry response cannot replace a newer same-Deck Card target", async ({ page }) => {
  const f = await fixture(page);
  let release: () => void = () => {}, notify: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; }), started = new Promise<void>((resolve) => { notify = resolve; });
  try {
    await show(page); let intercept = true;
    await page.route("**/api/decks-data", async (route) => {
      if (intercept && route.request().method() === "POST") {
        intercept = false; const response = await route.fetch(); notify(); await gate; await route.fulfill({ response });
      } else await route.continue();
    });
    await dialog(page).getByRole("button", { name: "Open Shared practice", exact: true }).click();
    await started;
    await page.evaluate((card) => { const url = new URL(window.location.href); url.searchParams.set("openCard", card); window.history.pushState(null, "", url.pathname + url.search); }, f.original.root.cardTemplateId);
    release();
    await expect(page.locator(".deck-card[role=button]")).toContainText("Practice Card 1");
    expect((await f.repo.getPersonalUser(f.actor))!.decksData.find((data) => data.deckTemplateId === f.active.root.deckTemplateId)!.activeCardId).toBe(f.original.root.cardTemplateId);
    await expect(page.getByRole("button", { name: "Back to Progress", exact: true })).toBeVisible();
  } finally { release(); await dispose(page, f.client); }
});
test("a lost Restore response is reconciled through fresh discovery without repeating or reversing the transition", async ({ page }) => {
  const f = await fixture(page);
  try {
    await show(page); await dialog(page).getByRole("button", { name: /^Archived/ }).click();
    await dialog(page).getByRole("button", { name: "Select archived Archived practice", exact: true }).click();
    let restores = 0;
    await page.route(`**/api/decks-data/${f.archived.root.deckTemplateId}`, async (route) => {
      if (route.request().method() === "PATCH" && route.request().postDataJSON()?.type === "restore") {
        restores++; await route.fetch(); return route.fulfill({ status: 500, json: { error: "Lost Restore response" } });
      }
      return route.continue();
    });
    await dialog(page).getByRole("button", { name: "Restore and open", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("Unable to confirm the current Deck state");
    await dialog(page).getByRole("button", { name: "Refresh Decks", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Open Archived practice", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Archived practice");
    expect(restores).toBe(1);
    expect((await f.repo.getPersonalUser(f.actor))!.decksData.find((data) => data.deckTemplateId === f.archived.root.deckTemplateId)!.membershipRevision).toBe(1);
  } finally { await dispose(page, f.client); }
});
