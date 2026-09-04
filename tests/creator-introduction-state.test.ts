import assert from "node:assert/strict";
import test from "node:test";
import {
  createCreatorBoardFromTemplate,
  creatorBoardToDeckTemplate,
  setBoardDeckIntroductionImage,
  setBoardDeckIntroductionVideo,
} from "../src/components/creator/creatorBoardState";
import type { DeckIntroduction, DeckTemplate } from "../src/components/decks/types";
import type { CloudflareR2ImageMediaItem, LegacyProviderlessImageMediaItem, CloudflareStreamVideoMediaItem } from "../src/lib/media";

const legacyImage = {
  id: "legacy-image-1",
  mediaType: "image",
  description: "Legacy image",
  src: "/images/daniel-intro-still.png",
} satisfies LegacyProviderlessImageMediaItem;

const cloudflareImage = {
  id: "image-asset-1",
  mediaType: "image",
  provider: "cloudflare-r2",
  assetId: "asset-1",
  description: "R2 image",
  src: "https://cdn.example.com/images/deck-introductions/asset-1.webp",
} satisfies CloudflareR2ImageMediaItem;

const introVideo = {
  id: "video-1",
  mediaType: "video",
  provider: "cloudflare-stream",
  assetId: "video-asset-1",
  description: "Video",
  src: "https://iframe.videodelivery.net/video-asset-1",
} satisfies CloudflareStreamVideoMediaItem;

const baseTemplate = {
  deckTemplateId: "creator-introduction-state",
  title: "Creator introduction state",
  category: null,
  streams: [{ id: "stream-1", title: "Stream 1" }],
  cards: [
    {
      cardId: "card-1",
      label: "Card 1",
      suggestedTargetDate: "",
      intro: { title: "Card 1", description: null, mediaItem: null },
      steps: [{ stepId: "step-1", description: "Step 1", mediaItem: null }],
    },
  ],
} satisfies DeckTemplate;

test("upload result is inserted into a null introduction", () => {
  const board = createCreatorBoardFromTemplate({
    ...baseTemplate,
    introduction: null,
  });
  const nextBoard = setBoardDeckIntroductionImage(board, cloudflareImage);

  assert.deepEqual(nextBoard.deckIntroduction, {
    image: cloudflareImage,
    video: null,
  });
});

test("upload preserves an existing intro video", () => {
  const board = createCreatorBoardFromTemplate({
    ...baseTemplate,
    introduction: { image: null, video: introVideo },
  });
  const nextBoard = setBoardDeckIntroductionImage(board, cloudflareImage);

  assert.deepEqual(nextBoard.deckIntroduction, {
    image: cloudflareImage,
    video: introVideo,
  });
});

test("replacing intro image preserves the intro video", () => {
  const board = createCreatorBoardFromTemplate({
    ...baseTemplate,
    introduction: { image: legacyImage, video: introVideo },
  });
  const nextBoard = setBoardDeckIntroductionImage(board, cloudflareImage);

  assert.deepEqual(nextBoard.deckIntroduction, {
    image: cloudflareImage,
    video: introVideo,
  });
});

test("creator board to template preserves R2 image media", () => {
  const board = createCreatorBoardFromTemplate({
    ...baseTemplate,
    introduction: { image: cloudflareImage, video: null },
  });
  const template = creatorBoardToDeckTemplate(board);

  assert.deepEqual(template.introduction as DeckIntroduction | null, {
    image: cloudflareImage,
    video: null,
  });
});

test("video upload result is inserted into a null introduction", () => {
  const board = createCreatorBoardFromTemplate({
    ...baseTemplate,
    introduction: null,
  });
  const nextBoard = setBoardDeckIntroductionVideo(board, introVideo);

  assert.deepEqual(nextBoard.deckIntroduction, {
    image: null,
    video: introVideo,
  });
});

test("adding intro video preserves the existing image", () => {
  const board = createCreatorBoardFromTemplate({
    ...baseTemplate,
    introduction: { image: cloudflareImage, video: null },
  });
  const nextBoard = setBoardDeckIntroductionVideo(board, introVideo);

  assert.deepEqual(nextBoard.deckIntroduction, {
    image: cloudflareImage,
    video: introVideo,
  });
});

test("replacing intro video preserves the existing image", () => {
  const existingVideo = {
    ...introVideo,
    id: "video-existing",
    assetId: "video-existing-asset",
    src: "https://iframe.videodelivery.net/video-existing-asset",
  } satisfies CloudflareStreamVideoMediaItem;
  const board = createCreatorBoardFromTemplate({
    ...baseTemplate,
    introduction: { image: legacyImage, video: existingVideo },
  });
  const nextBoard = setBoardDeckIntroductionVideo(board, introVideo);

  assert.deepEqual(nextBoard.deckIntroduction, {
    image: legacyImage,
    video: introVideo,
  });
});

test("creator board to template preserves Stream intro video", () => {
  const board = createCreatorBoardFromTemplate({
    ...baseTemplate,
    introduction: { image: cloudflareImage, video: introVideo },
  });
  const template = creatorBoardToDeckTemplate(board);

  assert.deepEqual(template.introduction as DeckIntroduction | null, {
    image: cloudflareImage,
    video: introVideo,
  });
});
