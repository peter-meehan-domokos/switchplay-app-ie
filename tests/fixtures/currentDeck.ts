import type { RuntimeDeckTemplate, UserDeckData } from "../../src/components/decks/types";
import type { MediaItem } from "../../src/lib/media";

const canonicalImage = {
  id: "canonical-image", mediaType: "image", provider: "cloudflare-r2",
  assetId: "images/deck-introductions/canonical.webp",
  src: "https://cdn.example.com/images/deck-introductions/canonical.webp",
  description: "Canonical image",
} satisfies MediaItem;
const canonicalVideo = {
  id: "stream-canonical", mediaType: "video", provider: "cloudflare-stream",
  assetId: "canonical", src: "https://iframe.videodelivery.net/canonical",
  thumbnailSrc: "https://videodelivery.net/canonical/thumbnails/thumbnail.jpg",
  width: 1280, height: 720, description: "Canonical video",
} satisfies MediaItem;

// Explicit legacy fixtures, independent of active seed data and external assets.
export function createCurrentDeckFixture(): { template: RuntimeDeckTemplate; data: UserDeckData } {
  const template: RuntimeDeckTemplate = {
    deckTemplateId: "legacy-deck", title: "Practice", category: "Learning",
    introduction: {
      image: { id: "legacy-image", mediaType: "image", description: "Legacy", src: "/images/legacy.png" },
      video: canonicalVideo,
    },
    streams: [{ id: "theme-a", title: "Prepare" }, { id: "theme-b", title: "Practice" }, { id: "theme-c", title: "Reflect" }],
    cards: [
      {
        cardId: "card-001", label: "Stage 1", suggestedTargetDate: "2026-06-01",
        intro: { title: "First Card", description: "Introduction", mediaItem: canonicalImage },
        steps: [
          { stepId: "a-1", title: "Read", description: "Read the guide", descriptionContent: [
            { type: "text", text: "Read " },
            { type: "link", text: "the guide", url: "https://example.com/guide" },
          ], mediaItem: canonicalVideo },
          { stepId: "a-2", title: "Try", description: "Try it", descriptionContent: undefined, mediaItem: null },
          { stepId: "a-empty", description: null, descriptionContent: undefined, mediaItem: null },
        ],
      },
      {
        cardId: "card-002", label: "Stage 2", suggestedTargetDate: "2026-06-08",
        intro: { title: "Second Card", description: null, mediaItem: null },
        steps: [
          { stepId: "b-1", title: "Prepare", description: "Prepare", descriptionContent: undefined, mediaItem: canonicalImage },
          { stepId: "b-empty", description: null, descriptionContent: undefined, mediaItem: null },
          { stepId: "b-3", title: "Reflect", description: "Reflect", descriptionContent: undefined, mediaItem: null },
        ],
      },
    ],
  };
  const data: UserDeckData = {
    deckTemplateId: template.deckTemplateId, activeCardId: "card-002", sharedWithUserIds: [],
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
    openedAt: "2026-01-03T00:00:00.000Z",
    cards: template.cards.map((card) => ({
      cardId: card.cardId, targetDate: card.cardId === "card-001" ? "2026-12-25" : card.suggestedTargetDate,
      items: card.steps.map((step) => ({ itemId: step.stepId, completionStatus: "done" })),
      signalReadings: [{ signalId: "0", reading: null }, { signalId: "1", reading: 1 }, { signalId: "2", reading: 9 }],
      reflection: "My reflection", chats: [{ id: "chat-1", comments: [
        { id: "comment-1", creatorId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", text: "Keep this", isRetained: true },
      ] }],
      mediaItems: [
        { id: "image-11111111-1111-4111-8111-111111111111", mediaType: "image", provider: "cloudflare-r2",
          assetId: `user-decks/user-1/legacy-deck/cards/${card.cardId}/11111111-1111-4111-8111-111111111111.webp`,
          src: `https://cdn.example.com/user-decks/user-1/legacy-deck/cards/${card.cardId}/11111111-1111-4111-8111-111111111111.webp`,
          description: "Personal image" },
        { ...canonicalVideo, id: "stream-personal", assetId: "personal",
          src: "https://iframe.videodelivery.net/personal",
          thumbnailSrc: "https://videodelivery.net/personal/thumbnails/thumbnail.jpg" },
      ],
    })),
  };
  // Each call must return independent fixtures, including nested media objects.
  return structuredClone({ template, data });
}
