"use client";
import DeckScene, { type DeckSceneProps } from "./DeckScene";
import type { DeckLayout } from "./deckLayout";
import DeckMenu from "./DeckMenu";
import WorkingFocusedCardView from "./WorkingFocusedCardView";
import BackCardFaceContent from "./BackCardFaceContent";
import { hasPersonalCard } from "./presentation";
import { useWorkingDeck } from "./useWorkingDeck";

type DeckDetailProps = Pick<DeckSceneProps, "isDeckFlipped" | "deckFlipRotationY" | "onBack" | "onToggleDeckFlip" | "transition"> & { deck: DeckLayout };

// Existing working entry point: canonical consumers mount DeckScene directly.
export default function DeckDetail({ deck, ...props }: DeckDetailProps) {
  const working = useWorkingDeck(deck);
  return <DeckScene {...props} deck={working.deck} error={working.mutationError}
    deckActions={deck.permissions?.canEditDeck ? <DeckMenu deckId={deck.id} deckTemplateId={deck.deckTemplateId} /> : undefined}
    onActiveCardChange={working.commitActiveCard}
    renderCardBackFace={(card, options) => hasPersonalCard(card) ? <BackCardFaceContent card={card} deckTemplateId={deck.deckTemplateId} {...options} /> : null}
    renderFocusedCard={(focused) => hasPersonalCard(focused.card) ? <WorkingFocusedCardView {...focused} card={focused.card}
      canMutate={working.canMutate}
      onCycleStepStatus={(stepId) => working.cycleFocusedStepStatus(focused.card.id, stepId)}
      onAdjustTargetDate={(direction) => working.adjustFocusedCardTargetDate(focused.card.id, direction)}
      onCommitSignalReading={working.commitFocusedSignalReading}
      onCommitReflection={working.canMutate && deck.hasUserDeckData ? working.commitFocusedReflection : undefined}
      onCommitCardMedia={working.canMutate && deck.hasUserDeckData ? working.commitFocusedCardMedia : undefined}
      onRemoveCardMedia={working.canMutate && deck.hasUserDeckData ? working.removeFocusedCardMedia : undefined}
    /> : null} />;
}
