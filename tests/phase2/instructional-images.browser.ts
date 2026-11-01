import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { instructionalImageUrl } from "../../src/lib/instructionalImageContext";
import { geometry } from "./helpers/presentationGeometry";

// Real Creator commands, real application auth/publication/permissions, and an
// explicitly disposable byte-storage provider. No intercepted image/API responses.
test("Creator image uploads publish and decode in normal learner Step View after reload", async ({ page, browser }) => {
  page.setDefaultTimeout(15_000);
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const db = client.db(process.env.MONGODB_DB!);
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    await page.goto("/creator/new"); await page.getByRole("button", { name: "Add card", exact: true }).click();
    const column = page.locator(".creator-column[data-card-template-id]").last(), id = (await column.getAttribute("data-card-template-id"))!;
    const root = () => db.collection("cardTemplates").findOne({ cardTemplateId: id });
    await expect.poll(async () => !!await root()).toBe(true);
    await expect(page).toHaveURL(/\/creator\/edit\/[^/]+$/);
    const deckId = new URL(page.url()).pathname.split("/").at(-1)!;
    await column.locator(".creator-card-title-button").click();
    await page.locator(".creator-modal").getByRole("textbox").fill("Understand a parabola");
    await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
    const file = { name: "Parabola.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") };
    const modal = page.locator("dialog[data-creator-step-media]");
    for (const intro of [true, false]) {
      await (intro ? column.locator(".creator-card-intro-media-slot .creator-media-upload-control") : column.getByRole("button", { name: "Manage step media", exact: true }).first()).click();
      await modal.getByLabel("Add image", { exact: true }).setInputFiles(file);
      await expect.poll(async () => {
        const card = (await root())!; return (intro ? card.draft.intro : card.draft.steps[0]).mediaItems?.length;
      }).toBe(1);
      await modal.getByRole("button", { name: "Close", exact: true }).click();
    }
    await column.getByRole("combobox", { name: "Card 1 publication visibility" }).selectOption("public");
    await column.getByRole("button", { name: /^Publish Card/ }).click();
    await page.getByRole("dialog", { name: "Confirm public publication" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
    await expect.poll(async () => (await root())?.latestVersion).toBe(1);
    await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
    await page.locator(".creator-modal textarea").fill("Study mathematical illustrations");
    await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public");
    await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
    await page.getByRole("dialog", { name: "Confirm public publication" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
    await expect.poll(async () => (await db.collection("deckTemplates").findOne({ deckTemplateId: deckId }))?.latestVersion).toBe(1);
    const content = (await db.collection("cardTemplateVersions").findOne({ cardTemplateId: id, version: 1 }))!.content;
    const learner = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL });
    learner.setDefaultTimeout(15_000);
    try {
      await learner.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
      const actor = (await db.collection("users").findOne({ username: "other" }))!._id.toString();
      const tab = await learner.newPage();
      const url = instructionalImageUrl({ viewerUserId: actor, cardTemplateId: id, version: 1, mode: "canonical", deckTemplateId: deckId, deckVersion: 1, stepId: "intro", attachmentId: content.intro.mediaItems[0].id });
      expect((await page.request.get(url)).status()).toBe(403); // context belongs to the learner, not creator
      expect((await learner.request.get(url)).status()).toBe(200);
      await tab.goto(`/library/${deckId}`);
      await tab.locator(".deck-card.is-active").press("Enter"); await geometry(tab, [".focused-card-surface--front"]);
      await tab.locator(".focused-card-surface--front .active-card-identity[role=button]").click();
      const visibleImage = tab.locator(".step-view-layer img[alt='Parabola.png']");
      await expect(visibleImage).toBeVisible();
      await expect.poll(() => visibleImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(1);
      await tab.reload(); await tab.locator(".deck-card.is-active").press("Enter"); await geometry(tab, [".focused-card-surface--front"]);
      await tab.locator(".focused-card-surface--front .active-card-identity[role=button]").click();
      await expect(visibleImage).toBeVisible();
      const stepUrl = instructionalImageUrl({ viewerUserId: actor, cardTemplateId: id, version: 1, mode: "canonical", deckTemplateId: deckId, deckVersion: 1, stepId: content.steps[0].stepId, attachmentId: content.steps[0].mediaItems[0].id });
      expect((await learner.request.get(stepUrl)).status()).toBe(200);
      expect((await learner.request.get(url + "&src=https://external.invalid/image.png")).status()).toBe(400);
    } finally { await learner.close().catch(() => {}); }
  } finally { await client.close(); }
});
