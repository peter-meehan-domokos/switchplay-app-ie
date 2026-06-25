import type { DeckTemplate, UserDeckData } from "@/components/decks/types";
import { clampSignalReading, DEFAULT_SIGNAL_READING, IMPLICIT_SIGNAL_IDS } from "@/lib/signals";

export type ReconcileDeckDataInput = {
  oldTemplate: DeckTemplate;
  newTemplate: DeckTemplate;
  existingDeckData: UserDeckData;
  outputDeckTemplateId: string;
};

function createFreshCardData(templateCard: DeckTemplate["cards"][number]): UserDeckData["cards"][number] {
  return {
    cardId: templateCard.cardId,
    targetDate: templateCard.suggestedTargetDate,
    items: templateCard.steps.map((step) => ({
      itemId: step.stepId,
      completionStatus: "todo",
    })),
    signalReadings: createDefaultSignalReadings(),
    reflection: "",
    mediaItems: [],
    chats: [],
  };
}

function createDefaultSignalReadings() {
  return IMPLICIT_SIGNAL_IDS.map((signalId) => ({
    signalId,
    reading: DEFAULT_SIGNAL_READING,
  }));
}

export function reconcileDeckDataWithTemplate({
  oldTemplate,
  newTemplate,
  existingDeckData,
  outputDeckTemplateId,
}: ReconcileDeckDataInput): UserDeckData {
  const oldCardsById = new Map(oldTemplate.cards.map((card) => [card.cardId, card]));
  const existingCardsById = new Map(existingDeckData.cards.map((card) => [card.cardId, card]));
  const newTemplateHasActiveCard = newTemplate.cards.some((card) => card.cardId === existingDeckData.activeCardId);

  return {
    deckTemplateId: outputDeckTemplateId,
    activeCardId: newTemplateHasActiveCard ? existingDeckData.activeCardId : newTemplate.cards[0]?.cardId ?? "",
    cards: newTemplate.cards.map((newCard) => {
      const oldCard = oldCardsById.get(newCard.cardId);
      const existingCard = existingCardsById.get(newCard.cardId);

      if (!oldCard || !existingCard) {
        return createFreshCardData(newCard);
      }

      const oldStepsById = new Map(oldCard.steps.map((step) => [step.stepId, step]));
      const existingItemsById = new Map(existingCard.items.map((item) => [item.itemId, item]));
      const existingSignalReadingsById = new Map(existingCard.signalReadings.map((reading) => [reading.signalId, reading]));

      return {
        cardId: newCard.cardId,
        targetDate: existingCard.targetDate,
        items: newCard.steps.map((newStep) => {
          const oldStep = oldStepsById.get(newStep.stepId);
          const existingItem = existingItemsById.get(newStep.stepId);
          const canPreserveCompletionStatus = oldStep !== undefined && oldStep.description === newStep.description;

          return {
            itemId: newStep.stepId,
            completionStatus: existingItem && canPreserveCompletionStatus ? existingItem.completionStatus : "todo",
          };
        }),
        signalReadings: IMPLICIT_SIGNAL_IDS.map((signalId, signalIndex) => {
          const existingFixedReading = existingSignalReadingsById.get(signalId);
          const legacySignal = oldCard.signals?.[signalIndex];
          const existingLegacyReading = legacySignal ? existingSignalReadingsById.get(legacySignal.signalId) : undefined;
          const reading =
            existingFixedReading !== undefined
              ? clampSignalReading(existingFixedReading.reading)
              : existingLegacyReading !== undefined
                ? clampSignalReading(existingLegacyReading.reading)
                : DEFAULT_SIGNAL_READING;

          return {
            signalId,
            reading,
          };
        }),
        reflection: existingCard.reflection,
        mediaItems: existingCard.mediaItems,
        chats: existingCard.chats,
      };
    }),
    createdAt: existingDeckData.createdAt,
    updatedAt: existingDeckData.updatedAt,
  };
}
