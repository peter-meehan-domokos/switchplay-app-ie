import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB!);
const root = (id: string) => db().collection("cardTemplates").findOne({ cardTemplateId: id });
const media = (page: Page) => page.locator("dialog[data-creator-step-media]");
async function setup(page: Page) {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/creator/new"); await page.getByRole("button", { name: "Add card", exact: true }).click();
  const column = page.locator(".creator-column[data-card-template-id]").last(), id = (await column.getAttribute("data-card-template-id"))!;
  await expect.poll(async () => !!await root(id)).toBe(true);
  await column.locator(".creator-card-title-button").click(); await page.locator(".creator-modal").getByRole("textbox").fill("Multimedia practice");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await root(id))?.draft?.intro.title).toBe("Multimedia practice");
  return { column, id };
}
const video = { name: "watch.mp4", mimeType: "video/mp4", buffer: Buffer.from("local video fixture") };
const image = { name: "diagram.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") };

test("video processing waits for its Card save acknowledgement and keeps permission failures denied", async ({ page, browser }) => {
  const { column, id } = await setup(page), assetId = `status-${id}`;
  // Exercise actual status authorization rather than the fixture-prefix display shortcut.
  await page.route("**/api/media/stream/direct-upload", async route => {
    const response = await route.fetch(); await route.fulfill({ response, json: { ...await response.json(), uid: assetId } });
  });
  let saving = false, acknowledged = false, release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/card-templates/${id}`, async route => {
    if (route.request().method() === "PATCH" && route.request().postData()?.includes(assetId)) {
      saving = true; await held; const response = await route.fetch(); acknowledged = response.ok(); await route.fulfill({ response });
    } else await route.continue();
  });
  const early: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/media/stream/status?") && request.url().includes(assetId) && !acknowledged) early.push(request.url()); });
  try {
    await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
    await media(page).getByLabel("Add video", { exact: true }).setInputFiles(video);
    await expect.poll(() => saving).toBe(true); await expect(media(page).locator("li[data-attachment-id]")).toHaveCount(1);
    await page.waitForTimeout(300); expect(early).toEqual([]);
    release(); await expect(media(page).getByText("Video ready", { exact: true })).toBeVisible();
    expect((await root(id))!.draft.intro.mediaItems[0].media.assetId).toBe(assetId);
    await media(page).getByRole("button", { name: "Close", exact: true }).click();
    await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
    await expect(media(page).getByText("Video ready", { exact: true })).toBeVisible();
    const outsider = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL });
    try {
      await outsider.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
      const query = new URLSearchParams({ scope: "card-template", deckTemplateId: "unchanged-context", cardTemplateId: id, assetId });
      const denied = await outsider.request.get(`/api/media/stream/status?${query}`);
      expect(denied.status()).toBe(403); expect((await denied.json()).code).toBe("CARD_FORBIDDEN");
    } finally { await outsider.close(); }
  } finally { release(); }
});

test("four ordered visuals, actual label-width rejection, keyboard return and draft publication stay independent", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const { column, id } = await setup(page), trigger = column.locator(".creator-card-intro-media-slot .creator-media-upload-control");
  await trigger.click();
  for (const activityId of ["roots-and-factors", "integration-area", "roots-and-factors", "integration-area"]) {
    await media(page).getByRole("combobox", { name: "Add Interactive Visual", exact: true }).selectOption(activityId);
  }
  const rows = () => media(page).locator("li[data-attachment-id]");
  await expect(rows()).toHaveCount(4); await expect(media(page).getByLabel("Add video", { exact: true })).toBeDisabled();
  await expect.poll(async () => (await root(id))?.draft.intro.mediaItems?.length).toBe(4);
  await media(page).screenshot({ path: "/private/tmp/plugged-in-creator-media-320.png" });
  const accepted = (await root(id))!.draft.intro.mediaItems;
  await rows().first().getByRole("textbox", { name: "Tab label", exact: true }).fill("WWWWWWWW");
  await expect(rows().first().getByRole("textbox", { name: "Tab label", exact: true })).toHaveAttribute("aria-invalid", "true");
  expect((await root(id))!.draft.intro.mediaItems[0].label).toBe("Explore");
  await rows().first().getByRole("textbox", { name: "Tab label", exact: true }).fill("Try");
  await rows().last().getByRole("button", { name: "Move up", exact: true }).click();
  await expect.poll(async () => (await root(id))?.draft.intro.mediaItems.map((item: { id: string }) => item.id)).toEqual([accepted[0].id, accepted[1].id, accepted[3].id, accepted[2].id]);
  expect((await root(id))!.latestVersion).toBe(0);
  const dialogBox = await media(page).boundingBox(); expect(dialogBox!.x).toBeGreaterThanOrEqual(0); expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  for (let index = 0; index < 3; index++) {
    await column.getByRole("button", { name: "Manage step media", exact: true }).nth(index).click();
    await media(page).getByRole("combobox", { name: "Add Interactive Visual", exact: true }).selectOption("roots-and-factors");
    await media(page).getByRole("button", { name: "Close", exact: true }).click();
  }
  await expect.poll(async () => (await root(id))?.draft.steps.map((step: { mediaItems?: unknown[] }) => step.mediaItems?.length)).toEqual([1, 1, 1]);
  await page.reload(); await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
  await expect(rows()).toHaveCount(4); await expect(rows().first().getByRole("textbox", { name: "Tab label", exact: true })).toHaveValue("Try");
  await rows().first().getByRole("button", { name: "Remove", exact: true }).click(); await expect(rows()).toHaveCount(3);
  await media(page).getByRole("button", { name: "Close", exact: true }).click();
  await column.getByRole("button", { name: "Publish Card 1", exact: true }).click();
  await expect.poll(async () => (await root(id))?.latestVersion).toBe(1);
  const published = await db().collection("cardTemplateVersions").findOne({ cardTemplateId: id, version: 1 });
  await trigger.click(); await rows().first().getByRole("button", { name: "Remove", exact: true }).click();
  await expect.poll(async () => (await root(id))?.draft?.intro.mediaItems.length).toBe(2);
  expect((await db().collection("cardTemplateVersions").findOne({ cardTemplateId: id, version: 1 }))!.content).toEqual(published!.content);
});

test("image and video uploads attach once; failed replacement and cancelled upload retain existing items", async ({ page }) => {
  const { column, id } = await setup(page); await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
  await media(page).getByLabel("Add image", { exact: true }).setInputFiles(image);
  await expect.poll(async () => (await root(id))?.draft.intro.mediaItems?.length).toBe(1);
  await media(page).getByLabel("Add video", { exact: true }).setInputFiles(video);
  await expect.poll(async () => (await root(id))?.draft.intro.mediaItems?.length).toBe(2);
  await expect(media(page).getByLabel("Add video", { exact: true })).toBeEnabled();
  const before = (await root(id))!.draft.intro.mediaItems;
  await page.route(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/upload`, route => route.fulfill({ status: 500, body: "Fixture failure" }));
  await media(page).getByLabel("Replace Image with video", { exact: true }).setInputFiles(video);
  await expect(media(page).getByRole("alert")).toContainText("upload failed");
  expect((await root(id))!.draft.intro.mediaItems).toEqual(before);
  await page.unroute(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/upload`);
  let started = false, release!: () => void; const paused = new Promise<void>(resolve => { release = resolve; });
  await page.route(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/upload`, async route => { started = true; await paused; await route.continue(); });
  await media(page).getByLabel("Add image", { exact: true }).setInputFiles(image); await expect.poll(() => started).toBe(true);
  await expect(media(page).getByRole("combobox", { name: "Add Interactive Visual", exact: true })).toBeDisabled();
  await media(page).getByRole("button", { name: "Cancel upload", exact: true }).click(); release();
  await expect(media(page).getByLabel("Add video", { exact: true })).toBeEnabled();
  expect((await root(id))!.draft.intro.mediaItems).toEqual(before);
  await page.unroute(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/upload`);
  await media(page).getByLabel("Replace Watch with image", { exact: true }).setInputFiles(image);
  await expect.poll(async () => (await root(id))?.draft.intro.mediaItems?.[1]?.kind).toBe("image");
  const after = (await root(id))!.draft.intro.mediaItems;
  expect(after[1].id).toBe(before[1].id); expect(after[1].label).toBe("Watch"); expect(after[0]).toEqual(before[0]);
});

test("a signed-in actor change during transfer cannot attach the upload to the former account", async ({ page }) => {
  const { column, id } = await setup(page); await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
  let started = false, release!: () => void; const paused = new Promise<void>(resolve => { release = resolve; });
  await page.route(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/upload`, async route => { started = true; await paused; await route.continue(); });
  await media(page).getByLabel("Add video", { exact: true }).setInputFiles(video); await expect.poll(() => started).toBe(true);
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } }); release();
  await expect(media(page).getByRole("alert")).toContainText("signed-in creator changed");
  expect((await root(id))!.draft.intro.mediaItems).toBeUndefined(); expect((await root(id))!.draft.intro.mediaItem).toBeNull();
});

