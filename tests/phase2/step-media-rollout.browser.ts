import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { withStepMedia } from "../../src/lib/stepMedia";

test("disabled media writers preserve legacy uploads and deny new array saves and publication without changing data", async ({ page }) => {
  expect(process.env.SWITCHPLAY_STEP_MEDIA_WRITES).toBe("0"); assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const db = client.db(process.env.MONGODB_DB!);
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    await page.goto("/creator/new"); await page.getByRole("button", { name: "Add card", exact: true }).click();
    const column = page.locator(".creator-column[data-card-template-id]").last(), id = (await column.getAttribute("data-card-template-id"))!;
    const root = () => db.collection("cardTemplates").findOne({ cardTemplateId: id });
    await expect.poll(async () => !!await root()).toBe(true);
    await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
    const modal = page.locator("dialog[data-creator-step-media]");
    await expect(modal.getByRole("combobox")).toHaveCount(0); await expect(modal.getByLabel("Add image", { exact: true })).toHaveCount(0);
    await modal.getByLabel("Add video", { exact: true }).setInputFiles({ name: "legacy.mp4", mimeType: "video/mp4", buffer: Buffer.from("local fixture") });
    await expect.poll(async () => (await root())?.draft.intro.mediaItem?.mediaType).toBe("video");
    const before = (await root())!; expect(before.draft.intro.mediaItems).toBeUndefined();
    await expect(modal.getByLabel("Add video", { exact: true })).toBeDisabled();
    await modal.getByLabel("Replace Watch with video", { exact: true }).setInputFiles({ name: "replace.mp4", mimeType: "video/mp4", buffer: Buffer.from("local replacement") });
    await expect.poll(async () => (await root())?.draft.intro.mediaItem?.assetId).not.toBe(before.draft.intro.mediaItem.assetId);
    const legacy = (await root())!, content = { ...legacy.draft, intro: withStepMedia(legacy.draft.intro, [{ id: "visual", label: "Explore", kind: "activity", activityId: "roots-and-factors" }]) };
    const headers = { "X-Creator-Actor": process.env.PHASE2_USER_ID!, "X-Step-Media-Protocol": "1" };
    const denied = await page.request.patch(`/api/card-templates/${id}`, { headers, data: { type: "save", revision: legacy.revision, content } });
    expect(denied.status()).toBe(409); expect((await denied.json()).code).toBe("STEP_MEDIA_CLIENT_REVISION_REQUIRED");
    expect((await root())!.draft).toEqual(legacy.draft);
    // Seed a prior modern draft directly in this disposable fixture to verify
    // rollback preserves it and cannot publish it through the legacy route.
    await db.collection("cardTemplates").updateOne({ cardTemplateId: id }, { $set: { draft: { ...content, intro: { ...content.intro, title: "Retained modern draft" } } } });
    const modern = (await root())!;
    const publication = await page.request.patch(`/api/card-templates/${id}`, { headers, data: { type: "publish", revision: modern.revision } });
    expect(publication.status()).toBe(409); expect((await root())!.draft).toEqual(modern.draft); expect((await root())!.latestVersion).toBe(0);
  } finally { await client.close(); }
});
