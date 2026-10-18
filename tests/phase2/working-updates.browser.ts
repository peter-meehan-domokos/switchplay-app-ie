import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { deckDraftContent } from "../../src/lib/cards/publicationRules";
import { geometry } from "./helpers/presentationGeometry";
let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function fixture(readableTitles = false) {
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), viewer = process.env.PHASE2_USER_ID!;
  const owner = (await repo.db.collection("users").findOne({ username: "other" }))!._id.toString();
  const ids: string[] = [];
  for (let i = 0; i < 2; i++) {
    const c = await repo.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: readableTitles ? `Practice ${i + 1}` : `Practice ${i + 1} ${randomUUID()}`, description: "Canonical instructions", mediaItem: null } }, "public");
    await repo.publishCard(owner, c.cardTemplateId, 0); ids.push(c.cardTemplateId);
  }
  const decks: string[] = [];
  for (let i = 0; i < 2; i++) {
    const d = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: readableTitles ? `Programme ${i + 1}` : `Programme ${i + 1} ${randomUUID()}`, cards: ids.map((cardTemplateId) => ({ cardTemplateId })) }, "public");
    await repo.publishDeck(owner, d.deckTemplateId, 0); await repo.ensureDeckData(viewer, d.deckTemplateId, 1); decks.push(d.deckTemplateId);
  }
  return { repo, viewer, owner, ids, decks };
}
async function cardPublish(f: Awaited<ReturnType<typeof fixture>>, note: string) {
  const root = (await f.repo.cards().findOne({ cardTemplateId: f.ids[0] }))!, content = (await f.repo.getCardVersion(f.ids[0], root.latestVersion))!.content;
  await f.repo.saveCardDraft(f.owner, f.ids[0], root.revision, { ...content, intro: { ...content.intro, title: `Updated practice v${root.latestVersion + 1}` } });
  await f.repo.publishCard(f.owner, f.ids[0], root.revision + 1, note);
}
async function deckPublish(f: Awaited<ReturnType<typeof fixture>>, ids: string[]) {
  const root = (await f.repo.decks().findOne({ deckTemplateId: f.decks[0] }))!, content = deckDraftContent((await f.repo.getDeckVersion(f.decks[0], root.latestVersion))!.content);
  await f.repo.saveDeckDraft(f.owner, f.decks[0], root.revision, { ...content, title: "Revised programme", cards: ids.map((cardTemplateId) => ({ cardTemplateId })) });
  await f.repo.publishDeck(f.owner, f.decks[0], root.revision + 1, "Revised composition");
}
async function open(page: Page, id: string) {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto(`/decks?openDeck=${id}`); await expect(page.locator(".deck-detail h1")).toBeVisible();
}
const modal = (page: Page) => page.getByRole("dialog", { name: /^Update / });

