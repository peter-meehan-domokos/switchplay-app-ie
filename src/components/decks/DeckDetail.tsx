"use client";
import { useCallback, useRef, useState } from "react";
import WorkingCardMediaViewer, { type WorkingMediaSelection } from "@/components/media/WorkingCardMediaViewer";
import { personalMediaKey, visiblePersonalMedia } from "@/lib/cards/personalHistoryProjection";
import type { OpenCardMedia } from "@/lib/cardMediaViewer";
import AssessmentControl from "@/components/assessments/AssessmentControl";
import { useWorkingUpdates } from "./useWorkingUpdates";
import DeckScene, { type DeckSceneProps } from "./DeckScene";
import type { DeckLayout } from "./deckLayout";
import DeckMenu from "./DeckMenu";
import WorkingFocusedCardView from "./WorkingFocusedCardView";
import BackCardFaceContent from "./BackCardFaceContent";
import { hasPersonalCard } from "./presentation";
import { useWorkingDeck } from "./useWorkingDeck";

type DeckDetailProps = Pick<DeckSceneProps, "isDeckFlipped" | "deckFlipRotationY" | "onBack" | "backLabel" | "onToggleDeckFlip" | "transition"> & { deck: DeckLayout; creatorEditHref?: string; onArchive?: () => Promise<boolean>; archiveDisabled?: boolean; onAdopted: (command: import("@/lib/cards/updateAdoption").UpdateCommand) => Promise<void> };

// Existing working entry point: canonical consumers mount DeckScene directly.
export default function DeckDetail({ deck, onAdopted, creatorEditHref, onArchive, archiveDisabled, ...props }: DeckDetailProps) {
  const [viewer, setViewer] = useState<WorkingMediaSelection | null>(null);
  const mediaSourceRef = useRef<HTMLButtonElement | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const working = useWorkingDeck(deck);
  const updates = useWorkingUpdates(deck, async (command) => { await onAdopted(command); working.clearMutationError(); });
  const openMedia: OpenCardMedia = (cardId, mediaItemId, source, context) => {
    if (!context || viewer || assessmentOpen || document.querySelector(".creator-modal-backdrop")) return;
    const card = working.deck.cards.find(card => card.id === cardId);
    const index = card ? visiblePersonalMedia(card).findIndex(item => personalMediaKey(item) === mediaItemId) : -1;
    if (index < 0) return;
    mediaSourceRef.current = source;
    setViewer({ cardId, mediaItemId, index, ...context, viewerUserId: deck.dataOwnerUserId!, deckTemplateId: deck.deckTemplateId, version: card?.adoptedVersion });
  };
  // Working membership is already authorized by the resolver. Creator entry
  // may create an owned copy; it does not grant writes to the foreign original.
  const canEnterCreator = deck.permissions?.canEditDeck || (deck.hasUserDeckData && deck.context === "working");
  const assessment = (card: import("./presentation").PresentedCard, variant: "front" | "back" = "front", interactive = true) => hasPersonalCard(card) && working.canMutate && deck.dataOwnerUserId ?
    <AssessmentControl key={`${deck.dataOwnerUserId}:${card.id}`} variant={variant} interactive={interactive} context={{ viewerUserId: deck.dataOwnerUserId,
      source: { kind: "card", cardTemplateId: card.id }, deckTemplateId: deck.deckTemplateId,
      canCreate: deck.hasUserDeckData && deck.context === "working" }} onOpenChange={setAssessmentOpen} /> : undefined;
  return <><DeckScene {...props} onOpenMedia={openMedia} mediaViewerOpen={!!viewer}
    renderMediaOverlay={context => <WorkingCardMediaViewer deck={working.deck} selection={viewer} context={context}
      sourceRef={mediaSourceRef} onSelect={setViewer} onClose={closeViewer} />} deck={working.deck} updateAction={updates.deckButton} cardFrontAction={(card) => updates.cardButton(card.id)} error={working.mutationError || updates.discoveryError}
    deckActions={canEnterCreator || onArchive ? <DeckMenu deckId={deck.id} deckTemplateId={deck.deckTemplateId} editHref={creatorEditHref}
      showEdit={!!canEnterCreator} deckTitle={deck.title} onArchive={onArchive} archiveDisabled={archiveDisabled} /> : undefined}
    onActiveCardChange={working.commitActiveCard}
    renderCardBackFace={(card, options) => hasPersonalCard(card) ? <BackCardFaceContent assessment={assessment(card, "back", false)} card={card} deckTemplateId={deck.deckTemplateId} {...options} /> : null}
    renderFocusedCard={(focused) => hasPersonalCard(focused.card) ? <WorkingFocusedCardView {...focused} card={focused.card}
      backAssessment={assessment(focused.card, "back")} assessmentOpen={assessmentOpen}
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
