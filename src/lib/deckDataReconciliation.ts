import type { DeckTemplate, UserDeckData } from "@/components/decks/types";

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
    signalReadings: [],
    reflection: "",
    mediaItems: [],
    chats: [],
  };
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
    ...existingDeckData,
    deckTemplateId: outputDeckTemplateId,
    activeCardId: newTemplateHasActiveCard ? existingDeckData.activeCardId : newTemplate.cards[0]?.cardId ?? "",
    channels: newTemplate.channels,
    cards: newTemplate.cards.map((newCard) => {
      const oldCard = oldCardsById.get(newCard.cardId);
      const existingCard = existingCardsById.get(newCard.cardId);

      if (!oldCard || !existingCard) {
        return createFreshCardData(newCard);
      }

      const oldStepsById = new Map(oldCard.steps.map((step) => [step.stepId, step]));
      const existingItemsById = new Map(existingCard.items.map((item) => [item.itemId, item]));
      const oldSignalsById = new Map(oldCard.signals.map((signal) => [signal.signalId, signal]));
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
        signalReadings: newCard.signals.flatMap((newSignal) => {
          const oldSignal = oldSignalsById.get(newSignal.signalId);
          const existingReading = existingSignalReadingsById.get(newSignal.signalId);

          if (!oldSignal || !existingReading) {
            return [];
          }

          const canPreserveReading =
            oldSignal.title === newSignal.title &&
            oldSignal.order === newSignal.order &&
            oldSignal.minValue === newSignal.minValue &&
            oldSignal.maxValue === newSignal.maxValue;

          return canPreserveReading ? [existingReading] : [];
        }),
        reflection: existingCard.reflection,
        mediaItems: existingCard.mediaItems,
        chats: existingCard.chats,
      };
    }),
  };
}
