"use client";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { CardLayout } from "@/components/cards/cardLayout";
import FocusedCardView, { type FocusedCardViewProps } from "./FocusedCardView";
import { dateOnlyToUtcDate } from "@/lib/dateOnly";
import BackCardFaceContent from "./BackCardFaceContent";
import { personalWork } from "@/lib/cards/personalWork";
type ReflectionEditorState = { cardId: string };
const REFLECTION_DISPLAY_RECOMMENDED_CHARS = 55;
type WorkingFocusedCardViewProps = Omit<FocusedCardViewProps, "card" | "backFace" | "overlays" | "interactionLocked"> & {
  card: CardLayout;
  assessmentOpen?: boolean;
  backAssessment?: import("react").ReactNode;
  canMutate: boolean;
  onCommitSignalReading: (cardId: string, signalId: string, reading: number) => void;
  onCommitReflection?: (cardId: string, reflection: string) => Promise<void>;
  onOpenMediaCentre?: (cardId: string) => void; mediaCentreOpen?: boolean;
};
export default function WorkingFocusedCardView({ card, deckTemplateId, canMutate, assessmentOpen = false, backAssessment, onCommitSignalReading,
  onCommitReflection, onOpenMediaCentre, mediaCentreOpen, ...navigation }: WorkingFocusedCardViewProps) {
  const [reflectionEditorState, setReflectionEditorState] = useState<ReflectionEditorState | null>(null);
  const [reflectionDraftValue, setReflectionDraftValue] = useState("");
  const [reflectionEditorError, setReflectionEditorError] = useState<string | null>(null);
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const editorFinish = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!reflectionEditorState || !card.dataOwnerUserId) return;
    editorFinish.current = personalWork.begin({ userId: card.dataOwnerUserId, cardIds: [reflectionEditorState.cardId] }, `editor:${deckTemplateId}:${reflectionEditorState.cardId}`);
    return () => { editorFinish.current?.(); editorFinish.current = null; };
  }, [reflectionEditorState, card.dataOwnerUserId, deckTemplateId]);
  const openReflectionEditor = (cardId: string) => {
    if (!onCommitReflection) {
      return;
    }

    setReflectionEditorState({
      cardId,
    });
    setReflectionDraftValue(card.reflection);
    setReflectionEditorError(null);
  };
  const closeReflectionEditor = () => {
    if (isSavingReflection) {
      return;
    }

    setReflectionEditorState(null);
    setReflectionEditorError(null);
  };
  const stopReflectionEditorGesturePropagation = (event: PointerEvent<HTMLFormElement>) => {
    event.stopPropagation();
  };
  const submitReflectionEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!reflectionEditorState || !onCommitReflection) {
      return;
    }

    setIsSavingReflection(true);
    setReflectionEditorError(null);

    try {
      await onCommitReflection(reflectionEditorState.cardId, reflectionDraftValue);
      setReflectionEditorState(null);
    } catch (error) {
      console.warn("Unable to persist card reflection.", error);
      setReflectionEditorError(error instanceof Error ? error.message : "Unable to save reflection.");
    } finally {
      setIsSavingReflection(false);
    }
  };
  const [editorCardId, setEditorCardId] = useState(card.id);
  if (editorCardId !== card.id) {
    setEditorCardId(card.id);
    setReflectionEditorState(null);
    setReflectionEditorError(null);
  }
  const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(dateOnlyToUtcDate(card.targetDate));
  return <FocusedCardView {...navigation} card={card} deckTemplateId={deckTemplateId}
    interactionLocked={assessmentOpen || Boolean(reflectionEditorState) || Boolean(mediaCentreOpen)}
    backFace={<BackCardFaceContent
      assessment={backAssessment}
      card={card} deckTemplateId={deckTemplateId} dateLabel={dateLabel} variant="focused" canMutate={canMutate}
      onCommitSignalReading={onCommitSignalReading}
      onEditMedia={onOpenMediaCentre}
      onEditReflection={onCommitReflection ? openReflectionEditor : undefined}
      />}
    overlays={<>
      <AnimatePresence>
        {reflectionEditorState ? (
          <motion.div
            className="creator-modal-backdrop reflection-editor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            role="presentation"
          >
            <form
              className="creator-modal creator-modal--reflection-editor reflection-editor-modal"
              onPointerCancel={stopReflectionEditorGesturePropagation}
              onPointerDown={stopReflectionEditorGesturePropagation}
              onPointerMove={stopReflectionEditorGesturePropagation}
              onPointerUp={stopReflectionEditorGesturePropagation}
              onSubmit={submitReflectionEditor}
            >
              <header className="creator-modal-header">
                <p>Edit reflection</p>
                <button className="creator-modal-close" disabled={isSavingReflection} onClick={closeReflectionEditor} type="button">
                  Close
                </button>
              </header>
              <p className="creator-modal-note">Aim for about 9 words. Longer reflections may be truncated on the card.</p>
              <textarea
                autoFocus
                className="creator-modal-field creator-modal-field--reflection"
                onChange={(event) => setReflectionDraftValue(event.target.value)}
                value={reflectionDraftValue}
              />
              <p
                className={`creator-modal-counter${
                  reflectionDraftValue.length > REFLECTION_DISPLAY_RECOMMENDED_CHARS ? " creator-modal-counter--warning" : ""
                }`}
              >
                {reflectionDraftValue.length}/{REFLECTION_DISPLAY_RECOMMENDED_CHARS} recommended characters
              </p>
              {reflectionEditorError ? <p className="creator-modal-error">{reflectionEditorError}</p> : null}
              <div className="creator-modal-actions">
                <button className="creator-modal-secondary" disabled={isSavingReflection} onClick={closeReflectionEditor} type="button">
                  Cancel
                </button>
                <button className="creator-modal-primary" disabled={isSavingReflection} type="submit">
                  {isSavingReflection ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>} />;
}
