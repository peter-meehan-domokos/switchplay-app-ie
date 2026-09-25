import { expect, test } from "@playwright/test";
import BackCardMediaTrace from "@/components/decks/BackCardMediaTrace";
import {
  createCardMediaAppendRequestBody,
  createCardMediaRemovalRequestBody,
  createCardMediaUpsertRequestBody,
} from "@/lib/deckMutations";
import type { CloudflareR2ImageMediaItem, CloudflareStreamVideoMediaItem, MediaItem } from "@/lib/media";
import {
  appendUserCardMediaItem,
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

function createTestImage(uuid: string): CloudflareR2ImageMediaItem {
  const assetId = `user-decks/507f1f77bcf86cd799439011/deck-1/cards/card-003/${uuid}.png`;

  return {
    id: `image-${uuid}`,
    description: `Card image ${uuid}`,
    mediaType: "image",
    provider: "cloudflare-r2",
    assetId,
    src: createImagePublicUrl(assetId),
  };
}

function createTestVideo(uid: string): CloudflareStreamVideoMediaItem {
  return {
    id: `stream-${uid}`,
    description: `Card video ${uid}`,
    mediaType: "video",
    provider: "cloudflare-stream",
    assetId: uid,
    src: `https://iframe.videodelivery.net/${uid}`,
  };
}

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

test("append preserves three images on the same card", () => {
  const images = [
    createTestImage("123e4567-e89b-42d3-a456-426614174001"),
    createTestImage("123e4567-e89b-42d3-a456-426614174002"),
    createTestImage("123e4567-e89b-42d3-a456-426614174003"),
  ];

  const mediaItems = images.reduce<MediaItem[]>(appendUserCardMediaItem, []);

  expect(mediaItems).toEqual(images);
});

test("append preserves three videos on the same card", () => {
  const videos = [createTestVideo("stream-1"), createTestVideo("stream-2"), createTestVideo("stream-3")];

  const mediaItems = videos.reduce<MediaItem[]>(appendUserCardMediaItem, []);

  expect(mediaItems).toEqual(videos);
});

test("mixed appends preserve every image and video in raw insertion order", () => {
  const imageOne = createTestImage("123e4567-e89b-42d3-a456-426614174004");
  const videoOne = createTestVideo("stream-mixed-1");
  const imageTwo = createTestImage("123e4567-e89b-42d3-a456-426614174005");
  const videoTwo = createTestVideo("stream-mixed-2");

  const mediaItems = [imageOne, videoOne, imageTwo, videoTwo].reduce<MediaItem[]>(appendUserCardMediaItem, []);

  expect(mediaItems).toEqual([imageOne, videoOne, imageTwo, videoTwo]);
});

test("append is idempotent by media-item id", () => {
  const original = createTestImage("123e4567-e89b-42d3-a456-426614174006");
  const sameIdWithDifferentDescription = { ...original, description: "A retried request" };

  const mediaItems = appendUserCardMediaItem(
    appendUserCardMediaItem([], original),
    sameIdWithDifferentDescription,
  );

  expect(mediaItems).toEqual([original]);
});

test("same-card concurrent append completion orders preserve all media items", () => {
  const imageOne = createTestImage("123e4567-e89b-42d3-a456-426614174007");
  const imageTwo = createTestImage("123e4567-e89b-42d3-a456-426614174008");
  const videoOne = createTestVideo("stream-concurrent-1");
  const completionOrders = [
    [imageOne, imageTwo, videoOne],
    [videoOne, imageTwo, imageOne],
  ];

  for (const completionOrder of completionOrders) {
    const mediaItems = completionOrder.reduce<MediaItem[]>(appendUserCardMediaItem, []);

    expect(mediaItems).toHaveLength(3);
    expect(new Set(mediaItems.map((mediaItem) => mediaItem.id))).toEqual(
      new Set([imageOne.id, imageTwo.id, videoOne.id]),
    );
  }
});

test("independent card appends preserve both card media arrays", () => {
  const cardOneImage = createTestImage("123e4567-e89b-42d3-a456-426614174009");
  const cardTwoVideo = createTestVideo("stream-card-two");
  const cardMediaById: Record<string, MediaItem[]> = {
    "card-003": [],
    "card-004": [],
  };

  const nextCardMediaById = {
    ...cardMediaById,
    "card-003": appendUserCardMediaItem(cardMediaById["card-003"], cardOneImage),
    "card-004": appendUserCardMediaItem(cardMediaById["card-004"], cardTwoVideo),
  };

  expect(nextCardMediaById).toEqual({
    "card-003": [cardOneImage],
    "card-004": [cardTwoVideo],
  });
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

test("non-modern and malformed Stream media are rejected", () => {
  const providerlessImage = {
    id: "legacy-image",
    description: "Legacy image",
    mediaType: "image",
    src: "/legacy/image.png",
  };
  const malformedStreamItem = { ...video, assetId: "stream uid with spaces", id: "stream-stream uid with spaces" };

  expect(validateUserCardMediaItem(providerlessImage, context, createImagePublicUrl)).toMatchObject({ ok: false });
  expect(validateUserCardMediaItem(malformedStreamItem, context, createImagePublicUrl)).toMatchObject({ ok: false });
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
  expect(createCardMediaAppendRequestBody("card-003", image)).toEqual({
    type: "append-card-media",
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
  expect(BackCardMediaTrace({ items: [], target: { scope: "user-card", deckTemplateId: "deck-1", cardId: "card-003" } })).toBeNull();
});

test("the media renderer emits an R2 image and Stream player for modern items", () => {
  const renderedTree = JSON.stringify(
    BackCardMediaTrace({
      items: [image, video],
      target: { scope: "user-card", deckTemplateId: "deck-1", cardId: "card-003" },
    }),
  );

  expect(renderedTree).toContain("focused-card-back-media");
  expect(renderedTree).toContain(imagePublicUrl);
  expect(renderedTree).toContain("streamUid123");
});
