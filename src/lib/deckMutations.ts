import type { CompletionStatus } from "@/components/decks/types";

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

export async function persistItemCompletionStatus(
  deckTemplateId: string,
  cardId: string,
  itemId: string,
  completionStatus: CompletionStatus,
) {
  const response = await fetch(`/api/decks-data/${deckTemplateId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cardId,
      itemId,
      completionStatus,
    }),
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