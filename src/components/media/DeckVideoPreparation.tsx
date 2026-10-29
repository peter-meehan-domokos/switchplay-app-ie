"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createDeckVideoPreparation, type DeckVideoCard } from "@/lib/deckVideoPreparation";
import { deckPresentationIdentity, hasPersonalCard, hasPersonalDeck, type PresentedCard, type PresentedDeck } from "@/components/decks/presentation";
import { isCloudflareStreamVideoMediaItem } from "@/lib/media";

const PreparationContext = createContext<ReturnType<typeof createDeckVideoPreparation> | null>(null);
const ViewerContext = createContext<string | undefined>(undefined);
const emptySubscribe = () => () => {};
const emptySnapshot = () => 0;

function videoCard(card: PresentedCard, viewer?: string): DeckVideoCard {
  const actor = hasPersonalCard(card) ? card.dataOwnerUserId : viewer;
  const version = hasPersonalCard(card) ? card.adoptedVersion : card.version;
  const mode = hasPersonalCard(card) ? "working" : "canonical";
  const intro = isCloudflareStreamVideoMediaItem(card.intro.mediaItem) ? card.intro.mediaItem : null;
  return {
    key: JSON.stringify([actor, mode, card.cardTemplateId, version, intro?.assetId]),
    context: process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === "1" && actor && version && card.cardTemplateId
      ? { viewerUserId: actor, mode, cardTemplateId: card.cardTemplateId, version } : null,
    intro,
  };
}

export function DeckVideoPreparationProvider({ deck, viewerUserId, activeIndex, suspended, children }: {
  deck: PresentedDeck; viewerUserId?: string; activeIndex: number; suspended: boolean; children: ReactNode;
}) {
  const actor = hasPersonalDeck(deck) ? deck.dataOwnerUserId : viewerUserId;
  const identity = deckPresentationIdentity(deck);
  // Replacing a Deck, learner or adopted composition owns a fresh resource pool.
  const manager = useMemo(() => createDeckVideoPreparation(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Scope lifetime, not initialisation arguments.
    [identity, actor]);
  const cards = useMemo(() => deck.cards.map(card => videoCard(card, actor)), [deck.cards, actor]);
  useEffect(() => {
    manager.update(cards, activeIndex);
  }, [manager, cards, activeIndex]);
  useEffect(() => {
    const visibility = () => manager.setHidden(suspended || document.visibilityState === "hidden");
    visibility(); document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [manager, suspended]);
  useEffect(() => () => manager.dispose(), [manager]);
  return <PreparationContext.Provider value={manager}><ViewerContext.Provider value={actor}>{children}</ViewerContext.Provider></PreparationContext.Provider>;
}

export function useDeckVideoResource(card: PresentedCard) {
  const manager = useContext(PreparationContext);
  const viewer = useContext(ViewerContext);
  const descriptor = videoCard(card, viewer);
  const resource = manager?.resource(descriptor);
  useSyncExternalStore(resource?.subscribe ?? emptySubscribe, resource?.snapshot ?? emptySnapshot, emptySnapshot);
  return { manager, resource, key: descriptor.key };
}
