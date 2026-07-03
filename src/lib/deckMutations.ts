import type { CompletionStatus } from "@/components/decks/types";
import { clientStepCompletionToServerItemCompletion } from "@/lib/deckApiTransforms";

type SharedDeckCommentMutationResult = {
  chat: {
    id: string;
    comments: Array<{
      id: string;
      creatorId: string;
      createdAt: string;
      text: string;
      isRetained: boolean;
    }>;
  };
  comment: {
    id: string;
    creatorId: string;
    createdAt: string;
    text: string;
    isRetained: boolean;
  };
};

export async function persistActiveCardId(deckTemplateId: string, activeCardId: string) {
  const response = await fetch(`/api/decks-data/${deckTemplateId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ activeCardId }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to update deck position.");
  }
}

export async function persistStepCompletionStatus(
  deckTemplateId: string,
  cardId: string,
  stepId: string,
  completionStatus: CompletionStatus,
) {
  const payload = clientStepCompletionToServerItemCompletion({
    cardId,
    stepId,
    completionStatus,
  });

  const response = await fetch(`/api/decks-data/${deckTemplateId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to update item progress.");
  }
}

export async function persistCardTargetDate(deckTemplateId: string, cardId: string, targetDate: string) {
  const response = await fetch(`/api/decks-data/${deckTemplateId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cardId,
      targetDate,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to update card target date.");
  }
}

export async function persistCardReflection(deckTemplateId: string, cardId: string, reflection: string | null) {
  const response = await fetch(`/api/decks-data/${deckTemplateId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "update-card-reflection",
      cardId,
      reflection,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to update card reflection.");
  }
}

export async function persistSignalReading(
  deckTemplateId: string,
  cardId: string,
  signalId: string,
  reading: number,
) {
  const response = await fetch(`/api/decks-data/${deckTemplateId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cardId,
      signalId,
      reading,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to update signal reading.");
  }
}

export async function createSharedCardComment(
  deckTemplateId: string,
  cardId: string,
  deckUserId: string,
  text: string,
): Promise<SharedDeckCommentMutationResult> {
  const response = await fetch(
    `/api/decks-data/shared/${encodeURIComponent(deckTemplateId)}/cards/${encodeURIComponent(cardId)}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deckUserId,
        text,
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | (SharedDeckCommentMutationResult & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to add shared deck comment.");
  }

  if (!payload || !("chat" in payload) || !("comment" in payload)) {
    throw new Error("Unable to add shared deck comment.");
  }

  return payload;
}
