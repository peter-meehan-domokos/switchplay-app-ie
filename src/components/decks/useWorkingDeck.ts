"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DeckLayout } from "./deckLayout";
import { buildOptimisticDeckLayout } from "./deckLayout";
import { personalWork } from "@/lib/cards/personalWork";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { withCardMediaItems, withUpdatedSignalReading, withUpdatedReflection } from "@/components/cards/cardLayout";
import { OptimisticSignalManager } from "@/lib/OptimisticSignalManager";
import { persistActiveCardId, appendCardMediaItem, persistCardReflection, persistCardTargetDate, persistSignalReading, persistStepCompletionStatus, removePersonalCardMediaItem } from "@/lib/deckMutations";
import type { UserCardMediaUploadTarget } from "@/components/media/useKeyedUserCardMediaUploadController";
import type { CompletionStatus } from "./types";
import { addDaysToDateOnly } from "@/lib/dateOnly";
import { normalizeCompletionStatus } from "@/lib/progress";
import { roundSignalReadingForStorage } from "@/lib/signals";
import type { MediaItem } from "@/lib/media";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";
import { UserCardMediaMutationQueue } from "@/lib/userCardMediaMutationQueue";
const stepProgressCycle: CompletionStatus[] = ["todo", "inProgress", "done", "skipped"];
function getNextCompletionStatus(currentStatus: CompletionStatus) {
  return stepProgressCycle[(stepProgressCycle.indexOf(currentStatus) + 1) % stepProgressCycle.length];
}
const addDaysToDateString = addDaysToDateOnly;

