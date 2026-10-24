import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import type { InfoMedia } from "../../src/lib/infoCards/model";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function fixture(visibility: "public" | "private" = "public", attached = ["demo-owner-public", "demo-other-public"]) {
  const main = new CardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!;
  const c = await main.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), infoCardIds: attached,
    intro: { title: "Consultation practice", description: "Main instruction remains mounted", mediaItem: null },
    steps: [0, 1, 2].map(index => ({ stepId: randomUUID(), title: `Practice ${index + 1}`, description: "Keep working on this step.", mediaItem: null })) }, visibility);
  await main.publishCard(owner, c.cardTemplateId, 0);
  const d = await main.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Consultation programme",
    cards: [{ cardTemplateId: c.cardTemplateId }] }, visibility); await main.publishDeck(owner, d.deckTemplateId, 0);
  await main.ensureDeckData(owner, d.deckTemplateId, 1); await main.ensureCardData(owner, c.cardTemplateId, 1);
  return { main, info: new InfoCardRepository(main.db, client), owner, cardId: c.cardTemplateId, deckId: d.deckTemplateId, content: c.draft! };
}
async function login(page: Page, username = "phase2") {
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).ok()).toBeTruthy();
}
async function enter(page: Page, deckId: string, working = false) {
  await page.goto(working ? `/decks?openDeck=${deckId}` : `/library/${deckId}`);
  await page.locator(".deck-card.is-active").press("Enter");
  await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
}
const consultation = (page: Page) => page.getByRole("dialog", { name: "Info card consultation", exact: true });
const open = async (page: Page) => {
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
};
const close = async (page: Page) => {
  await page.getByRole("button", { name: "Close information card stack", exact: true }).click(); await expect(consultation(page)).toHaveCount(0);
};

test("real canonical and working Step Views fetch authorised ordered snapshots on Intro and all three steps", async ({ page }) => {
  const f = await fixture(); await login(page); const requests: URL[] = [];
  page.on("request", request => { if (/\/api\/card-templates\/[^/]+\/info-cards\?/.test(request.url())) requests.push(new URL(request.url())); });
  for (const working of [false, true]) {
    await enter(page, f.deckId, working);
    for (let item = 0; item < 4; item++) {
      await open(page); await expect(consultation(page).getByRole("button", { name: "Close information cards (2 attached)", exact: true })).toBeVisible();
      await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", "demo-owner-public");
      await page.keyboard.press("ArrowDown"); await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", "demo-other-public");
      await close(page);
      if (item < 3) { await page.getByRole("button", { name: "Next", exact: true }).click(); await expect(page.locator(".step-view-layer")).toHaveCount(1); }
    }
  }
  expect(requests).toHaveLength(8);
  expect(requests.filter(url => url.searchParams.get("mode") === "working").every(url => url.searchParams.get("deckTemplateId") === f.deckId)).toBe(true);
  expect(requests.filter(url => url.searchParams.get("mode") === "canonical").every(url => !url.searchParams.has("deckTemplateId"))).toBe(true);
});

test("real API denies unauthenticated, changed-actor, invalid queries, private canonical and stale working versions", async ({ page }) => {
  const f = await fixture("private", ["demo-owner-private"]);
  const url = `/api/card-templates/${f.cardId}/info-cards`;
  expect((await page.request.get(`${url}?mode=canonical&version=1`)).status()).toBe(401);
  await login(page);
  const response = await page.request.get(`${url}?mode=working&version=1&deckTemplateId=${f.deckId}`, { headers: { "X-Personal-Viewer": f.owner } });
  expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers().vary.split(/,\s*/)).toContain("Cookie"); expect((await response.json()).entries[0].info.infoCardId).toBe("demo-owner-private");
  expect((await page.request.get(`${url}?mode=canonical&version=1`)).status()).toBe(403);
  expect((await page.request.get(`${url}?mode=working&version=2&deckTemplateId=${f.deckId}`)).status()).toBe(409);
  for (const suffix of ["&ids=demo-owner-public", "&version=2", "&mode=canonical"]) {
    expect((await page.request.get(`${url}?mode=working&version=1&deckTemplateId=${f.deckId}${suffix}`)).status()).toBe(400);
  }
  expect((await page.request.get(`${url}?mode=working&version=1&deckTemplateId=${f.deckId}`, { headers: { "X-Personal-Viewer": "wrong-actor" } })).status()).toBe(409);
  await login(page, "other"); expect((await page.request.get(`${url}?mode=working&version=1&deckTemplateId=${f.deckId}`)).status()).toBe(400);
});

