import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID, createHmac } from "node:crypto";
import { SignJWT } from "jose";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../../src/lib/cards/forks";
import { mathsHostToken } from "../../src/lib/infoCards/mathsHostAuth";
import { mkdirSync, copyFileSync } from "node:fs";

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
  if (empty) await expect(consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true })).toBeVisible();
  else await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
}
async function action(page: Page, name: "+ New" | "Edit" | "Remove") {
  await current(page).getByRole("button", { name: "Info Card actions", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
// The Personal editor uses an in-page listbox (a native iPhone picker could not stay open in the modal dialog).
async function chooseSeries(page: Page, name = "Basics (phase2)") {
  await editor(page).getByRole("combobox", { name: "Series", exact: true }).click();
  await editor(page).getByRole("option", { name, exact: true }).click();
  await expect(editor(page).getByRole("combobox", { name: "Series", exact: true })).toContainText(name);
}
async function fill(page: Page, title: string, body = "Keep the sign with its number.") {
  await expect(editor(page)).toBeVisible();
  await chooseSeries(page);
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
  await expect(consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true })).toHaveText("Add Personal Info Card");
  await expect(consult(page).getByRole("button", { name: "Close information card stack", exact: true }), "no Close button").toHaveCount(0);
  await expect(page.locator("[data-info-card-face]")).toHaveCount(0);
  await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).click(); await fill(page, "My note");
  await expect(editor(page).getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
  await expect(editor(page).getByRole("combobox", { name: "Creator mode" })).toHaveCount(0);
  const id = await save(page);
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("My note");
  await expect(current(page).locator("[data-info-card-face]")).toHaveCSS("background-color", "rgb(48, 80, 71)");
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

test("last Remove shows the compact empty panel, remains open, and the pouch can close and reopen", async ({ page }) => {
  const f = await fixture(); await enter(page, f.deckId); await open(page, true);
  await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).click(); await fill(page, "Only note"); await save(page);
  await action(page, "Remove"); await expect(consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true })).toBeVisible();
  await expect(page.locator("[data-info-card-stack]")).toHaveCount(0);
  await expect(consult(page).locator("[data-info-card-pouch-count]")).toHaveText("0");
  // Taps are ignored while the Remove is still settling, so wait until the panel is usable.
  await expect(consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true })).toBeEnabled();
  await page.mouse.click(200, 120); await expect(consult(page)).toHaveCount(0);
  await open(page, true);
});

for (const engine of ["chromium", "webkit"] as const) test(`${engine} touch: the empty pouch opens a compact panel, outside tap and Escape dismiss it, and the first Save opens the card`, async ({ playwright }) => {
  const browser = await playwright[engine].launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    const f = await fixture(); await enter(page, f.deckId);
    const panel = consult(page).locator("[data-info-empty-panel]"), add = consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true });
    await page.getByRole("button", { name: /^Open information cards/ }).tap();
    await expect(panel).toHaveAttribute("data-info-empty-phase", "open"); await expect(add).toBeVisible();
    // Compact: a small panel, not a card-sized box, with no card face, stack or Close button.
    const size = await panel.evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }));
    expect(size.width).toBeLessThan(200); expect(size.height).toBeLessThan(100);
    expect((await add.boundingBox())!.height, "comfortable touch target").toBeGreaterThanOrEqual(44);
    await expect(page.locator("[data-info-card-face], [data-info-card-stack]")).toHaveCount(0);
    await expect(consult(page).getByRole("button", { name: "Close information card stack", exact: true })).toHaveCount(0);
    await expect(add).toBeFocused();
    await page.getByRole("button", { name: /^Close information cards \(/ }).tap(); await expect(consult(page)).toHaveCount(0);
    // The panel really animates out of the pouch: sample its transform over the opening.
    await page.evaluate(() => { const samples: string[] = []; (window as unknown as { __samples: string[] }).__samples = samples;
      const tick = () => { const node = document.querySelector("[data-info-empty-panel]"); if (node) samples.push(getComputedStyle(node).transform); if (samples.length < 90) requestAnimationFrame(tick); }; tick(); });
    await page.getByRole("button", { name: /^Open information cards/ }).tap();
    await expect(panel).toHaveAttribute("data-info-empty-phase", "open");
    await expect.poll(() => page.evaluate(() => (window as unknown as { __samples: string[] }).__samples.length)).toBeGreaterThan(50);
    const samples = await page.evaluate(() => (window as unknown as { __samples: string[] }).__samples);
    expect(new Set(samples).size, "the transform changes over the opening").toBeGreaterThan(3);
    expect(samples.at(-1) === "none" || /matrix\(1, 0, 0, 1, 0, 0\)/.test(samples.at(-1)!), "and settles in place").toBe(true);
    // Outside tap dismisses (with the reverse animation); so does Escape.
    await page.touchscreen.tap(200, 120); await expect(consult(page)).toHaveCount(0);
    await page.getByRole("button", { name: /^Open information cards/ }).tap(); await expect(add).toBeVisible();
    await page.keyboard.press("Escape"); await expect(consult(page)).toHaveCount(0);
    // Add opens the existing editor; the first Save opens the new card in the stack's normal opening, focused.
    await page.getByRole("button", { name: /^Open information cards/ }).tap(); await add.tap();
    await fill(page, "First note");
    await editor(page).getByRole("button", { name: "Save", exact: true }).tap(); await expect(editor(page)).toHaveCount(0);
    await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", /^(opening|open)$/);
    await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
    await expect(current(page).locator("[data-info-card-title]")).toHaveText("First note");
    await expect(current(page).getByRole("button", { name: "Info Card actions", exact: true })).toBeFocused();
    await expect(panel).toHaveCount(0);
  } finally { await context.close(); await browser.close(); }
});

