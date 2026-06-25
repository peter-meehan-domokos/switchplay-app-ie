import type {
  ClientUserCardData,
  ClientUserDeckData,
  CompletionStatus,
  UserCardData,
  UserDeckData,
} from "@/components/decks/types";

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

export function serverDeckDataItemsToClientDeckDataSteps(serverDeckData: UserDeckData[]): ClientUserDeckData[] {
  return serverDeckData.map((deckData) => {
    const deckDataWithoutChannels = { ...deckData } as UserDeckData & { channels?: unknown };
    delete deckDataWithoutChannels.channels;

    return {
      ...deckDataWithoutChannels,
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

    return {
      ...deckDataWithoutChannels,
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
