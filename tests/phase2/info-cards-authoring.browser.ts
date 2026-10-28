import { expect, test, type Page } from "@playwright/test";
import { randomUUID, createHmac } from "node:crypto";
import { SignJWT } from "jose";
import { MongoClient } from "mongodb";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";

async function login(page: Page, username = "phase2") {
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).ok()).toBeTruthy();
}
async function create(page: Page) {
  await page.goto("/creator/info-cards/new");
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption({ label: "Basics (phase2)" });
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Signs");
  await page.getByRole("textbox", { name: "Explanation", exact: true }).fill("Keep the sign attached to its number.\n\nCheck each step before continuing.");
  await expect(page).toHaveURL(/\/creator\/info-cards\/[a-f\d-]+\?entry=create$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.getByRole("status", { exact: false }).filter({ hasText: /^Saved$/ })).toBeVisible();
  return id;
}

test("mode switch, private publication, clean edit, independent drafts and published Library snapshot", async ({ page }) => {
  await login(page); await page.goto("/creator/new");
  await page.getByRole("combobox", { name: "Creator mode" }).selectOption("info-card");
  await expect(page).toHaveURL(/\/creator\/info-cards\/new/);
  const id = await create(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  const card = page.locator(`[data-info-id="${id}"]`);
  await expect(card).toContainText("Keep the sign attached"); await expect(card).toContainText("Private");
  await card.getByRole("link", { name: "Edit Signs" }).click();
  await expect(page.getByRole("combobox", { name: "Creator mode" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Edit Info Card", exact: true })).toBeVisible();
  expect((await (await page.request.get("/api/info-cards?limit=50")).json()).items.some((item: { infoCardId: string }) => item.infoCardId === id)).toBe(false);
  await page.getByRole("textbox", { name: "Explanation", exact: true }).fill("Changed draft only.");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "My Drafts" }).locator('button[aria-current="true"]')).toContainText("Signs");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(`[data-info-id="${id}"]`)).toContainText("Keep the sign attached");
  await expect(page.locator(`[data-info-id="${id}"]`)).not.toContainText("Changed draft only");
  await page.getByRole("link", { name: "Decks", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Library sections" }).getByRole("link", { name: "Decks", exact: true })).toHaveAttribute("aria-current", "page");
});

test("public confirmation, attribution, collaboration and owner-only editing", async ({ page }) => {
  await login(page); const id = await create(page);
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption({ label: "Basics (other)" });
  await expect(page.getByLabel("Series selection")).toContainText("(other)");
  await page.getByRole("combobox", { name: "Info Card publication visibility" }).selectOption("public");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Publish Info Card publicly?" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await dialog.getByRole("button", { name: "Publish publicly", exact: true }).click();
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Info Card publication visibility" })).toBeDisabled();
  const data = await (await page.request.get(`/api/info-cards/${id}`)).json();
  expect(data.selectedSeries.creatorUsername).toBe("other"); expect(data.root.ownerUserId).not.toBe(data.selectedSeries.createdByUserId);
  await login(page, "other"); await page.goto(`/creator/info-cards/${id}`);
  await expect(page.getByText("Info Card unavailable.", { exact: true })).toBeVisible();
  await page.goto("/library?tab=info-cards");
  await expect(page.locator(`[data-info-id="${id}"]`)).toBeVisible();
  await expect(page.locator(`[data-info-id="${id}"]`)).toContainText("Basics (series by other)");
  await expect(page.locator(`[data-info-id="${id}"]`)).toContainText("Card by phase2");
  await expect(page.locator(`[data-info-id="${id}"]`).getByRole("link", { name: /^Edit/ })).toHaveCount(0);
  await expect(page.locator('[data-info-id="demo-owner-private"]')).toHaveCount(0);
  await expect(page.locator('[data-info-id="demo-other-private"]')).toBeVisible();
});

test("incomplete/overflow publication and conflicted save preserve text and prevent mode navigation", async ({ page }) => {
  await login(page); await page.goto("/creator/info-cards/new");
  const incompleteId = randomUUID();
  expect((await page.request.post("/api/info-cards", { data: { infoCardId: incompleteId } })).ok()).toBeTruthy();
  expect((await page.request.patch(`/api/info-cards/${incompleteId}`, { data: { revision: 0, visibility: "private", content: { title: "Incomplete", body: "", seriesId: null, mediaItem: null } } })).ok()).toBeTruthy();
  await page.goto(`/creator/info-cards/${incompleteId}`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Choose a series");
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Incomplete");
  const id = await create(page);
  await page.getByRole("textbox", { name: "Explanation", exact: true }).fill("This cannot fit. ".repeat(100));
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.locator("#info-body-capacity")).toContainText("The explanation is too long or wide to fit safely:");
  await page.route(`**/api/info-cards/${id}`, async route => {
    if (route.request().method() === "PATCH") await route.fulfill({ status: 409, json: { error: "STALE_INFO_REVISION" } }); else await route.continue();
  });
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Local conflict");
  await expect(page.getByRole("main").getByRole("alert").filter({ hasText: "changed in another session" })).toBeVisible();
  await page.getByRole("combobox", { name: "Creator mode" }).selectOption("deck");
  await expect(page).toHaveURL(new RegExp(`/creator/info-cards/${id}`));
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Local conflict");
});

test("series creation is explicit, attributed and does not duplicate the creator's normalised name", async ({ page }) => {
  await login(page); await page.goto("/creator/info-cards/new");
  const title = `Series ${randomUUID().slice(0, 5)}`;
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption("__create__");
  await page.getByRole("textbox", { name: "New series name", exact: true }).fill(title);
  await page.getByRole("button", { name: "Create series", exact: true }).click();
  await expect(page.getByLabel("Series selection")).toContainText(`${title} (phase2)`);
  await expect(page).toHaveURL(/\/creator\/info-cards\/[a-f\d-]+\?entry=create$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft?.seriesId).toBeTruthy();
  const first = (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft.seriesId;
  const again = await (await page.request.post("/api/info-card-series", { data: { seriesId: randomUUID(), title: ` ${title.toUpperCase()} ` } })).json();
  expect(again.seriesId).toBe(first);
});

test("My Drafts traverses more than one page and stays usable from Deck mode", async ({ page }) => {
  await login(page);
  const batch = randomUUID().slice(0, 5);
  for (let index = 0; index < 52; index++) {
    const id = `paged-${randomUUID()}`;
    expect((await page.request.post("/api/info-cards", { data: { infoCardId: id } })).ok()).toBeTruthy();
    expect((await page.request.patch(`/api/info-cards/${id}`, { data: { revision: 0, visibility: "private", content: { title: `Paged ${batch} ${index}`, body: "", seriesId: null, mediaItem: null } } })).ok()).toBeTruthy();
  }
  await page.goto("/creator/new"); await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "My Drafts" });
  await expect(modal.getByRole("button", { name: `Paged ${batch} 0 · Info Card`, exact: true })).toBeVisible();
  await expect(modal.getByRole("button", { name: `Paged ${batch} 51 · Info Card`, exact: true })).toBeVisible();
  await modal.getByRole("button", { name: `Paged ${batch} 0 · Info Card`, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(`Paged ${batch} 0`);
});

test("mobile editor and static Library retain fixed card dimensions and fit the viewport", async ({ page }, info) => {
  await login(page); await page.setViewportSize({ width: 390, height: 844 }); const id = await create(page);
  const face = page.locator("[data-info-card-face]"); await expect(face).toHaveCSS("height", "204px"); await expect(face).toHaveCSS("width", "240px");
  expect(await face.locator("button[aria-expanded]").evaluate(node => node.getBoundingClientRect().height)).toBeLessThan(13);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("info-editor-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Publish", exact: true }).click(); await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click(); await expect(page.locator(`[data-info-id="${id}"]`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("info-library-mobile.png"), fullPage: true });
});

test("unverified real media fails closed while text stays saved and cancelled upload permits navigation", async ({ page }) => {
  await login(page); const id = await create(page);
  await page.getByLabel("Upload Info Card media", { exact: true }).setInputFiles({ name: "a.png", mimeType: "image/png", buffer: Buffer.from("fixture") });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("protected Cloudflare delivery has been verified");
  const saved = await (await page.request.get(`/api/info-cards/${id}`)).json(); expect(saved.root.draft.mediaItem).toBeNull(); expect(saved.root.draft.body).toContain("Keep the sign attached");
  await page.getByRole("combobox", { name: "Creator mode" }).selectOption("deck"); await expect(page).toHaveURL(new RegExp(`/creator/info-cards/${id}`));
  await page.getByRole("button", { name: "Cancel upload", exact: true }).click();
  await page.getByRole("combobox", { name: "Creator mode" }).selectOption("deck"); await expect(page).toHaveURL(/\/creator\/new$/);
  expect((await (await page.request.get(`/api/info-cards/${id}`)).json()).root.latestVersion).toBe(0);
});

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

test("mocked image transfer uses real proof-checked draft save; cancellation, preview and removal preserve state", async ({ page }) => {
  await login(page); const id = await create(page);
  const root = (await (await page.request.get(`/api/info-cards/${id}`)).json()).root;
  const media = { id: "image", provider: "cloudflare-r2", mediaType: "image", assetId: `info-cards/${root.ownerUserId}/${id}/image.png`, src: `https://private.invalid/info-cards/${id}/image.png`, description: "Image" };
  const proof = await new SignJWT({ purpose: "info-upload", actor: root.ownerUserId, infoCardId: id, createdAt: root.createdAt, provider: media.provider, assetId: media.assetId, src: media.src })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(createHmac("sha256", "local-phase2-browser-test-secret-only").update("switchplay:info-card-upload:v1").digest());
  await page.route(`**/api/info-cards/${id}/upload`, route => route.fulfill({ json: { media, proof, uploadURL: `${new URL(page.url()).origin}/__fixture-info-upload`, headers: { "Content-Type": "image/png", "If-None-Match": "*" } } }));
  let pause: Promise<void> | null = null, release = () => {}, started = false;
  await page.route("**/__fixture-info-upload", async route => {
    expect(route.request().headers()["if-none-match"]).toBe("*"); started = true; if (pause) await pause;
    await route.fulfill({ status: 200 }).catch(() => {});
  });
  await page.getByLabel("Upload Info Card media", { exact: true }).setInputFiles({ name: "a.png", mimeType: "image/png", buffer: pixel });
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft?.mediaItem?.assetId).toBe(media.assetId);
  const twelveLines = Array(12).fill("Line").join("\n");
  const explanation = page.getByRole("textbox", { name: "Explanation", exact: true });
  await explanation.fill(twelveLines);
  await expect(page.locator("#info-body-capacity")).toBeVisible();
  await expect(explanation).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Remove media", exact: true }).click();
  await expect(page.locator("#info-body-capacity")).toHaveCount(0);
  await expect(explanation).not.toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Upload Info Card media", { exact: true }).setInputFiles({ name: "a.png", mimeType: "image/png", buffer: pixel });
  await expect(page.locator("#info-body-capacity")).toBeVisible();
  await explanation.fill("Keep the sign attached to its number.\n\nCheck each step before continuing.");
  await expect(page.locator("#info-body-capacity")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("");
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft?.title).toBe("");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Remove media", exact: true })).toBeVisible();
  expect((await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft.mediaItem.assetId).toBe(media.assetId);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Signs");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  const legacy = (await (await page.request.get(`/api/info-cards/${id}`)).json()).root;
  expect((await page.request.patch(`/api/info-cards/${id}`, { data: { revision: legacy.revision, visibility: "private", content: { ...legacy.draft, seriesId: null } } })).ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Signs");
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Remove media", exact: true })).toBeVisible();
  await expect(explanation).toHaveValue("Keep the sign attached to its number.\n\nCheck each step before continuing.");
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption("demo-series-owner");
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toBeEditable();
  pause = new Promise(resolve => { release = resolve; }); started = false;
  await page.getByLabel("Upload Info Card media", { exact: true }).setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: pixel });
  await expect.poll(() => started).toBe(true);
  await page.getByRole("textbox", { name: "Explanation", exact: true }).fill("Text changed during upload.");
  await page.getByRole("button", { name: "Cancel upload", exact: true }).click(); release();
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft?.body).toBe("Text changed during upload.");
  let requested = "";
  await page.route(`**/api/info-cards/${id}/media?*`, route => { requested = route.request().url(); return route.fulfill({ contentType: "image/png", body: pixel }); });
  await page.getByRole("button", { name: "View image", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Info card media", exact: true }); await expect(viewer.getByAltText("Image", { exact: true })).toBeVisible();
  expect(new URL(requested).searchParams.has("revision")).toBe(true);
  await viewer.getByRole("button", { name: "Close info card media", exact: true }).click();
  await expect(page.getByRole("button", { name: "View image", exact: true })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).toHaveValue("Text changed during upload.");
  await page.getByRole("button", { name: "Remove media", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft?.mediaItem).toBeNull();
});

test("Library media uses the selected publication and only its dedicated control opens the viewer", async ({ page }) => {
  await login(page);
  const me = (await (await page.request.get("/api/auth/me")).json()).user;
  const card = { infoCardId: "fixture-publication", version: 7, ownerUserId: me.id, creatorUsername: me.username, visibility: "private", series: { seriesId: "s", title: "Basics", createdByUserId: me.id, creatorUsername: me.username }, content: {
    title: "Signs", body: "Keep signs attached.", seriesId: "s", mediaItem: { id: "image", provider: "cloudflare-r2", mediaType: "image", assetId: "image", src: "https://private.invalid/image.png", description: "Image" } } };
  // Use the ordinary authorised catalogue read with a stored publication;
  // only provider delivery below is mocked.
  // This bypasses upload verification in test data, not in application code.
  expect(process.env.MONGODB_DB).toMatch(/^switchplay_phase2_browser_/);
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const repo = new InfoCardRepository(client.db(process.env.MONGODB_DB), client);
    await repo.create(me.id, card.infoCardId);
    await repo.save(me.id, card.infoCardId, 0, { ...card.content, seriesId: "demo-series-owner", mediaItem: null }, "private");
    await repo.publish(me.id, card.infoCardId, 1);
    await repo.versions().updateOne({ infoCardId: card.infoCardId, version: 1 }, { $set: { version: card.version, "content.mediaItem": card.content.mediaItem } });
    await repo.roots().updateOne({ infoCardId: card.infoCardId }, { $set: { latestVersion: card.version } });
  } finally { await client.close(); }
  let query = "";
  await page.route("**/api/info-cards/fixture-publication/media?*", route => { query = route.request().url(); return route.fulfill({ contentType: "image/png", body: pixel }); });
  await page.goto("/library?tab=info-cards");
  const publication = page.locator('[data-info-id="fixture-publication"]');
  await publication.getByText("Keep signs attached.", { exact: true }).click(); await expect(page.getByRole("dialog", { name: "Info card media", exact: true })).toHaveCount(0);
  await publication.getByRole("button", { name: "View image", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Info card media", exact: true }).getByAltText("Image", { exact: true })).toBeVisible();
  expect(new URL(query).searchParams.get("version")).toBe("7");
  await page.getByRole("button", { name: "Close info card media", exact: true }).click();
  await expect(publication.getByRole("button", { name: "View image", exact: true })).toBeFocused();
});

test("video upload uses multipart transfer, processing feedback and an exact-context playback resolver", async ({ page }) => {
  await login(page); const id = await create(page);
  const root = (await (await page.request.get(`/api/info-cards/${id}`)).json()).root;
  const media = { id: "video", provider: "cloudflare-stream", mediaType: "video", assetId: `fixture-${randomUUID()}`, src: "https://iframe.videodelivery.net/fixture", description: "Video" };
  const proof = await new SignJWT({ purpose: "info-upload", actor: root.ownerUserId, infoCardId: id, createdAt: root.createdAt, provider: media.provider, assetId: media.assetId, src: media.src })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m")
    .sign(createHmac("sha256", "local-phase2-browser-test-secret-only").update("switchplay:info-card-upload:v1").digest());
  const origin = new URL(page.url()).origin;
  await page.route(`**/api/info-cards/${id}/upload`, route => route.fulfill({ json: { media, proof, uploadURL: `${origin}/__fixture-info-video-upload` } }));
  await page.route("**/__fixture-info-video-upload", route => {
    expect(route.request().method()).toBe("POST"); expect(route.request().headers()["content-type"]).toContain("multipart/form-data"); return route.fulfill({ status: 200 });
  });
  let statuses = 0;
  await page.route(`**/api/info-cards/${id}/media/status?*`, route => route.fulfill({ json: ++statuses === 1 ? { status: "processing", progress: 42 } : { status: "ready" } }));
  let requestURL = "", requestActor = "";
  await page.route(`**/api/info-cards/${id}/media?*`, route => {
    requestURL = route.request().url(); requestActor = route.request().headers()["x-creator-actor"];
    return route.fulfill({ json: { assetId: media.assetId, manifestUrl: `${origin}/__fixture-info.m3u8`, thumbnailUrl: `${origin}/__fixture-info.png`, expiresAt: Date.now() + 60000, reuseUntil: Date.now() + 30000 } });
  });
  await page.route("**/__fixture-info.m3u8", route => route.fulfill({ contentType: "application/vnd.apple.mpegurl", body: "#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXT-X-ENDLIST\n" }));
  await page.route("**/__fixture-info.png", route => route.fulfill({ contentType: "image/png", body: pixel }));
  await page.getByLabel("Upload Info Card media", { exact: true }).setInputFiles({ name: "a.mp4", mimeType: "video/mp4", buffer: Buffer.from("provider transfer fixture") });
  await expect(page.getByRole("status").filter({ hasText: "Processing video: 42%" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Video ready" })).toBeVisible();
  await page.getByRole("button", { name: "Watch video", exact: true }).click();
  await expect.poll(() => requestURL).toContain("revision="); expect(requestActor).toBe(root.ownerUserId);
  await page.getByRole("button", { name: "Close info card media", exact: true }).click();
  await expect(page.getByRole("button", { name: "Watch video", exact: true })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).toHaveValue("Keep the sign attached to its number.\n\nCheck each step before continuing.");
});

test("browser Back finishes a pending text save and account changes hide the old editor", async ({ page }) => {
  await login(page); await page.goto("/library?tab=info-cards");
  await page.getByRole("button", { name: /menu/i }).click();
  await page.getByRole("menuitem", { name: "Create", exact: true }).click();
  await page.getByRole("combobox", { name: "Creator mode" }).selectOption("info-card");
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption({ label: "Basics (phase2)" });
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Back preserves me");
  await expect(page).toHaveURL(/\/creator\/info-cards\/[a-f\d-]+\?entry=create$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("textbox", { name: "Explanation", exact: true }).fill("Last change before Back."); await page.goBack();
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft?.body).toBe("Last change before Back.");
  await page.goto(`/creator/info-cards/${id}`); await login(page, "other");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("Your account changed. Reload before continuing.", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).toHaveCount(0);
});

test("keyboard attribution, publication confirmation and My Drafts restore focus", async ({ page }) => {
  await login(page); await create(page);
  const series = page.locator("[data-info-card-face]").getByRole("button", { name: "Series Basics; show series creator", exact: true });
  await series.focus(); if (await series.getAttribute("aria-expanded") === "false") await page.keyboard.press("Enter");
  await expect(page.getByRole("tooltip")).toHaveText("phase2");
  await page.keyboard.press("Escape"); await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Info Card publication visibility" }).selectOption("public");
  const publish = page.getByRole("button", { name: "Publish", exact: true }); await publish.focus(); await page.keyboard.press("Enter");
  const confirmation = page.getByRole("dialog", { name: "Publish Info Card publicly?", exact: true });
  await expect(confirmation).toBeVisible(); await page.keyboard.press("Tab");
  expect(await confirmation.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape"); await expect(confirmation).toHaveCount(0); await expect(publish).toBeFocused();
  const drafts = page.getByRole("button", { name: "My Drafts", exact: true }); await drafts.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "My Drafts", exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog", { name: "My Drafts", exact: true })).toHaveCount(0); await expect(drafts).toBeFocused();
});

test("Library has no unrequested controls and card attribution is directly below each face", async ({ page }) => {
  await login(page); await page.goto("/library?tab=info-cards");
  await expect(page.locator("[data-info-id]").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search Info Cards" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Search", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create Info Card" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  const card = page.locator('[data-info-id="demo-owner-public"]');
  await expect(card).toContainText("Basics (series by phase2)");
  await expect(card.locator("[data-info-card-face] + p")).toHaveText("Card by phase2");
  const gap = await card.evaluate(node => node.querySelector("[data-info-card-face]")!.nextElementSibling!.getBoundingClientRect().top - node.querySelector("[data-info-card-face]")!.getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(3); expect(gap).toBeLessThanOrEqual(8);
});

test("new-item context survives autosave/reload; Library edit returns to Info Cards without a mode selector", async ({ page }) => {
  await login(page); const id = await create(page);
  await page.reload(); await expect(page.getByRole("combobox", { name: "Creator mode" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Info Card", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.locator(`[data-info-id="${id}"]`).getByRole("link", { name: "Edit Signs" }).click();
  await expect(page).toHaveURL(new RegExp(`/creator/info-cards/${id}$`));
  await page.reload(); await expect(page.getByRole("combobox", { name: "Creator mode" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Edit Info Card", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click(); await expect(page).toHaveURL("/library?tab=info-cards");
});

test("My Drafts Info Card edits return to Library, with an explicit unpublished warning", async ({ page }) => {
  await login(page); const id = await create(page);
  const title = `Draft ${randomUUID().slice(0, 5)}`;
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  await page.goto("/creator/new"); await expect(page.getByRole("combobox", { name: "Creator mode" })).toHaveValue("deck");
  await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  await page.getByRole("dialog", { name: "My Drafts" }).getByRole("button", { name: `${title} · Info Card`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/creator/info-cards/${id}\\?draftOrigin=`));
  await expect(page.getByRole("combobox", { name: "Creator mode" })).toHaveCount(0);
  await page.reload(); await expect(page.getByRole("button", { name: "Back to My Drafts", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "My Drafts", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  const leave = page.getByRole("dialog", { name: "Leave Info Card Creator?", exact: true });
  await expect(leave).toContainText("saved in My Drafts"); await leave.getByRole("button", { name: "Stay in Creator", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(title);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await leave.getByRole("button", { name: "Leave without publishing", exact: true }).click();
  await expect(page).toHaveURL(/\/library\?tab=info-cards$/);
  await expect(page.locator(`[data-info-id="${id}"]`)).toHaveCount(0);
});

test("Library preserves owner-first latest-publication ordering across its real pagination", async ({ page }) => {
  await login(page);
  expect(process.env.MONGODB_DB).toMatch(/^switchplay_phase2_browser_/);
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const db = client.db(process.env.MONGODB_DB), repo = new InfoCardRepository(db, client);
    const users = await db.collection("users").find({ username: { $in: ["phase2", "other"] } }).toArray();
    const own = users.find(user => user.username === "phase2")!._id.toString(), other = users.find(user => user.username === "other")!._id.toString();
    const prefix = `order-${randomUUID()}`;
    for (let i = 0; i < 36; i++) {
      const actor = i < 31 ? own : other, id = `${prefix}-${i}`;
      await repo.create(actor, id);
      await repo.save(actor, id, 0, { title: `Order ${i}`, body: "A reference note.", seriesId: actor === own ? "demo-series-owner" : "demo-series-other", mediaItem: null }, "public");
      await repo.publish(actor, id, 1);
      // Mix original dates independently of publication order and owner priority.
      await repo.roots().updateOne({ infoCardId: id }, { $set: { createdAt: new Date(Date.UTC(2025, 0, i % 9 + 1)) } });
    }
    const roots = await repo.roots().find({ latestVersion: { $gt: 0 }, $or: [{ ownerUserId: own }, { visibility: "public" }] }).toArray();
    const publications = await repo.versions().find({ $or: roots.map(root => ({ infoCardId: root.infoCardId, version: root.latestVersion })) }).toArray();
    const time = (id: string) => publications.find(item => item.infoCardId === id)!.publishedAt.getTime();
    const expected = roots.sort((a, b) => Number(b.ownerUserId === own) - Number(a.ownerUserId === own) || time(b.infoCardId) - time(a.infoCardId) || a.infoCardId.localeCompare(b.infoCardId)).map(root => root.infoCardId);
    await page.goto("/library?tab=info-cards"); await expect(page.locator("[data-info-id]")).toHaveCount(30);
    while (await page.getByRole("button", { name: "More Info Cards", exact: true }).count()) {
      const oldCount = await page.locator("[data-info-id]").count();
      await page.getByRole("button", { name: "More Info Cards", exact: true }).click();
      await expect.poll(() => page.locator("[data-info-id]").count()).toBeGreaterThan(oldCount);
    }
    expect(await page.locator("[data-info-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-info-id")))).toEqual(expected);
  } finally { await client.close(); }
});

test("series dropdown groups own series first and retains an authorised non-discoverable selection", async ({ page }) => {
  await login(page); await page.goto("/creator/info-cards/new");
  const select = page.getByRole("combobox", { name: "Series", exact: true });
  await expect(select.locator('optgroup[label="Other creators’ series"] option')).not.toHaveCount(0);
  const groups = await select.locator("optgroup").evaluateAll(nodes => nodes.map(node => node.getAttribute("label")));
  expect(groups).toEqual(["Your series", "Other creators’ series"]);
  await expect(select.locator('optgroup[label="Your series"]')).toContainText("Basics (phase2)");
  await expect(select.locator('optgroup[label="Other creators’ series"]')).toContainText("Basics (other)");
  await expect(select.locator('option:disabled')).toContainText(["Choose a series", "──────────"]);
  const id = await create(page);
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption({ label: "Basics (other)" });
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  // Discovery response no longer includes this series; owner editor context still does.
  await page.route("**/api/info-card-series?*", route => route.fulfill({ json: { items: [], nextOffset: null } }));
  await page.goto(`/creator/info-cards/${id}`);
  await expect(page.getByRole("combobox", { name: "Series", exact: true })).toHaveValue("demo-series-other");
  await expect(page.getByRole("combobox", { name: "Series", exact: true }).locator('option:checked')).toHaveText("Basics (other)");
  await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).toBeEditable();
});

test("series/title prerequisites provide keyboard feedback without destroying incomplete draft content", async ({ page }) => {
  await login(page); await page.goto("/creator/info-cards/new");
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  const body = page.getByRole("textbox", { name: "Explanation", exact: true });
  await expect(title).toHaveValue(""); await expect(body).toHaveAttribute("readonly", "");
  await expect(page.getByText("Choose a series and enter a title first.", { exact: true })).toHaveCount(0);
  await body.focus(); await expect(page.getByText("Choose a series and enter a title first.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Image/video (optional)", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByText("Choose a series and enter a title first.", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption({ label: "Basics (phase2)" });
  await title.fill("Ready"); await expect(body).toBeEditable(); await body.fill("Keep stored content.");
  await title.fill(""); await expect(body).toHaveValue("Keep stored content."); await expect(body).not.toBeEditable();
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto(`/creator/info-cards/${id}`); await expect(body).toHaveValue("Keep stored content.");
  await expect(body).not.toBeEditable(); await title.fill("Restored"); await expect(body).toBeEditable();
  await expect(page.getByText("Your draft can be saved before it is complete.", { exact: false })).toHaveCount(0);
  await expect(page.getByLabel("Publication requirements")).toHaveCount(0);
});

test("series dropdown traverses all eligible pages without exposing a separate search control", async ({ page }) => {
  await login(page);
  const me = (await (await page.request.get("/api/auth/me")).json()).user;
  const offsets: string[] = [];
  await page.route("**/api/info-card-series?*", route => {
    const offset = new URL(route.request().url()).searchParams.get("offset")!; offsets.push(offset);
    return route.fulfill({ json: offset === "0" ? { items: [{ seriesId: "first", title: "Own", createdByUserId: me.id, creatorUsername: me.username }], nextOffset: 50 }
      : { items: [{ seriesId: "second", title: "Foreign", createdByUserId: "other-owner", creatorUsername: "other" }], nextOffset: null } });
  });
  await page.goto("/creator/info-cards/new");
  const select = page.getByRole("combobox", { name: "Series", exact: true });
  await expect(select.locator('option[value="second"]')).toHaveText("Foreign (other)");
  expect(offsets).toContain("0"); expect(offsets).toContain("50");
  await expect(page.getByRole("textbox", { name: /search/i })).toHaveCount(0);
});

test("live title overflow is field-specific and reacts to typing and series changes", async ({ page }) => {
  await login(page); const id = await create(page);
  const seriesId = randomUUID(), longSeries = "W".repeat(20);
  expect((await page.request.post("/api/info-card-series", { data: { seriesId, title: longSeries } })).ok()).toBeTruthy();
  await page.reload();
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  await title.fill("W".repeat(40));
  await expect(page.locator("#info-title-capacity")).toHaveText("The series name and title are too wide to fit together. Shorten either one.");
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveAttribute("aria-describedby", "info-title-capacity");
  expect(await title.evaluate(node => node.closest("label")!.nextElementSibling?.id)).toBe("info-title-capacity");
  await expect(page.getByText("The content exceeds the card’s layout limits.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-info-card-face]")).toBeVisible();
  await expect(page.locator("[data-info-card-face]").locator("..")).toHaveCSS("opacity", "1");
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft?.title).toBe("W".repeat(40));
  await title.fill("Signs"); await expect(page.locator("#info-title-capacity")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption(seriesId);
  await expect(page.locator("#info-title-capacity")).toBeVisible();
  await title.fill("I"); await expect(page.locator("#info-title-capacity")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption("demo-series-owner");
  await expect(page.locator("[data-info-card-face]")).toBeVisible();
  await expect(title).not.toHaveAttribute("aria-invalid", "true");
  await expect(title).not.toHaveAttribute("aria-describedby", /info-title-capacity/);
});

test("live explanation feedback preserves text, paragraph spacing, autosave and nonblocking publication", async ({ page }) => {
  await login(page); const id = await create(page);
  const body = page.getByRole("textbox", { name: "Explanation", exact: true });
  const text = "Too much explanation. ".repeat(100);
  await body.fill(text);
  const warning = page.locator("#info-body-capacity");
  await expect(warning).toContainText("The explanation is too long or wide to fit safely:");
  await expect(body).toHaveAttribute("aria-invalid", "true");
  await expect(body).toHaveAttribute("aria-describedby", "info-body-capacity");
  expect(await body.evaluate(node => node.closest("label")!.nextElementSibling?.id)).toBe("info-body-capacity");
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft?.body).toBe(text);
  const published = page.waitForResponse(response => response.url().endsWith(`/api/info-cards/${id}/publish`) && response.request().method() === "POST");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  expect((await published).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
  await expect(body).toHaveValue(text);
  await expect(warning).toBeVisible();
  // The existing live overflow warning remains advisory after publication.
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("alert")).toHaveAttribute("id", "info-body-capacity");
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
  expect((await (await page.request.get(`/api/info-cards/${id}`)).json()).root.latestVersion).toBe(1);
  await body.fill("One\n\n\n\nTwo");
  await expect(warning).toHaveCount(0); await expect(page.locator("[data-info-card-face]")).toBeVisible();
  await expect(page.locator("[data-info-card-body] p")).toHaveCount(2);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
});


test("series-first title entry explains unavailability to keyboard and touch users", async ({ page, browser }) => {
  await login(page); await page.goto("/creator/info-cards/new");
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  await expect(title).not.toBeEditable(); await expect(title).toHaveAttribute("aria-disabled", "true");
  await title.focus(); await page.keyboard.type("Must not enter"); await expect(title).toHaveValue("");
  await expect(page.getByText("Choose or create a series first.", { exact: true })).toBeVisible();
  await expect(title).toHaveAttribute("aria-describedby", "info-title-prerequisite");
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption("demo-series-owner");
  await expect(title).toBeEditable(); await expect(title).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Choose or create a series first.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).not.toBeEditable();
  await title.fill("Ready"); await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).toBeEditable();
  await expect(page.getByLabel("Upload Info Card media", { exact: true })).toBeEnabled();
  const context = await browser.newContext({ storageState: await page.context().storageState(), hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const touch = await context.newPage(); await touch.goto(new URL("/creator/info-cards/new", page.url()).href);
    const input = touch.getByRole("textbox", { name: "Title", exact: true }); const box = await input.boundingBox();
    // aria-disabled remains keyboard-focusable/read-only; use actual touch
    // coordinates rather than Locator.tap's disabled actionability filter.
    await touch.touchscreen.tap(box!.x + 20, box!.y + 15);
    await expect(touch.getByText("Choose or create a series first.", { exact: true })).toBeVisible();
    await expect(input).toHaveValue("");
  } finally { await context.close(); }
});

test("new-series intent, failed creation and pending response do not unlock title", async ({ page }) => {
  await login(page); await page.goto("/creator/info-cards/new");
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption("__create__");
  await expect(title).not.toBeEditable();
  let fail = true, started = false, release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/info-card-series", async route => {
    if (route.request().method() !== "POST") return route.continue();
    if (fail) return route.fulfill({ status: 503, json: { error: "SERIES_TEMPORARY_FAILURE" } });
    started = true; await gate; await route.continue();
  });
  await page.getByRole("textbox", { name: "New series name", exact: true }).fill(`Series ${randomUUID().slice(0, 5)}`);
  await page.getByRole("button", { name: "Create series", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "SERIES_TEMPORARY_FAILURE" })).toBeVisible();
  await expect(title).not.toBeEditable(); fail = false;
  await page.getByRole("button", { name: "Create series", exact: true }).click();
  await expect.poll(() => started).toBe(true); await expect(title).not.toBeEditable();
  const returned = page.waitForResponse(response => response.url().endsWith("/api/info-card-series") && response.request().method() === "POST");
  release(); const result = await (await returned).json();
  await expect(page.getByRole("combobox", { name: "Series", exact: true })).toHaveValue(result.seriesId);
  await expect(title).toBeEditable();
});

test("legacy title and explanation without a series survive reload and selecting a series", async ({ page }) => {
  await login(page); const id = randomUUID();
  const stored = { title: "W".repeat(40), body: "Keep this stored explanation.", mediaItem: null, seriesId: null };
  expect((await page.request.post("/api/info-cards", { data: { infoCardId: id } })).ok()).toBeTruthy();
  expect((await page.request.patch(`/api/info-cards/${id}`, { data: { revision: 0, visibility: "private", content: stored } })).ok()).toBeTruthy();
  await page.goto(`/creator/info-cards/${id}`);
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  await expect(title).toHaveValue(stored.title); await expect(title).not.toBeEditable();
  await title.focus(); await page.keyboard.type("ignored"); await expect(title).toHaveValue(stored.title);
  await expect(page.locator("#info-title-capacity")).toHaveCount(0);
  await page.reload(); await expect(title).toHaveValue(stored.title);
  await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).toHaveValue(stored.body);
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption("demo-series-owner");
  await expect(title).toBeEditable(); await expect(title).toHaveValue(stored.title);
  await expect(page.locator("#info-title-capacity")).toBeVisible();
  await expect.poll(async () => (await (await page.request.get(`/api/info-cards/${id}`)).json()).root.draft).toEqual({ ...stored, seriesId: "demo-series-owner" });
});