test("unfinished personal work recovers through My Drafts on a fresh page and never appears in Library", async ({ page }) => {
  const f = await fixture(); await enter(page, f.deckId); await open(page, true);
  await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).click(); await fill(page, "Recover personal", "");
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
  await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).click(); await fill(page, "Recover Save");
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
        separated: credit.right <= menu.left && credit.top >= box.top && credit.bottom <= box.bottom, target: menu.width };
    });
    expect(bounds.width).toBe(240); expect(bounds.height).toBe(173); expect(bounds.centreError).toBeLessThan(.1); expect(bounds.separated).toBe(true);
    expect(bounds.target).toBeGreaterThanOrEqual(24); await info.attach(`footer-${width}`, { body: JSON.stringify(bounds), contentType: "application/json" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const author = current(page).getByRole("button", { name: "Card by phase2", exact: true });
  // The type label moves down 2.5px towards the credit (gap 6px to 3.5px) while the credit text stays where it was.
  const gap = await current(page).locator("[data-info-card-face]").evaluate(node => {
    const label = node.querySelector<HTMLElement>("[data-info-card-type-label]")!, button = node.querySelector<HTMLElement>("[data-info-card-creator] button")!;
    const scale = node.getBoundingClientRect().width / (node as HTMLElement).offsetWidth, range = document.createRange(); range.selectNodeContents(button);
    const text = range.getBoundingClientRect(), glyphs = document.createRange(); glyphs.selectNodeContents(label);
    return { gap: (text.top - glyphs.getBoundingClientRect().bottom) / scale, textTop: (text.top - node.getBoundingClientRect().top) / scale, buttonTop: (button.getBoundingClientRect().top - node.getBoundingClientRect().top) / scale };
  });
  expect(gap.gap, "gap was 6px; about 40% smaller").toBeGreaterThan(3); expect(gap.gap).toBeLessThan(4);
  expect(gap.textTop - gap.buttonTop, "credit text stays where it was, 6px below its button top").toBeCloseTo(6, 0);
  await author.click(); await expect(current(page).getByRole("tooltip")).toHaveText("phase2");
  await page.locator("[data-info-card-current=\"true\"] [data-info-card-title]").click(); await expect(current(page).getByRole("tooltip"), "outside tap closes the tooltip").toHaveCount(0);
  await author.click(); await expect(current(page).getByRole("tooltip")).toBeVisible(); await author.click(); await expect(current(page).getByRole("tooltip"), "second tap closes").toHaveCount(0);
  await author.click(); await expect(current(page).getByRole("tooltip")).toBeVisible(); await author.press("Escape");
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
  await action(page, "Remove"); await expect(consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true })).toBeEnabled();
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
  await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).click(); await fill(page, "Saved safely");
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
  await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).click(); await fill(page, "My algebra", "Keep $x^2 + 1$ together.");
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

