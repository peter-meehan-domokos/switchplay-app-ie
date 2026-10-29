import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";

// Explicit provider-write opt-in; the ordinary suite never allocates real assets.
const live = process.env.PHASE2_LIVE_INFO_MEDIA === "1";
test.skip(!live, "Requires --live-info-media and explicit permission for disposable Cloudflare assets");
const prefix = "trial-media-check-";
const actor = process.env.PHASE2_USER_ID!;
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");

test.afterAll(async () => {
  if (!live) return;
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const s3 = new S3Client({ region: "auto", endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!, secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY! } });
  try {
    const assets = await client.db(process.env.MONGODB_DB!).collection("infoCardMediaAssets")
      .find({ ownerUserId: actor, infoCardId: { $regex: `^${prefix}` } }).toArray();
    for (const asset of assets) {
      if (asset.provider === "cloudflare-r2") {
        expect(asset.assetId.startsWith(`info-cards/${actor}/${prefix}`)).toBe(true);
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, Key: asset.assetId }));
        await expect(s3.send(new HeadObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME, Key: asset.assetId }))).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
      } else {
        const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream/${asset.assetId}`;
        const headers = { Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}` };
        const details = await (await fetch(url, { headers })).json();
        expect(details.result?.creator).toBe(actor);
        expect(details.result?.meta?.name).toBe("disposable-trial-video.mp4");
        expect((await fetch(url, { method: "DELETE", headers })).ok).toBe(true);
      }
      console.log(JSON.stringify({ liveMediaCleanup: asset.provider, deleted: true }));
    }
  } finally { s3.destroy(); await client.close(); }
});