// Mounted only by DeckDetail's working adapter. Queues, optimistic state and
// store ownership survive focus and Card navigation for the lifetime of the Deck.
export function useWorkingDeck(deck: DeckLayout, ready = true) {
  const canMutate = ready && deck.dataOwnerUserId != null && deck.cards.every((card) => card.permissions?.canMutateCardData && card.permissions.dataOwnerUserId === deck.dataOwnerUserId);
  const [mutationError, setMutationError] = useState("");
  const [cards, setCards] = useState(() => deck.dataOwnerUserId ? deck.cards.map((card) => workingCardStore.project(deck.dataOwnerUserId!, card)) : deck.cards);
  const fieldTokens = useRef(new Map<string, symbol>());
  const confirmedFields = useRef(new Map<string, unknown>());
  // cardsRef is the immediate optimistic source of truth for target-date edits.
  // We update it synchronously before setCards(...) so rapid taps always calculate
  // from the latest optimistic state rather than waiting for React render/effect timing.
  // This avoids missed persistence updates and prepares the interaction for future
  // long-press acceleration.
  const cardsRef = useRef(cards);
  const cardMediaMutationQueueRef = useRef<UserCardMediaMutationQueue | null>(null);

  if (cardMediaMutationQueueRef.current === null) {
    cardMediaMutationQueueRef.current = new UserCardMediaMutationQueue();
  }
  useEffect(() => {
    cardsRef.current = cards;
    if (ready && deck.dataOwnerUserId) workingCardStore.accept(deck.dataOwnerUserId, cards);
  }, [cards, deck.dataOwnerUserId, ready]);
  const [sourceCards, setSourceCards] = useState(deck.cards);
  if (sourceCards !== deck.cards) {
    setSourceCards(deck.cards);
    setCards(deck.cards.map((card) => {
      const current = cards.find((item) => item.id === card.id);
      return current && deck.dataOwnerUserId && personalWork.hasWork({ userId: deck.dataOwnerUserId, cardIds: [card.id] }) && current.adoptedVersion === card.adoptedVersion ? current : card;
    }));
  }
  const optimisticDeck = useMemo(() => buildOptimisticDeckLayout(deck, cards), [deck, cards]);
  function updatePersonalCard(cardId: string, change: (card: typeof cards[number]) => typeof cards[number]) {
    const next = cardsRef.current.map((card) => card.id === cardId ? change(card) : card);
    cardsRef.current = next; setCards(next);
  }
  async function saveField<T>(key: string, previous: T, next: T, persist: () => Promise<unknown>, rollback: (value: T) => void) {
    if (!confirmedFields.current.has(key)) confirmedFields.current.set(key, previous);
    const token = Symbol(); fieldTokens.current.set(key, token);
    try { await persist(); confirmedFields.current.set(key, next); }
    catch (error) {
      if (fieldTokens.current.get(key) === token) rollback(confirmedFields.current.get(key) as T);
      setMutationError(error instanceof Error ? error.message : "Change could not be saved");
    }
  }
  const cycleFocusedStepStatus = (cardId: string, stepId: string) => {
    if (!canMutate) {
      return;
    }

    const activeCardIndex = cardsRef.current.findIndex((card) => card.id === cardId);
    const activeCard = cardsRef.current[activeCardIndex];

    if (!activeCard) {
      return;
    }

    const currentStep = cardsRef.current.find((card) => card.id === activeCard.id)?.steps.find((step) => step.stepId === stepId);

    if (!currentStep) {
      return;
    }

    const nextCompletionStatus = getNextCompletionStatus(normalizeCompletionStatus(currentStep.completionStatus));

    const optimistic = cardsRef.current.map((card, cardIndex) => {
        if (cardIndex !== activeCardIndex) {
          return card;
        }

        return {
          ...card,
          steps: card.steps.map((step) =>
            step.stepId === stepId
              ? { ...step, completionStatus: nextCompletionStatus }
              : step
          ),
        };
      });
    cardsRef.current = optimistic; setCards(optimistic);

    if (!deck.hasUserDeckData) {
      return;
    }

    void saveField(`${activeCard.id}:completion:${stepId}`, currentStep.completionStatus, nextCompletionStatus,
      () => persistStepCompletionStatus(deck.deckTemplateId, activeCard.id, stepId, nextCompletionStatus, deck.dataOwnerUserId),
      (value) => updatePersonalCard(activeCard.id, (card) => ({ ...card, steps: card.steps.map((step) => step.stepId === stepId ? { ...step, completionStatus: value } : step) })));

  };
  const adjustFocusedCardTargetDate = (cardId: string, direction: -1 | 1) => {
    const activeCardIndex = cardsRef.current.findIndex((card) => card.id === cardId);
    if (!deck.hasUserDeckData || !canMutate) {
      return;
    }

    const activeCard = cardsRef.current[activeCardIndex];

    if (!activeCard) {
      return;
    }

    const nextTargetDate = addDaysToDateString(activeCard.targetDate, direction);

    if (!nextTargetDate) {
      console.warn("Unable to adjust card target date.");
      return;
    }

    const nextCards = cardsRef.current.map((card, cardIndex) =>
      cardIndex === activeCardIndex
        ? {
            ...card,
            targetDate: nextTargetDate,
          }
        : card,
    );

    cardsRef.current = nextCards;
    setCards(nextCards);

    void saveField(`${activeCard.id}:date`, activeCard.targetDate, nextTargetDate,
      () => persistCardTargetDate(deck.deckTemplateId, activeCard.id, nextTargetDate, deck.dataOwnerUserId),
      (value) => updatePersonalCard(activeCard.id, (card) => ({ ...card, targetDate: value })));

  };
  const optimisticSignalManagerRef = useRef<OptimisticSignalManager | null>(null);
  if (optimisticSignalManagerRef.current === null) {
    optimisticSignalManagerRef.current = new OptimisticSignalManager(
      async (cardId: string, signalId: string, reading: number) => {
        await persistSignalReading(deck.deckTemplateId, cardId, signalId, reading, deck.dataOwnerUserId);
      },
      (cardId: string, signalId: string, restored) => {
        setCards((currentCards) => {
          const revertedCards = currentCards.map((c) =>
            c.id === cardId
              ? withUpdatedSignalReading(c, signalId, restored.rawReading)
              : c
          );
          cardsRef.current = revertedCards;
          return revertedCards;
        });
      }
    );
  }

  useEffect(() => {
    for (const key of confirmedFields.current.keys()) {
      const pending = deck.cards.some((card) => key.startsWith(`${card.id}:`) && deck.dataOwnerUserId && personalWork.hasWork({ userId: deck.dataOwnerUserId, cardIds: [card.id] }));
      if (!pending && !(key.startsWith("deck:") && deck.dataOwnerUserId && personalWork.hasWork({ userId: deck.dataOwnerUserId, deckId: deck.deckTemplateId, cardIds: [] }))) confirmedFields.current.delete(key);
    }
    optimisticSignalManagerRef.current?.resetConfirmed();
  }, [deck.cards, deck.dataOwnerUserId, deck.deckTemplateId]);

  const commitFocusedSignalReading = (cardId: string, signalId: string, reading: number) => {
    if (!canMutate) {
      return;
    }

    const nextReading = roundSignalReadingForStorage(reading);
    const manager = optimisticSignalManagerRef.current!;

    // Capture baseline before optimistic update
    const currentCard = cardsRef.current.find((c) => c.id === cardId);
    const currentSignal = currentCard?.signals.find((s) => s.id === signalId);
    manager.getConfirmedSignal(cardId, signalId, currentSignal?.reading ?? null, currentSignal?.rawReading ?? null);

    const nextCards = cardsRef.current.map((card) =>
      card.id === cardId ? withUpdatedSignalReading(card, signalId, nextReading) : card
    );

    cardsRef.current = nextCards;
    setCards(nextCards);

    if (!deck.hasUserDeckData) {
      return;
    }

    void personalWork.run({ userId: deck.dataOwnerUserId!, cardIds: [cardId] }, `signal-chain:${cardId}:${signalId}`, () => manager.setOptimisticReading(cardId, signalId, nextReading)).catch(() => {});
  };
  const commitFocusedReflection = async (cardId: string, reflection: string) => {
    if (!canMutate || !deck.hasUserDeckData) {
      throw new Error("Unable to save reflection for this deck.");
    }

    const normalizedReflection = reflection.trim();
    const previousCards = cardsRef.current;
    const nextCards = previousCards.map((card) =>
      card.id === cardId ? withUpdatedReflection(card, normalizedReflection) : card
    );

    cardsRef.current = nextCards;
    setCards(nextCards);

    try {
      await persistCardReflection(deck.deckTemplateId, cardId, normalizedReflection, deck.dataOwnerUserId);
    } catch (error) {
      updatePersonalCard(cardId, (card) => withUpdatedReflection(card, previousCards.find((item) => item.id === cardId)?.reflection ?? ""));
      throw error;
    }
  };
  const applyConfirmedCardMedia = (
    cardId: string,
    mediaItems: MediaItem[],
  ) => {
    const nextCards = cardsRef.current.map((card) =>
      card.id === cardId ? withCardMediaItems(card, mediaItems) : card,
    );

    cardsRef.current = nextCards;
    setCards((currentCards) => currentCards.map((card) =>
      card.id === cardId ? withCardMediaItems(card, mediaItems) : card,
    ));
  };
  const commitFocusedCardMedia = async (target: UserCardMediaUploadTarget, mediaItem: ModernUserCardMediaItem) => {
    if (!canMutate || !deck.hasUserDeckData) {
      throw new Error("Unable to save media for this deck.");
    }

    if (target.deckTemplateId !== deck.deckTemplateId) {
      throw new Error("Unable to save media for this deck.");
    }

    await cardMediaMutationQueueRef.current!.enqueue(target, async () => {
      const result = await appendCardMediaItem(target.deckTemplateId, target.cardId, mediaItem, deck.dataOwnerUserId);

      if (result.deckTemplateId !== target.deckTemplateId || result.cardId !== target.cardId) {
        throw new Error("Card media was saved to an unexpected card.");
      }

      applyConfirmedCardMedia(target.cardId, result.mediaItems);
    });
  };
  const removeFocusedCardMedia = async (target: UserCardMediaUploadTarget, mediaItemId: string) => {
    if (!canMutate || !deck.hasUserDeckData) {
      throw new Error("Unable to remove media from this deck.");
    }

    if (target.deckTemplateId !== deck.deckTemplateId) {
      throw new Error("Unable to remove media from this deck.");
    }

    const affected = cardsRef.current.filter((card) => card.id === target.cardId || card.personalHistory?.some((segment) => segment.cardTemplateId === target.cardId)).map((card) => card.id);
    await personalWork.run({ userId: deck.dataOwnerUserId!, cardIds: [target.cardId, ...affected] }, `remove-media:${target.cardId}:${mediaItemId}`, () => cardMediaMutationQueueRef.current!.enqueue(target, async () => {
      const result = await removePersonalCardMediaItem(target.cardId, mediaItemId, deck.dataOwnerUserId);

      if (result.cardId !== target.cardId) {
        throw new Error("Card media was removed from an unexpected card.");
      }

      const nextCards = cardsRef.current.map((card) => withCardMediaItems({ ...card,
        personalHistory: card.personalHistory?.map((segment) => segment.cardTemplateId === target.cardId
          ? { ...segment, mediaItems: result.mediaItems } : segment),
      }, card.id === target.cardId ? result.mediaItems : card.mediaItems));
      workingCardStore.removeMedia(deck.dataOwnerUserId!, target.cardId, mediaItemId);
      cardsRef.current = nextCards;
      setCards(nextCards);
    }));
  };
  const commitActiveCard = (previous: number, next: number, rollback: (index: number) => void) => {
    const nextId = cardsRef.current[next]?.id;
    if (!deck.hasUserDeckData || !canMutate || !nextId) return;
    void saveField(`deck:${deck.deckTemplateId}:active`, previous, next,
      () => persistActiveCardId(deck.deckTemplateId, nextId, deck.dataOwnerUserId), rollback);
  };
  return { deck: optimisticDeck, canMutate, mutationError, clearMutationError: () => setMutationError(""), commitActiveCard,
    cycleFocusedStepStatus, adjustFocusedCardTargetDate, commitFocusedSignalReading,
    commitFocusedReflection, commitFocusedCardMedia, removeFocusedCardMedia };
}
