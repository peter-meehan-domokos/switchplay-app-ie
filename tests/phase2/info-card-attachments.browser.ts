import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";

let client: MongoClient;
test.beforeAll(async () => {
  assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const db = client.db(process.env.MONGODB_DB!);
  // Own dedicated publications: collection-navigation regressions intentionally
  // edit the shared runner examples before this file executes in a combined run.
  const info = new InfoCardRepository(db, client);
  const other = (await db.collection("users").findOne({ username: "other" }))!._id.toString();
  for (const [id, owner, title, visibility, seriesId] of [
    ["attachment-private", process.env.PHASE2_USER_ID!, "Attachment private", "private", "demo-series-owner"],
    ["attachment-other-public", other, "Attachment shared", "public", "demo-series-other"],
  ] as const) if (!await info.roots().findOne({ infoCardId: id })) {
    await info.create(owner, id);
    await info.save(owner, id, 0, { title, body: "Keep each sign.", seriesId, mediaItem: null }, visibility);
    await info.publish(owner, id, 1);
  }
  if (await db.collection("infoCardVersions").countDocuments({ infoCardId: /^attachment-option-/ }) === 53) return;
  const root = (await db.collection("infoCards").findOne({ infoCardId: "demo-owner-public" }))!;
  const publication = (await db.collection("infoCardVersions").findOne({ infoCardId: root.infoCardId }))!;
  const { _id: rootId, ...rootFields } = root, { _id: versionId, ...versionFields } = publication; void rootId; void versionId;
  await db.collection("infoCards").insertMany(Array.from({ length: 53 }, (_, i) => ({ ...rootFields, infoCardId: `attachment-option-${i}` })));
  await db.collection("infoCardVersions").insertMany(Array.from({ length: 53 }, (_, i) => ({ ...versionFields,
    infoCardId: `attachment-option-${i}`, publishedAt: new Date(2026, 0, 1, 0, 0, i), content: { ...publication.content, title: `Tip ${i}` } })));
});
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB!);
async function open(page: Page) {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/creator/new"); await page.getByRole("button", { name: "Add card", exact: true }).click();
  const column = page.locator(".creator-column[data-card-template-id]").first();
  const id = (await column.getAttribute("data-card-template-id"))!;
  await expect.poll(async () => !!await db().collection("cardTemplates").findOne({ cardTemplateId: id })).toBe(true);
  await column.locator(".creator-card-title-button").click(); return id;
}

test("title modal loads every catalogue page, uses approved groups/two-line attribution and saves ordered references only on Save", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const id = await open(page);
  const modal = page.locator(".creator-modal"), attach = modal.getByRole("button", { name: "Add Info Card", exact: true });
  const pages: string[] = []; page.on("request", req => { if (req.url().includes("/api/library/info-cards?")) pages.push(req.url()); });
  await attach.click(); const list = page.getByRole("listbox", { name: "Published Info Cards" });
  await expect(list).toHaveAttribute("aria-busy", "false");
  expect(pages.some(url => url.includes("offset=50"))).toBe(true);
  await expect(list.getByRole("group", { name: "My Cards", exact: true })).toBeVisible();
  const other = list.getByRole("group", { name: "Other Cards", exact: true });
  await expect(other.getByRole("option", { name: "Attachment shared Basics · by other", exact: true })).toBeVisible();
  await expect(other).not.toContainText("Attachment private"); await expect(list.getByRole("textbox")).toHaveCount(0);
  const option = list.getByRole("group", { name: "My Cards", exact: true }).getByRole("option", { name: "Attachment private Basics", exact: true });
  const typography = await option.evaluate(el => { const spans = el.querySelectorAll("span");
    return { title: spans[0].getBoundingClientRect().top, series: spans[1].getBoundingClientRect().top,
      titleSize: parseFloat(getComputedStyle(spans[0]).fontSize), seriesSize: parseFloat(getComputedStyle(spans[1]).fontSize) }; });
  expect(typography.series).toBeGreaterThan(typography.title); expect(typography.seriesSize).toBeLessThan(typography.titleSize);
  await option.click(); await attach.click(); await expect(list).toHaveAttribute("aria-busy", "false");
  await list.getByRole("option", { name: "Attachment shared Basics · by other", exact: true }).click();
  await attach.click(); await expect(list).toHaveAttribute("aria-busy", "false");
  await list.getByRole("option", { name: "Tip 0 Basics", exact: true }).click();
  await modal.getByRole("button", { name: "Move Attachment shared up", exact: true }).click();
  expect((await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.infoCardIds).toBeUndefined();
  await modal.getByRole("textbox").fill("Attached practice"); await modal.getByRole("button", { name: "Save", exact: true }).click();
  const expected = ["attachment-other-public", "attachment-private", "attachment-option-0"];
  await expect.poll(async () => (await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.infoCardIds).toEqual(expected);
  await page.locator(`.creator-column[data-card-template-id="${id}"] .creator-card-title-button`).click();
  await modal.getByRole("button", { name: "Remove attachment Attachment private", exact: true }).click();
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  expect((await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.infoCardIds).toEqual(expected);
  await page.reload(); await page.locator(`.creator-column[data-card-template-id="${id}"] .creator-card-title-button`).click();
  await expect(modal.getByRole("list", { name: "Attached Info Cards" }).locator("li")).toHaveCount(3);
});

test("dropdown keyboard selection, Escape focus restoration, duplicate prevention and removal", async ({ page }) => {
  const id = await open(page); const modal = page.locator(".creator-modal");
  const trigger = modal.getByRole("button", { name: "Add Info Card", exact: true });
  await trigger.focus(); await page.keyboard.press("ArrowDown");
  const list = page.getByRole("listbox"); await expect(list).toBeFocused(); await expect(list).toHaveAttribute("aria-busy", "false");
  await page.keyboard.press("End"); await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused(); await expect(modal.getByRole("list", { name: "Attached Info Cards" }).locator("li")).toHaveCount(1);
  await trigger.click(); await expect(list).toHaveAttribute("aria-busy", "false");
  await expect(list.getByRole("option", { selected: true })).toHaveCount(1);
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); await expect(list).toHaveCount(0);
  await modal.getByRole("button", { name: /^Remove attachment/ }).click();
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.infoCardIds ?? []).toEqual([]);
});

