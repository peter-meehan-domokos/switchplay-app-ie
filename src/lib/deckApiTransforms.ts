import type {
  ClientUserCardData,
  ClientUserDeckData,
  CompletionStatus,
  DeckIntroduction,
  DeckTemplate,
  RuntimeDeckTemplate,
  StreamTemplate,
  UserCardData,
  UserDeckData,
} from "@/components/decks/types";

type RawDeckTemplateWithLegacyStreams = Omit<DeckTemplate, "introduction" | "streams"> & {
  channels?: StreamTemplate[];
  introduction?: DeckIntroduction | null;
  streams?: StreamTemplate[];
};

export function normalizeDeckIntroductionForRuntime(
  introduction: DeckIntroduction | null | undefined,
): DeckIntroduction | null {
  if (introduction == null) {
    return null;
  }

  return {
    image: introduction.image ?? null,
    video: introduction.video ?? null,
  };
}

export function normalizeDeckTemplateForRuntime(rawTemplate: RawDeckTemplateWithLegacyStreams): RuntimeDeckTemplate {
  const templateWithoutNormalizedFields = { ...rawTemplate };
  delete templateWithoutNormalizedFields.introduction;
  delete templateWithoutNormalizedFields.streams;
  delete templateWithoutNormalizedFields.channels;

  return {
    ...templateWithoutNormalizedFields,
    introduction: normalizeDeckIntroductionForRuntime(rawTemplate.introduction),
    streams: rawTemplate.streams ?? rawTemplate.channels ?? [],
  };
}

function normalizeServerItemsToClientSteps(serverItems: UserCardData["items"]): ClientUserCardData["steps"] {
  return serverItems.map((item) => ({
    stepId: item.itemId,
    completionStatus: item.completionStatus,
  }));
}

function normalizeClientStepsToServerItems(clientSteps: ClientUserCardData["steps"]): UserCardData["items"] {
  return clientSteps.map((step) => ({
    itemId: step.stepId,
    completionStatus: step.completionStatus,
  }));
}

function normalizeSharedWithUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((userId): userId is string => typeof userId === "string");
}

export function normalizeUserDeckDataSharingFields<T extends { sharedWithUserIds?: unknown }>(
  deckData: T,
): T & { sharedWithUserIds: string[] } {
  return {
    ...deckData,
    sharedWithUserIds: normalizeSharedWithUserIds(deckData.sharedWithUserIds),
  };
}

export function serverDeckDataItemsToClientDeckDataSteps(serverDeckData: UserDeckData[]): ClientUserDeckData[] {
  return serverDeckData.map((deckData) => {
    const deckDataWithoutChannels = { ...deckData } as UserDeckData & { channels?: unknown };
    delete deckDataWithoutChannels.channels;
    const normalizedDeckData = normalizeUserDeckDataSharingFields(deckDataWithoutChannels);

    return {
      ...normalizedDeckData,
      cards: deckData.cards.map((card) => ({
        ...card,
        steps: normalizeServerItemsToClientSteps(card.items),
      })),
    };
  });
}

export function clientDeckDataStepsToServerDeckDataItems(clientDeckData: ClientUserDeckData[]): UserDeckData[] {
  return clientDeckData.map((deckData) => {
    const deckDataWithoutChannels = { ...deckData } as ClientUserDeckData & { channels?: unknown };
    delete deckDataWithoutChannels.channels;
    const normalizedDeckData = normalizeUserDeckDataSharingFields(deckDataWithoutChannels);

    return {
      ...normalizedDeckData,
      cards: deckData.cards.map((card) => ({
        ...card,
        items: normalizeClientStepsToServerItems(card.steps),
      })),
    };
  });
}

export function clientStepCompletionToServerItemCompletion(input: {
  cardId: string;
  stepId: string;
  completionStatus: CompletionStatus;
}) {
  return {
    cardId: input.cardId,
    itemId: input.stepId,
    completionStatus: input.completionStatus,
  };
}
