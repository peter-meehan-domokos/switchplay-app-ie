import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../../src/lib/cards/forks";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function fixture(shared = false) {
  const main = new CardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!;
  const card = await main.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
    intro: { title: "Personal practice", description: "Original instruction stays mounted.", mediaItem: null }, infoCardIds: shared ? ["demo-owner-public"] : [] }, "public");
  await main.publishCard(owner, card.cardTemplateId, 0);
  const deck = await main.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Personal programme", cards: [{ cardTemplateId: card.cardTemplateId }] }, "public");
  await main.publishDeck(owner, deck.deckTemplateId, 0); await main.ensureDeckData(owner, deck.deckTemplateId, 1);
  return { main, info: new InfoCardRepository(main.db, client), owner, cardId: card.cardTemplateId, deckId: deck.deckTemplateId };
}
async function login(page: Page) { expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).ok()).toBeTruthy(); }
async function enter(page: Page, deckId: string) {
  await login(page); await page.goto(`/decks?openDeck=${deckId}`);
  await page.locator(".deck-card.is-active").press("Enter"); await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
}
const consult = (page: Page) => page.getByRole("dialog", { name: "Info card consultation", exact: true });
const editor = (page: Page) => page.getByRole("dialog", { name: "Personal Info Card editor", exact: true });
const current = (page: Page) => page.locator('[data-info-card-current="true"]');
async function open(page: Page, empty = false) {
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  if (empty) await expect(consult(page).getByRole("button", { name: "New personal Info Card", exact: true })).toBeVisible();
  else await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
}
async function action(page: Page, name: "+ New" | "Edit" | "Remove") {
  await current(page).getByRole("button", { name: "Info Card actions", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
async function fill(page: Page, title: string, body = "Keep the sign with its number.") {
  await expect(editor(page)).toBeVisible();
  await editor(page).getByRole("combobox", { name: "Series", exact: true }).selectOption("demo-series-owner");
  await editor(page).getByRole("textbox", { name: "Title", exact: true }).fill(title);
  if (body) await editor(page).getByRole("textbox", { name: "Explanation", exact: true }).fill(body);
}
async function save(page: Page) {
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  await expect(consult(page)).toBeVisible();
  await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
  return current(page).getAttribute("data-info-card-id");
}

test("empty pouch creates a private note with the existing editor, keeping the same Step View and open pack", async ({ page }) => {
  // Ordinary HTTP LAN pages (including iPhone review) lack randomUUID, while
  // cryptographic getRandomValues remains available to the existing ID helper.
  await page.addInitScript(() => Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true }));
  const f = await fixture(); await enter(page, f.deckId);
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");
  await page.locator(".step-view-layer").evaluate(node => { (node as HTMLElement).dataset.personalMount = "retained"; });
  await open(page, true);
  await expect(consult(page).getByRole("button", { name: "New personal Info Card", exact: true })).toHaveText("+");
  await expect(page.locator("[data-info-card-face]")).toHaveCount(0);
  await consult(page).getByRole("button", { name: "New personal Info Card", exact: true }).click(); await fill(page, "My note");
  await expect(editor(page).getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
  await expect(editor(page).getByRole("combobox", { name: "Creator mode" })).toHaveCount(0);
  const id = await save(page);
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("My note");
  await expect(current(page).locator("[data-info-card-face]")).toHaveCSS("background-color", "rgb(38, 59, 54)");
  await expect(page.locator(".step-view-layer")).toHaveAttribute("data-personal-mount", "retained");
  const root = await f.info.owner(f.owner, id!); expect(root.kind).toBe("personal"); expect(root.visibility).toBe("private");
  expect((await f.main.getPersonalUser(f.owner))!.cardsData.find(data => data.cardTemplateId === f.cardId)!.personalInfoCardIds).toEqual([id]);
  await page.screenshot({ path: "phase2-test-results/personal-info-open-390.png" });
});

test("shared menu offers only New; new Save, Edit, Cancel and Remove preserve stable selection in one consultation", async ({ page }) => {
  const f = await fixture(true); await enter(page, f.deckId); await open(page);
  await current(page).getByRole("button", { name: "Info Card actions", exact: true }).click();
  await expect(page.getByRole("menuitem")).toHaveText(["+ New"]); await page.getByRole("menuitem", { name: "+ New", exact: true }).click();
  await fill(page, "First personal"); const first = await save(page);
  await page.locator("[data-info-card-stack]").evaluate(node => { (node as HTMLElement).dataset.personalMount = "retained"; });
  await action(page, "+ New"); await fill(page, "Second personal"); const second = await save(page); expect(second).not.toBe(first);
  await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-personal-mount", "retained");
  await action(page, "Edit"); await editor(page).getByRole("textbox", { name: "Title", exact: true }).fill("Edited personal"); await save(page);
  await expect(current(page)).toHaveAttribute("data-info-card-id", second!);
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("Edited personal");
  await action(page, "Edit"); await editor(page).getByRole("textbox", { name: "Title", exact: true }).fill("Cancelled draft");
  await editor(page).getByRole("button", { name: "Cancel", exact: true }).click(); await expect(editor(page)).toHaveCount(0);
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("Edited personal");
  await expect(current(page).getByRole("button", { name: "Info Card actions", exact: true })).toBeFocused();
  await action(page, "Remove"); await expect(current(page)).toHaveAttribute("data-info-card-id", first!);
  await action(page, "Remove"); await expect(current(page)).toHaveAttribute("data-info-card-id", "demo-owner-public");
  await expect(consult(page)).toBeVisible();
  expect((await f.main.getPersonalUser(f.owner))!.cardsData.find(data => data.cardTemplateId === f.cardId)!.personalInfoCardIds).toEqual([]);
  expect((await f.info.drafts(f.owner)).items.some(root => root.infoCardId === second)).toBe(false);
});

test("last Remove shows the true empty plus, remains open, and the pouch can close and reopen", async ({ page }) => {
  const f = await fixture(); await enter(page, f.deckId); await open(page, true);
  await consult(page).getByRole("button", { name: "New personal Info Card", exact: true }).click(); await fill(page, "Only note"); await save(page);
  await action(page, "Remove"); await expect(consult(page).getByRole("button", { name: "New personal Info Card", exact: true })).toBeVisible();
  await expect(page.locator("[data-info-card-stack]")).toHaveCount(0);
  await expect(consult(page).locator("[data-info-card-pouch-count]")).toHaveText("0");
  await consult(page).getByRole("button", { name: "Close information card stack", exact: true }).click(); await expect(consult(page)).toHaveCount(0);
  await open(page, true);
});

test("unfinished personal work recovers through My Drafts on a fresh page and never appears in Library", async ({ page }) => {
  const f = await fixture(); await enter(page, f.deckId); await open(page, true);
  await consult(page).getByRole("button", { name: "New personal Info Card", exact: true }).click(); await fill(page, "Recover personal", "");
  await editor(page).getByRole("button", { name: "Cancel", exact: true }).click(); await expect(editor(page)).toHaveCount(0);
  const root = (await f.info.drafts(f.owner)).items.find(root => root.draft?.title === "Recover personal")!; expect(root).toBeTruthy();
  await page.evaluate(() => sessionStorage.clear()); await page.goto("/creator/new"); await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  await page.getByRole("dialog", { name: "My Drafts", exact: true }).getByRole("button", { name: "Recover personal · Info Card", exact: true }).click();
  await expect(editor(page)).toBeVisible(); await expect(editor(page).getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Recover personal");
  await editor(page).getByRole("textbox", { name: "Explanation", exact: true }).fill("Recovered explanation."); await save(page);
  await page.goto("/library?tab=info-cards"); await expect(page.locator(`[data-info-id="${root.infoCardId}"]`)).toHaveCount(0);
  expect((await f.info.drafts(f.owner)).items.some(item => item.infoCardId === root.infoCardId)).toBe(false);
});

test("personal mutation response loss recovers one Save and keeps normal draft/publication security", async ({ page }) => {
  const f = await fixture(); await enter(page, f.deckId); await open(page, true);
  let lost = false;
  await page.route("**/api/info-cards/*/save", async route => {
    const response = await route.fetch();
    if (!lost) { lost = true; await route.abort(); } else await route.fulfill({ response });
  });
  await consult(page).getByRole("button", { name: "New personal Info Card", exact: true }).click(); await fill(page, "Recover Save");
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page).getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await editor(page).getByRole("button", { name: "Retry", exact: true }).click();
  await editor(page).getByRole("button", { name: "Save", exact: true }).click(); await expect(editor(page)).toHaveCount(0);
  const id = await current(page).getAttribute("data-info-card-id");
  expect(await f.info.versions().countDocuments({ infoCardId: id! })).toBe(1);
  expect((await f.main.getPersonalUser(f.owner))!.cardsData.find(data => data.cardTemplateId === f.cardId)!.personalInfoCardIds).toEqual([id]);
  expect((await page.request.post(`/api/info-cards/${id}/publish`, { data: { revision: 1 } })).status()).toBe(403);
});

test("footer geometry, creator tooltip and menu keyboard/outside isolation at mobile widths", async ({ page }, info) => {
  const f = await fixture(true); await enter(page, f.deckId); await open(page);
  for (const { width, height } of [{ width: 360, height: 844 }, { width: 390, height: 844 }, { width: 430, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const bounds = await current(page).locator("[data-info-card-face]").evaluate(node => {
      const face = node as HTMLElement, box = face.getBoundingClientRect();
      const credit = face.querySelector<HTMLElement>("[data-info-card-creator]")!.getBoundingClientRect();
      const menu = face.querySelector<HTMLElement>("[data-info-card-menu]")!.getBoundingClientRect();
      return { width: face.offsetWidth, height: face.offsetHeight, centreError: Math.abs(credit.left + credit.width / 2 - box.left - box.width / 2),
        separated: credit.top >= menu.bottom, target: menu.width };
    });
    expect(bounds.width).toBe(240); expect(bounds.height).toBe(204); expect(bounds.centreError).toBeLessThan(.1); expect(bounds.separated).toBe(true);
    expect(bounds.target).toBeGreaterThanOrEqual(24); await info.attach(`footer-${width}`, { body: JSON.stringify(bounds), contentType: "application/json" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const author = current(page).getByRole("button", { name: "Card by phase2", exact: true }); await author.click();
  await expect(current(page).getByRole("tooltip")).toHaveText("phase2"); await author.press("Escape");
  await current(page).getByRole("button", { name: "Info Card actions", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "+ New", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(consult(page)).toBeVisible();
  await current(page).getByRole("button", { name: "Info Card actions", exact: true }).click();
  await page.locator('[data-info-card-current="true"] [data-info-card-title]').click();
  await expect(page.getByRole("menu")).toHaveCount(0); await expect(consult(page)).toBeVisible();
});

test("inherited notes Edit and Remove their real source without copied associations or source labels", async ({ page }) => {
  const f = await fixture(), id = randomUUID();
  await f.info.createPersonal(f.owner, id, f.cardId, { deckTemplateId: f.deckId, version: 1, personalInfoRevision: 0 });
  await f.info.save(f.owner, id, 0, { title: "Inherited note", body: "Original personal explanation.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  await f.info.savePersonal(f.owner, id, 1, { deckTemplateId: f.deckId, version: 1, personalInfoRevision: 0 });
  const source = { cardTemplateId: f.cardId, version: 1 }, target = randomUUID(), stepIds = [randomUUID(), randomUUID(), randomUUID()];
  const original = (await f.main.getCardVersion(f.cardId, 1))!.content;
  await f.main.createCardFork(f.owner, { source, cardTemplateId: target, context: { kind: "library" }, stepIds, visibility: "public",
    content: { ...forkCardContent(original, source, stepIds), intro: { ...original.intro, title: "Adapted practice" } } });
  await f.main.publishCard(f.owner, target, 0);
  const d = await f.main.createDeckDraft(f.owner, { ...createDefaultDeckContent([]), title: "Adapted programme", cards: [{ cardTemplateId: target }] }, "public");
  await f.main.publishDeck(f.owner, d.deckTemplateId, 0); await f.main.ensureDeckData(f.owner, d.deckTemplateId, 1);
  await enter(page, d.deckTemplateId); await open(page); await expect(current(page)).toHaveAttribute("data-info-card-id", id);
  await action(page, "Edit"); await editor(page).getByRole("textbox", { name: "Title", exact: true }).fill("Updated inherited"); await save(page);
  expect((await f.info.owner(f.owner, id)).originCardTemplateId).toBe(f.cardId);
  await action(page, "Remove"); await expect(consult(page).getByRole("button", { name: "New personal Info Card", exact: true })).toBeEnabled();
  const user = (await f.main.getPersonalUser(f.owner))!;
  expect(user.cardsData.find(data => data.cardTemplateId === f.cardId)!.personalInfoCardIds).toEqual([]);
  expect(user.cardsData.find(data => data.cardTemplateId === target)!.personalInfoCardIds).toBeUndefined();
  await expect(consult(page)).not.toContainText(/source|ancestor|fork/i);
});

test("personal nested image keeps the selected exact publication and the open pouch", async ({ page }) => {
  const f = await fixture(), id = randomUUID(), context = { deckTemplateId: f.deckId, version: 1, personalInfoRevision: 0 };
  await f.info.createPersonal(f.owner, id, f.cardId, context);
  await f.info.save(f.owner, id, 0, { title: "Personal image", body: "Keep the note available.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  await f.info.savePersonal(f.owner, id, 1, context);
  // Stored media fixture only; no live provider or false verification flag.
  await f.info.versions().updateOne({ infoCardId: id, version: 1 }, { $set: { "content.mediaItem": { id: "image", provider: "cloudflare-r2", mediaType: "image", assetId: "test-image", src: "https://example.invalid/test.png", description: "Image" } } });
  const requested: string[] = [];
  await page.route(`**/api/info-cards/${id}/media?*`, async route => { requested.push(new URL(route.request().url()).searchParams.get("version")!);
    await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5kAAAAASUVORK5CYII=", "base64") }); });
  await enter(page, f.deckId); await open(page); await current(page).getByRole("button", { name: "View image", exact: true }).click();
  const media = page.getByRole("dialog", { name: "Info card media", exact: true }); await expect(media).toBeVisible();
  await media.getByRole("button", { name: /Close/ }).click(); await expect(media).toHaveCount(0);
  await expect(current(page)).toHaveAttribute("data-info-card-id", id); await expect(consult(page)).toBeVisible(); expect(requested).toEqual(["1"]);
});

test("durable Save survives a failed snapshot refresh and retry does not duplicate its attachment", async ({ page }) => {
  const f = await fixture(); await enter(page, f.deckId); await open(page, true);
  await consult(page).getByRole("button", { name: "New personal Info Card", exact: true }).click(); await fill(page, "Saved safely");
  let fail = true;
  await page.route(`**/api/card-templates/${f.cardId}/info-cards?*`, async route => {
    if (fail) await route.fulfill({ status: 503, json: { error: "Temporary read failure" } }); else await route.continue();
  });
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page).getByRole("status").filter({ hasText: "The connection failed. Your local edits are retained" })).toBeVisible();
  const data = (await f.main.getPersonalUser(f.owner))!.cardsData.find(item => item.cardTemplateId === f.cardId)!;
  expect(data.personalInfoCardIds).toHaveLength(1);
  fail = false; await save(page);
  expect((await f.main.getPersonalUser(f.owner))!.cardsData.find(item => item.cardTemplateId === f.cardId)!.personalInfoCardIds).toEqual(data.personalInfoCardIds);
  expect(await f.info.versions().countDocuments({ infoCardId: data.personalInfoCardIds![0] })).toBe(1);
});

test("Remove selects the next surviving prior-order neighbour when another note disappears concurrently", async ({ page }) => {
  const f = await fixture(true), ids = [randomUUID(), randomUUID(), randomUUID()];
  for (const [index, id] of ids.entries()) {
    const context = { deckTemplateId: f.deckId, version: 1, personalInfoRevision: index };
    await f.info.createPersonal(f.owner, id, f.cardId, context);
    await f.info.save(f.owner, id, 0, { title: `Note ${index}`, body: "Original explanation.", seriesId: "demo-series-owner", mediaItem: null }, "private");
    await f.info.savePersonal(f.owner, id, 1, context);
  }
  await enter(page, f.deckId); await open(page); await expect(current(page)).toHaveAttribute("data-info-card-id", ids[2]);
  let removed = false;
  await page.route(`**/api/card-templates/${f.cardId}/info-cards?*`, async route => {
    if (!removed) { removed = true; await f.info.removePersonal(f.owner, f.cardId, ids[1], 4); }
    await route.continue();
  });
  await action(page, "Remove"); await expect(current(page)).toHaveAttribute("data-info-card-id", ids[0]);
  await expect(consult(page).getByRole("button", { name: "Close information cards (2 attached)", exact: true })).toBeVisible();
});

test("personal maths survives Save, reopening and Edit while account changes hide the open private consultation", async ({ page }) => {
  const f = await fixture(); await enter(page, f.deckId); await open(page, true);
  await consult(page).getByRole("button", { name: "New personal Info Card", exact: true }).click(); await fill(page, "My algebra", "Keep $x^2 + 1$ together.");
  const id = await save(page);
  await expect(current(page).locator(".katex").first()).toBeVisible();
  const publication = (await f.info.owner(f.owner, id!)).latestVersion;
  expect((await f.info.versions().findOne({ infoCardId: id!, version: publication }))!.content.bodyFormat).toBe("latex-v1");
  await consult(page).getByRole("button", { name: "Close information card stack", exact: true }).click(); await expect(consult(page)).toHaveCount(0);
  await open(page); await expect(current(page).locator(".katex").first()).toBeVisible();
  await action(page, "Edit"); await expect(editor(page).getByRole("textbox", { name: "Explanation", exact: true })).toHaveValue("Keep $x^2 + 1$ together.");
  await editor(page).getByRole("button", { name: "Cancel", exact: true }).click(); await expect(editor(page)).toHaveCount(0);
  expect((await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } })).ok()).toBeTruthy();
  await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(consult(page)).toHaveCount(0);
});
