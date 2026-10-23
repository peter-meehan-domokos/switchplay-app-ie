import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB!);
const root = (id: string) => db().collection("cardTemplates").findOne({ cardTemplateId: id });
const card = (page: Page, id: string) => page.locator(`.creator-column[data-card-template-id="${id}"]`);
function gate() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }
async function open(page: Page) {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/creator/new"); await expect(page.getByRole("button", { name: "Add card", exact: true })).toBeVisible();
}
async function add(page: Page, title = "Useful Card") {
  const count = await page.locator(".creator-column[data-card-template-id]").count();
  await page.getByRole("button", { name: "Add card", exact: true }).click(); await expect(page.locator(".creator-column[data-card-template-id]")).toHaveCount(count + 1);
  const id = (await page.locator(".creator-column[data-card-template-id]").last().getAttribute("data-card-template-id"))!;
  await expect.poll(async () => !!await root(id)).toBe(true);
  await card(page, id).locator(".creator-card-title-button").click(); await page.locator(".creator-modal textarea").fill(title);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await root(id))?.draft?.intro.title).toBe(title); return id;
}
async function title(page: Page, text = "Public programme") {
  await page.getByRole("button", { name: "Edit deck title and introduction" }).click(); await page.locator(".creator-modal textarea").fill(text);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
}
const publicDialog = (page: Page) => page.getByRole("dialog", { name: "Confirm public publication" });
async function leaveDialog(page: Page) {
  await page.getByRole("link", { name: "Decks", exact: true }).click();
  await page.getByRole("dialog", { name: "Leave Creator confirmation" }).getByRole("button", { name: "Publish and leave", exact: true }).click();
}