// ---- Series listbox (iPhone dropdown) ----
for (const engine of ["chromium", "webkit"] as const) test(`${engine} touch: the Personal series listbox opens, selects, dismisses and keeps focus in the dialog`, async ({ playwright }) => {
  const browser = await playwright[engine].launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    const f = await fixture(); await enter(page, f.deckId); await open(page, true);
    await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).tap();
    const series = editor(page).getByRole("combobox", { name: "Series", exact: true }), list = editor(page).getByRole("listbox", { name: "Series", exact: true });
    await expect(series).toBeVisible();
    expect(await series.evaluate(node => node.tagName), "no native select, hence no operating-system picker").toBe("BUTTON");
    await expect(series).toHaveAttribute("aria-expanded", "false"); await expect(series).toContainText("Choose a series");

    await series.tap(); await expect(list).toBeVisible(); await expect(series).toHaveAttribute("aria-expanded", "true");
    await expect(list.getByRole("option", { name: "Create a new series…", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.id), "focus stays on the trigger inside the dialog").toBe("info-series");
    // Escape dismisses only the list; the dialog stays open.
    await page.keyboard.press("Escape"); await expect(list).toHaveCount(0); await expect(editor(page)).toBeVisible();
    // Tapping elsewhere in the dialog dismisses it.
    await series.tap(); await expect(list).toBeVisible(); await editor(page).getByRole("heading", { level: 1 }).tap(); await expect(list).toHaveCount(0);
    // Tapping the trigger again toggles it.
    await series.tap(); await expect(list).toBeVisible(); await series.tap(); await expect(list).toHaveCount(0);

    // Selecting by touch updates the field, closes the list, returns focus and enables the title.
    await expect(editor(page).getByRole("textbox", { name: "Title", exact: true })).not.toBeEditable();
    await series.tap(); await list.getByRole("option", { name: "Basics (phase2)", exact: true }).tap();
    await expect(list).toHaveCount(0); await expect(series).toContainText("Basics (phase2)");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("info-series");
    await expect(editor(page).getByRole("textbox", { name: "Title", exact: true })).toBeEditable();

    // Keyboard: arrows move, Enter chooses, the chosen option is marked selected.
    await series.focus(); await page.keyboard.press("ArrowDown"); await expect(list).toBeVisible();
    await expect(list.getByRole("option", { name: "Basics (phase2)", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End"); await page.keyboard.press("Home"); await page.keyboard.press("Enter");
    await expect(list).toHaveCount(0); await expect(series).toContainText("Basics (phase2)");
    // The editor itself still dismisses with Escape only when the list is closed.
    await page.keyboard.press("Escape"); await expect(editor(page)).toHaveCount(0);
  } finally { await context.close(); await browser.close(); }
});

// The whole form is usable by touch after choosing a series: tapping each field focuses it and typing enters text.
for (const engine of ["chromium", "webkit"] as const) test(`${engine} touch: after choosing a series the title and explanation can be tapped and typed into`, async ({ playwright }) => {
  const browser = await playwright[engine].launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    const f = await fixture(); await enter(page, f.deckId); await open(page, true);
    await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).tap();
    const series = editor(page).getByRole("combobox", { name: "Series", exact: true }), list = editor(page).getByRole("listbox", { name: "Series", exact: true });
    const title = editor(page).getByRole("textbox", { name: "Title", exact: true }), body = editor(page).getByRole("textbox", { name: "Explanation", exact: true });
    await series.tap(); await list.getByRole("option", { name: "Basics (phase2)", exact: true }).tap();
    const activeId = () => page.evaluate(() => `${document.activeElement?.tagName}:${(document.activeElement as HTMLInputElement | null)?.labels?.[0]?.textContent ?? document.activeElement?.id}`);
    await title.tap(); expect(await activeId(), "tapping the title focuses it").toMatch(/^INPUT:Title/);
    await page.keyboard.type("Touch title"); await expect(title).toHaveValue("Touch title");
    await body.tap(); expect(await activeId(), "tapping the explanation focuses it").toMatch(/^TEXTAREA:Explanation/);
    await page.keyboard.type("Touch body"); await expect(body).toHaveValue("Touch body");
    await title.tap(); expect(await activeId()).toMatch(/^INPUT:Title/);
  } finally { await context.close(); await browser.close(); }
});

