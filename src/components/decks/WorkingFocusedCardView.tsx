"use client";
import { useEffect, useCallback, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { CardLayout } from "@/components/cards/cardLayout";
import FocusedCardView, { type FocusedCardViewProps } from "./FocusedCardView";
import { dateOnlyToUtcDate } from "@/lib/dateOnly";
import BackCardFaceContent from "./BackCardFaceContent";
import UserCardMediaUploadPanel, { type UserCardMediaRemovalState } from "@/components/media/UserCardMediaUploadPanel";
import { useKeyedUserCardMediaUploadController, type CompletedUserCardMediaUpload, type UserCardMediaUploadTarget } from "@/components/media/useKeyedUserCardMediaUploadController";
import { selectAllTrustedUserCardMediaItems, type ModernUserCardMediaItem } from "@/lib/userCardMedia";
import { visiblePersonalMedia, personalMediaKey, type PersonalMediaDisplayItem } from "@/lib/cards/personalHistoryProjection";
import { createUserCardMediaMutationKey } from "@/lib/userCardMediaMutationQueue";
import { personalWork } from "@/lib/cards/personalWork";
type ReflectionEditorState = { cardId: string };
const REFLECTION_DISPLAY_RECOMMENDED_CHARS = 55;
type WorkingFocusedCardViewProps = Omit<FocusedCardViewProps, "card" | "backFace" | "overlays" | "interactionLocked"> & {
  card: CardLayout;
  canMutate: boolean;
  onCommitSignalReading: (cardId: string, signalId: string, reading: number) => void;
  onCommitReflection?: (cardId: string, reflection: string) => Promise<void>;
  onCommitCardMedia?: (target: UserCardMediaUploadTarget, mediaItem: ModernUserCardMediaItem) => Promise<void>;
  onRemoveCardMedia?: (target: UserCardMediaUploadTarget, mediaItemId: string) => Promise<void>;
};
export default function WorkingFocusedCardView({ card, deckTemplateId, canMutate, onCommitSignalReading,
  onCommitReflection, onCommitCardMedia, onRemoveCardMedia, ...navigation }: WorkingFocusedCardViewProps) {
  const [reflectionEditorState, setReflectionEditorState] = useState<ReflectionEditorState | null>(null);
  const [reflectionDraftValue, setReflectionDraftValue] = useState("");
  const [reflectionEditorError, setReflectionEditorError] = useState<string | null>(null);
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [mediaEditorCardId, setMediaEditorCardId] = useState<string | null>(null);
  const [mediaRemovalStatesByKey, setMediaRemovalStatesByKey] = useState<Record<string, UserCardMediaRemovalState>>({});
  const mediaRemovalInFlightKeysRef = useRef(new Set<string>());
  const mediaUploadTarget = useMemo(
    () => ({ scope: "user-card" as const, deckTemplateId, cardId: card.id, userId: card.dataOwnerUserId }),
    [card.id, card.dataOwnerUserId, deckTemplateId],
  );
  const commitCompletedMediaUpload = useCallback(
    async ({ mediaItem, target }: CompletedUserCardMediaUpload) => {
      if (!onCommitCardMedia) {
        throw new Error("Unable to save media for this card.");
      }

      await onCommitCardMedia(target, mediaItem);
    },
    [onCommitCardMedia],
  );
  const uploadFinishes = useRef(new Map<string, (error?: Error, retry?: () => Promise<unknown>) => void>());
  const editorFinish = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!reflectionEditorState || !card.dataOwnerUserId) return;
    editorFinish.current = personalWork.begin({ userId: card.dataOwnerUserId, cardIds: [reflectionEditorState.cardId] }, `editor:${deckTemplateId}:${reflectionEditorState.cardId}`);
    return () => { editorFinish.current?.(); editorFinish.current = null; };
  }, [reflectionEditorState, card.dataOwnerUserId, deckTemplateId]);
  const mediaUploadController = useKeyedUserCardMediaUploadController({
    onUploadCompleted: commitCompletedMediaUpload,
    onUploadStarted: (target, kind) => {
      if (target.userId) uploadFinishes.current.set(`${target.cardId}:${kind}`, personalWork.begin({ userId: target.userId, cardIds: [target.cardId] }, `upload:${target.cardId}:${kind}`));
    },
    onUploadSettled: (target, kind, error, retry) => {
      const key = `${target.cardId}:${kind}`;
      uploadFinishes.current.get(key)?.(error, retry); uploadFinishes.current.delete(key);
    },
  });
  const mediaUploadState = mediaUploadController.getState(mediaUploadTarget);
  // Uploads target current CardData; deletions target the original personal item.
  const { images: cardImages, videos: cardVideos } = selectAllTrustedUserCardMediaItems(visiblePersonalMedia(card));
  const removalStatesById = Object.fromEntries(
    [...cardImages, ...cardVideos].map((item) => [
      personalMediaKey(item),
      mediaRemovalStatesByKey[`${createUserCardMediaMutationKey({ ...mediaUploadTarget, cardId: (item as PersonalMediaDisplayItem).sourceCardTemplateId ?? card.id })}:${encodeURIComponent(item.id)}`],
    ]),
  );
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
  const openMediaEditor = (cardId: string) => {
    if (!onCommitCardMedia || !onRemoveCardMedia) {
      return;
    }

    setMediaEditorCardId(cardId);
  };
  const closeMediaEditor = () => {
    setMediaEditorCardId(null);
  };
  const removeCardMedia = async (item: import("@/lib/media").MediaItem) => {
    if (!onRemoveCardMedia) {
      return;
    }

    const target = { ...mediaUploadTarget, cardId: (item as PersonalMediaDisplayItem).sourceCardTemplateId ?? card.id };
    const key = `${createUserCardMediaMutationKey(target)}:${encodeURIComponent(item.id)}`;

    if (mediaRemovalInFlightKeysRef.current.has(key)) {
      return;
    }

    mediaRemovalInFlightKeysRef.current.add(key);

    setMediaRemovalStatesByKey((currentStates) => ({
      ...currentStates,
      [key]: { error: null, isRemoving: true },
    }));

    try {
      await onRemoveCardMedia(target, item.id);
      setMediaRemovalStatesByKey((currentStates) => {
        const nextStates = { ...currentStates };
        delete nextStates[key];
        return nextStates;
      });
    } catch (error) {
      setMediaRemovalStatesByKey((currentStates) => ({
        ...currentStates,
        [key]: {
          error: error instanceof Error ? error.message : "Unable to remove card media.",
          isRemoving: false,
        },
      }));
    } finally {
      mediaRemovalInFlightKeysRef.current.delete(key);
    }
  };
  const stopMediaEditorGesturePropagation = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
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
    setMediaEditorCardId(null);
  }
  const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(dateOnlyToUtcDate(card.targetDate));
  return <FocusedCardView {...navigation} card={card} deckTemplateId={deckTemplateId}
    interactionLocked={Boolean(reflectionEditorState) || Boolean(mediaEditorCardId)}
    backFace={<BackCardFaceContent
      card={card} deckTemplateId={deckTemplateId} dateLabel={dateLabel} variant="focused" canMutate={canMutate}
      onCommitSignalReading={onCommitSignalReading}
      onEditMedia={onCommitCardMedia && onRemoveCardMedia ? openMediaEditor : undefined}
      onEditReflection={onCommitReflection ? openReflectionEditor : undefined}
      />}
    overlays={<>
      <AnimatePresence>
        {mediaEditorCardId === card.id ? (
          <motion.div
            className="creator-modal-backdrop reflection-editor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            role="presentation"
          >
            <div
              aria-labelledby="card-media-editor-title"
              aria-modal="true"
              className="creator-modal creator-modal--deck-introduction card-media-upload-modal"
              onPointerCancel={stopMediaEditorGesturePropagation}
              onPointerDown={stopMediaEditorGesturePropagation}
              onPointerMove={stopMediaEditorGesturePropagation}
              onPointerUp={stopMediaEditorGesturePropagation}
              role="dialog"
            >
              <header className="creator-modal-header">
                <p id="card-media-editor-title">Card media</p>
                <button className="creator-modal-close" onClick={closeMediaEditor} type="button">
                  Close
                </button>
              </header>
              <UserCardMediaUploadPanel
                images={cardImages}
                videos={cardVideos}
                target={mediaUploadTarget}
                uploadState={mediaUploadState}
                removalStatesById={removalStatesById}
                onAddImage={(file) => void mediaUploadController.uploadImage(mediaUploadTarget, file)}
                onAddVideo={(file) => void mediaUploadController.uploadVideo(mediaUploadTarget, file)}
                onRemoveMedia={(item) => void removeCardMedia(item)}
                getMediaKey={personalMediaKey}
                getVideoTarget={(item) => ({ ...mediaUploadTarget, cardId: (item as PersonalMediaDisplayItem).sourceCardTemplateId ?? card.id })}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
