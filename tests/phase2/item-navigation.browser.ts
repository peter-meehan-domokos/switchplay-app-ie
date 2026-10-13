import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { cardFixture, deckFixture } from "../fixtures/frameworks";
import { itemFixtureRoutes } from "./helpers/assessmentFixtureRoutes";
import type { Framework } from "../../src/lib/frameworks/configuration";

async function fixture(page: Page, mode: "multi" | "single" | "archived" = "multi") {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect(), repo = new CardRepository(client.db(process.env.MONGODB_DB!), client);
  const actor = new ObjectId(), owner = new ObjectId(), username = `item-navigation-${randomUUID()}`;
  const original = cardFixture(randomUUID()), fork = cardFixture(randomUUID(), original.root.cardTemplateId),
    nested = cardFixture(randomUUID(), fork.root.cardTemplateId), library = cardFixture(randomUUID()), unmapped = cardFixture(randomUUID()), orphan = cardFixture(randomUUID());
  const cards = [original, fork, nested, library, unmapped, orphan];
  for (const card of cards) { card.root.ownerUserId = owner.toHexString(); card.root.visibility = card.version.visibility = "public"; }
  original.version.content.intro.title = fork.version.content.intro.title = "Shared practice";
  nested.version.content.intro.title = "Nested practice"; library.version.content.intro.title = "Library only Card";
  original.version.content.intro.description = "A calm description of the learning action.";
  original.version.content.steps.forEach((step, index) => { step.title = `Action ${index + 1}`; step.description = `Take this practical action ${index + 1}.`; });
  const current = structuredClone(original.version); current.version = 2; current.content.intro.title = "Current public practice"; original.root.latestVersion = 2;
  const active = deckFixture(randomUUID(), [unmapped.root.cardTemplateId, original.root.cardTemplateId, ...(mode === "single" ? [] : [fork.root.cardTemplateId])]);
  const other = deckFixture(randomUUID(), [original.root.cardTemplateId]), archived = deckFixture(randomUUID(), [unmapped.root.cardTemplateId, nested.root.cardTemplateId], true),
    published = deckFixture(randomUUID(), [original.root.cardTemplateId, fork.root.cardTemplateId, library.root.cardTemplateId]);
  const decks = [active, other, archived, published];
  for (const [index, deck] of decks.entries()) { deck.root.ownerUserId = owner.toHexString(); deck.root.visibility = deck.version.visibility = "public"; deck.version.content.title = ["Active Path", "Second Path", "Archived Path", "Public Path"][index]; }
  active.data.activeCardId = unmapped.root.cardTemplateId;
  if (mode !== "multi") for (const deck of [active, other, archived, published]) {
    if (mode === "single" ? deck !== active : deck !== archived) deck.root.visibility = "private";
  }
  const memberships = mode === "single" ? [active.data] : mode === "archived" ? [archived.data] : [active.data, other.data, archived.data];
  await repo.cards().insertMany(cards.map((card) => card.root)); await repo.cardVersions().insertMany([...cards.map((card) => card.version), current]);
  await repo.decks().insertMany(decks.map((deck) => deck.root)); await repo.deckVersions().insertMany(decks.map((deck) => deck.version));
  const users = [{ _id: actor, username, email: `${username}@example.invalid`, passwordHash: hashSync("local-test-only", 4),
    cardsData: cards.filter((card) => card !== library).map((card) => ({ ...card.data, reflection: "PRIVATE PERSONAL REFLECTION" })), decksData: memberships, itemTests: [], itemTestsRevision: 0, createdAt: new Date(), updatedAt: new Date() },
    { _id: owner, username: "Maths mentor", cardsData: [{ ...original.data, reflection: "FOREIGN PRIVATE REFLECTION" }], decksData: [] }];
  await repo.users().insertMany(users);
  const frameworks: Framework[] = [{ id: "item-maths", title: "Item Maths", areas: [{ id: "algebra", title: "Algebra", items: [
    { id: "item-core", title: "Practice", cardTemplateIds: [original.root.cardTemplateId] },
    { id: "item-public", title: "Library practice", cardTemplateIds: [library.root.cardTemplateId] },
    { id: "item-empty", title: "Empty Item", cardTemplateIds: [] },
    { id: "item-orphan", title: "Standalone", cardTemplateIds: [orphan.root.cardTemplateId] },
  ] }, ...Array.from({ length: 10 }, (_, index) => ({ id: `extra-${index}`, title: `Extra ${index}`, items: [{ id: `item-extra-${index}`, title: "Unmapped", cardTemplateIds: [] }] }))] }];
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).status()).toBe(200);
  await itemFixtureRoutes(page, repo, actor.toHexString(), frameworks);
  return { client, repo, actor: actor.toHexString(), owner, original, fork, nested, library, active, other, archived, published };
}
async function dispose(page: Page, f: Awaited<ReturnType<typeof fixture>>) {
  await page.unrouteAll({ behavior: "wait" });
  const decks = (await f.repo.decks().find({ ownerUserId: f.owner.toHexString() }).toArray()).map((deck) => deck.deckTemplateId);
  const cards = (await f.repo.cards().find({ ownerUserId: f.owner.toHexString() }).toArray()).map((card) => card.cardTemplateId);
  await f.repo.deckVersions().deleteMany({ deckTemplateId: { $in: decks } }); await f.repo.decks().deleteMany({ deckTemplateId: { $in: decks } });
  await f.repo.cardVersions().deleteMany({ cardTemplateId: { $in: cards } }); await f.repo.cards().deleteMany({ cardTemplateId: { $in: cards } });
  await f.repo.users().deleteMany({ _id: { $in: [new ObjectId(f.actor), f.owner] } }); await f.client.close();
}
const dialog = (page: Page, title = "Practice") => page.getByRole("dialog", { name: title, exact: true });
async function show(page: Page, item = "item-core", title = "Practice") {
  await page.goto("/progress"); await page.locator(`tr[data-item-id="${item}"] .progress-content-title`).click();
  await expect(dialog(page, title)).toBeVisible(); await expect(dialog(page, title).getByText("Loading Cards…", { exact: true })).toHaveCount(0);
}
const card = (page: Page, id: string, title = "Practice") => dialog(page, title).locator(`[data-card-template-id="${id}"]`);

