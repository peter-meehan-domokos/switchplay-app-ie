import assert from "node:assert/strict";
import test from "node:test";
import {
  getContainedIntroVideoSize,
  getDeckTileActions,
  getPlayableDeckIntroductionVideo,
  initialDeckIntroPreviewState,
  reduceDeckIntroPreviewState,
} from "../src/components/decks/deckIntroPreview";
import { shouldRecordPlaybackPause } from "../src/components/media/videoPlaybackState";
import type { DeckIntroduction } from "../src/components/decks/types";
import type {
  CloudflareR2ImageMediaItem,
  CloudflareStreamVideoMediaItem,
} from "../src/lib/media";

const introImage = {
  id: "intro-image",
  mediaType: "image",
  provider: "cloudflare-r2",
  assetId: "intro-image-asset",
  description: "Introduction",
  src: "https://cdn.example.com/intro.webp",
} satisfies CloudflareR2ImageMediaItem;

const introVideo = {
  id: "intro-video",
  mediaType: "video",
  provider: "cloudflare-stream",
  assetId: "intro-video-asset",
  description: "Introduction video",
  src: "https://iframe.videodelivery.net/intro-video-asset",
  width: 1080,
  height: 1920,
} satisfies CloudflareStreamVideoMediaItem;

function withIntroduction(introduction: DeckIntroduction | null) {
  return { introduction };
}

test("detects a playable Cloudflare Stream deck introduction", () => {
  assert.deepEqual(
    getPlayableDeckIntroductionVideo(withIntroduction({ image: introImage, video: introVideo })),
    introVideo,
  );
});

test("an image-only deck opens from its front card", () => {
  assert.deepEqual(
    getDeckTileActions(withIntroduction({ image: introImage, video: null })),
    { frontCard: "open", title: "open" },
  );
});

test("a deck with no introduction opens from its front card", () => {
  assert.deepEqual(getDeckTileActions(withIntroduction(null)), { frontCard: "open", title: "open" });
});

test("a video-only deck remains playable", () => {
  assert.deepEqual(
    getDeckTileActions(withIntroduction({ image: null, video: introVideo })),
    { frontCard: "preview", title: "open" },
  );
});

test("activating another deck leaves only that deck active and restores the previous poster", () => {
  const deckAPlaying = reduceDeckIntroPreviewState(
    reduceDeckIntroPreviewState(initialDeckIntroPreviewState, { type: "activate", deckId: "deck-a" }),
    { type: "playing", deckId: "deck-a" },
  );
  const deckBLoading = reduceDeckIntroPreviewState(deckAPlaying, { type: "activate", deckId: "deck-b" });

  assert.equal(deckBLoading.activeDeckId, "deck-b");
  assert.equal(deckBLoading.visibleDeckId, null);
  assert.equal(deckBLoading.status, "loading");
});

test("the title action remains open while the video front-card action is preview", () => {
  const actions = getDeckTileActions(withIntroduction({ image: introImage, video: introVideo }));

  assert.equal(actions.frontCard, "preview");
  assert.equal(actions.title, "open");
});

test("activation records continue intent across an internal source transition", () => {
  const active = reduceDeckIntroPreviewState(initialDeckIntroPreviewState, { type: "activate", deckId: "deck-a" });

  assert.equal(active.intent, "continue");
  assert.equal(shouldRecordPlaybackPause({ hasEnded: false, isInternalTransition: true }), false);
});

test("a genuine user pause remains paused", () => {
  const playing = reduceDeckIntroPreviewState(
    reduceDeckIntroPreviewState(initialDeckIntroPreviewState, { type: "activate", deckId: "deck-a" }),
    { type: "playing", deckId: "deck-a" },
  );
  const paused = reduceDeckIntroPreviewState(playing, { type: "paused", deckId: "deck-a" });

  assert.equal(shouldRecordPlaybackPause({ hasEnded: false, isInternalTransition: false }), true);
  assert.equal(paused.intent, "paused");
  assert.equal(paused.visibleDeckId, "deck-a");
});

test("an ended video pause is not treated as an explicit user pause", () => {
  assert.equal(shouldRecordPlaybackPause({ hasEnded: true, isInternalTransition: false }), false);
});

test("active preview state clears when its deck disappears", () => {
  const active = reduceDeckIntroPreviewState(initialDeckIntroPreviewState, { type: "activate", deckId: "deck-a" });
  const reconciled = reduceDeckIntroPreviewState(active, { type: "reconcile", deckIds: ["deck-b"] });

  assert.deepEqual(reconciled, initialDeckIntroPreviewState);
});

test("one-card decks have the same intro action as every other deck", () => {
  const oneCardDeck = {
    introduction: { image: introImage, video: introVideo },
    cards: [{ id: "only-card" }],
  };

  assert.equal(getDeckTileActions(oneCardDeck).frontCard, "preview");
});

test("a 9:16 video is fully contained in the 0.72 card with equal side margins", () => {
  const size = getContainedIntroVideoSize(introVideo);

  assert.equal(size.heightPercentage, 100);
  assert.equal(size.widthPercentage, 78.125);
});