test("empty Deck public intent stays private until confirmed publication; Cancel retains draft and no membership is created", async ({ page }) => {
  await open(page); await expect(page.getByRole("button", { name: "Publish Deck", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public");
  await expect(page).toHaveURL(/\/creator\/edit\//); const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect.poll(async () => (await db().collection("deckTemplates").findOne({ deckTemplateId: id }))?.draftVisibility).toBe("public");
  expect((await db().collection("deckTemplates").findOne({ deckTemplateId: id }))!.visibility).toBe("private");
  expect((await page.request.get(`/api/library/decks/${id}`)).status()).toBe(403);
  await title(page); const publish = page.getByRole("button", { name: "Publish Deck", exact: true }); await expect(publish).toBeEnabled(); await publish.click();
  await expect(publicDialog(page)).toContainText("0 Cards and 1 Deck"); await expect(publicDialog(page)).toContainText("cannot be made private again");
  await publicDialog(page).getByRole("button", { name: "Cancel", exact: true }).click(); expect(await db().collection("deckTemplateVersions").countDocuments({ deckTemplateId: id })).toBe(0);
  await publish.click(); await publicDialog(page).getByRole("button", { name: "Publish publicly", exact: true }).click(); await expect(publish).toHaveText("Published");
  await expect(page.getByRole("combobox", { name: "Deck publication visibility" })).toBeDisabled();
  const preview = await (await page.request.get(`/api/library/decks/${id}`)).json(); expect(preview.manifest).toEqual({ deckTemplateId: id, deckVersion: 1, cards: [] });
  expect(await db().collection("users").countDocuments({ "decksData.deckTemplateId": id })).toBe(0);
  await title(page, "Next public version"); await expect(publish).toBeEnabled(); await publish.click(); await expect(publish).toHaveText("Published"); await expect(publicDialog(page)).toHaveCount(0);
  expect(await db().collection("deckTemplateVersions").countDocuments({ deckTemplateId: id })).toBe(2);
});

test("in-flight Card edits coalesce with public intent; Publish and leave waits then confirms Cards before Deck", async ({ page }) => {
  await open(page); const id = await add(page); await title(page);
  const held = gate(); let started = false;
  await page.route(`**/api/card-templates/${id}`, async (route) => {
    if (route.request().method() === "PATCH" && route.request().postDataJSON().type === "save") { started = true; await held.promise; }
    await route.continue();
  });
  await card(page, id).getByRole("combobox", { name: "Card 1 publication visibility" }).selectOption("public");
  await expect.poll(() => started).toBe(true);
  await card(page, id).locator(".creator-pair-step").first().click(); await page.locator(".creator-modal textarea").fill("Newest instruction before public publication");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public");
  await page.getByRole("link", { name: "Decks", exact: true }).click(); await expect(page.locator(".creator-navigation-status")).toContainText("Finishing saves and uploads");
  await expect(publicDialog(page)).toHaveCount(0); held.resolve();
  await page.getByRole("dialog", { name: "Leave Creator confirmation" }).getByRole("button", { name: "Publish and leave", exact: true }).click();
  await expect(publicDialog(page)).toContainText("1 Card and 1 Deck");
  expect((await root(id))!.visibility).toBe("private"); expect((await root(id))!.draft.steps[0].description).toBe("Newest instruction before public publication");
  await publicDialog(page).getByRole("button", { name: "Publish publicly", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/); expect((await root(id))!.visibility).toBe("public");
  expect((await db().collection("cardTemplateVersions").findOne({ cardTemplateId: id, version: 1 }))!.content.steps[0].description).toBe("Newest instruction before public publication");
});

test("public Deck lock explains private Cards; explicit Card publication preserves private-era versions", async ({ page }) => {
  await open(page); const id = await add(page); await title(page);
  const cardPublish = card(page, id).getByRole("button", { name: "Publish Card 1", exact: true }); await expect(cardPublish).toBeEnabled(); await cardPublish.click(); await expect(cardPublish).toHaveText("Published");
  await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public");
  const deckPublish = page.getByRole("button", { name: "Publish Deck", exact: true }); await expect(deckPublish.getByRole("img", { name: "Publication blocked" })).toBeVisible();
  await deckPublish.click(); await expect(page.getByRole("dialog", { name: "Publication blocked" })).toContainText("published publicly");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect((await root(id))!.visibility).toBe("private");
  await card(page, id).getByRole("combobox", { name: "Card 1 publication visibility" }).selectOption("public");
  await expect(cardPublish).toBeEnabled(); await cardPublish.click(); await expect(publicDialog(page)).toContainText("1 Card and 0 Decks");
  await publicDialog(page).getByRole("button", { name: "Publish publicly", exact: true }).click(); await expect(cardPublish).toHaveText("Published");
  expect((await db().collection("cardTemplateVersions").findOne({ cardTemplateId: id, version: 1 }))!.visibility).toBe("private");
  await expect(card(page, id).getByRole("combobox", { name: "Card 1 publication visibility" })).toBeDisabled();
  await expect(deckPublish.getByRole("img", { name: "Publication blocked" })).toHaveCount(0); await deckPublish.click();
  await expect(publicDialog(page)).toContainText("0 Cards and 1 Deck"); await publicDialog(page).getByRole("button", { name: "Publish publicly", exact: true }).click(); await expect(deckPublish).toHaveText("Published");
  const deckId = new URL(page.url()).pathname.split("/").at(-1)!; const preview = await (await page.request.get(`/api/library/decks/${deckId}`)).json(); expect(preview.manifest.cards).toEqual([{ cardTemplateId: id, version: 2 }]);
});

test("partial Publish and leave retry retains public Card success and confirms only remaining first-public entities", async ({ page }) => {
  await open(page); const a = await add(page, "A"), b = await add(page, "B"); await title(page);
  await card(page, a).getByRole("combobox", { name: "Card 1 publication visibility" }).selectOption("public");
  await card(page, b).getByRole("combobox", { name: "Card 2 publication visibility" }).selectOption("public");
  await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public");
  await page.route(`**/api/card-templates/${b}`, async (route) => {
    if (route.request().method() === "PATCH" && route.request().postDataJSON().type === "publish") await route.fulfill({ status: 400, json: { code: "TEST_PUBLICATION_FAILURE" } });
    else await route.continue();
  });
  await leaveDialog(page); await expect(publicDialog(page)).toContainText("2 Cards and 1 Deck"); await publicDialog(page).getByRole("button", { name: "Publish publicly", exact: true }).click();
  await expect(page.locator(".creator-save-message--error")).toContainText("Earlier successful publications are retained");
  expect((await root(a))!.latestVersion).toBe(1); expect((await root(a))!.visibility).toBe("public"); expect((await root(b))!.latestVersion).toBe(0);
  await page.unroute(`**/api/card-templates/${b}`); await leaveDialog(page); await expect(publicDialog(page)).toContainText("1 Card and 1 Deck");
  await publicDialog(page).getByRole("button", { name: "Publish publicly", exact: true }).click(); await expect(page).toHaveURL(/\/decks$/);
  expect(await db().collection("cardTemplateVersions").countDocuments({ cardTemplateId: a })).toBe(1);
});

test("failed visibility save stays in Creator with local intent intact and retries the same lane", async ({ page }) => {
  await open(page); const id = await add(page);
  await page.route(`**/api/card-templates/${id}`, async (route) => {
    if (route.request().method() === "PATCH" && route.request().postDataJSON().type === "save") await route.fulfill({ status: 400, json: { code: "INVALID_CONTENT" } });
    else await route.continue();
  });
  const visibility = card(page, id).getByRole("combobox", { name: "Card 1 publication visibility" }); await visibility.selectOption("public");
  await expect(page.getByRole("button", { name: "Retry Save Card 1", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Decks", exact: true }).click(); await expect(page.locator(".creator-save-message--error")).toContainText("could not be saved");
  await expect(page).toHaveURL(/\/creator\/edit\//); await expect(visibility).toHaveValue("public"); expect((await root(id))!.visibility).toBe("private");
  await page.unroute(`**/api/card-templates/${id}`); await page.getByRole("button", { name: "Retry Save Card 1", exact: true }).click();
  await expect.poll(async () => (await root(id))?.draftVisibility).toBe("public");
  await page.reload(); await expect(visibility).toHaveValue("public");
});

for (const width of [375, 390]) test(`visibility controls preserve mobile Creator scrolling and header at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 }); await open(page); const id = await add(page); await title(page);
  await expect(page.getByRole("combobox", { name: "Deck publication visibility" })).toBeVisible();
  await expect(card(page, id).getByRole("combobox", { name: "Card 1 publication visibility" })).toBeVisible();
  const geometry = await page.evaluate(() => {
    const header = document.querySelector(".creator-header")!.getBoundingClientRect();
    const actions = document.querySelector(".creator-header-actions")!.getBoundingClientRect();
    const board = document.querySelector(".creator-scroll-shell")!.getBoundingClientRect();
    return { width: window.innerWidth, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
      height: window.innerHeight, right: actions.right, headerBottom: header.bottom, actionsBottom: actions.bottom, boardTop: board.top };
  });
  expect(geometry.documentWidth).toBe(geometry.width); expect(geometry.documentHeight).toBe(geometry.height);
  expect(geometry.right).toBeLessThanOrEqual(width); expect(geometry.actionsBottom).toBeLessThanOrEqual(geometry.headerBottom);
  expect(geometry.boardTop).toBeGreaterThanOrEqual(geometry.headerBottom);
  await info.attach(`creator-visibility-${width}`, { body: await page.screenshot(), contentType: "image/png" });
});
