import { expect, test } from "@playwright/test";
import { mergeDeckTemplatesWithUserData, createEmptyClientUserCardDataFromTemplate } from "../src/lib/deckData";
import { reconcileDeckDataWithTemplate } from "../src/lib/deckDataReconciliation";
import { DeckTemplate } from "../src/components/decks/types";

const dummyTemplate: DeckTemplate = {
  deckTemplateId: "test-deck",
  title: "Test",
  category: null,
  streams: [{ id: "stream-0", title: "Stream 0" }],
  cards: [
    {
      cardId: "card-1",
      label: "Card 1",
      suggestedTargetDate: "2026-01-10",
      intro: { title: "Intro", description: null, mediaItem: null },
      steps: [{ stepId: "step-1", description: "Step 1", mediaItem: null }]
    }
  ]
};

test("createEmptyClientUserCardDataFromTemplate returns null readings", () => {
  const data = createEmptyClientUserCardDataFromTemplate(dummyTemplate.cards[0]);
  expect(data.signalReadings.every(r => r.reading === null)).toBe(true);
});

test("mergeDeckTemplatesWithUserData preserves raw reading null, but reading is null", () => {
  const merged = mergeDeckTemplatesWithUserData([dummyTemplate], [{
    deckTemplateId: "test-deck",
    activeCardId: "card-1",
    sharedWithUserIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cards: [{
      cardId: "card-1",
      targetDate: null,
      steps: [],
      mediaItems: [],
      chats: [],
      reflection: "",
      signalReadings: [{ signalId: "0", reading: null }, { signalId: "1", reading: 11 }]
    }]
  }], "user-1");

  const signals = merged[0].cards[0].signals;
  expect(signals.find(s => s.id === "0")?.reading).toBeNull();
  expect(signals.find(s => s.id === "0")?.rawReading).toBeNull();

  // Test that clamp happens for reading but rawReading preserves original value (if possible)
  // Our system treats any numeric input as rawReading, clamping it for reading
  expect(signals.find(s => s.id === "1")?.reading).toBe(10);
  expect(signals.find(s => s.id === "1")?.rawReading).toBe(11);
  
  // Test fallback for missing signal
  expect(signals.find(s => s.id === "2")?.reading).toBeNull();
  expect(signals.find(s => s.id === "2")?.rawReading).toBeNull();
});

test("reconcileDeckDataWithTemplate handles null", () => {
  const existingDeckData = {
    deckTemplateId: "test-deck",
    activeCardId: "card-1",
    sharedWithUserIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cards: [{
      cardId: "card-1",
      targetDate: null,
      items: [],
      mediaItems: [],
      chats: [],
      reflection: "",
      signalReadings: [{ signalId: "0", reading: null }]
    }]
  };
  
  const reconciled = reconcileDeckDataWithTemplate({
    oldTemplate: dummyTemplate,
    newTemplate: dummyTemplate,
    existingDeckData,
    outputDeckTemplateId: "test-deck"
  });
  
  expect(reconciled.cards[0].signalReadings.find(r => r.signalId === "0")?.reading).toBeNull();
  expect(reconciled.cards[0].signalReadings.find(r => r.signalId === "1")?.reading).toBeNull(); // Defaulted to null
});