test("opening legacy media makes no draft write; an explicit edit preserves that video and step uploads use the correct destination", async ({ page }) => {
  const { column, id } = await setup(page);
  const legacy = { id: "legacy-video", mediaType: "video", provider: "cloudflare-stream", assetId: "fixture-legacy", src: "https://iframe.videodelivery.net/fixture-legacy", description: "Existing video" };
  await db().collection("cardTemplates").updateOne({ cardTemplateId: id }, { $set: { "draft.intro.mediaItem": legacy } });
  const before = (await root(id))!; await page.reload();
  await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
  await expect(media(page).locator("li[data-attachment-id]")).toHaveCount(1);
  await media(page).getByRole("button", { name: "Close", exact: true }).click();
  expect((await root(id))!.revision).toBe(before.revision); expect((await root(id))!.draft).toEqual(before.draft);
  await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
  await media(page).getByRole("combobox", { name: "Add Interactive Visual", exact: true }).selectOption("integration-area");
  await expect.poll(async () => (await root(id))?.draft.intro.mediaItems?.length).toBe(2);
  const changed = (await root(id))!; expect(changed.draft.intro.mediaItem).toBeUndefined(); expect(changed.draft.intro.mediaItems[0].media).toEqual(legacy);
  expect(changed.draft.steps).toEqual(before.draft.steps);
  await media(page).getByRole("button", { name: "Close", exact: true }).click();
  await column.getByRole("button", { name: "Manage step media", exact: true }).nth(2).click();
  await media(page).getByLabel("Add image", { exact: true }).setInputFiles(image);
  await expect.poll(async () => (await root(id))?.draft.steps[2].mediaItems?.[0]?.kind).toBe("image");
  const final = (await root(id))!; expect(final.draft.intro).toEqual(changed.draft.intro);
  expect(final.draft.steps.slice(0, 2)).toEqual(before.draft.steps.slice(0, 2));
});