// Checkpoint 5: the stack shows one coloured strip per upcoming card (up to four), so the mixture of
// Creator and Personal cards is visible. Colours and labels follow the approved palette.
const SCREENSHOT_DIR = process.env.CHECKPOINT5_SCREENSHOTS;
for (const engine of ["chromium", "webkit"] as const) test(`${engine} 390x844: mixed stack shows typed strips, labels, palette and compact geometry`, async ({ playwright }) => {
  const browser = await playwright[engine].launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    const f = await fixture(true);
    // Three Creator cards (two seeded and one more) and two Personal cards on the same Card.
    const third = randomUUID();
    await f.info.create(f.owner, third);
    await f.info.save(f.owner, third, 0, { title: "Third creator", body: "A third creator card.", seriesId: "demo-series-owner", mediaItem: null }, "public");
    await f.info.publish(f.owner, third, 1);
    const card = await f.main.createCardDraft(f.owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
      intro: { title: "Mixed stack", description: "Mixed Info Card types.", mediaItem: null }, infoCardIds: ["demo-owner-public", "demo-other-public", third] }, "public");
    await f.main.publishCard(f.owner, card.cardTemplateId, 0);
    const deck = await f.main.createDeckDraft(f.owner, { ...createDefaultDeckContent([]), title: "Mixed programme", cards: [{ cardTemplateId: card.cardTemplateId }] }, "public");
    await f.main.publishDeck(f.owner, deck.deckTemplateId, 0); await f.main.ensureDeckData(f.owner, deck.deckTemplateId, 1);
    for (const name of ["First personal", "Second personal"]) {
      const id = randomUUID(), revision = (await f.main.getPersonalUser(f.owner))!.cardsData.find(data => data.cardTemplateId === card.cardTemplateId)?.personalInfoRevision ?? 0;
      await f.info.createPersonal(f.owner, id, card.cardTemplateId, { deckTemplateId: deck.deckTemplateId, version: 1, personalInfoRevision: revision });
      await f.info.save(f.owner, id, 0, { title: name, body: "A personal note.", seriesId: "demo-series-owner", mediaItem: null }, "private");
      await f.info.savePersonal(f.owner, id, 1, { deckTemplateId: deck.deckTemplateId, version: 1, personalInfoRevision: revision });
    }
    await enter(page, deck.deckTemplateId); await open(page);
    const stack = page.locator("[data-info-card-stack]");
    const faceType = () => current(page).locator("[data-info-card-face]").getAttribute("data-info-card-type");
    const strips = () => stack.locator("[data-info-card-backing]").evaluateAll(nodes => nodes.map(node => ({ type: node.getAttribute("data-strip-type"), offset: Number(node.getAttribute("data-strip-offset")),
      background: getComputedStyle(node).backgroundColor || "", image: getComputedStyle(node).backgroundImage, top: node.getBoundingClientRect().top })));
    const geometry = await current(page).locator("[data-info-card-face]").evaluate(node => {
      const face = node as HTMLElement, header = face.querySelector<HTMLElement>("[data-info-card-header]")!.getBoundingClientRect();
      const footer = face.querySelector<HTMLElement>("[data-info-card-footer]")!.getBoundingClientRect(), box = face.getBoundingClientRect();
      // The Step View scales the pack to the phone width, so measure in the card's own CSS pixels.
      const scale = box.width / face.offsetWidth;
      return { width: face.offsetWidth, height: face.offsetHeight, scale, headerBottom: (header.bottom - box.top) / scale, footerTop: (footer.top - box.top) / scale, footerHeight: Math.round(footer.height / scale) };
    });
    expect(geometry.width).toBe(240); expect(geometry.height).toBe(173); expect(geometry.footerHeight).toBe(41);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight && document.documentElement.scrollWidth <= window.innerWidth), "no page scrolling").toBe(true);
    // Strips: four of the five cards, each 5px further up, and together with the top card the 3+2 mixture.
    const first = await strips(); expect(first).toHaveLength(4);
    expect(first.map(strip => strip.offset)).toEqual([5, 10, 15, 20]);
    const topTop = await current(page).locator("[data-info-card-face]").evaluate(node => node.getBoundingClientRect().top);
    first.forEach((strip, index) => expect(Math.abs(strip.top - (topTop - 5 * geometry.scale * (index + 1))), `strip ${index} sits ${5 * (index + 1)}px above the top card`).toBeLessThan(2));
    const mixture = (list: (string | null)[]) => list.reduce<Record<string, number>>((count, type) => ({ ...count, [type!]: (count[type!] ?? 0) + 1 }), {});
    expect(mixture([await faceType(), ...first.map(strip => strip.type)])).toEqual({ creator: 3, personal: 2 });
    for (const strip of first) {
      if (strip.type === "personal") expect(strip.background).toBe("rgb(48, 80, 71)");
      else expect(strip.image).toContain("linear-gradient");
    }
    // Type labels: visible text, not only colour.
    await expect(current(page).locator("[data-info-card-type-label]")).toHaveText(await faceType() === "personal" ? "Personal" : "Creator");
    if (SCREENSHOT_DIR) { mkdirSync(SCREENSHOT_DIR, { recursive: true }); const shot = test.info().outputPath(`${engine}-mixed-stack.png`); await page.screenshot({ path: shot }); copyFileSync(shot, `${SCREENSHOT_DIR}/${engine}-mixed-stack.png`); }
    // Browsing: tap through every card; the strips keep following the actual upcoming cards.
    const seen: string[] = [];
    for (let step = 0; step < 5; step++) {
      const type = await faceType(); seen.push(type!);
      const list = await strips(); expect(list).toHaveLength(4);
      expect(mixture([type, ...list.map(strip => strip.type)])).toEqual({ creator: 3, personal: 2 });
      await page.keyboard.press("ArrowDown"); await expect(stack).toHaveAttribute("data-info-stack-phase", "open");
    }
    expect(mixture(seen)).toEqual({ creator: 3, personal: 2 });
    // Group Admin fixture: the shared face host renders the third type with the teal palette and white text.
    const host = await context.newPage(); await host.setExtraHTTPHeaders({ "x-info-maths-host": mathsHostToken() });
    await host.goto("/internal/info-maths"); await host.waitForFunction(() => !!(window as unknown as { infoMaths?: unknown }).infoMaths);
    for (const [infoType, label, background, colour] of [["groupAdmin", "Group", "rgb(20, 125, 108)", "rgb(255, 255, 255)"], ["personal", "Personal", "rgb(48, 80, 71)", "rgb(214, 221, 230)"]] as const) {
      await host.evaluate(card => (window as unknown as { infoMaths: { mount(card: object): void } }).infoMaths.mount(card),
        { title: "Typed", seriesTitle: "Basics", seriesCreatorUsername: "x", creatorUsername: "phase2", body: "Plain text body", bodyFormat: "latex-v1", infoType });
      const face = host.locator("[data-info-card-face]"); await expect(face).toHaveAttribute("data-info-card-type", infoType);
      await expect(face).toHaveCSS("background-color", background); await expect(face).toHaveCSS("color", colour);
      await expect(host.locator("[data-info-card-type-label]")).toHaveText(label);
      await expect(host.locator("[data-info-card-title]")).toHaveCSS("color", infoType === "groupAdmin" ? "rgb(255, 255, 255)" : "rgb(240, 242, 246)");
      if (SCREENSHOT_DIR) { const shot = test.info().outputPath(`${engine}-${infoType}-face.png`); await face.screenshot({ path: shot }); copyFileSync(shot, `${SCREENSHOT_DIR}/${engine}-${infoType}-face.png`); }
    }
  } finally { await context.close(); await browser.close(); }
});

