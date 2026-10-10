"use client";
import { useWorkingUpdates } from "./useWorkingUpdates";
import DeckScene, { type DeckSceneProps } from "./DeckScene";
import type { DeckLayout } from "./deckLayout";
import DeckMenu from "./DeckMenu";
import WorkingFocusedCardView from "./WorkingFocusedCardView";
import BackCardFaceContent from "./BackCardFaceContent";
import { hasPersonalCard } from "./presentation";
import { useWorkingDeck } from "./useWorkingDeck";

type DeckDetailProps = Pick<DeckSceneProps, "isDeckFlipped" | "deckFlipRotationY" | "onBack" | "onToggleDeckFlip" | "transition"> & { deck: DeckLayout; onAdopted: (command: import("@/lib/cards/updateAdoption").UpdateCommand) => Promise<void> };

// Existing working entry point: canonical consumers mount DeckScene directly.
export default function DeckDetail({ deck, onAdopted, ...props }: DeckDetailProps) {
  const working = useWorkingDeck(deck);
  const updates = useWorkingUpdates(deck, async (command) => { await onAdopted(command); working.clearMutationError(); });
  // Working membership is already authorized by the resolver. Creator entry
  // may create an owned copy; it does not grant writes to the foreign original.
  const canEnterCreator = deck.permissions?.canEditDeck || (deck.hasUserDeckData && deck.context === "working");
  return <><DeckScene {...props} deck={working.deck} updateAction={updates.deckButton} cardFrontAction={(card) => updates.cardButton(card.id)} error={working.mutationError || updates.discoveryError}
    deckActions={canEnterCreator ? <DeckMenu deckId={deck.id} deckTemplateId={deck.deckTemplateId} /> : undefined}
    onActiveCardChange={working.commitActiveCard}
    renderCardBackFace={(card, options) => hasPersonalCard(card) ? <BackCardFaceContent card={card} deckTemplateId={deck.deckTemplateId} {...options} /> : null}
    renderFocusedCard={(focused) => hasPersonalCard(focused.card) ? <WorkingFocusedCardView {...focused} card={focused.card}
      canMutate={working.canMutate}
      frontAction={updates.cardButton(focused.card.id)}
      onCycleStepStatus={(stepId) => working.cycleFocusedStepStatus(focused.card.id, stepId)}
      onAdjustTargetDate={(direction) => working.adjustFocusedCardTargetDate(focused.card.id, direction)}
      onCommitSignalReading={working.commitFocusedSignalReading}
      onCommitReflection={working.canMutate && deck.hasUserDeckData ? working.commitFocusedReflection : undefined}
      onCommitCardMedia={working.canMutate && deck.hasUserDeckData ? working.commitFocusedCardMedia : undefined}
      onRemoveCardMedia={working.canMutate && deck.hasUserDeckData ? working.removeFocusedCardMedia : undefined}
    /> : null} />{updates.modal}</>;
}