test("pending catalogue response and missing metadata cannot discard a selected reference", async ({ page }) => {
  const id = await open(page); const modal = page.locator(".creator-modal");
  await modal.getByRole("button", { name: "Add Info Card" }).click();
  await page.getByRole("option", { name: "Attachment private Basics", exact: true }).click();
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.infoCardIds).toEqual(["attachment-private"]);
  await page.route("**/api/info-cards/attachment-private/publication", route => route.fulfill({ status: 403, json: { error: "INFO_PUBLICATION_FORBIDDEN" } }));
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/library/info-cards?*", async route => { const response = await route.fetch(); await held; await route.fulfill({ response }).catch(() => {}); });
  await page.locator(`.creator-column[data-card-template-id="${id}"] .creator-card-title-button`).click();
  await expect(modal.getByRole("list", { name: "Attached Info Cards" })).toContainText("Unavailable Info Card");
  await modal.getByRole("button", { name: "Add Info Card" }).click(); await expect(page.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
  await page.keyboard.press("Escape"); release();
  await modal.getByRole("textbox").fill("Title only"); await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.intro.title).toBe("Title only");
  expect((await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.infoCardIds).toEqual(["attachment-private"]);
});

for (const width of [375, 390, 1280]) test(`compact main title and recognisable dropdown at ${width}px preserve full titles and Save/Cancel`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); const id = await open(page);
  const modal = page.locator(".creator-modal"), title = modal.getByRole("textbox");
  await expect(title).toHaveAttribute("type", "text");
  await expect(modal.locator("textarea")).toHaveCount(0);
  await expect(modal.getByText("Short card title. Aim for 1-4 words.", { exact: true })).toBeVisible();
  expect(await title.getAttribute("maxlength")).toBeNull();
  const input = (await title.boundingBox())!, bounds = (await modal.boundingBox())!;
  expect(input.height).toBeGreaterThanOrEqual(32); expect(input.height).toBeLessThanOrEqual(48);
  expect(input.x).toBeGreaterThanOrEqual(bounds.x); expect(input.x + input.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  const trigger = modal.getByRole("button", { name: "Add Info Card", exact: true }), chevron = trigger.locator("svg");
  await expect(trigger).toHaveAttribute("aria-haspopup", "listbox"); await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(chevron).toBeVisible(); await expect(chevron).toHaveAttribute("aria-hidden", "true");
  const label = (await trigger.locator("span").boundingBox())!, icon = (await chevron.boundingBox())!, control = (await trigger.boundingBox())!;
  expect(icon.x).toBeGreaterThan(label.x + label.width);
  expect(control.x + control.width - icon.x - icon.width).toBeGreaterThanOrEqual(10);
  expect(control.x + control.width - icon.x - icon.width).toBeLessThanOrEqual(15);
  expect(Math.abs(icon.y + icon.height / 2 - control.y - control.height / 2)).toBeLessThanOrEqual(1);
  const long = "A long existing main card title that remains completely editable ".repeat(8).trim();
  await title.fill(long); await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.intro.title).toBe(long);
  await page.locator(`[data-card-template-id="${id}"] .creator-card-title-button`).click();
  await expect(title).toHaveValue(long); await title.press("Home"); await title.press("End");
  await expect.poll(() => title.evaluate((el: HTMLInputElement) => el.scrollLeft)).toBeGreaterThan(0);
  expect((await title.boundingBox())!.height).toBe(input.height);
  await title.fill("Cancelled title"); await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.intro.title).toBe(long);
  await page.locator(`[data-card-template-id="${id}"] .creator-card-title-button`).click(); await expect(title).toHaveValue(long);
});

test("touch opens the dropdown and selects a published card without submitting the title modal", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL: process.env.PHASE2_BASE_URL });
  try {
    const page = await context.newPage(), id = await open(page), modal = page.locator(".creator-modal");
    await modal.getByRole("button", { name: "Add Info Card", exact: true }).tap();
    const list = page.getByRole("listbox"); await expect(list).toHaveAttribute("aria-busy", "false");
    await list.getByRole("option", { name: "Attachment private Basics", exact: true }).tap();
    await expect(list).toHaveCount(0); await expect(modal.getByRole("list", { name: "Attached Info Cards" })).toContainText("Attachment private");
    expect((await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.infoCardIds).toBeUndefined();
    await modal.getByRole("button", { name: "Save", exact: true }).tap();
    await expect.poll(async () => (await db().collection("cardTemplates").findOne({ cardTemplateId: id }))!.draft.infoCardIds).toEqual(["attachment-private"]);
  } finally { await context.close(); }
});
