import { expect, test } from "@playwright/test";
import BackCardMediaTrace from "@/components/decks/BackCardMediaTrace";
import {
  createCardMediaRemovalRequestBody,
  createCardMediaUpsertRequestBody,
} from "@/lib/deckMutations";
import type { CloudflareR2ImageMediaItem, CloudflareStreamVideoMediaItem, MediaItem } from "@/lib/media";
import {
  removeUserCardMediaItem,
  selectVisibleUserCardMediaItems,
  upsertUserCardMediaItem,
  validateUserCardMediaItem,
} from "@/lib/userCardMedia";

const context = {
  userId: "507f1f77bcf86cd799439011",
  deckTemplateId: "deck-1",
  cardId: "card-003",
};
const imageAssetId =
  "user-decks/507f1f77bcf86cd799439011/deck-1/cards/card-003/123e4567-e89b-42d3-a456-426614174000.png";
const imagePublicUrl = `https://user-uploads.example.com/${imageAssetId}`;
const image: CloudflareR2ImageMediaItem = {
  id: "image-123e4567-e89b-42d3-a456-426614174000",
  description: "Card image",
  mediaType: "image",
  provider: "cloudflare-r2",
  assetId: imageAssetId,
  src: imagePublicUrl,
};
const video: CloudflareStreamVideoMediaItem = {
  id: "stream-streamUid123",
  description: "Card video",
  mediaType: "video",
  provider: "cloudflare-stream",
  assetId: "streamUid123",
  src: "https://iframe.videodelivery.net/streamUid123",
  width: 1920,
  height: 1080,
};
const createImagePublicUrl = (assetId: string) => `https://user-uploads.example.com/${assetId}`;

test("an owner-scoped modern image is accepted and can be added", () => {
  const validation = validateUserCardMediaItem(image, context, createImagePublicUrl);

  expect(validation).toEqual({ ok: true, mediaItem: image });
  expect(upsertUserCardMediaItem([], image)).toEqual([image]);
});

test("same-type replacement removes every old image and keeps the video slot", () => {
  const legacyImage = {
    id: "legacy-image",
    description: "Legacy image",
    mediaType: "image",
    src: "/legacy/image.png",
  } as const;
  const oldModernImage = { ...image, id: "image-old", assetId: `${imageAssetId}.old`, src: `${imagePublicUrl}.old` };
  const nextItems = upsertUserCardMediaItem([legacyImage, oldModernImage, video], image);

  expect(nextItems).toEqual([video, image]);
  expect(nextItems.filter((item) => item.mediaType === "image")).toHaveLength(1);
});

test("video replacement leaves no hidden duplicate", () => {
  const olderVideo = { ...video, id: "stream-older", assetId: "older", src: "https://iframe.videodelivery.net/older" };
  const nextItems = upsertUserCardMediaItem([image, olderVideo, video], video);

  expect(nextItems).toEqual([image, video]);
  expect(nextItems.filter((item) => item.mediaType === "video")).toHaveLength(1);
});

test("concurrent image and video upserts retain both media items in either completion order", () => {
  const imageThenVideo = upsertUserCardMediaItem(upsertUserCardMediaItem([], image), video);
  const videoThenImage = upsertUserCardMediaItem(upsertUserCardMediaItem([], video), image);

  expect(imageThenVideo).toEqual([image, video]);
  expect(videoThenImage).toEqual([video, image]);
});

test("removal filters by media-item id without touching the provider asset", () => {
  expect(removeUserCardMediaItem([image, video], image.id)).toEqual([video]);
});

test("foreign image paths and mismatched public URLs are rejected", () => {
  const foreignImage = {
    ...image,
    assetId:
      "user-decks/507f1f77bcf86cd799439012/deck-1/cards/card-003/123e4567-e89b-42d3-a456-426614174000.png",
  };
  const wrongUrlImage = { ...image, src: "https://attacker.example/image.png" };

  expect(validateUserCardMediaItem(foreignImage, context, createImagePublicUrl)).toMatchObject({ ok: false });
  expect(validateUserCardMediaItem(wrongUrlImage, context, createImagePublicUrl)).toMatchObject({ ok: false });
});

test("Stream persistence requires the conventional id and iframe URL", () => {
  expect(validateUserCardMediaItem(video, context, createImagePublicUrl)).toEqual({ ok: true, mediaItem: video });
  expect(
    validateUserCardMediaItem({ ...video, src: "https://attacker.example/video" }, context, createImagePublicUrl),
  ).toMatchObject({ ok: false });
});

test("card media request bodies use explicit mutation types", () => {
  expect(createCardMediaUpsertRequestBody("card-003", image)).toEqual({
    type: "upsert-card-media",
    cardId: "card-003",
    mediaItem: image,
  });
  expect(createCardMediaRemovalRequestBody("card-003", image.id)).toEqual({
    type: "remove-card-media",
    cardId: "card-003",
    mediaItemId: image.id,
  });
});

test("visible card media includes modern R2 and Stream items only", () => {
  const unsupportedItems: MediaItem[] = [
    {
      id: "legacy-image",
      description: "Legacy image",
      mediaType: "image",
      src: "/legacy/image.png",
    },
    {
      id: "youtube-video",
      description: "YouTube video",
      mediaType: "video",
      provider: "youtube",
      assetId: "youtube-id",
      src: "https://youtube.example/video",
    },
  ];

  expect(selectVisibleUserCardMediaItems([...unsupportedItems, image, video])).toEqual([image, video]);
  expect(selectVisibleUserCardMediaItems(unsupportedItems)).toEqual([]);
});

test("the media renderer reserves no region when there is no modern media", () => {
  expect(BackCardMediaTrace({ items: [] })).toBeNull();
});

test("the media renderer emits an R2 image and Stream player for modern items", () => {
  const renderedTree = JSON.stringify(BackCardMediaTrace({ items: [image, video] }));

  expect(renderedTree).toContain("focused-card-back-media");
  expect(renderedTree).toContain(imagePublicUrl);
  expect(renderedTree).toContain("streamUid123");
});