// ---- Image upload failure and recovery ----
async function mockInfoUpload(page: Page, outcomes: ("fail-403" | "fail-network" | "ok")[]) {
  const puts: number[] = [];
  await page.route("**/api/info-cards/*/upload", async route => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!;
    const root = (await (await page.request.get(`/api/info-cards/${id}`)).json()).root;
    const media = { id: "image", provider: "cloudflare-r2", mediaType: "image", assetId: `info-cards/${root.ownerUserId}/${id}/image.png`, src: `https://private.invalid/info-cards/${id}/image.png`, description: "Image" };
    const proof = await new SignJWT({ purpose: "info-upload", actor: root.ownerUserId, infoCardId: id, createdAt: root.createdAt, provider: media.provider, assetId: media.assetId, src: media.src })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
      .sign(createHmac("sha256", "local-phase2-browser-test-secret-only").update("switchplay:info-card-upload:v1").digest());
    await route.fulfill({ json: { media, proof, uploadURL: `${new URL(page.url()).origin}/__fixture-info-upload`, headers: { "Content-Type": "image/png", "If-None-Match": "*" } } });
  });
  await page.route("**/__fixture-info-upload", async route => {
    const outcome = outcomes[Math.min(puts.length, outcomes.length - 1)]; puts.push(route.request().postDataBuffer()?.length ?? 0);
    if (outcome === "fail-network") return route.abort("failed");
    return route.fulfill({ status: outcome === "ok" ? 200 : 403 });
  });
  return puts;
}
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const media = (page: Page) => editor(page).getByRole("region", { name: "Info Card media", exact: true });
const choosePicture = (page: Page) => editor(page).getByLabel("Upload Info Card media", { exact: true }).setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: pixel });