test("republication while consulting stays pinned, the next opening refreshes, and known unavailable slots retain count", async ({ page }) => {
  const info = new InfoCardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!, infoId = randomUUID();
  await info.create(owner, infoId); await info.save(owner, infoId, 0, { title: "Signs", body: "Keep each sign.", seriesId: "demo-series-owner", mediaItem: null }, "public");
  await info.publish(owner, infoId, 1);
  const f = await fixture("public", [infoId, "demo-other-public"]); await login(page); await enter(page, f.deckId); await open(page);
  const before = (await f.info.owner(f.owner, infoId));
  await f.info.save(f.owner, before.infoCardId, before.revision, { title: "Updated signs", body: "A fresh explanation.", seriesId: "demo-series-owner", mediaItem: null }, "public");
  await f.info.publish(f.owner, before.infoCardId, before.revision + 1);
  await expect(page.locator('[data-info-card-current="true"] [data-info-card-title]')).toHaveText("Signs");
  await close(page); await open(page); await expect(page.locator('[data-info-card-current="true"] [data-info-card-title]')).toHaveText("Updated signs");
  await close(page);
  // Deliberate corrupted retained reference, not a permitted deletion operation.
  const root = (await f.info.roots().findOne({ infoCardId: "demo-other-public" }))!;
  const version = (await f.info.versions().findOne({ infoCardId: root.infoCardId, version: root.latestVersion }))!;
  await f.info.versions().updateOne({ infoCardId: root.infoCardId, version: root.latestVersion }, { $set: { "content.body": null } } as never);
  try {
    await open(page); await page.keyboard.press("ArrowDown");
    await expect(page.locator("[data-info-card-unavailable]")).toHaveText("This Info Card is unavailable.");
    await expect(consultation(page).getByRole("button", { name: "Close information cards (2 attached)", exact: true })).toBeVisible();
    await expect(consultation(page).locator("[data-info-card-pouch-count]")).toHaveText("2");
    const data = await (await page.request.get(`/api/card-templates/${f.cardId}/info-cards?mode=canonical&version=1`)).json();
    expect(data.entries[1]).toEqual({ status: "unavailable" });
  } finally { await f.info.versions().replaceOne({ _id: version._id }, version); }
});

test("delayed real response shows a closed-pouch status, supports cancellation and does not install an old consultation", async ({ page }) => {
  const f = await fixture(); await login(page); let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), requested = new Promise<void>(resolve => { entered = resolve; }); let calls = 0;
  await page.route(`**/api/card-templates/${f.cardId}/info-cards?*`, async route => {
    const response = await route.fetch(); calls++; entered(); if (calls === 1) await held;
    await route.fulfill({ response }).catch(() => {});
  });
  await enter(page, f.deckId); await page.getByRole("button", { name: /^Open information cards/ }).click(); await requested;
  await expect(consultation(page).getByText("Loading Info Cards…", { exact: true })).toBeVisible();
  await expect(page.locator("[data-info-card-stack]")).toHaveCount(0);
  await consultation(page).getByRole("button", { name: /^Close information cards \(/ }).click();
  await expect(consultation(page)).toHaveCount(0); release();
  await open(page); await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", "demo-owner-public");
  expect(calls).toBe(2);
});

test("no attachments means no production pouch or snapshot requests", async ({ page }) => {
  const f = await fixture("public", []); await login(page); let requests = 0;
  page.on("request", request => { if (request.url().includes(`/api/card-templates/${f.cardId}/info-cards`)) requests++; });
  await enter(page, f.deckId); await expect(page.locator("[data-info-card-pouch]")).toHaveCount(0); expect(requests).toBe(0);
});

test("account changed during a held private response cannot install its content", async ({ page }) => {
  const f = await fixture("private", ["demo-owner-private"]); await login(page);
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), requested = new Promise<void>(resolve => { entered = resolve; });
  await page.route(`**/api/card-templates/${f.cardId}/info-cards?*`, async route => {
    const response = await route.fetch(); entered(); await held; await route.fulfill({ response }).catch(() => {});
  });
  await enter(page, f.deckId, true); await page.getByRole("button", { name: /^Open information cards/ }).click(); await requested;
  await login(page, "other"); release();
  await expect(consultation(page).getByRole("alert")).toContainText("Unable to load Info Cards");
  await expect(page.locator("[data-info-card-stack]")).toHaveCount(0); await expect(consultation(page)).not.toContainText("Private tip");
});

