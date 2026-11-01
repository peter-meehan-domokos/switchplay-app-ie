import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { geometry } from "./helpers/presentationGeometry";

test("normal Creator publication and both hosted visuals remain available without runtime switches", async ({ page }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const db = client.db(process.env.MONGODB_DB!);
    const login = await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
    const actor = (await login.json()).user.id;
    await page.goto("/creator/new"); await page.getByRole("button", { name: "Add card", exact: true }).click();
    const column = page.locator(".creator-column[data-card-template-id]").last(), id = (await column.getAttribute("data-card-template-id"))!;
    const root = () => db.collection("cardTemplates").findOne({ cardTemplateId: id });
    await expect.poll(async () => !!await root()).toBe(true); await expect(page).toHaveURL(/\/creator\/edit\/[^/]+$/);
    const deckId = new URL(page.url()).pathname.split("/").at(-1)!;
    await column.locator(".creator-card-title-button").click(); await page.locator(".creator-modal").getByRole("textbox").fill("Explore graphs and area");
    await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
    const modal = page.locator("dialog[data-creator-step-media]");
    await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
    const selector = modal.getByRole("combobox", { name: "Add Interactive Visual", exact: true });
    await expect(selector.locator("option[value='roots-and-factors']")).toHaveCount(1);
    await expect(selector.locator("option[value='integration-area']")).toHaveCount(1);
    await selector.selectOption("roots-and-factors"); await modal.getByRole("button", { name: "Close", exact: true }).click();
    await column.getByRole("button", { name: "Manage step media", exact: true }).first().click();
    await selector.selectOption("integration-area"); await modal.getByRole("button", { name: "Close", exact: true }).click();
    await column.getByRole("button", { name: /^Publish Card/ }).click(); await expect.poll(async () => (await root())?.latestVersion).toBe(1);
    await page.getByRole("button", { name: "Edit deck title and introduction" }).click(); await page.locator(".creator-modal textarea").fill("Always available visual learning");
    await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
    await expect.poll(async () => (await db.collection("deckTemplates").findOne({ deckTemplateId: deckId }))?.latestVersion).toBe(1);
    const published = (await db.collection("cardTemplateVersions").findOne({ cardTemplateId: id, version: 1 }))!.content;
    const oldWrite = await page.request.patch(`/api/card-templates/${id}`, { data: { type: "save", revision: (await root())!.revision, content: published } });
    expect(oldWrite.status()).toBe(409); expect((await oldWrite.json()).code).toBe("STEP_MEDIA_CLIENT_REVISION_REQUIRED");
    await page.goto(`/decks?openDeck=${deckId}&openCard=${id}`);
    await page.locator(".deck-card.is-active").press("Enter"); await geometry(page, [".focused-card-surface--front"]);
    await page.locator(".focused-card-surface--front .active-card-identity[role=button]").click();
    await page.getByRole("button", { name: "Start: Roots and Factors", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Roots and Factors", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close interactive visual" }).click();
    await page.locator(".step-view-layer").getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Start: Integration", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Integration", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close interactive visual" }).click();
    expect(await db.collection("visualRecords").countDocuments({ principalKey: `account:${actor}` })).toBe(2);
  } finally { await client.close(); }
});
