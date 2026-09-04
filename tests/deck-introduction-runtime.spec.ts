import { expect, test } from "@playwright/test";

import type { ClientUserDeckData, DeckIntroduction, DeckTemplate } from "@/components/decks/types";
import { buildDeckLayout } from "@/components/decks/deckLayout";
import { mergeDeckTemplatesWithUserData } from "@/lib/deckData";
import { normalizeDeckTemplateForRuntime } from "@/lib/deckApiTransforms";

const validImage = {
  id: "intro-image",
  description: "Intro image",
  mediaType: "image",
  src: "/images/intro.png",
} as const;

const validVideo = {
  id: "intro-video",
  description: "Intro video",
  mediaType: "video",
  provider: "cloudflare-stream",
  assetId: "stream-asset-id",
  src: "https://customer.cloudflarestream.com/stream-asset-id/manifest/video.m3u8",
} as const;

function createTemplate(overrides: Partial<DeckTemplate> = {}): DeckTemplate {
  return {
    deckTemplateId: "deck-introduction-runtime",
    title: "Deck introduction runtime",
    category: "Training",
    streams: [
      { id: "stream-1", title: "Strength" },
      { id: "stream-2", title: "Skill" },
      { id: "stream-3", title: "Confidence" },
    ],
    cards: [
      {
        cardId: "card-1",
        label: "Week 1",
        suggestedTargetDate: "2026-01-10",
        intro: {
          title: "First card",
          description: "Start here.",
          mediaItem: null,
        },
        steps: [
          {
            stepId: "step-1",
            description: "First step",
            mediaItem: null,
          },
          {
            stepId: "step-2",
            description: "Second step",
            mediaItem: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createUserDeckData(overrides: Partial<ClientUserDeckData> = {}): ClientUserDeckData {
  return {
    deckTemplateId: "deck-introduction-runtime",
    activeCardId: "card-1",
    sharedWithUserIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    cards: [
      {
        cardId: "card-1",
        targetDate: "2026-01-15",
        steps: [
          { stepId: "step-1", completionStatus: "done" },
          { stepId: "step-2", completionStatus: "inProgress" },
        ],
        signalReadings: [
          { signalId: "0", reading: 8 },
          { signalId: "1", reading: 6 },
          { signalId: "2", reading: 4 },
        ],
        reflection: "A runtime reflection.",
        mediaItems: [],
        chats: [],
      },
    ],
    ...overrides,
  };
}

function mergeTemplateIntroduction(introduction?: DeckIntroduction | null) {
  const template = normalizeDeckTemplateForRuntime(createTemplate({ introduction }));

  return mergeDeckTemplatesWithUserData([template], [], "user-1")[0]?.introduction;
}

test.describe("deck introduction runtime propagation", () => {
  test("legacy template missing introduction becomes runtime deck null", () => {
    const template = normalizeDeckTemplateForRuntime(createTemplate());
    const deck = mergeDeckTemplatesWithUserData([template], [], "user-1")[0];

    expect(deck?.introduction).toBeNull();
  });

  test("explicit top-level null becomes runtime deck null", () => {
    expect(mergeTemplateIntroduction(null)).toBeNull();
  });

  test("explicit empty introduction object is preserved", () => {
    expect(mergeTemplateIntroduction({ image: null, video: null })).toEqual({ image: null, video: null });
  });

  test("image-only introduction is preserved", () => {
    expect(mergeTemplateIntroduction({ image: validImage, video: null })).toEqual({
      image: validImage,
      video: null,
    });
  });

  test("video-only introduction is preserved", () => {
    expect(mergeTemplateIntroduction({ image: null, video: validVideo })).toEqual({
      image: null,
      video: validVideo,
    });
  });

  test("image and video introduction is preserved", () => {
    expect(mergeTemplateIntroduction({ image: validImage, video: validVideo })).toEqual({
      image: validImage,
      video: validVideo,
    });
  });

  test("introduction comes from the template, not user deck data", () => {
    const templateIntroduction = { image: validImage, video: null };
    const userDataIntroduction = { image: null, video: validVideo };
    const template = normalizeDeckTemplateForRuntime(createTemplate({ introduction: templateIntroduction }));
    const userDeckData = {
      ...createUserDeckData(),
      introduction: userDataIntroduction,
    } as unknown as ClientUserDeckData;
    const deck = mergeDeckTemplatesWithUserData([template], [userDeckData], "user-1")[0];

    expect(deck?.introduction).toEqual(templateIntroduction);
  });

  test("existing progress and user fields still merge correctly", () => {
    const template = normalizeDeckTemplateForRuntime(createTemplate({
      introduction: { image: null, video: validVideo },
    }));
    const deck = mergeDeckTemplatesWithUserData([template], [createUserDeckData()], "user-1", {
      canMutate: false,
      currentUserId: "viewer-1",
      ownerUserId: "user-1",
      ownerUsername: "Owner",
      showOwnerTag: true,
    })[0];

    expect(deck).toMatchObject({
      id: "user-1:deck-introduction-runtime",
      deckTemplateId: "deck-introduction-runtime",
      hasUserDeckData: true,
      canMutate: false,
      isOwnedByCurrentUser: false,
      ownerUserId: "user-1",
      ownerUsername: "Owner",
      showOwnerTag: true,
      activeCardId: "card-1",
      title: "Deck introduction runtime",
      category: "Training",
      introduction: { image: null, video: validVideo },
    });
    expect(deck?.cards[0]).toMatchObject({
      id: "card-1",
      label: "Week 1",
      targetDate: "2026-01-15",
      reflection: "A runtime reflection.",
    });
    expect(deck?.cards[0]?.steps).toEqual([
      {
        stepId: "step-1",
        description: "First step",
        descriptionContent: undefined,
        mediaItem: null,
        completionStatus: "done",
      },
      {
        stepId: "step-2",
        description: "Second step",
        descriptionContent: undefined,
        mediaItem: null,
        completionStatus: "inProgress",
      },
    ]);
    expect(deck?.cards[0]?.signals.map((signal) => signal.reading)).toEqual([8, 6, 4]);
  });

  test("runtime deck fields are not lost when introduction is added", () => {
    const template = normalizeDeckTemplateForRuntime(createTemplate({
      introduction: { image: validImage, video: validVideo },
    }));
    const deck = mergeDeckTemplatesWithUserData([template], [], "user-1")[0];

    expect(Object.keys(deck ?? {}).sort()).toEqual([
      "activeCardId",
      "canMutate",
      "cards",
      "category",
      "deckTemplateId",
      "hasUserDeckData",
      "id",
      "introduction",
      "isOwnedByCurrentUser",
      "ownerUserId",
      "ownerUsername",
      "showOwnerTag",
      "streams",
      "title",
    ]);
  });

  test("deck layout preserves introduction", () => {
    const introduction = { image: validImage, video: validVideo };
    const template = normalizeDeckTemplateForRuntime(createTemplate({ introduction }));
    const deck = mergeDeckTemplatesWithUserData([template], [createUserDeckData()], "user-1")[0];

    if (!deck) {
      throw new Error("Expected merged deck.");
    }

    const deckLayout = buildDeckLayout(deck, { currentUserId: "user-1", users: [] });

    expect(deckLayout.introduction).toEqual(introduction);
    expect(deckLayout.cards).toHaveLength(deck.cards.length);
    expect(deckLayout.progressPercentage).toBeGreaterThan(0);
  });
});