for (const failure of ["fail-403", "fail-network"] as const) test(`a failed Personal image upload (${failure}) keeps the work, blocks a false Save, and Retry completes without choosing the file again`, async ({ page }) => {
  const f = await fixture(); await enter(page, f.deckId); const puts = await mockInfoUpload(page, [failure, "ok"]);
  await open(page, true); await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).click();
  await fill(page, "My note", "Words that must survive a failed upload.");
  await choosePicture(page);

  // Clear, accurate feedback; nothing claims success.
  await expect(media(page).getByRole("alert")).toHaveText("The image transfer failed. Retry the upload; your text and previous media are retained.");
  await expect(editor(page).getByRole("status").filter({ hasText: "Text saved; media not uploaded" })).toBeVisible();
  await expect(editor(page).getByText("Media uploaded and saved.")).toHaveCount(0);
  await expect(media(page).getByRole("button", { name: "Retry upload", exact: true })).toBeVisible();
  await expect(media(page).getByRole("button", { name: "Cancel upload", exact: true })).toBeVisible();
  // The work is preserved in the editor and on the server.
  await expect(editor(page).getByRole("textbox", { name: "Explanation", exact: true })).toHaveValue("Words that must survive a failed upload.");
  const saved = async () => (await f.info.owner(f.owner, (await ownDraftId(f)) as string));
  await expect.poll(async () => (await saved()).draft?.body).toBe("Words that must survive a failed upload.");

  // Save is refused, not reported as a success; nothing is attached.
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page).getByText("Finish, retry or cancel the upload before publishing.", { exact: true })).toBeVisible();
  await expect(editor(page)).toBeVisible();
  expect((await f.main.getPersonalUser(f.owner))!.cardsData.find(data => data.cardTemplateId === f.cardId)?.personalInfoCardIds ?? []).toEqual([]);
  // Leaving is refused with an accurate explanation, not a misleading connection error.
  await editor(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor(page).getByText(/^The upload failed\. Retry it, or choose Cancel upload to leave without the media\. Your text is saved\.$/)).toBeVisible();
  await expect(editor(page).getByText(/connection failed/)).toHaveCount(0);
  await expect(editor(page)).toBeVisible();

  // Retry re-sends the same file with no new selection.
  await media(page).getByRole("button", { name: "Retry upload", exact: true }).click();
  await expect(editor(page).getByText("Media uploaded and saved.", { exact: true })).toBeVisible();
  await expect(media(page).getByRole("alert")).toHaveCount(0); await expect(media(page).getByRole("button", { name: "Retry upload", exact: true })).toHaveCount(0);
  await expect(media(page).getByText("Image attached", { exact: true })).toBeVisible();
  expect(puts).toHaveLength(2); expect(puts[1]).toBe(puts[0]);
  expect((await saved()).draft?.mediaItem?.mediaType).toBe("image");
  // With the transfer done, Save is no longer refused by the upload guard. (Whether the note then publishes
  // depends on live object verification of the image, which the disposable harness cannot provide.)
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page).getByText("Finish, retry or cancel the upload before publishing.", { exact: true })).toHaveCount(0);
});

test("after a failed Personal upload, Cancel upload releases the editor and keeps the saved text", async ({ page }) => {
  const f = await fixture(); await enter(page, f.deckId); await mockInfoUpload(page, ["fail-403"]);
  await open(page, true); await consult(page).getByRole("button", { name: "Add Personal Info Card", exact: true }).click();
  await fill(page, "Draft note", "Text kept after dismissing the failed image.");
  await choosePicture(page); await expect(media(page).getByRole("alert")).toBeVisible();
  await media(page).getByRole("button", { name: "Cancel upload", exact: true }).click();
  await expect(media(page).getByRole("alert")).toHaveCount(0); await expect(media(page).getByRole("button", { name: "Retry upload", exact: true })).toHaveCount(0);
  await expect(editor(page).getByRole("textbox", { name: "Explanation", exact: true })).toHaveValue("Text kept after dismissing the failed image.");
  await editor(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  const draft = await f.info.owner(f.owner, (await ownDraftId(f)) as string);
  expect(draft.draft?.body).toBe("Text kept after dismissing the failed image."); expect(draft.draft?.mediaItem ?? null).toBeNull();
});
async function ownDraftId(f: Awaited<ReturnType<typeof fixture>>) {
  const root = await f.info.roots().find({ ownerUserId: f.owner, kind: "personal" }).sort({ createdAt: -1 }).limit(1).next();
  return root?.infoCardId as string | undefined;
}
