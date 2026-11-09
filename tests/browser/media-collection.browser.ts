import { openFocusedMediaCard } from "./personalMediaFixture";
import { test, expect } from "@playwright/test";
const owner = "507f1f77bcf86cd799439011";
test("unified collection uses the existing thumbnail layout and gallery through Strict Mode", async ({ page }) => {
  const records = Array.from({ length: 8 }, (_, n) => ({ source: n < 5 ? { kind: "personal", cardTemplateId: "card-1", mediaItemId: `photo-${n}` } : { kind: "group", experienceId: "Galway-U18", contributionId: `group-${n}` },
    authorUserId: owner, mediaType: "image", description: `Training photo ${n + 1}`, uploadedAt: `2026-10-0${n + 1}T00:00:00.000Z`, originName: n < 5 ? "Personal" : "Galway U18", private: false, revision: 2,
    ...(n < 5 ? { media: { id: `photo-${n}`, mediaType: "image", provider: "cloudflare-r2", assetId: `photo-${n}.png`, src: `/image-${n}.svg`, description: `Training photo ${n + 1}` } } : {}) }));
  await page.route("**/api/media/history?*", route => {
    const limit = Number(new URL(route.request().url()).searchParams.get("limit"));
    return route.fulfill({ json: { viewerUserId: owner, cardTemplateId: "card-1", items: records.slice(-limit), start: Math.max(0, 8 - limit), total: 8, olderCount: Math.max(0, 8 - limit), older: limit < 8 ? "older" : null, newer: null }, headers: { "X-Personal-Viewer": owner } });
  });
  await page.route("**/api/group-media/*?*", route => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5kAAAAASUVORK5CYII=", "base64") }));
  await openFocusedMediaCard(page, "/?strict=1");
  const thumbnails = page.getByRole("button", { name: /^Open image/ });
  await expect(thumbnails).toHaveCount(5);
  await expect(thumbnails.first()).toHaveAttribute("aria-label", /Training photo 4$/);
  await thumbnails.last().click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  await expect(viewer.getByText("8 of 8")).toBeVisible();
  await expect(viewer.locator('img[alt="Training photo 8"]')).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Next media" })).toBeDisabled();
  for (let index = 7; index >= 1; index--) {
    await viewer.getByRole("button", { name: "Previous media" }).click();
    await expect(viewer.getByText(`${index} of 8`)).toBeVisible();
  }
  await expect(viewer.getByRole("button", { name: "Previous media" })).toBeDisabled();
  await viewer.getByRole("button", { name: "Close media viewer" }).click();
  await expect(viewer).toHaveCount(0);
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
});

test("existing gallery arrows cross a bounded page boundary without losing the selected source", async ({ page }) => {
  const records = Array.from({ length: 35 }, (_, n) => ({ source: { kind: "personal", cardTemplateId: "card-1", mediaItemId: `bounded-${n}` }, authorUserId: owner,
    mediaType: "image", description: `Bounded photo ${n + 1}`, uploadedAt: null, originName: "Personal", private: false,
    media: { id: `bounded-${n}`, mediaType: "image", src: `/image-${n}.svg`, description: `Bounded photo ${n + 1}` } }));
  const limits: number[] = [];
  await page.route("**/api/media/history?*", route => {
    const p = new URL(route.request().url()).searchParams, limit = Number(p.get("limit")); limits.push(limit);
    const old = p.get("cursor") === "older", start = old ? 0 : Math.max(0, 35 - limit);
    return route.fulfill({ json: { viewerUserId: owner, cardTemplateId: "card-1", total: 35, start, olderCount: 35 - Math.min(limit, 35),
      items: old ? records.slice(0, 5) : records.slice(start), older: old ? null : "older", newer: old ? "newer" : null }, headers: { "X-Personal-Viewer": owner } });
  });
  await openFocusedMediaCard(page, "/");
  const thumbnails = page.getByRole("button", { name: /^Open image/ });
  await expect(thumbnails).toHaveCount(5); await expect(thumbnails.first()).toHaveAttribute("aria-label", /Bounded photo 31$/);
  await thumbnails.first().click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  await expect(viewer.getByText("31 of 35")).toBeVisible();
  for (let n = 30; n >= 5; n--) { await viewer.getByRole("button", { name: "Previous media" }).click(); await expect(viewer.getByText(`${n} of 35`)).toBeVisible(); }
  await expect(viewer.locator('img[alt="Bounded photo 5"]')).toBeVisible();
  await viewer.getByRole("button", { name: "Next media" }).click(); await expect(viewer.getByText("6 of 35")).toBeVisible();
  expect(limits.every(n => n <= 30)).toBe(true);
});

test("background Gallery metadata does not resize the image or reset an existing zoom", async ({ page }) => {
  const record = { source: { kind: "personal", cardTemplateId: "card-1", mediaItemId: "photo" }, authorUserId: owner, mediaType: "image", description: "Basketball practice", uploadedAt: null, originName: "Personal", private: false,
    media: { id: "photo", mediaType: "image", src: "/image-0.svg", description: "Basketball practice" } };
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/media/history?*", async route => {
    if (new URL(route.request().url()).searchParams.get("limit") === "30") await held;
    await route.fulfill({ json: { viewerUserId: owner, cardTemplateId: "card-1", items: [record], total: 1, olderCount: 0, older: null, newer: null } });
  });
  try {
    await openFocusedMediaCard(page, "/?strict"); await page.getByRole("button", { name: /^Open image 1 of 1:/ }).click();
    const gallery = page.getByRole("dialog", { name: "Card media viewer" });
    await gallery.getByRole("button", { name: "Zoom in" }).click(); await expect(gallery.getByLabel("Zoom level")).toHaveText("150%");
    release(); await expect(gallery.getByText("Loading media history…")).toHaveCount(0);
    await page.waitForTimeout(150); await expect(gallery.getByLabel("Zoom level")).toHaveText("150%");
  } finally { release(); }
});
