import {
  type Deck,
  type DeckTemplate,
  type UserCardData,
  type UserDeckData,
} from "@/components/decks/types";

function getFirstCardId(template: DeckTemplate) {
  return template.cards[0]?.cardId ?? "";
}

function createEmptyUserCardDataFromTemplate(templateCard: DeckTemplate["cards"][number]): UserCardData {
  return {
    cardId: templateCard.cardId,
    targetDate: templateCard.suggestedTargetDate,
    items: templateCard.items.map((item) => ({
      itemId: item.itemId,
      completionStatus: "todo",
    })),
    signalReadings: [],
    reflection: "",
    mediaItems: [],
    chats: [],
  };
}

export function createEmptyUserDeckDataFromTemplate(template: DeckTemplate): UserDeckData {
  const timestamp = new Date().toISOString();

  return {
    deckTemplateId: template.deckTemplateId,
    activeCardId: getFirstCardId(template),
    channels: template.channels,
    cards: template.cards.map((templateCard) => createEmptyUserCardDataFromTemplate(templateCard)),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function getDeckKey(userId: string, deckTemplateId: string) {
  return `${userId}:${deckTemplateId}`;
}

export function mergeDeckTemplatesWithUserData(
  templates: DeckTemplate[],
  decksData: UserDeckData[],
  userId: string,
): Deck[] {
  const decksDataByTemplateId = new Map(decksData.map((deckData) => [deckData.deckTemplateId, deckData]));

  return templates.map((template) => {
    const matchedUserDeckData = decksDataByTemplateId.get(template.deckTemplateId);
    const fallbackUserDeckData = createEmptyUserDeckDataFromTemplate(template);
    const resolvedDeckData = matchedUserDeckData ?? fallbackUserDeckData;
    const cardDataById = new Map(resolvedDeckData.cards.map((cardData) => [cardData.cardId, cardData]));

    const cards = template.cards.map((templateCard) => {
      const fallbackCardData = createEmptyUserCardDataFromTemplate(templateCard);
      const cardData = cardDataById.get(templateCard.cardId) ?? fallbackCardData;
      const itemStatusByItemId = new Map(cardData.items.map((item) => [item.itemId, item.completionStatus]));
      const signalReadingById = new Map(cardData.signalReadings.map((signal) => [signal.signalId, signal.reading]));

      return {
        id: templateCard.cardId,
        title: templateCard.title,
        subtitle: templateCard.subtitle,
        targetDate: cardData.targetDate || templateCard.suggestedTargetDate,
        intro: templateCard.intro,
        items: templateCard.items.map((item) => ({
          id: item.itemId,
          description: item.description,
          mediaItem: item.mediaItem,
          completionStatus: itemStatusByItemId.get(item.itemId) ?? "todo",
        })),
        signals: templateCard.signals.map((signal) => ({
          id: signal.signalId,
          title: signal.title,
          description: signal.description,
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