test("one Card opens its visual modal first, targets the selected working Card and refreshes saved completion on return", async ({ page }) => {
  const f = await fixture(page, "single");
  try {
    const before = await f.repo.getPersonalUser(f.actor); await show(page);
    await expect(dialog(page).locator(".active-card-front")).toHaveCount(1);
    await expect(dialog(page)).toContainText("Take this practical action 1.");
    await expect(card(page, f.original.root.cardTemplateId)).toContainText("My Decks · Active Path");
    await expect(card(page, f.original.root.cardTemplateId)).not.toContainText("Version 1");
    await expect(page).toHaveURL(/\/progress$/); expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await card(page, f.original.root.cardTemplateId).getByRole("button", { name: "Choose Shared practice", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Active Path");
    await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Shared practice");
    expect((await f.repo.getPersonalUser(f.actor))!.decksData[0].activeCardId).toBe(f.original.root.cardTemplateId);
    await page.locator(".deck-card.is-active").press("Enter");
    await page.getByRole("button", { name: "Update step progress. Current status: todo", exact: true }).first().click();
    await expect.poll(async () => (await f.repo.getPersonalUser(f.actor))!.cardsData.find((value) => value.cardTemplateId === f.original.root.cardTemplateId)!.items[0].completionStatus).toBe("inProgress");
    await page.getByRole("button", { name: "Update step progress. Current status: inProgress", exact: true }).first().click();
    await expect.poll(async () => (await f.repo.getPersonalUser(f.actor))!.cardsData.find((value) => value.cardTemplateId === f.original.root.cardTemplateId)!.items[0].completionStatus).toBe("done");
    await page.getByRole("button", { name: "Close focused card", exact: true }).press("Enter");
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("item-maths");
    await expect(page.locator('tr[data-item-id="item-core"] td').first()).toHaveText("33%");
  } finally { await dispose(page, f); }
});

test("original/forks remain separate visuals, one Card exposes multiple visual Deck contexts and each context keeps its Card version", async ({ page }) => {
  const f = await fixture(page);
  try {
    const before = await f.repo.getPersonalUser(f.actor); await show(page);
    await expect(dialog(page).locator(".active-card-front")).toHaveCount(3);
    await expect(dialog(page).getByRole("button", { name: "Choose Shared practice", exact: true })).toHaveCount(2);
    await expect(card(page, f.original.root.cardTemplateId)).toContainText("Choose a Deck · Different versions available");
    await expect(card(page, f.original.root.cardTemplateId)).not.toContainText("Version 1");
    await expect(card(page, f.original.root.cardTemplateId)).not.toContainText("Active Path");
    await card(page, f.original.root.cardTemplateId).getByRole("button").click();
    await expect(dialog(page).locator(".deck-tile")).toHaveCount(3);
    await expect(dialog(page).locator(`[data-context="library"][data-deck-template-id="${f.active.root.deckTemplateId}"]`)).toHaveCount(0);
    await expect(dialog(page).locator('[data-context="library"] .deck-tile-meta-confidence')).toHaveCount(0);
    await expect(dialog(page)).toContainText("Card version 2"); expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await dialog(page).getByRole("button", { name: "Open Library Public Path", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Public Path");
    await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Current public practice");
    await expect(page.getByRole("button", { name: "Add to My Decks", exact: true })).toBeEnabled();
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await page.locator('tr[data-item-id="item-core"] .progress-content-title').click();
    await card(page, f.original.root.cardTemplateId).getByRole("button").click();
    await dialog(page).getByRole("button", { name: "Open Second Path", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Second Path");
    await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Shared practice");
  } finally { await dispose(page, f); }
});

test("archived-only selection requires explicit Restore and open and targets the selected Card without advancing adoption", async ({ page }) => {
  const f = await fixture(page, "archived");
  try {
    const before = await f.repo.getPersonalUser(f.actor); await show(page);
    await card(page, f.nested.root.cardTemplateId).getByRole("button", { name: "Choose Nested practice", exact: true }).click();
    await expect(dialog(page).getByRole("button", { name: "Restore and open", exact: true })).toBeVisible();
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await dialog(page).getByRole("button", { name: "Restore and open", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Archived Path");
    await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Nested practice");
    const user = (await f.repo.getPersonalUser(f.actor))!, membership = user.decksData[0];
    expect(membership.archivedAt).toBeNull(); expect(membership.activeCardId).toBe(f.nested.root.cardTemplateId);
    expect(user.cardsData.find((card) => card.cardTemplateId === f.nested.root.cardTemplateId)!.cardTemplateVersion).toBe(1);
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("item-maths");
  } finally { await dispose(page, f); }
});

test("Library-only Card opens at its exact non-first public position without importing; invalid Library target never opens another Card", async ({ page }) => {
  const f = await fixture(page);
  try {
    const before = await f.repo.getPersonalUser(f.actor); await show(page, "item-public", "Library practice");
    await expect(dialog(page, "Library practice").locator(".active-card-front")).toHaveCount(1);
    await card(page, f.library.root.cardTemplateId, "Library practice").getByRole("button", { name: "Choose Library only Card", exact: true }).press("Enter");
    await expect(page.locator(".deck-detail h1")).toHaveText("Public Path");
    await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Library only Card");
    await expect(page.getByRole("button", { name: "Add to My Decks", exact: true })).toBeEnabled();
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("item-maths");
    await page.goto(`/library/${f.published.root.deckTemplateId}?openCard=nonexistent&progressFramework=item-maths&progressArea=algebra`);
    await expect(page.getByRole("heading", { name: "Unavailable Card", exact: true })).toBeVisible();
    await expect(page.locator(".deck-card")).toHaveCount(0); expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
  } finally { await dispose(page, f); }
});

test("empty and standalone mappings never create destinations; incomplete data keeps available visuals and explicit warning", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto("/progress");
    const empty = page.locator('tr[data-item-id="item-empty"]');
    await expect(empty.locator(".progress-content-title")).toBeDisabled();
    await empty.locator(".progress-tests-trigger").click();
    await expect(page.getByRole("dialog", { name: "Assessment history", exact: true })).toBeVisible();
    await page.getByRole("dialog", { name: "Assessment history", exact: true }).getByRole("button", { name: "Close", exact: true }).click();
    await show(page, "item-orphan", "Standalone");
    await expect(dialog(page, "Standalone")).toContainText("No Cards are available through accessible Decks");
    await expect(dialog(page, "Standalone").locator(".active-card-front")).toHaveCount(0);
    await f.repo.cardVersions().deleteOne({ cardTemplateId: f.original.root.cardTemplateId, version: 1 });
    await show(page); await expect(dialog(page)).toContainText("Some Card destinations are unavailable");
    await expect(dialog(page).locator(".active-card-front")).not.toHaveCount(0);
    await expect(dialog(page)).not.toContainText("No Cards are available through accessible Decks");
    await f.repo.cardVersions().deleteMany({ cardTemplateId: { $in: [f.original, f.fork, f.nested, f.library].map((card) => card.root.cardTemplateId) } });
    await dialog(page).getByRole("button", { name: "Refresh Cards", exact: true }).click();
    await expect(dialog(page)).toContainText("No Card destinations can currently be shown.");
    await expect(dialog(page)).not.toContainText("Available choices are shown.");
    await expect(dialog(page).locator(".active-card-front")).toHaveCount(0);
  } finally { await dispose(page, f); }
});

test("configured mappings alone style and enable Item titles, including missing sources; unmapped Tests cells remain usable", async ({ page }, info) => {
  const f = await fixture(page);
  try {
    let discoveries = 0;
    page.on("request", (request) => { if (request.url().includes("/destinations?")) discoveries++; });
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await page.goto("/progress");
      const mapped = page.locator('tr[data-item-id="item-core"] .progress-content-title');
      const empty = page.locator('tr[data-item-id="item-empty"] .progress-content-title');
      await expect(mapped).toBeEnabled(); await expect(empty).toBeDisabled();
      const areaTitle = page.locator('tr[data-area-id="algebra"] .progress-content-title');
      const unmappedAreaTitle = page.locator('tr[data-area-id="extra-0"] .progress-content-title');
      await expect(areaTitle).toBeEnabled(); await expect(areaTitle).toHaveCSS("cursor", "pointer");
      await expect(areaTitle).toHaveCSS("font-weight", "500"); await expect(areaTitle).toHaveCSS("opacity", "1");
      await expect(unmappedAreaTitle).toBeDisabled(); await expect(unmappedAreaTitle).toHaveCSS("cursor", "default");
      await expect(unmappedAreaTitle).toHaveCSS("opacity", "0.85");
      const toggle = page.locator('tr[data-area-id="extra-0"] .progress-area-toggle');
      await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(mapped).toHaveCSS("cursor", "pointer"); await expect(mapped).toHaveCSS("font-weight", "500");
      await expect(mapped).toHaveCSS("opacity", "1"); await expect(empty).toHaveCSS("cursor", "default");
      await expect(empty).toHaveCSS("opacity", "0.85");
      await mapped.hover(); await expect(mapped).toHaveCSS("text-decoration-line", "underline");
      await mapped.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
      await expect(mapped).toHaveCSS("outline-style", "solid");
      await page.screenshot({ path: info.outputPath(`progress-titles-${width}.png`), fullPage: true });
    }
    expect(discoveries).toBe(0); // No destination queries for title styling, including inherited forks.
    await f.repo.cards().deleteOne({ cardTemplateId: f.original.root.cardTemplateId });
    await page.reload(); const mapped = page.locator('tr[data-item-id="item-core"] .progress-content-title');
    await expect(page.locator('tr[data-area-id="algebra"] .progress-content-title')).toBeEnabled();
    await expect(mapped).toBeEnabled(); await mapped.click();
    await expect(dialog(page)).toContainText("Some Card destinations are unavailable");
    // Opening may mount the read effect twice in development Strict Mode.
    expect(discoveries).toBeGreaterThan(0);
  } finally { await dispose(page, f); }
});

test("version changes after selection revalidation cannot silently open a newer working or Library Card", async ({ page }) => {
  const f = await fixture(page, "single");
  try {
    await show(page);
    await page.route("**/api/decks-data", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $set: { "cardsData.$[card].cardTemplateVersion": 2 } },
        { arrayFilters: [{ "card.cardTemplateId": f.original.root.cardTemplateId }] });
      return route.continue();
    });
    await card(page, f.original.root.cardTemplateId).getByRole("button").click();
    await expect(page.locator("main").getByRole("alert")).toContainText("selected Card version changed");
    await expect(page.locator(".deck-detail")).toHaveCount(0);
    const membership = (await f.repo.getPersonalUser(f.actor))!.decksData[0];
    expect(membership.activeCardId).toBe(f.active.data.activeCardId); expect(membership.openedAt).toBeNull();
    await page.goto(`/library/${f.active.root.deckTemplateId}?openCard=${f.original.root.cardTemplateId}&cardVersion=1&progressFramework=item-maths&progressArea=algebra`);
    await expect(page.getByRole("heading", { name: "Unavailable Card", exact: true })).toBeVisible();
    await expect(page.locator(".deck-card")).toHaveCount(0);
  } finally { await dispose(page, f); }
});

test("stale membership/Card targets and inaccessible Library destinations require refresh rather than substitution", async ({ page }) => {
  const f = await fixture(page);
  try {
    await show(page); await card(page, f.original.root.cardTemplateId).getByRole("button").click();
    await f.repo.archiveDeckData(f.actor, f.other.root.deckTemplateId);
    await dialog(page).getByRole("button", { name: "Open Second Path", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("no longer available");
    await expect(page).toHaveURL(/\/progress$/);
    await dialog(page).getByRole("button", { name: "Refresh Cards", exact: true }).click();
    await card(page, f.original.root.cardTemplateId).getByRole("button").click();
    await f.repo.decks().updateOne({ deckTemplateId: f.published.root.deckTemplateId }, { $set: { visibility: "private" } });
    await dialog(page).getByRole("button", { name: "Open Library Public Path", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("no longer available");
    expect((await f.repo.getPersonalUser(f.actor))!.decksData.some((deck) => deck.deckTemplateId === f.published.root.deckTemplateId)).toBe(false);
  } finally { await dispose(page, f); }
});

for (const width of [320, 390, 1440]) test(`Item static Card fronts, internal Back scroll/focus and responsive keyboard selection at ${width}px`, async ({ page }, info) => {
  const f = await fixture(page);
  try {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    const before = await f.repo.getPersonalUser(f.actor); let mediaRequests = 0;
    page.on("request", (request) => { if (/\/api\/media\/stream\/status|\/manifest\/video/.test(request.url())) mediaRequests++; });
    await show(page); const modal = dialog(page);
    await expect(modal.locator("video, .card-assessment-indicator, a[href], .card-creator-attribution button, .active-step-item[role=button]")).toHaveCount(0);
    const fronts = modal.locator(".active-card-front"); expect(await fronts.count()).toBe(3);
    const appearance = await card(page, f.original.root.cardTemplateId).locator("article").evaluate((element) => {
      const creator = element.querySelector(".card-creator-name")!.getBoundingClientRect(), outer = element.getBoundingClientRect();
      return { creatorText: element.querySelector(".card-creator-name")!.textContent,
        creatorInside: creator.left >= outer.left && creator.right <= outer.right,
        creatorCenter: Math.abs((creator.left + creator.right) / 2 - (outer.left + outer.right) / 2),
        labelSize: parseFloat(getComputedStyle(element.querySelector(".card-title-anchor h2")!).fontSize) };
    });
    expect(appearance.creatorText).toBe("Maths mentor"); expect(appearance.creatorInside).toBe(true);
    expect(appearance.creatorCenter).toBeLessThan(1); expect(appearance.labelSize).toBeLessThan(15);
    const sizing = await card(page, f.original.root.cardTemplateId).locator("article").evaluate((element) => {
      const outer = element.getBoundingClientRect(), list = element.parentElement!.parentElement!, rect = list.getBoundingClientRect();
      return { width: outer.width, expected: Math.min(rect.width, 320) * .95,
        center: Math.abs(outer.left + outer.width / 2 - rect.left - rect.width / 2), zoom: getComputedStyle(element).zoom };
    });
    expect(Math.abs(sizing.width - sizing.expected)).toBeLessThan(1);
    expect(sizing.center).toBeLessThan(1); expect(sizing.zoom).toBe("0.95");
    await expect(card(page, f.original.root.cardTemplateId).locator("..")).toHaveCSS("padding-top", "12px");
    await expect(card(page, f.original.root.cardTemplateId).locator("p").last()).toHaveCSS("padding-top", "8px");
    const rectangles = await fronts.evaluateAll((elements) => elements.map((element) => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, bottom: rect.bottom }; }));
    expect(rectangles[1].y).toBeGreaterThan(rectangles[0].bottom); expect(rectangles[1].x).toBe(rectangles[0].x);
    expect(await modal.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`item-cards-${width}.png`), fullPage: true });
    const select = card(page, f.fork.root.cardTemplateId).getByRole("button");
    await select.focus(); const savedScroll = await modal.evaluate((element) => element.scrollTop); expect(savedScroll).toBeGreaterThan(0);
    await select.press("Enter"); await expect(modal.getByRole("button", { name: "Back to Cards", exact: true })).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.screenshot({ path: info.outputPath(`item-contexts-${width}.png`), fullPage: true });
    await modal.getByRole("button", { name: "Back to Cards", exact: true }).press("Enter");
    await expect(select).toBeFocused(); await expect.poll(() => modal.evaluate((element) => element.scrollTop)).toBe(savedScroll);
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before); expect(mediaRequests).toBe(0);
    await page.keyboard.press("Escape"); await expect(page.locator('tr[data-item-id="item-core"] .progress-content-title')).toBeFocused();
  } finally { await dispose(page, f); }
});

test("the same Card across all three contexts appears once and archived Deck selection requires explicit targeted restoration", async ({ page }) => {
  const f = await fixture(page);
  try {
    await f.repo.deckVersions().updateOne({ deckTemplateId: f.archived.root.deckTemplateId, version: 1 },
      { $push: { "content.cards": { cardTemplateId: f.original.root.cardTemplateId, cardVersionAtPublish: 1 } } });
    const before = await f.repo.getPersonalUser(f.actor); await show(page);
    await expect(card(page, f.original.root.cardTemplateId)).toHaveCount(1);
    await card(page, f.original.root.cardTemplateId).getByRole("button").click();
    await expect(dialog(page).locator(".deck-tile")).toHaveCount(4);
    for (const kind of ["active", "archived", "library"]) await expect(dialog(page).locator(`[data-context="${kind}"]`).first()).toBeVisible();
    await expect(dialog(page).locator(`[data-context="library"][data-deck-template-id="${f.archived.root.deckTemplateId}"]`)).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Select archived Archived Path", exact: true }).click();
    await expect(dialog(page).getByRole("button", { name: "Restore and open", exact: true })).toBeVisible();
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await dialog(page).getByRole("button", { name: "Restore and open", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Archived Path");
    await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Shared practice");
    expect((await f.repo.getPersonalUser(f.actor))!.decksData.find((deck) => deck.deckTemplateId === f.archived.root.deckTemplateId)!.activeCardId).toBe(f.original.root.cardTemplateId);
  } finally { await dispose(page, f); }
});
