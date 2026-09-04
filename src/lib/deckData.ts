import {
  type ClientUserCardData,
  type ClientUserDeckData,
  type Deck,
  type DeckTemplate,
  type RuntimeDeckTemplate,
} from "@/components/decks/types";
import { resolveDateOnly } from "@/lib/dateOnly";
import { clampSignalReading, DEFAULT_SIGNAL_READING, IMPLICIT_SIGNAL_IDS } from "@/lib/signals";

function getFirstCardId(template: DeckTemplate) {
  return template.cards[0]?.cardId ?? "";
}

function createEmptyClientUserCardDataFromTemplate(templateCard: DeckTemplate["cards"][number]): ClientUserCardData {
  return {
    cardId: templateCard.cardId,
    targetDate: resolveDateOnly(templateCard.suggestedTargetDate),
    steps: templateCard.steps.map((step) => ({
      stepId: step.stepId,
      completionStatus: "todo",
    })),
    signalReadings: IMPLICIT_SIGNAL_IDS.map((signalId) => ({
      signalId,
      reading: DEFAULT_SIGNAL_READING,
    })),
    reflection: "",
    mediaItems: [],
    chats: [],
  };
}

function getDeckKey(userId: string, deckTemplateId: string) {
  return `${userId}:${deckTemplateId}`;
}

function getStreamTitle(template: DeckTemplate, index: number) {
  return template.streams[index]?.title ?? `Stream ${index + 1}`;
}

export function mergeDeckTemplatesWithUserData(
  templates: RuntimeDeckTemplate[],
  decksData: ClientUserDeckData[],
  userId: string,
  options?: {
    canMutate?: boolean;
    currentUserId?: string;
    ownerUserId?: string;
    ownerUsername?: string;
    showOwnerTag?: boolean;
  },
): Deck[] {
  const decksDataByTemplateId = new Map(decksData.map((deckData) => [deckData.deckTemplateId, deckData]));
  const currentUserId = options?.currentUserId ?? userId;
  const ownerUserId = options?.ownerUserId ?? userId;

  return templates.map((template) => {
    const matchedUserDeckData = decksDataByTemplateId.get(template.deckTemplateId);
    const fallbackUserDeckData: ClientUserDeckData = {
      deckTemplateId: template.deckTemplateId,
      activeCardId: getFirstCardId(template),
      cards: template.cards.map((templateCard) => createEmptyClientUserCardDataFromTemplate(templateCard)),
      sharedWithUserIds: [],
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
        label: templateCard.label,
        targetDate: resolveDateOnly(cardData.targetDate, resolveDateOnly(templateCard.suggestedTargetDate)),
        intro: templateCard.intro,
        steps: templateCard.steps.map((step) => ({
          stepId: step.stepId,
          description: step.description,
          descriptionContent: step.descriptionContent,
          mediaItem: step.mediaItem,
          completionStatus: stepStatusByStepId.get(step.stepId) ?? "todo",
        })),
        signals: IMPLICIT_SIGNAL_IDS.map((signalId, signalIndex) => {
          const fixedReading = signalReadingById.get(signalId);
          const legacySignal = templateCard.signals?.[signalIndex];
          const legacyReading = legacySignal ? signalReadingById.get(legacySignal.signalId) : undefined;
          const reading =
            fixedReading !== undefined
              ? clampSignalReading(fixedReading)
              : legacyReading !== undefined
                ? clampSignalReading(legacyReading)
                : DEFAULT_SIGNAL_READING;

          return {
            id: signalId,
            streamTitle: getStreamTitle(template, signalIndex),
            order: "increasing" as const,
            reading,
            unit: null,
          };
        }),
        mediaItems: cardData.mediaItems,
        chats: cardData.chats,
        reflection: cardData.reflection,
      };
    });

    return {
      id: getDeckKey(userId, template.deckTemplateId),
      deckTemplateId: template.deckTemplateId,
      hasUserDeckData: Boolean(matchedUserDeckData),
      canMutate: options?.canMutate ?? true,
      isOwnedByCurrentUser: ownerUserId === currentUserId,
      ownerUserId,
      ownerUsername: options?.ownerUsername ?? "",
      showOwnerTag: options?.showOwnerTag ?? false,
      activeCardId: resolvedDeckData.activeCardId || getFirstCardId(template),
      title: template.title,
      category: template.category,
      introduction: template.introduction,
      streams: template.streams,
      cards,
    };
  });
}
