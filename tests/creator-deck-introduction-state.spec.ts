import { expect, test } from "@playwright/test";

import {
  appendCreatorCard,
  createBlankCreatorBoard,
  createCreatorBoardFromTemplate,
  creatorBoardToDeckTemplate,
  swapCreatorBoardRows,
  type BoardState,
} from "@/components/creator/creatorBoardState";
import type { DeckIntroduction, DeckTemplate } from "@/components/decks/types";

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
    deckTemplateId: "creator-introduction-template",
    title: "Creator introduction template",
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
          description: "Card intro",
          mediaItem: null,
        },
        steps: [
          {
            stepId: "step-1",
            description: "Strength step",
            mediaItem: null,
          },
          {
            stepId: "step-2",
            description: "Skill step",
            mediaItem: null,
          },
          {
            stepId: "step-3",
            description: "Confidence step",
            mediaItem: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createBoardWithIntroduction(deckIntroduction: DeckIntroduction | null): BoardState {
  return {
    ...createBlankCreatorBoard(),
    deckIntroduction,
  };
}

function convertTemplateIntroduction(introduction?: DeckIntroduction | null) {
  return createCreatorBoardFromTemplate(createTemplate({ introduction })).deckIntroduction;
}

test.describe("creator deck introduction state", () => {
  test("blank creator board defaults deckIntroduction to null", () => {
    expect(createBlankCreatorBoard().deckIntroduction).toBeNull();
  });

  test("template introduction null becomes creator state null", () => {
    expect(convertTemplateIntroduction(null)).toBeNull();
  });

  test("template explicit empty introduction object is preserved", () => {
    expect(convertTemplateIntroduction({ image: null, video: null })).toEqual({ image: null, video: null });
  });

  test("template image-only introduction is preserved", () => {
    expect(convertTemplateIntroduction({ image: validImage, video: null })).toEqual({
      image: validImage,
      video: null,
    });
  });

  test("template video-only introduction is preserved", () => {
    expect(convertTemplateIntroduction({ image: null, video: validVideo })).toEqual({
      image: null,
      video: validVideo,
    });
  });

  test("template image and video introduction is preserved", () => {
    expect(convertTemplateIntroduction({ image: validImage, video: validVideo })).toEqual({
      image: validImage,
      video: validVideo,
    });
  });

  test("creator board with null introduction generates template introduction null", () => {
    const template = creatorBoardToDeckTemplate(createBoardWithIntroduction(null));

    expect(template).toHaveProperty("introduction", null);
  });

  test("creator board with explicit empty introduction object generates template introduction object", () => {
    const template = creatorBoardToDeckTemplate(createBoardWithIntroduction({ image: null, video: null }));

    expect(template.introduction).toEqual({ image: null, video: null });
  });

  test("template to creator board to template round trip preserves introduction", () => {
    const introduction = { image: validImage, video: validVideo };
    const board = createCreatorBoardFromTemplate(createTemplate({ introduction }));
    const template = creatorBoardToDeckTemplate(board);

    expect(template.introduction).toEqual(introduction);
  });

  test("snapshot-style serialization and restore preserves introduction", () => {
    const introduction = { image: validImage, video: null };
    const board = createCreatorBoardFromTemplate(createTemplate({ introduction }));
    const snapshot = JSON.stringify(creatorBoardToDeckTemplate(board));
    const restoredTemplate = JSON.parse(snapshot) as DeckTemplate;
    const restoredBoard = createCreatorBoardFromTemplate(restoredTemplate);

    expect(restoredBoard.deckIntroduction).toEqual(introduction);
  });

  test("board clone and mutation helpers preserve deckIntroduction", () => {
    const introduction = { image: null, video: validVideo };
    const board = createBoardWithIntroduction(introduction);
    const appendedBoard = appendCreatorCard(board);
    const swappedBoard = swapCreatorBoardRows(appendedBoard, appendedBoard.rows[0], appendedBoard.rows[1]);

    expect(appendedBoard.deckIntroduction).toEqual(introduction);
    expect(swappedBoard.deckIntroduction).toEqual(introduction);
  });

  test("existing title category stream and card conversion behavior remains unchanged", () => {
    const board = createCreatorBoardFromTemplate(createTemplate({
      introduction: { image: null, video: validVideo },
    }));
    const template = creatorBoardToDeckTemplate(board);

    expect(board.deckTitle).toBe("Creator introduction template");
    expect(board.category).toBe("Training");
    expect(template.title).toBe("Creator introduction template");
    expect(template.category).toBe("Training");
    expect(template.streams).toEqual([
      { id: "stream-1", title: "Strength" },
      { id: "stream-2", title: "Skill" },
      { id: "stream-3", title: "Confidence" },
    ]);
    expect(template.cards[0]).toMatchObject({
      cardId: "card-1",
      label: "Week 1",
      suggestedTargetDate: "2026-01-10",
      intro: {
        title: "First card",
        description: "Card intro",
        mediaItem: null,
      },
    });
  });

  test("one-card templates preserve deckIntroduction without a special case", () => {
    const introduction = { image: validImage, video: validVideo };
    const sourceTemplate = createTemplate({ introduction });
    const board = createCreatorBoardFromTemplate(sourceTemplate);
    const template = creatorBoardToDeckTemplate(board);

    expect(sourceTemplate.cards).toHaveLength(1);
    expect(template.introduction).toEqual(introduction);
  });
});