test("Card Update reviews chronological notes and refreshes a shared adoption without remounting DeckDetail", async ({ page }) => {
  const f = await fixture(); await cardPublish(f, "First improvements"); await cardPublish(f, "Second improvements");
  await open(page, f.decks[0]);
  const before = (await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!;
  await page.locator(".deck-detail").evaluate((element) => { (window as unknown as { originalDeck: Element }).originalDeck = element; });
  await page.locator(".deck-card.is-active .working-card-update").click();
  await expect(page.locator(".focused-card-stage")).toHaveCount(0);
  await expect(modal(page)).toContainText("This updates the Card everywhere you use it.");
  expect(await modal(page).locator("li p").allTextContents()).toEqual(["First improvements", "Second improvements"]);
  await modal(page).getByRole("button", { name: "Update", exact: true }).click();
  await expect(modal(page)).toHaveCount(0); await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Updated practice v3");
  expect(await page.locator(".deck-detail").evaluate((element) => (window as unknown as { originalDeck: Element }).originalDeck === element)).toBe(true);
  const after = (await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!;
  expect(after.cardTemplateVersion).toBe(3); expect(after.targetDate).toBe(before.targetDate); expect(after.items).toEqual(before.items);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.goto(`/decks?openDeck=${f.decks[1]}`); await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Updated practice v3");
  await expect(page.locator(".working-card-update")).toHaveCount(0);
  await page.goto(`/library/${f.decks[0]}`); await expect(page.locator(".working-update-button")).toHaveCount(0);
});
test("stale Update review requires Refresh and another explicit Update, while account changes cannot adopt", async ({ page }) => {
  const f = await fixture(); await cardPublish(f, "Reviewed note"); await open(page, f.decks[0]);
  await page.locator(".working-card-update").click(); await cardPublish(f, "New publication");
  await modal(page).getByRole("button", { name: "Update", exact: true }).click();
  await expect(modal(page).getByRole("button", { name: "Refresh", exact: true })).toBeVisible();
  expect((await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!.cardTemplateVersion).toBe(1);
  await modal(page).getByRole("button", { name: "Refresh", exact: true }).click(); await expect(modal(page)).toContainText("New publication");
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  await modal(page).getByRole("button", { name: "Update", exact: true }).click(); await expect(modal(page).getByRole("alert")).toContainText("sign-in changed");
  expect((await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!.cardTemplateVersion).toBe(1);
});
test("Deck Update preserves cadence/dates, reconciles removed active Card, and supports empty composition", async ({ page }) => {
  const f = await fixture(); await open(page, f.decks[0]);
  const before = (await f.repo.getPersonalUser(f.viewer))!, membership = before.decksData.find((data) => data.deckTemplateId === f.decks[0])!;
  await deckPublish(f, [f.ids[1]]); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.locator(".detail-progress-row .working-update-button").click(); await modal(page).getByRole("button", { name: "Update", exact: true }).click();
  await expect(modal(page)).toHaveCount(0); await expect(page.locator(".deck-detail h1")).toHaveText("Revised programme");
  await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Practice 2");
  const after = (await f.repo.getPersonalUser(f.viewer))!;
  const updated = after.decksData.find((data) => data.deckTemplateId === f.decks[0])!;
  expect(updated.activeCardId).toBe(f.ids[1]); expect(updated.cadenceAnchorDate).toBe(membership.cadenceAnchorDate);
  expect(after.cardsData.map((data) => data.targetDate)).toEqual(before.cardsData.map((data) => data.targetDate));
  await deckPublish(f, []); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.locator(".detail-progress-row .working-update-button").click(); await modal(page).getByRole("button", { name: "Update", exact: true }).click();
  await expect(modal(page)).toHaveCount(0); await expect(page.locator(".deck-card")).toHaveCount(0);
});
test("Update waits for an affected personal save, Cancel leaves it running, and retries a failed save safely", async ({ page }) => {
  const f = await fixture(); await cardPublish(f, "Better instruction"); await open(page, f.decks[0]);
  await page.locator(".deck-card.is-active").press("Enter");
  await geometry(page, [".focused-card-surface--front"]);
  let release!: () => void; const hold = new Promise<void>((resolve) => { release = resolve; }); let started = false, fail = true;
  await page.route(`**/api/decks-data/${f.decks[0]}`, async (route) => {
    if (route.request().method() === "PATCH" && route.request().postDataJSON()?.type === "completion") {
      started = true; await hold;
      if (fail) { fail = false; return route.fulfill({ status: 500, json: { error: "Simulated personal save failure" } }); }
    }
    await route.continue();
  });
  try {
    await page.locator(".focused-card-surface--front .step-progress-hit-area").first().click(); await expect.poll(() => started).toBe(true);
    await page.locator(".focused-card-surface--front .working-card-update").click(); await modal(page).getByRole("button", { name: "Update", exact: true }).click();
    await expect(modal(page).getByRole("status")).toHaveText("Waiting for personal saves and uploads…");
    await modal(page).getByRole("button", { name: "Cancel", exact: true }).click(); release();
    await expect(page.getByRole("alert").filter({ hasText: "Simulated personal save failure" })).toBeVisible();
    await page.locator(".focused-card-surface--front .working-card-update").click(); await modal(page).getByRole("button", { name: "Update", exact: true }).click();
    await expect(modal(page).getByRole("button", { name: "Retry", exact: true })).toBeVisible(); await modal(page).getByRole("button", { name: "Retry", exact: true }).click();
    await expect(modal(page)).toHaveCount(0); await expect(page.locator(".focused-card-stage")).toBeVisible();
    const card = (await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!;
    expect(card.cardTemplateVersion).toBe(2); expect(card.items[0].completionStatus).toBe("inProgress");
  } finally { release(); }
});
for (const width of [390, 1440]) test(`Update controls preserve Card geometry and attribution clearance at ${width}`, async ({ page }, testInfo) => {
  const f = await fixture(true);
  const source = (await f.repo.getCardVersion(f.ids[0], 1))!;
  await f.repo.setSignalReading(f.viewer, f.decks[0], f.ids[0], source.content.steps[0].stepId, 7);
  await page.setViewportSize({ width, height: 900 }); await open(page, f.decks[0]);
  const selectors = [".deck-card.is-active", ".deck-card.is-active .active-card-identity", ".deck-card.is-active .card-creator-attribution", ".detail-heading h1"];
  const before = await geometry(page, selectors); await cardPublish(f, "Improvement");
  await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(page.locator(".working-card-update")).toBeVisible();
  await deckPublish(f, f.ids); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".detail-progress-row .working-update-button")).toBeVisible();
  const after = await geometry(page, selectors);
  for (const selector of selectors) before[selector].forEach((value, index) => expect(Math.abs(after[selector][index] - value)).toBeLessThanOrEqual(1));
  const card = await page.locator(".deck-card.is-active .deck-card-surface--front").boundingBox();
  const update = await page.locator(".deck-card.is-active .working-card-update").boundingBox();
  const attribution = await page.locator(".deck-card.is-active .card-creator-attribution").boundingBox();
  const deckUpdate = await page.locator(".detail-progress-row .working-update-button").boundingBox();
  const completion = await page.locator(".detail-progress").boundingBox();
  const confidence = await page.locator(".detail-confidence").boundingBox();
  const title = await page.locator(".detail-heading h1").boundingBox();
  expect(Math.abs((update!.x - card!.x) - (card!.y + card!.height - update!.y - update!.height))).toBeLessThanOrEqual(1);
  expect(update!.height).toBeGreaterThanOrEqual(24); expect(deckUpdate!.height).toBeGreaterThanOrEqual(24);
  expect(Math.abs(deckUpdate!.y + deckUpdate!.height / 2 - completion!.y - completion!.height / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(deckUpdate!.y + deckUpdate!.height / 2 - confidence!.y - confidence!.height / 2)).toBeLessThanOrEqual(1);
  expect(deckUpdate!.x - confidence!.x - confidence!.width).toBeGreaterThanOrEqual(12);
  expect(deckUpdate!.x - confidence!.x - confidence!.width).toBeLessThanOrEqual(16);
  expect(deckUpdate!.y + deckUpdate!.height).toBeLessThanOrEqual(title!.y);
  expect(Math.abs(attribution!.x + attribution!.width / 2 - card!.x - card!.width / 2)).toBeLessThanOrEqual(1);
  expect(update!.x + update!.width).toBeLessThan(attribution!.x);
  const steps = await page.locator(".deck-card.is-active .active-step-list").boundingBox();
  expect(steps!.y + steps!.height).toBeLessThan(update!.y);
  const treatments = await page.locator(".working-update-button").evaluateAll((buttons) => buttons.map((button) => {
    const style = getComputedStyle(button);
    return [style.borderTopWidth, style.borderTopStyle, style.borderRadius, style.color, style.fontSize, style.fontWeight, style.padding, style.minHeight, style.height, style.width];
  }));
  expect(treatments).toHaveLength(2); expect(treatments[0]).toEqual(treatments[1]);
  expect(treatments[0].slice(0, 3)).toEqual(["1px", "solid", "8px"]);
  await page.screenshot({ path: testInfo.outputPath(`update-active-${width}.png`) });
  await page.locator(".deck-card.is-active").press("Enter");
  const focused = await geometry(page, [".focused-card-surface--front", ".focused-card-surface--front .working-card-update", ".focused-card-surface--front .card-creator-attribution"]);
  const surface = focused[".focused-card-surface--front"], focusedUpdate = focused[".focused-card-surface--front .working-card-update"], focusedAttribution = focused[".focused-card-surface--front .card-creator-attribution"];
  expect(Math.abs((focusedUpdate[0] - surface[0]) - (surface[1] + surface[3] - focusedUpdate[1] - focusedUpdate[3]))).toBeLessThanOrEqual(1);
  expect(focusedUpdate[3]).toBeGreaterThanOrEqual(24);
  expect(Math.abs(focusedAttribution[0] + focusedAttribution[2] / 2 - surface[0] - surface[2] / 2)).toBeLessThanOrEqual(1);
  expect(focusedUpdate[0] + focusedUpdate[2]).toBeLessThan(focusedAttribution[0]);
  expect(focusedUpdate[0] - surface[0]).toBeGreaterThanOrEqual(20);
  expect(focusedUpdate[0] - surface[0]).toBeLessThanOrEqual(26);
  const focusedSteps = await page.locator(".focused-card-surface--front .active-step-list").boundingBox();
  expect(focusedSteps!.y + focusedSteps!.height).toBeLessThan(focusedUpdate[1]);
  const measurements = {
    width,
    deck: {
      completionCenter: completion!.y + completion!.height / 2,
      confidenceCenter: confidence!.y + confidence!.height / 2,
      updateCenter: deckUpdate!.y + deckUpdate!.height / 2,
      gap: deckUpdate!.x - confidence!.x - confidence!.width,
      titleGap: title!.y - deckUpdate!.y - deckUpdate!.height,
    },
    active: {
      leftInset: update!.x - card!.x,
      bottomInset: card!.y + card!.height - update!.y - update!.height,
      attributionCenterOffset: attribution!.x + attribution!.width / 2 - card!.x - card!.width / 2,
    },
    focused: {
      leftInset: focusedUpdate[0] - surface[0],
      bottomInset: surface[1] + surface[3] - focusedUpdate[1] - focusedUpdate[3],
      attributionCenterOffset: focusedAttribution[0] + focusedAttribution[2] / 2 - surface[0] - surface[2] / 2,
    },
  };
  await testInfo.attach(`positions-${width}`, { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
  console.log(`Update positioning: ${JSON.stringify(measurements)}`);
  await page.screenshot({ path: testInfo.outputPath(`update-focused-${width}.png`) });
});

test("Update waits for the entire upload and attachment without remounting the working controller", async ({ page }) => {
  const f = await fixture(); await cardPublish(f, "New instruction"); await open(page, f.decks[0]);
  await page.locator(".deck-card.is-active").press("Enter");
  async function flip(selector: string, delta: number) {
    const rect = (await geometry(page, [selector]))[selector];
    await page.mouse.move(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2);
    await page.mouse.down(); await page.mouse.move(rect[0] + rect[2] / 2 + delta, rect[1] + rect[3] / 2, { steps: 12 }); await page.mouse.up();
  }
  await flip(".focused-card-surface--front .card-title-anchor", 220);
  await page.getByRole("button", { name: "Add media", exact: true }).click();
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; }); let started = false;
  await page.route("**/api/media/images/direct-upload", async (route) => { started = true; await held; await route.continue(); });
  try {
    await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "pending.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") });
    await expect.poll(() => started).toBe(true);
    await page.getByRole("dialog", { name: "Card media", exact: true }).getByRole("button", { name: "Close", exact: true }).click();
    await flip(".focused-card-surface--back .card-title-anchor", -220);
    await page.locator(".focused-card-surface--front .working-card-update").click();
    await modal(page).getByRole("button", { name: "Update", exact: true }).click();
    await expect(modal(page).getByRole("status")).toHaveText("Waiting for personal saves and uploads…");
    expect((await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!.cardTemplateVersion).toBe(1);
    release(); await expect(modal(page)).toHaveCount(0);
    await expect(page.locator(".focused-card-stage")).toBeVisible();
    const data = (await f.repo.getPersonalUser(f.viewer))!.cardsData.find((card) => card.cardTemplateId === f.ids[0])!;
    expect(data.cardTemplateVersion).toBe(2); expect(data.mediaItems).toHaveLength(1);
  } finally { release(); }
});

test("lost adoption response retries the reviewed target without replaying subsequent personal state", async ({ page }) => {
  const f = await fixture(); await cardPublish(f, "Reviewed publication"); await open(page, f.decks[0]);
  let lose = true; const targets: number[] = [];
  await page.route(`**/api/cards-data/${f.ids[0]}/update`, async (route) => {
    if (route.request().method() === "POST") {
      targets.push(route.request().postDataJSON().command.targetVersion);
      if (lose) { lose = false; expect((await route.fetch()).ok()).toBeTruthy(); return route.abort("failed"); }
    }
    await route.continue();
  });
  await page.locator(".working-card-update").click(); await modal(page).getByRole("button", { name: "Update", exact: true }).click();
  await expect(modal(page).getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  expect((await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!.cardTemplateVersion).toBe(2);
  await f.repo.setReflection(f.viewer, f.decks[1], f.ids[0], "Written after adoption"); await cardPublish(f, "Later unreviewed publication");
  await modal(page).getByRole("button", { name: "Retry", exact: true }).click(); await expect(modal(page)).toHaveCount(0);
  const after = (await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!;
  expect(targets).toEqual([2, 2]); expect(after.cardTemplateVersion).toBe(2); expect(after.reflection).toBe("Written after adoption");
  await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Updated practice v2");
  await expect(page.locator(".working-card-update")).toBeVisible();
});

test("a working refresh preserves an unsent reflection editor and its mounted draft", async ({ page }) => {
  const f = await fixture(); await open(page, f.decks[0]); await page.locator(".deck-card.is-active").press("Enter");
  const selector = ".focused-card-surface--front .card-title-anchor", rect = (await geometry(page, [selector]))[selector];
  await page.mouse.move(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2); await page.mouse.down();
  await page.mouse.move(rect[0] + rect[2] / 2 + 220, rect[1] + rect[3] / 2, { steps: 12 }); await page.mouse.up();
  await page.getByRole("button", { name: "Add a reflection", exact: true }).click();
  const editor = page.locator(".reflection-editor-modal");
  await editor.getByRole("textbox").fill("Unsent personal reflection");
  await cardPublish(f, "New instructions"); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(editor.getByRole("textbox")).toHaveValue("Unsent personal reflection");
  expect((await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!.reflection).not.toBe("Unsent personal reflection");
  await editor.getByRole("button", { name: "Save", exact: true }).click(); await expect(editor).toHaveCount(0);
  await expect(page.locator(".focused-card-stage")).toBeVisible();
  expect((await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.ids[0])!.reflection).toBe("Unsent personal reflection");
});

test("existing working reads, writes, open and personal-media deletion reject a switched initiating account", async ({ request }) => {
  const f = await fixture(); await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const headers = { "X-Personal-Viewer": f.viewer }, before = await f.repo.getPersonalUser(f.owner);
  const results = await Promise.all([
    request.get("/api/decks-data", { headers }), request.get(`/api/decks-data/${f.decks[0]}`, { headers }),
    request.post("/api/decks-data", { headers, data: { deckTemplateId: f.decks[0], localDate: "2026-10-09" } }),
    request.patch(`/api/decks-data/${f.decks[0]}`, { headers, data: { type: "reflection", cardTemplateId: f.ids[0], reflection: "Must not write" } }),
    request.delete(`/api/cards-data/${f.ids[0]}/media/not-an-item`, { headers }),
  ]);
  for (const response of results) { expect(response.status()).toBe(409); expect((await response.json()).code).toBe("UPDATE_SESSION_CONFLICT"); }
  expect(await f.repo.getPersonalUser(f.owner)).toEqual(before);
});

test("focus during an adoption refetch cannot invalidate the foreground Update outcome", async ({ page }) => {
  const f = await fixture(); await cardPublish(f, "Reviewed instructions"); await open(page, f.decks[0]);
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; }); let captured = false;
  await page.route(`**/api/decks-data/${f.decks[0]}`, async (route) => {
    if (route.request().method() === "GET") {
      const response = await route.fetch(); captured = true; await held; await route.fulfill({ response }); return;
    }
    await route.continue();
  });
  try {
    await page.locator(".working-card-update").click(); await modal(page).getByRole("button", { name: "Update", exact: true }).click();
    await expect.poll(() => captured).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("focus"))); release();
    await expect(modal(page)).toHaveCount(0);
    await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Updated practice v2");
  } finally { release(); }
});
