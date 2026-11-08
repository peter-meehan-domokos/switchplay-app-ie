"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import CardMediaCentre from "@/components/media/CardMediaCentre";
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

type DeckDetailProps = Pick<DeckSceneProps, "isDeckFlipped" | "deckFlipRotationY" | "onBack" | "backLabel" | "onToggleDeckFlip" | "transition"> & { deck: DeckLayout; ready?: boolean; entryRevision?: number; recoveryInfoCardId?: string; creatorEditHref?: string; onArchive?: () => Promise<boolean>; archiveDisabled?: boolean; onAdopted: (command: import("@/lib/cards/updateAdoption").UpdateCommand) => Promise<void> };

// Existing working entry point: canonical consumers mount DeckScene directly.
export default function DeckDetail({ deck, ready = true, entryRevision, recoveryInfoCardId, onAdopted, creatorEditHref, onArchive, archiveDisabled, ...props }: DeckDetailProps) {
  const [viewer, setViewer] = useState<WorkingMediaSelection | null>(null);
  const [centre, setCentre] = useState<{ cardId: string; activeCardId: string; focused: boolean } | null>(null);
  const mediaSourceRef = useRef<HTMLButtonElement | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const working = useWorkingDeck(deck, ready);
  const [pendingNavigation, setPendingNavigation] = useState<{ cardId: string; rollback: (index: number) => void } | null>(null);
  const submittedNavigation = useRef<typeof pendingNavigation>(null);
  // Navigation is visual immediately. Persist only the latest selected Card
  // after the opening transaction, which also writes DeckData.activeCardId.
  useEffect(() => {
    if (!ready || !pendingNavigation || submittedNavigation.current === pendingNavigation) return;
    submittedNavigation.current = pendingNavigation;
    const next = deck.cards.findIndex(card => card.id === pendingNavigation.cardId);
    const previous = Math.max(0, deck.cards.findIndex(card => card.id === deck.activeCardId));
    if (next >= 0 && next !== previous) working.commitActiveCard(previous, next, pendingNavigation.rollback);
  }, [ready, pendingNavigation, deck.cards, deck.activeCardId, working]);
  const updates = useWorkingUpdates(deck, async (command) => { await onAdopted(command); working.clearMutationError(); }, ready);
  const openMedia: OpenCardMedia = (cardId, mediaItemId, source, context, initialPage) => {
    if (!context || viewer || centre || assessmentOpen || document.querySelector(".creator-modal-backdrop")) return;
    const card = working.deck.cards.find(card => card.id === cardId);
    const index = card ? visiblePersonalMedia(card).findIndex(item => personalMediaKey(item) === mediaItemId) : -1;
    if (!card) return;
    mediaSourceRef.current = source;
    setViewer({ cardId, mediaItemId, initialPage, index: Math.max(0, index), ...context, viewerUserId: deck.dataOwnerUserId!, deckTemplateId: deck.deckTemplateId, version: card?.adoptedVersion });
  };
  // Working membership is already authorized by the resolver. Creator entry
  // may create an owned copy; it does not grant writes to the foreign original.
  const canEnterCreator = ready && (deck.permissions?.canEditDeck || (deck.hasUserDeckData && deck.context === "working"));
  const assessment = (card: import("./presentation").PresentedCard, variant: "front" | "back" = "front", interactive = true) => hasPersonalCard(card) && deck.dataOwnerUserId ?
    <AssessmentControl key={`${deck.dataOwnerUserId}:${card.id}`} variant={variant} interactive={interactive && working.canMutate} context={{ viewerUserId: deck.dataOwnerUserId,
      initialHistory: deck.preparedAssessments?.[card.id], source: { kind: "card", cardTemplateId: card.id }, deckTemplateId: deck.deckTemplateId,
      canCreate: working.canMutate && deck.hasUserDeckData && deck.context === "working" }} onOpenChange={setAssessmentOpen} /> : undefined;
  const entryCardId = pendingNavigation && deck.cards.some(card => card.id === pendingNavigation.cardId) ? pendingNavigation.cardId : deck.activeCardId;
  return <><DeckScene {...props} initiallyFocused={!!recoveryInfoCardId} entrySelection={entryRevision === undefined ? undefined : { revision: entryRevision, cardId: entryCardId }} onOpenMedia={openMedia} mediaViewerOpen={!!viewer || !!centre}
    renderMediaOverlay={context => {
      const card = centre && working.deck.cards.find(c => c.id === centre.cardId);
      const valid = card && hasPersonalCard(card) && context.activeCardId === centre?.activeCardId && context.focused === centre.focused && !context.transitioning;
      return <><WorkingCardMediaViewer deck={working.deck} selection={viewer} context={context}
        sourceRef={mediaSourceRef} onSelect={setViewer} onClose={closeViewer} />
        {valid && working.canMutate && deck.hasUserDeckData && deck.dataOwnerUserId ? <CardMediaCentre key={`${deck.dataOwnerUserId}:${card.id}`} context={{ kind: "owner", viewerUserId: deck.dataOwnerUserId, cardTemplateId: card.id }}
          personalTarget={{ scope: "user-card", userId: deck.dataOwnerUserId, cardId: card.id, deckTemplateId: deck.deckTemplateId }}
          legacyItems={visiblePersonalMedia(card)} onPersonalUpload={working.commitFocusedCardMedia} onPersonalRemove={working.removeFocusedCardMedia}
          backgroundRef={context.backgroundRef} sourceRef={mediaSourceRef} onClose={() => setCentre(null)} /> : null}</>;
    }} deck={working.deck} updateAction={updates.deckButton} cardFrontAction={(card) => updates.cardButton(card.id)} error={working.mutationError || updates.discoveryError}
    deckActions={canEnterCreator || onArchive ? <DeckMenu deckId={deck.id} deckTemplateId={deck.deckTemplateId} editHref={creatorEditHref}
      showEdit={!!canEnterCreator} deckTitle={deck.title} onArchive={onArchive} archiveDisabled={!ready || archiveDisabled} /> : undefined}
    onActiveCardChange={(previous, next, rollback) => {
      if (!ready) { const card = working.deck.cards[next]; if (card) setPendingNavigation({ cardId: card.id, rollback }); }
      else working.commitActiveCard(previous, next, rollback);
    }}
    renderCardBackFace={(card, options) => hasPersonalCard(card) ? <BackCardFaceContent canMutate={working.canMutate} onEditMedia={working.canMutate && deck.hasUserDeckData && options.variant !== "preview" ? cardId => { mediaSourceRef.current = document.activeElement as HTMLButtonElement; setCentre({ cardId, activeCardId: cardId, focused: false }); } : undefined} assessment={assessment(card, "back", false)} card={card} deckTemplateId={deck.deckTemplateId} {...options} /> : null}
    renderFocusedCard={(focused) => hasPersonalCard(focused.card) ? <WorkingFocusedCardView {...focused} card={focused.card}
      personalDraftId={focused.card.id === deck.activeCardId ? recoveryInfoCardId : undefined}
      backAssessment={assessment(focused.card, "back")} assessmentOpen={assessmentOpen}
      canMutate={working.canMutate}
      frontAction={updates.cardButton(focused.card.id)}
      onCycleStepStatus={working.canMutate ? (stepId) => working.cycleFocusedStepStatus(focused.card.id, stepId) : undefined}
      onAdjustTargetDate={working.canMutate ? (direction) => working.adjustFocusedCardTargetDate(focused.card.id, direction) : undefined}
      onCommitSignalReading={working.commitFocusedSignalReading}
      onCommitReflection={working.canMutate && deck.hasUserDeckData ? working.commitFocusedReflection : undefined}
      onOpenMediaCentre={working.canMutate && deck.hasUserDeckData ? cardId => { mediaSourceRef.current = document.activeElement as HTMLButtonElement; setCentre({ cardId, activeCardId: cardId, focused: true }); } : undefined}
      mediaCentreOpen={!!centre}
    /> : null} />{updates.modal}</>;
}
