import type { CompletionStatus } from "@/components/decks/types";
import { clientStepCompletionToServerItemCompletion } from "@/lib/deckApiTransforms";

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
