import { expect, type Page } from "@playwright/test";

// These older viewer cases deliberately exercise the legacy CardData thumbnail
// snapshot (the five-item HTTP thumbnail path is covered in media-collection and
// Phase 7/11 browser suites). Give their Gallery a real, authorised metadata
// response rather than relying on the former fallback after a failed request.
export async function mockLegacyGalleryHistory(page: Page) {
  await page.route("**/api/media/history?*", route => {
    const limit = Number(new URL(route.request().url()).searchParams.get("limit"));
    if (limit !== 30) return route.continue();
    const options = new URL(page.url()).searchParams, owner = "507f1f77bcf86cd799439011";
    const media = Array.from({ length: options.has("single") ? 1 : 8 }, (_, index) => [1, 2, 5].includes(index) ? {
      id: `stream-${index}`, assetId: `video-${index}`, mediaType: "video", provider: "cloudflare-stream", src: `https://iframe.videodelivery.net/video-${index}`, description: `Practice ${index + 1}`,
    } : { id: `image-${index}`, assetId: `user-decks/${owner}/deck-1/cards/card-1/${index}.png`, mediaType: "image", provider: "cloudflare-r2", src: `/image-${index}.svg`, description: `Written work ${index + 1}` });
    const records = (options.has("inherited") ? [...media.slice(0, 2).map(item => ({ item, source: "card-1" })), { item: media[0], source: "original" }]
      : media.map(item => ({ item, source: "card-1" }))).map(({ item, source }) => ({ source: { kind: "personal", cardTemplateId: source, mediaItemId: item.id },
      authorUserId: owner, mediaType: item.mediaType, description: item.description, uploadedAt: null, originName: "Personal", private: false, media: item }));
    return route.fulfill({ json: { viewerUserId: owner, cardTemplateId: "card-1", total: records.length, start: 0, olderCount: 0, older: null, newer: null, items: records } });
  });
}

// Gallery tests exercise focused interactions. Deck previews are passive.
export async function openFocusedMediaCard(page: Page, url = "/") {
  await page.goto(url);
  await page.locator(".deck-card.is-active").press("Enter");
  await expect(page.locator(".focused-card-object")).toBeVisible();
}