async function mediaFixture(kind: "image" | "video") {
  const info = new InfoCardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!, infoId = randomUUID();
  await info.create(owner, infoId);
  await info.save(owner, infoId, 0, { title: "Media tip", body: "Keep the explanation available.", seriesId: "demo-series-owner", mediaItem: null }, "public");
  await info.publish(owner, infoId, 1);
  const media: InfoMedia = kind === "image" ? { id: "fixture-image", provider: "cloudflare-r2", mediaType: "image", assetId: "fixture-image",
    src: "https://assets.example.invalid/info.png", description: "Reference image" } : { id: "consultation-video", provider: "cloudflare-stream", mediaType: "video",
    assetId: "consultation-video", src: "https://iframe.videodelivery.net/consultation-video", description: "Reference video" };
  // Explicit stored-provider fixture; no upload/publication gate is bypassed in
  // application code. Actual delivery remains fail-closed unless intercepted.
  await info.versions().updateOne({ infoCardId: infoId, version: 1 }, { $set: { "content.mediaItem": media } });
  return { ...await fixture("public", ["demo-owner-public", infoId]), infoId, media };
}

test("nested image requests the exact pinned publication after republication and returns to the selected card", async ({ page }) => {
  const f = await mediaFixture("image"); await login(page);
  expect((await page.request.get(`/api/info-cards/${f.infoId}/media?version=1`)).status()).toBe(503);
  const requests: string[] = [];
  await page.route(`**/api/info-cards/${f.infoId}/media?*`, route => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="navy"/></svg>' });
  });
  await enter(page, f.deckId); await open(page); await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", f.infoId);
  await page.locator('[data-info-card-current="true"] [data-info-card-body]').click();
  expect(requests).toHaveLength(0); await expect(page.getByRole("dialog", { name: "Info card media", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View image", exact: true }).click(); const viewer = page.getByRole("dialog", { name: "Info card media", exact: true });
  await expect(viewer.getByRole("img")).toBeVisible();
  const root = await f.info.owner(f.owner, f.infoId);
  await f.info.save(f.owner, f.infoId, root.revision, { title: "New media tip", body: "New published explanation.", seriesId: "demo-series-owner", mediaItem: null }, "public");
  await f.info.publish(f.owner, f.infoId, root.revision + 1);
  await page.keyboard.press("ArrowDown");
  await viewer.getByRole("button", { name: "Close info card media", exact: true }).click();
  await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", f.infoId);
  await expect(page.locator('[data-info-card-current="true"] [data-info-card-title]')).toHaveText("Media tip");
  await expect(page.getByRole("button", { name: "View image", exact: true })).toBeFocused();
  const count = requests.length; await page.getByRole("button", { name: "View image", exact: true }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(count);
  expect(requests.every(url => new URL(url).searchParams.get("version") === "1")).toBe(true);
  await viewer.getByRole("button", { name: "Close info card media", exact: true }).click(); await close(page);
  await open(page); await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-info-card-current="true"] [data-info-card-title]')).toHaveText("New media tip");
  await expect(page.getByRole("button", { name: "View image", exact: true })).toHaveCount(0);
});

for (const kind of ["image", "video"] as const) test(`fail-closed ${kind} delivery retains the info card and selected position`, async ({ page }) => {
  const f = await mediaFixture(kind); await login(page); await enter(page, f.deckId); await open(page);
  await page.keyboard.press("ArrowDown"); await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", f.infoId);
  const failed = page.waitForResponse(response => response.url().includes(`/api/info-cards/${f.infoId}/media?version=1`));
  await page.getByRole("button", { name: kind === "image" ? "View image" : "Watch video", exact: true }).click();
  expect((await failed).status()).toBe(503);
  const viewer = page.getByRole("dialog", { name: "Info card media", exact: true });
  await expect(viewer.getByText(kind === "image" ? "This image could not be loaded." : "Video unavailable.", { exact: true })).toBeVisible();
  await viewer.getByRole("button", { name: "Close info card media", exact: true }).click();
  await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", f.infoId);
  await expect(page.locator('[data-info-card-current="true"] [data-info-card-title]')).toHaveText("Media tip");
  await expect(consultation(page).locator("[data-info-card-pouch-count]")).toHaveText("2");
});