for (const kind of ["image", "video"] as const) test(`live ${kind}: upload, private/public publication, delivery and real pouch retain exact media`, async ({ page, browser }) => {
  test.setTimeout(240_000);
  assertDisposableDatabase();
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  const id = `${prefix}${randomUUID()}`;
  expect((await page.request.post("/api/info-cards", { data: { infoCardId: id } })).status()).toBe(200);
  expect((await page.request.patch(`/api/info-cards/${id}`, { data: { revision: 0, visibility: "private",
    content: { title: `Trial ${kind}`, body: "Disposable media verification.", seriesId: "demo-series-owner", mediaItem: null } } })).status()).toBe(200);
  await page.goto(`/creator/info-cards/${id}`);
  const imageTransfer = kind === "image" ? new Promise<boolean>(resolve => {
    page.on("requestfailed", request => { if (request.method() === "PUT" && new URL(request.url()).hostname.endsWith(".r2.cloudflarestorage.com")) resolve(false); });
    page.on("response", response => { if (response.request().method() === "PUT" && new URL(response.url()).hostname.endsWith(".r2.cloudflarestorage.com")) resolve(response.ok()); });
  }) : null;
  const allocated = page.waitForResponse(r => r.url().endsWith(`/api/info-cards/${id}/upload`) && r.request().method() === "POST");
  await page.getByLabel("Upload Info Card media", { exact: true }).setInputFiles(kind === "image"
    ? { name: "disposable-trial-image.png", mimeType: "image/png", buffer: pixel }
    : { name: "disposable-trial-video.mp4", mimeType: "video/mp4", buffer: readFileSync("tests/fixtures/info-cards-sample.mp4") });
  const allocationResponse = await allocated;
  expect(allocationResponse.status()).toBe(200);
  const allocation = await allocationResponse.json();
  const browserImageUpload = imageTransfer ? await imageTransfer : true;
  if (!browserImageUpload) {
    // Diagnose the remaining provider CORS blocker independently of the real
    // image storage/publication/viewer lifecycle. This is test-only transport,
    // never an application fallback. The final assertion still fails for CORS.
    const transferred = await page.request.put(allocation.uploadURL, { headers: allocation.headers, data: pixel });
    expect(transferred.status()).toBe(200);
    const saved = await (await page.request.get(`/api/info-cards/${id}`)).json();
    expect((await page.request.patch(`/api/info-cards/${id}`, { data: { revision: saved.root.revision, visibility: "private",
      content: { ...saved.root.draft, mediaItem: allocation.media }, mediaProof: allocation.proof } })).ok()).toBe(true);
    await page.reload();
  }
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft?.mediaItem?.assetId,
    { timeout: 90_000 }).toBe(allocation.media.assetId);
  if (kind === "video") await expect.poll(async () => {
    const current = await (await page.request.get(`/api/info-cards/${id}`)).json();
    const response = await page.request.get(`/api/info-cards/${id}/media/status?revision=${current.root.revision}`);
    return response.ok() ? (await response.json()).status : "unavailable";
  }, { timeout: 120_000, intervals: [1000, 2000, 4000] }).toBe("ready");
  if (kind === "image") {
    const again = await page.request.put(allocation.uploadURL, { headers: allocation.headers, data: pixel });
    expect(again.status()).toBe(412);
  }
  const publicationResponse = page.waitForResponse(r => r.url().endsWith(`/api/info-cards/${id}/publish`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const initialPublication = await publicationResponse;
  if (initialPublication.status() >= 500) {
    console.log(JSON.stringify({ livePublication: kind, firstAttemptStatus: initialPublication.status(), checkingExistingReceiptRecovery: true }));
    await page.getByRole("button", { name: "Retry", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible({ timeout: 30_000 });
  const published = await (await page.request.get(`/api/info-cards/${id}`)).json();
  expect(published.publication.version).toBe(1);
  expect(published.publication.content.mediaItem.assetId).toBe(allocation.media.assetId);
  const foreign = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL });
  try {
    await foreign.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
    expect((await foreign.request.get(`/api/info-cards/${id}/media?version=1`)).status()).toBe(403);
    const save = await page.request.patch(`/api/info-cards/${id}`, { data: { revision: published.root.revision, visibility: "public", content: published.publication.content } });
    expect(save.ok()).toBe(true);
    expect((await page.request.post(`/api/info-cards/${id}/publish`, { data: { revision: (await save.json()).revision } })).ok()).toBe(true);
    expect((await foreign.request.get(`/api/info-cards/${id}/media?version=1`)).status()).toBe(403);
    expect((await foreign.request.get(`/api/info-cards/${id}/media?version=2`)).status()).toBe(200);
  } finally { await foreign.close(); }
  await page.goto("/library?tab=info-cards");
  const face = page.locator(`[data-info-id='${id}']`);
  await face.getByRole("button", { name: kind === "image" ? "View image" : "Watch video", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Info card media", exact: true });
  const verifyDelivery = async () => {
    await expect(viewer).toBeVisible();
    if (kind === "image") await expect.poll(() => viewer.locator("img").evaluateAll(nodes => nodes.some(n => (n as HTMLImageElement).naturalWidth > 0))).toBe(true);
    else {
      const video = viewer.locator("video");
      await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).readyState), { timeout: 45_000 }).toBeGreaterThanOrEqual(2);
      await video.evaluate(el => { const player = el as HTMLVideoElement; player.muted = true; return player.play(); });
      await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).currentTime), { timeout: 15_000 }).toBeGreaterThan(0);
    }
  };
  await verifyDelivery();
  await page.getByRole("button", { name: "Close info card media", exact: true }).click();
  await expect(face.getByRole("button", { name: kind === "image" ? "View image" : "Watch video", exact: true })).toBeFocused();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  let deckId: string;
  try {
    const main = new CardRepository(client.db(process.env.MONGODB_DB!), client);
    await new InfoCardRepository(main.db, client).assertIndexesReady(true);
    const card = await main.createCardDraft(actor, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
      intro: { title: "Disposable media carrier", description: "Retain this step.", mediaItem: null }, infoCardIds: ["demo-owner-public", id] }, "private");
    await main.publishCard(actor, card.cardTemplateId, 0);
    const deck = await main.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Disposable media carrier", cards: [{ cardTemplateId: card.cardTemplateId }] }, "private");
    await main.publishDeck(actor, deck.deckTemplateId, 0); deckId = deck.deckTemplateId;
    await main.ensureDeckData(actor, deckId, 1); await main.ensureCardData(actor, card.cardTemplateId, 1);
  } finally { await client.close(); }
  await page.goto(`/decks?openDeck=${deckId}`);
  await page.locator(".deck-card.is-active").press("Enter");
  await page.locator(".focused-card-layer .active-card-identity").click();
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  const stack = page.locator("[data-info-card-stack]");
  await expect(stack).toHaveAttribute("data-info-stack-phase", "open");
  await page.keyboard.press("ArrowDown");
  const current = page.locator('[data-info-card-current="true"]');
  await expect(current).toContainText(`Trial ${kind}`);
  await expect(stack).toHaveAttribute("data-info-stack-phase", "open");
  await current.getByRole("button", { name: kind === "image" ? "View image" : "Watch video", exact: true }).click();
  await verifyDelivery();
  await page.getByRole("button", { name: "Close info card media", exact: true }).click();
  await expect(current).toContainText(`Trial ${kind}`);
  await expect(stack).toHaveAttribute("data-info-stack-phase", "open");
  console.log(JSON.stringify({ liveMediaWorkflow: kind, browserUpload: browserImageUpload, providerUpload: true, published: true, libraryDelivery: true, pouchDelivery: true, productionDatabaseUsed: false }));
  expect(browserImageUpload, "R2 browser upload is blocked by the existing bucket's CORS policy; API upload success is not a browser-upload pass").toBe(true);
});
