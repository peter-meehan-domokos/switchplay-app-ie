import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { instructionalImageUrl, type InstructionalImageContext } from "../../src/lib/instructionalImageContext";

test("the real Next image endpoint authorizes exact context, decodes local fixture bytes and denies changed actors", async ({ page }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client, "1"), actor = process.env.PHASE2_USER_ID!;
    const owner = (await repo.users().findOne({ username: "other" }))!._id.toString(), attachmentId = randomUUID();
    const defaults = createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]);
    const card = await repo.createCardDraft(owner, { ...defaults, intro: { title: "Instructional image", description: null,
      mediaItems: [{ id: attachmentId, kind: "image", label: "Image", alt: "A diagram", media: { id: "fixture-image", mediaType: "image", provider: "cloudflare-r2",
        assetId: "fixtures/diagram.png", src: `${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/assets/fixtures/diagram.png`, description: "A diagram" } }] } }, "public");
    await repo.publishCard(owner, card.cardTemplateId, 0);
    const deck = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Image test", cards: [{ cardTemplateId: card.cardTemplateId }] }, "public");
    await repo.publishDeck(owner, deck.deckTemplateId, 0);
    const context: InstructionalImageContext = { viewerUserId: actor, cardTemplateId: card.cardTemplateId, version: 1, mode: "canonical", deckTemplateId: deck.deckTemplateId, deckVersion: 1, stepId: "intro", attachmentId };
    const url = instructionalImageUrl(context);
    expect((await page.request.get(url)).status()).toBe(401);
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    const result = await page.request.get(url); expect(result.status()).toBe(200);
    expect(result.headers()["content-type"]).toBe("image/png"); expect(result.headers()["cache-control"]).toBe("private, no-store");
    expect(result.headers()["x-content-type-options"]).toBe("nosniff"); expect((await result.body()).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    await page.goto("/library");
    expect(await page.evaluate(src => new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.onerror = () => reject(new Error("Image did not decode")); image.src = src;
    }), url)).toEqual({ width: 1, height: 1 });
    expect((await page.request.get(instructionalImageUrl({ ...context, attachmentId: randomUUID() }))).status()).toBe(403);
    expect((await page.request.get(url + "&src=https://external.invalid/image.png")).status()).toBe(400);
    await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
    expect((await page.request.get(url)).status()).toBe(403);
  } finally { await client.close(); }
});
