import {
  type ClientUserCardData,
  type ClientUserDeckData,
  type Deck,
  type DeckTemplate,
} from "@/components/decks/types";

function getFirstCardId(template: DeckTemplate) {
  return template.cards[0]?.cardId ?? "";
}

function createEmptyClientUserCardDataFromTemplate(templateCard: DeckTemplate["cards"][number]): ClientUserCardData {
  return {
    cardId: templateCard.cardId,
    targetDate: templateCard.suggestedTargetDate,
    steps: templateCard.steps.map((step) => ({
      stepId: step.stepId,
      completionStatus: "todo",
    })),
    signalReadings: [],
    reflection: "",
    mediaItems: [],
    chats: [],
  };
}

function getDeckKey(userId: string, deckTemplateId: string) {
  return `${userId}:${deckTemplateId}`;
}

export function mergeDeckTemplatesWithUserData(
  templates: DeckTemplate[],
  decksData: ClientUserDeckData[],
  userId: string,
): Deck[] {
  const decksDataByTemplateId = new Map(decksData.map((deckData) => [deckData.deckTemplateId, deckData]));

  return templates.map((template) => {
    const matchedUserDeckData = decksDataByTemplateId.get(template.deckTemplateId);
    const fallbackUserDeckData: ClientUserDeckData = {
      deckTemplateId: template.deckTemplateId,
      activeCardId: getFirstCardId(template),
      channels: template.channels,
      cards: template.cards.map((templateCard) => createEmptyClientUserCardDataFromTemplate(templateCard)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const resolvedDeckData = matchedUserDeckData ?? fallbackUserDeckData;
    const cardDataById = new Map(resolvedDeckData.cards.map((cardData) => [cardData.cardId, cardData]));

    const cards = template.cards.map((templateCard) => {
      const fallbackCardData = createEmptyClientUserCardDataFromTemplate(templateCard);
      const cardData = cardDataById.get(templateCard.cardId) ?? fallbackCardData;
      const signalReadingById = new Map(cardData.signalReadings.map((signal) => [signal.signalId, signal.reading]));
      const stepStatusByStepId = new Map(cardData.steps.map((step) => [step.stepId, step.completionStatus]));

      return {
        id: templateCard.cardId,
        title: templateCard.title,
        subtitle: templateCard.subtitle,
        targetDate: cardData.targetDate || templateCard.suggestedTargetDate,
        intro: templateCard.intro,
        steps: templateCard.steps.map((step) => ({
          stepId: step.stepId,
          description: step.description,
          mediaItem: step.mediaItem,
          completionStatus: stepStatusByStepId.get(step.stepId) ?? "todo",
        })),
        signals: templateCard.signals.map((signal) => ({
          id: signal.signalId,
          title: signal.title,
          order: signal.order,
          reading: signalReadingById.get(signal.signalId) ?? signal.minValue,
          minValue: signal.minValue,
          maxValue: signal.maxValue,
          isTheoreticalMin: signal.isTheoreticalMin,
          isTheoreticalMax: signal.isTheoreticalMax,
          unit: signal.unit,
        })),
        mediaItems: cardData.mediaItems,
        chats: cardData.chats,
        reflection: cardData.reflection,
      };
    });

    return {
      id: getDeckKey(userId, template.deckTemplateId),
      deckTemplateId: template.deckTemplateId,
      hasUserDeckData: Boolean(matchedUserDeckData),
      activeCardId: resolvedDeckData.activeCardId || getFirstCardId(template),
      title: template.title,
      category: template.category,
      channels: template.channels,
      cards,
    };
  });
}
