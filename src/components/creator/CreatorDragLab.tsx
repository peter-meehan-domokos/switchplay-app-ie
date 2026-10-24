"use client";

import {
  DndContext,
  DragOverlay,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { creatorBoard, privateGraph, layoutCreatorColumns, type CreatorBoardDTO } from "./cardArchitectureAdapter";
import { CreatorPersistenceCoordinator, type PublicPublicationReview } from "./creatorPersistenceCoordinator";
import CreatorCopyConfirmation from "./CreatorCopyConfirmation";
import { actorCreatorTransport, CreatorActorLifetime } from "./creatorRequest";
import type { CreatorSessionDTO } from "@/lib/cards/creatorSession";
import CreatorDraftsModal from "./CreatorDraftsModal";
import CreatorCopyTo from "./CreatorCopyTo";
import CreatorLeaveConfirmation from "./CreatorLeaveConfirmation";
import CreatorModeSelector from "./CreatorModeSelector";
import InfoCardAttachments from "./InfoCardAttachments";
import type { CreatorTransport } from "./creatorRequest";
import { currentDraftOrigin, deckCollectionTarget, type CreatorNavigation } from "./creatorNavigation";
import { clientId } from "@/lib/clientId";
import { loadCreatorDraftEntries, creatorDraftHref, type CreatorDraftEntry } from "./creatorDraftEntries";
import CreatorPublishControl from "./CreatorPublishControl";
import CreatorVisibilityControl from "./CreatorVisibilityControl";
import CreatorPublicConfirmation from "./CreatorPublicConfirmation";
import { cardPublicationPresentation, deckPublicationPresentation, requiresPublicInfoAttachments, creatorPublicationErrorMessage } from "./creatorPublicationPresentation";
import { creatorRequest } from "./creatorRequest";
import type { CreatorDTO } from "@/lib/cards/readModels";
import { sameContent } from "@/lib/cards/publicationRules";
import { restoreCreatorDeckTitle } from "@/lib/cards/creatorDefaults";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent } from "react";
import {
  appendCreatorCard,
  deleteCreatorCard,
  getCardColumns,
  getCreatorCellId,
  getStepDisplayText,
  getStepMediaDisplayText,
  isStepEmpty,
  isStepMediaEmpty,
  resolveCreatorCardTitle,
  resolveCreatorStreamName,
  setBoardDeckIntroductionVideo,
  setBoardDeckIntroductionImage,
  type BoardState,
  type CellId,
  type CellState,
  type Pair,
  type PairId,
} from "@/components/creator/creatorBoardState";
import CreatorMediaUploadSlot from "@/components/creator/CreatorMediaUploadSlot";
import MediaUploadPanel from "@/components/media/MediaUploadPanel";
import { useMediaUploadController, type CompletedMediaUpload } from "@/components/media/useMediaUploadController";
import SupportErrorMessage from "@/components/support/SupportErrorMessage";
import { CREATOR_GEOMETRY, getCreatorGeometryStyle } from "@/components/creator/creatorDragLabGeometry";
import type { StepDescriptionSpan } from "@/components/decks/types";
import type { ImageMediaItem, VideoMediaItem } from "@/lib/media";
import { isAbortError, uploadVideoMedia, prospectiveAttachmentProof, type MediaUploadTarget } from "@/lib/mediaUploadClient";

type EditTarget =
  | { type: "deck-title" }
  | { type: "stream-name"; row: number }
  | { type: "card-title"; cardTemplateId: string }
  | { type: "pair-step"; pairId: PairId };

type EditSession = {
  infoCardIds?: string[];
  descriptionContent?: StepDescriptionSpan[];
  helperText?: string;
  inputKind: "long-text" | "short-text";
  label: string;
  stepTitle?: string;
  target: EditTarget;
  value: string;
};

type StepLinkRange = {
  id: string;
  start: number;
  end: number;
  text: string;
  url: string;
};

type PendingStepLink =
  | { mode: "selection"; start: number; end: number; text: string; url: string }
  | { mode: "insert"; start: number; text: string; url: string };

type DateEditTarget = { type: "target-date"; cardTemplateId: string };

type DateEditSession = {
  label: string;
  target: DateEditTarget;
  value: string;
};

type PublishStatus = "idle" | "publishing" | "success" | "error";

type UploadSession = {
  controller: AbortController;
  token: symbol;
  cardTemplateId?: string;
};

const creatorGeometryStyle = getCreatorGeometryStyle();
const STEP_TEXT_WARNING_LENGTH = 65;
const SUPPORT_ERROR_MESSAGE = "support";

function createStepLinkId() {
  return `step-link-${clientId()}`;
}

function isIsoDateOnlyString(value: string) {
  const normalizedDateString = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateString)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = normalizedDateString.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const candidateDate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidateDate.getUTCFullYear() === year &&
    candidateDate.getUTCMonth() === month - 1 &&
    candidateDate.getUTCDate() === day
  );
}

function formatCreatorDateDisplay(value: string) {
  if (!isIsoDateOnlyString(value)) {
    return value.trim() || "Set date";
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function normalizeCreatorHttpUrl(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function getPlainTextFromDescriptionContent(content: StepDescriptionSpan[]) {
  return content.map((span) => span.text).join("");
}

function getLinkRangesFromDescriptionContent(content: StepDescriptionSpan[] | undefined, fallbackText: string): StepLinkRange[] {
  if (!content) {
    return [];
  }

  const contentText = getPlainTextFromDescriptionContent(content);

  if (contentText !== fallbackText) {
    return [];
  }

  let cursor = 0;

  return content.flatMap((span) => {
    const start = cursor;
    cursor += span.text.length;

    if (span.type !== "link") {
      return [];
    }

    return [{
      id: createStepLinkId(),
      start,
      end: cursor,
      text: span.text,
      url: span.url,
    }];
  }).filter((range) => fallbackText.slice(range.start, range.end) === range.text);
}

function buildStepDescriptionContent(text: string, ranges: StepLinkRange[]) {
  const validRanges = ranges
    .map((range) => ({
      ...range,
      start: Math.max(0, Math.min(text.length, range.start)),
      end: Math.max(0, Math.min(text.length, range.end)),
      url: normalizeCreatorHttpUrl(range.url) ?? "",
    }))
    .filter((range) => range.start < range.end && range.text.trim() !== "" && range.url !== "" && text.slice(range.start, range.end) === range.text)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .reduce<StepLinkRange[]>((nextRanges, range) => {
      const previousRange = nextRanges.at(-1);

      if (previousRange && range.start < previousRange.end) {
        return nextRanges;
      }

      nextRanges.push(range);
      return nextRanges;
    }, []);

  if (validRanges.length === 0) {
    return undefined;
  }

  const content: StepDescriptionSpan[] = [];
  let cursor = 0;

  for (const range of validRanges) {
    if (range.start > cursor) {
      content.push({ type: "text", text: text.slice(cursor, range.start) });
    }

    content.push({ type: "link", text: range.text, url: range.url });
    cursor = range.end;
  }

  if (cursor < text.length) {
    content.push({ type: "text", text: text.slice(cursor) });
  }

  return content;
}

function adjustStepLinkRangesForTextChange(previousText: string, nextText: string, ranges: StepLinkRange[]) {
  if (previousText === nextText || ranges.length === 0) {
    return ranges;
  }

  let prefixLength = 0;

  while (
    prefixLength < previousText.length &&
    prefixLength < nextText.length &&
    previousText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let previousSuffixStart = previousText.length;
  let nextSuffixStart = nextText.length;

  while (
    previousSuffixStart > prefixLength &&
    nextSuffixStart > prefixLength &&
    previousText[previousSuffixStart - 1] === nextText[nextSuffixStart - 1]
  ) {
    previousSuffixStart -= 1;
    nextSuffixStart -= 1;
  }

  const delta = (nextSuffixStart - prefixLength) - (previousSuffixStart - prefixLength);

  return ranges.map((range) => {
    if (previousSuffixStart <= range.start) {
      return {
        ...range,
        start: range.start + delta,
        end: range.end + delta,
      };
    }

    return range;
  });
}

function findPairCell(cells: BoardState["cells"], pairId: PairId) {
  return Object.entries(cells).find(([, cell]) => cell.pairId === pairId)?.[0] as CellId | undefined;
}

function getEditSession(board: BoardState, target: EditTarget): EditSession | null {
  if (target.type === "deck-title") {
    return { inputKind: "long-text", label: "Deck title", target, value: board.deckTitle };
  }

  if (target.type === "stream-name") {
    return {
      helperText: "Short label. One word works best.",
      inputKind: "short-text",
      label: "Theme name",
      target,
      value: board.streamNamesByRow[target.row] ?? "",
    };
  }

  if (target.type === "card-title") {
    const column = board.columns.find((candidate) => candidate.cardId === target.cardTemplateId);

    if (!column) {
      return null;
    }

    return {
      helperText: "Short card title. Aim for 1-4 words.",
      inputKind: "short-text",
      label: "Card title",
      infoCardIds: column.infoCardIds,
      target,
      value: column.cardTitle ?? "",
    };
  }

  const pair = board.pairs[target.pairId];

  if (!pair) {
    return null;
  }

  if (target.type === "pair-step") {
    return {
      descriptionContent: pair.stepDescriptionContent,
      helperText: "Aim for 1-2 short lines on the card.",
      inputKind: "long-text",
      label: "Step text",
      stepTitle: pair.stepTitle ?? "",
      target,
      value: pair.stepText ?? "",
    };
  }

  return null;
}

function getDateEditSession(board: BoardState, target: DateEditTarget): DateEditSession | null {
  const column = board.columns.find((candidate) => candidate.cardId === target.cardTemplateId);

  if (!column) {
    return null;
  }

  return { label: "Suggested target date", target, value: column.targetDate ?? "" };
}

function getEditTargetKey(target: EditTarget) {
  if (target.type === "deck-title") {
    return target.type;
  }

  if (target.type === "stream-name") {
    return `${target.type}:${target.row}`;
  }

  if (target.type === "pair-step") {
    return `${target.type}:${target.pairId}`;
  }

  return `${target.type}:${target.cardTemplateId}`;
}

function CreatorEditModal({
  actor,
  request,
  publicInfoOnly,
  canDeleteCard = false,
  videoReadinessTarget,
  deckIntroductionImage,
  deckIntroductionImageMessage,
  deckIntroductionVideo,
  deckIntroductionVideoMessage,
  isDeckIntroImageUploading = false,
  isDeckIntroVideoUploading = false,
  deckIntroductionVideoUploadStage = "idle",
  onClose,
  onDeleteCard,
  onRemoveDeckIntroductionImage,
  onSave,
  copyControl,
  onUploadDeckIntroductionVideo,
  onUploadDeckIntroductionImage,
  session,
}: {
  actor?: string;
  request: CreatorTransport;
  publicInfoOnly: boolean;
  canDeleteCard?: boolean;
  videoReadinessTarget: MediaUploadTarget;
  deckIntroductionImage: ImageMediaItem | null;
  deckIntroductionImageMessage?: string | null;
  deckIntroductionVideo: VideoMediaItem | null;
  deckIntroductionVideoMessage?: string | null;
  isDeckIntroImageUploading?: boolean;
  isDeckIntroVideoUploading?: boolean;
  deckIntroductionVideoUploadStage?: "idle" | "saving" | "uploading";
  onClose: () => void;
  onDeleteCard?: () => void;
  onRemoveDeckIntroductionImage: () => void;
  onSave: (value: string, title?: string, descriptionContent?: StepDescriptionSpan[], infoCardIds?: string[]) => void;
  copyControl?: React.ReactNode;
  onUploadDeckIntroductionVideo: (file: File) => void;
  onUploadDeckIntroductionImage: (file: File) => void;
  session: EditSession;
}) {
  const [draftValue, setDraftValue] = useState(session.value);
  const [draftInfoIds, setDraftInfoIds] = useState(session.infoCardIds);
  const [draftTitle, setDraftTitle] = useState(session.stepTitle ?? "");
  const [linkRanges, setLinkRanges] = useState<StepLinkRange[]>(() =>
    getLinkRangesFromDescriptionContent(session.descriptionContent, session.value)
  );
  const [pendingLink, setPendingLink] = useState<PendingStepLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isLongText = session.inputKind === "long-text";
  const isDeckIntroduction = session.target.type === "deck-title";
  const isCardTitle = session.target.type === "card-title";
  const isStepText = session.target.type === "pair-step";
  const modalClassName = `creator-modal creator-modal--${isDeckIntroduction ? "deck-introduction" : session.target.type}`;
  const fieldClassName = [
    "creator-modal-field",
    session.target.type === "pair-step" ? "creator-modal-field--step" : undefined,
    session.target.type === "card-title" ? "creator-modal-field--card-title" : undefined,
    session.target.type === "deck-title" ? "creator-modal-field--deck-title" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const showStepCounter = session.target.type === "pair-step";
  const combinedLength = draftTitle.length + draftValue.length;
  const isStepWarningVisible = showStepCounter && combinedLength > STEP_TEXT_WARNING_LENGTH;
  function handleDraftValueChange(value: string) {
    setLinkRanges((currentRanges) => adjustStepLinkRangesForTextChange(draftValue, value, currentRanges));
    setDraftValue(value);
    setLinkError(null);
  }

  function startAddLink() {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? draftValue.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const selectedText = draftValue.slice(selectionStart, selectionEnd);

    setLinkError(null);

    if (selectedText.trim() !== "") {
      setPendingLink({
        mode: "selection",
        start: selectionStart,
        end: selectionEnd,
        text: selectedText,
        url: "",
      });
      return;
    }

    setPendingLink({
      mode: "insert",
      start: selectionStart,
      text: "",
      url: "",
    });
  }

  function updatePendingLink(field: "text" | "url", value: string) {
    setPendingLink((currentLink) => (currentLink ? { ...currentLink, [field]: value } : currentLink));
    setLinkError(null);
  }

  function commitPendingLink() {
    if (!pendingLink) {
      return;
    }

    const url = normalizeCreatorHttpUrl(pendingLink.url);

    if (!url) {
      setLinkError("Links must use http:// or https:// URLs.");
      return;
    }

    if (pendingLink.mode === "selection") {
      const linkedText = draftValue.slice(pendingLink.start, pendingLink.end);

      if (linkedText !== pendingLink.text) {
        setLinkError("Selected text changed. Select the text and add the link again.");
        return;
      }

      setLinkRanges((currentRanges) => [
        ...currentRanges.filter((range) => range.end <= pendingLink.start || range.start >= pendingLink.end),
        {
          id: createStepLinkId(),
          start: pendingLink.start,
          end: pendingLink.end,
          text: pendingLink.text,
          url,
        },
      ]);
      setPendingLink(null);
      return;
    }

    const linkText = pendingLink.text.trim();

    if (linkText === "") {
      setLinkError("Enter link text.");
      return;
    }

    const insertAt = Math.max(0, Math.min(draftValue.length, pendingLink.start));
    const nextValue = `${draftValue.slice(0, insertAt)}${linkText}${draftValue.slice(insertAt)}`;
    const insertedRange = {
      id: createStepLinkId(),
      start: insertAt,
      end: insertAt + linkText.length,
      text: linkText,
      url,
    };

    setDraftValue(nextValue);
    setLinkRanges((currentRanges) => [
      ...currentRanges
        .filter((range) => range.end <= insertAt || range.start >= insertAt)
        .map((range) => range.start >= insertAt ? { ...range, start: range.start + linkText.length, end: range.end + linkText.length } : range),
      insertedRange,
    ]);
    setPendingLink(null);
  }

  function removeLinkRange(linkId: string) {
    setLinkRanges((currentRanges) => currentRanges.filter((range) => range.id !== linkId));
    setLinkError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(
      draftValue,
      isStepText ? draftTitle : undefined,
      isStepText ? buildStepDescriptionContent(draftValue, linkRanges) : undefined,
      isCardTitle ? draftInfoIds : undefined
    );
  }

  const primaryField = isLongText ? (
    <textarea
      autoFocus
      className={fieldClassName}
      onChange={(event) => handleDraftValueChange(event.target.value)}
      ref={textareaRef}
      value={draftValue}
    />
  ) : (
    <input
      autoFocus
      className="creator-modal-text-input"
      onChange={(event) => handleDraftValueChange(event.target.value)}
      type="text"
      value={draftValue}
    />
  );

  return (
    <div className="creator-modal-backdrop" role="presentation">
      <form className={modalClassName} onSubmit={handleSubmit}>
        <header className="creator-modal-header">
          <p>{isDeckIntroduction ? "Deck introduction" : session.label}</p>
          <button className="creator-modal-close" onClick={onClose} type="button">
            Close
          </button>
        </header>
        {session.helperText ? <p className="creator-modal-note">{session.helperText}</p> : null}
        {isStepText ? (
          <label className="creator-step-title-group">
            <span className="creator-step-title-label">Title (optional)</span>
            <input
              className="creator-modal-text-input creator-step-title-input"
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="e.g. Listen closely"
              type="text"
              value={draftTitle}
            />
          </label>
        ) : null}
        {isDeckIntroduction ? (
          <section className="creator-deck-introduction-section">
            <h2>Deck title</h2>
            {primaryField}
          </section>
        ) : primaryField}
        {isCardTitle && actor && <InfoCardAttachments actor={actor} request={request} value={draftInfoIds ?? []} onChange={setDraftInfoIds} publicOnly={publicInfoOnly} />}
        {isDeckIntroduction ? (
          <MediaUploadPanel
            image={deckIntroductionImage}
            imageError={deckIntroductionImageMessage}
            isImageUploading={isDeckIntroImageUploading}
            isVideoUploading={isDeckIntroVideoUploading}
            onRemoveImage={onRemoveDeckIntroductionImage}
            onUploadImage={onUploadDeckIntroductionImage}
            onUploadVideo={onUploadDeckIntroductionVideo}
            video={deckIntroductionVideo}
            videoError={deckIntroductionVideoMessage}
            videoReadinessTarget={videoReadinessTarget}
            videoUploadStage={deckIntroductionVideoUploadStage}
          />
        ) : null}
        {showStepCounter ? (
          <p className={`creator-modal-counter${isStepWarningVisible ? " creator-modal-counter--warning" : ""}`}>
            {isStepWarningVisible ? `${combinedLength} characters - this may truncate on the card.` : `${combinedLength} characters`}
          </p>
        ) : null}
        {isStepText ? (
          <section className="creator-step-inline-links" aria-label="Inline step links">
            <div className="creator-step-inline-links-header">
              <p>Inline links</p>
              <button className="creator-step-inline-link-add" onClick={startAddLink} type="button">
                Add link
              </button>
            </div>
            {pendingLink ? (
              <div className="creator-step-inline-link-editor">
                {pendingLink.mode === "insert" ? (
                  <label>
                    <span>Link text</span>
                    <input
                      className="creator-modal-text-input"
                      onChange={(event) => updatePendingLink("text", event.target.value)}
                      type="text"
                      value={pendingLink.text}
                    />
                  </label>
                ) : (
                  <p className="creator-step-inline-link-selection">Linking: {pendingLink.text}</p>
                )}
                <label>
                  <span>URL</span>
                  <input
                    className="creator-modal-text-input"
                    inputMode="url"
                    onChange={(event) => updatePendingLink("url", event.target.value)}
                    placeholder="https://example.com"
                    type="url"
                    value={pendingLink.url}
                  />
                </label>
                <div className="creator-step-inline-link-actions">
                  <button className="creator-modal-secondary" onClick={() => setPendingLink(null)} type="button">
                    Cancel
                  </button>
                  <button className="creator-modal-primary" onClick={commitPendingLink} type="button">
                    Apply link
                  </button>
                </div>
              </div>
            ) : null}
            {linkRanges.length > 0 ? (
              <div className="creator-step-inline-link-list" aria-label="Current inline links">
                {linkRanges.map((range) => (
                  <span className="creator-step-inline-link-pill" key={range.id}>
                    {range.text}
                    <button aria-label={`Remove link from ${range.text}`} onClick={() => removeLinkRange(range.id)} type="button">
                      Remove
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {linkError ? <p className="creator-modal-error">{linkError}</p> : null}
          </section>
        ) : null}
        <div className="creator-modal-actions">
          <button className="creator-modal-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="creator-modal-primary" type="submit">
            Save
          </button>
        </div>
        {copyControl}
        {isCardTitle && onDeleteCard ? (
          <div className="creator-modal-delete-section">
            {isDeleteConfirming ? (
              <>
                <p className="creator-modal-delete-heading">Delete this card?</p>
                <p className="creator-modal-delete-note">This will remove this card and pairs inside it.</p>
                <div className="creator-modal-delete-actions">
                  <button className="creator-modal-secondary" onClick={() => setIsDeleteConfirming(false)} type="button">
                    Keep Card
                  </button>
                  <button className="creator-modal-danger" onClick={onDeleteCard} type="button">
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <button className="creator-modal-delete-trigger" disabled={!canDeleteCard} onClick={() => setIsDeleteConfirming(true)} type="button">
                Delete Card
              </button>
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function CreatorDateEditModal({ session, onClose, onSave }: { session: DateEditSession; onClose: () => void; onSave: (value: string) => void }) {
  const [draftValue, setDraftValue] = useState(() => (isIsoDateOnlyString(session.value) ? session.value : ""));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasInvalidStoredValue = Boolean(session.value.trim()) && !isIsoDateOnlyString(session.value);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isIsoDateOnlyString(draftValue)) {
      setErrorMessage("Choose a valid date.");
      return;
    }

    onSave(draftValue);
  }

  return (
    <div className="creator-modal-backdrop" role="presentation">
      <form className="creator-modal" onSubmit={handleSubmit}>
        <header className="creator-modal-header">
          <p>{session.label}</p>
          <button className="creator-modal-close" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <input
          autoFocus
          className="creator-date-field"
          onChange={(event) => {
            setDraftValue(event.target.value);
            setErrorMessage(null);
          }}
          required
          type="date"
          value={draftValue}
        />
        {hasInvalidStoredValue ? <p className="creator-modal-note">Current value: {session.value}</p> : null}
        {errorMessage ? <p className="creator-modal-error">{errorMessage}</p> : null}
        <div className="creator-modal-actions">
          <button className="creator-modal-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="creator-modal-primary" type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function PairBlock({
  isMediaUploading = false,
  isMediaUploadBlocked = false,
  pair,
  isDragging = false,
  onCancelMediaUpload,
  onEdit,
  onUploadMedia,
}: {
  isMediaUploading?: boolean;
  isMediaUploadBlocked?: boolean;
  pair: Pair;
  isDragging?: boolean;
  onCancelMediaUpload: (pairId: PairId) => void;
  onEdit: (target: EditTarget) => void;
  onUploadMedia: (pairId: PairId, file: File) => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: pair.id,
    data: { type: "pair" },
    disabled: isStepEmpty(pair),
  });
  const isEmptyPair = isStepEmpty(pair);
  const stepClassName = `creator-editable creator-pair-step${isStepEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;
  const mediaClassName = `creator-pair-media${isStepMediaEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;
  const handleClassName = `creator-drag-handle${isEmptyPair ? " creator-drag-handle--disabled" : ""}`;

  return (
    <div className={`creator-pair${isDragging ? " creator-pair--dragging" : ""}`} ref={setNodeRef}>
      <button className={stepClassName} onClick={() => onEdit({ type: "pair-step", pairId: pair.id })} type="button">
        {pair.stepTitle ? (
          <>
            <span className="creator-step-title-inline">{pair.stepTitle}</span>
            {pair.stepText && pair.stepText.trim() !== "" ? pair.stepText : null}
          </>
        ) : (
          getStepDisplayText(pair)
        )}
      </button>
      <div className="creator-pair-handle-row">
        {/* Touch reorder is intentionally handle-only and requires dnd-kit long-press activation. */}
        <button
          className={handleClassName}
          type="button"
          aria-label={isEmptyPair ? "Empty pair slot" : "Long press to reorder pair"}
          data-creator-drag-handle
          disabled={isEmptyPair}
          {...(isEmptyPair ? {} : listeners)}
          {...(isEmptyPair ? {} : attributes)}
        >
          <DragHandleMark />
        </button>
      </div>
      <CreatorMediaUploadSlot
        ariaLabel="Upload step video"
        disabled={isMediaUploadBlocked}
        className={mediaClassName}
        isUploading={isMediaUploading}
        mediaItem={pair.stepMediaItem}
        onCancelUpload={() => onCancelMediaUpload(pair.id)}
        onUpload={(file) => onUploadMedia(pair.id, file)}
        placeholder="Upload video"
        size="pair"
      />
    </div>
  );
}

function DragHandleMark({ rows = 2, variant }: { rows?: 2 | 3; variant?: "stream" }) {
  const dotCount = rows * 2;

  return (
    <span className={`creator-drag-handle-mark${variant === "stream" ? " creator-stream-drag-handle-mark" : ""}`} aria-hidden="true">
      {Array.from({ length: dotCount }, (_, dotIndex) => (
        <span className="creator-drag-handle-dot" key={dotIndex} />
      ))}
    </span>
  );
}

function PairPreview({ pair }: { pair: Pair }) {
  const stepClassName = `creator-pair-step${isStepEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;
  const mediaClassName = `creator-pair-media${isStepMediaEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;

  return (
    <div className="creator-pair creator-pair--preview">
      <div className={stepClassName}>
        {pair.stepTitle ? (
          <>
            <span className="creator-step-title-inline">{pair.stepTitle}</span>
            {pair.stepText && pair.stepText.trim() !== "" ? pair.stepText : null}
          </>
        ) : (
          getStepDisplayText(pair)
        )}
      </div>
      <div className="creator-pair-handle-row">
        <span className="creator-drag-handle creator-drag-handle--preview" aria-hidden="true">
          <DragHandleMark />
        </span>
      </div>
      <div className={mediaClassName}>{getStepMediaDisplayText(pair)}</div>
    </div>
  );
}

function StreamRow({ streamName, onEdit, row }: { streamName?: string; onEdit: (target: EditTarget) => void; row: number }) {
  return <div className="creator-stream-row"><button className="creator-editable creator-stream-name" onClick={() => onEdit({ type: "stream-name", row })} type="button">{streamName}</button></div>;
}

function AddCardControl({ onAddCard }: { onAddCard: () => void }) {
  return (
    <div className="creator-add-card-column" aria-label="Add card">
      <button className="creator-add-card-button" onClick={onAddCard} type="button" aria-label="Add card">
        +
      </button>
    </div>
  );
}

function BoardCell({
  activePairId,
  isMediaUploadBlocked = false,
  cell,
  cellId,
  streamName,
  onEdit,
  onCancelMediaUpload,
  onUploadMedia,
  pair,
  row,
  uploadingMediaPairIds,
}: {
  activePairId: PairId | null;
  isMediaUploadBlocked?: boolean;
  cell: CellState;
  cellId: CellId;
  streamName?: string;
  onCancelMediaUpload: (pairId: PairId) => void;
  onEdit: (target: EditTarget) => void;
  onUploadMedia: (pairId: PairId, file: File) => void;
  pair?: Pair;
  row: number;
  uploadingMediaPairIds: ReadonlySet<PairId>;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: cellId,
    disabled: cell.kind === "locked",
    data: { type: "cell", accepts: "pair" },
  });
  const isOccupied = Boolean(cell.pairId);
  const isLocked = cell.kind === "locked";
  const canDropActivePair = Boolean(isOver && activePairId && pair && pair.id !== activePairId && isStepEmpty(pair));
  const isEmptyPanSurface = cell.kind === "empty" && !cell.pairId;

  return (
    <div
      className={`creator-cell${isOccupied ? " creator-cell--occupied" : ""}${isLocked ? " creator-cell--locked" : ""}${canDropActivePair ? " creator-cell--can-drop" : ""}`}
      data-creator-pan-surface={isEmptyPanSurface ? true : undefined}
      ref={setNodeRef}
    >
      {/* Themes remain editable Deck metadata and are not drag targets. */}
      {pair ? (
        <PairBlock
          pair={pair}
          isDragging={pair.id === activePairId}
          isMediaUploading={uploadingMediaPairIds.has(pair.id)}
          isMediaUploadBlocked={isMediaUploadBlocked}
          onCancelMediaUpload={onCancelMediaUpload}
          onEdit={onEdit}
          onUploadMedia={onUploadMedia}
        />
      ) : isLocked ? (
        <StreamRow streamName={streamName} onEdit={onEdit} row={row} />
      ) : (
        <span className="creator-empty">empty</span>
      )}
    </div>
  );
}

type CreatorDragLabProps = {
  canPreviewOutput: boolean;
  creatorReturnTarget?: {
    label: "Library" | "My Decks";
    href: string;
  };
  initialBoard: BoardState;
  initialPublishedBoard?: BoardState;
  initialCreator?: CreatorDTO;
  initialSession?: CreatorSessionDTO;
  currentUserId?: string;
  mode: "edit" | "new";
  navigation?: CreatorNavigation;
};

export default function CreatorDragLab({ canPreviewOutput, creatorReturnTarget, initialBoard, initialCreator, initialSession, currentUserId, mode, navigation }: CreatorDragLabProps) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardState>(() => initialBoard);
  const [canonical, setCanonical] = useState<CreatorBoardDTO | null>(initialCreator ?? null);
  const [, setPersistenceVersion] = useState(0);
  const [deckWarning, setDeckWarning] = useState<{ ids: string[]; newer: import("@/lib/cards/model").DeckPublicationReview["cards"]; resolve: (accepted: boolean) => void } | null>(null);
  const [publicConfirmation, setPublicConfirmation] = useState<{ review: PublicPublicationReview; resolve: (accepted: boolean) => void } | null>(null);
  const publicTriggerRef = useRef<HTMLElement | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteSession, setNoteSession] = useState<{ key: string; label: string; value: string } | null>(null);
  const [actorLifetime] = useState(() => new CreatorActorLifetime());
  const [persistence] = useState(() => new CreatorPersistenceCoordinator(initialBoard, initialCreator ?? null,
    currentUserId ? actorCreatorTransport(currentUserId, (url, method, body) => actorLifetime.isActive(url, method, body), (id) => actorLifetime.allowDetachedCard(id)) : creatorRequest, initialSession));
  const [copyConfirmation, setCopyConfirmation] = useState<{ entity: "Card" | "Deck"; resolve: (accepted: boolean) => void } | null>(null);
  const confirmedCards = useRef(new Set<string>());
  const [entryConfirmed, setEntryConfirmed] = useState(initialSession?.deck.kind !== "foreign");
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [drafts, setDrafts] = useState<CreatorDraftEntry[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsError, setDraftsError] = useState("");
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const switchingRef = useRef<string | null>(null);
  const draftsButtonRef = useRef<HTMLButtonElement>(null);
  const [activePairId, setActivePairId] = useState<PairId | null>(null);
  const [editSession, setEditSession] = useState<EditSession | null>(null);
  const [dateEditSession, setDateEditSession] = useState<DateEditSession | null>(null);
  const [publishMessage, setPublishMessage] = useState("");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [navigationPending, setNavigationPending] = useState(false);
  const navigationRef = useRef(false);
  const [leaveConfirmationOpen, setLeaveConfirmationOpen] = useState(false);
  const returnLinkRef = useRef<HTMLAnchorElement>(null);
  const [blockedPublication, setBlockedPublication] = useState<string | null>(null);
  const blockedTriggerRef = useRef<HTMLElement | null>(null);
  const [uploadingMediaPairIds, setUploadingMediaPairIds] = useState<ReadonlySet<PairId>>(() => new Set());
  const [uploadingIntroMediaCardIds, setUploadingIntroMediaCardIds] = useState<ReadonlySet<string>>(() => new Set());
  const boardRef = useRef<BoardState>(initialBoard);
  const pairUploadSessionsRef = useRef<Map<PairId, UploadSession>>(new Map());
  const introUploadSessionsRef = useRef<Map<string, UploadSession>>(new Map());
  const uploadFailuresRef = useRef<Map<string, string | null>>(new Map());
  const scrollShellRef = useRef<HTMLElement | null>(null);
  const suppressClickUntilRef = useRef(0);
  const panStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    isPanning: boolean;
    hasPointerCapture: boolean;
  } | null>(null);
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    }),
  );

  const activeOriginCellId = useMemo(() => {
    return activePairId ? findPairCell(board.cells, activePairId) ?? null : null;
  }, [activePairId, board.cells]);
  const activePair = activePairId ? board.pairs[activePairId] ?? null : null;
  const canDeleteActiveCard = editSession?.target.type === "card-title";
  const editingCardId = editSession?.target.type === "card-title" ? editSession.target.cardTemplateId : null;
  function collectionDestination() {
    return deckCollectionTarget({ creating: navigation?.creating ?? mode === "new", visibility: !persistence.deck.ack && initialSession?.deck.kind === "foreign" ? "public" : persistence.deck.desiredVisibility,
      origin: creatorReturnTarget ? creatorReturnTarget.href === "/library" ? "library" : "my-decks" : undefined,
      copied: !!persistence.deck.ack?.root.forkedFrom, id: persistence.deckTemplateId,
      publicationVersion: persistence.deck.confirmedPublicationVersion,
      reveal: !!persistence.deck.ack?.root.latestVersion || initialSession?.deck.kind === "foreign" && !persistence.deck.ack });
  }
  const resolvedCreatorReturnTarget = collectionDestination();
  const deckIntroductionUploadTarget = useMemo(() => ({
    scope: "deck-introduction" as const,
    deckTemplateId: persistence.deckTemplateId,
    creatorActor: currentUserId,
  }), [persistence.deckTemplateId, currentUserId]);
  const deckIntroductionUpload = useMediaUploadController({
    target: deckIntroductionUploadTarget,
    prepareTarget: (kind) => persistence.prepareUploadTarget(undefined, kind),
    onUploadStarted: handleDeckIntroductionUploadStarted,
    onUploadCompleted: handleDeckIntroductionUploadCompleted,
    onUploadFailed: (kind) => { uploadFailuresRef.current.set(`deck:${kind}`, null); },
  });
  const renderingColumns = useMemo(() => layoutCreatorColumns(board), [board]);
  const deckPresentation = deckPublicationPresentation(persistence.deck, persistence.publicationReferences());
  const anyPublishing = publishStatus === "publishing" || persistence.deck.publishing || [...persistence.cards.values()].some((lane) => lane.publishing);
  const navigationLocked = isDraftsOpen || navigationPending || leaveConfirmationOpen || blockedPublication !== null || publicConfirmation !== null || copyConfirmation !== null || !entryConfirmed || persistence.recovering;

  useEffect(() => {
    actorLifetime.setActive(true);
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        persistence.configureRecovery(window.sessionStorage, window.location.search);
        if (persistence.recoverSubmitted()) { setEntryConfirmed(true); const recovered = creatorBoard(persistence.presentation); boardRef.current = recovered; setBoard(recovered); }
      } catch { setPublishStatus("error"); setPublishMessage("Submitted work could not be recovered safely. Reload or review the existing copy before editing."); }
    });
    return () => { active = false; actorLifetime.setActive(false); };
  }, [persistence, actorLifetime]);

  useEffect(() => {
    let recovering = false;
    return persistence.subscribe(() => {
    setPersistenceVersion((version) => version + 1);
    if (recovering && !persistence.recovering) { const recovered = creatorBoard(persistence.presentation); boardRef.current = recovered; setBoard(recovered); }
    recovering = persistence.recovering;
    if (!persistence.deck.uncertainPublication && ![...persistence.cards.values()].some((lane) => lane.uncertainPublication)) setPublishMessage((current) => current.startsWith("Publication outcome is not yet confirmed.") ? "" : current);
    const dto = persistence.dto;
    // Autosave may install the edit URL, but must retain the explicit entry origin for reloads.
    if (dto) {
      setCanonical(persistence.presentation);
      const query = new URLSearchParams(window.location.search);
      if (navigation?.creating) query.set("entry", "create");
      window.history.replaceState(null, "", `/creator/edit/${encodeURIComponent(dto.root.deckTemplateId)}${query.size ? `?${query}` : ""}`); persistence.routeInstalled();
    }
    });
  }, [persistence, navigation?.creating]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    const pairUploadSessions = pairUploadSessionsRef.current;
    const introUploadSessions = introUploadSessionsRef.current;

    return () => {
      for (const [id, session] of pairUploadSessions) {
        if (!session.cardTemplateId || !persistence.cards.get(session.cardTemplateId)?.detached) { session.controller.abort(); pairUploadSessions.delete(id); }
      }
      for (const [id, session] of introUploadSessions) {
        if (!persistence.cards.get(id)?.detached) { session.controller.abort(); introUploadSessions.delete(id); }
      }
      // Detached authorized uploads retain their session until their independent
      // Card metadata save completes, even if Creator unmounts during SPA navigation.
    };
  }, [persistence]);

  function clearExpiredClickSuppression() {
    if (suppressClickUntilRef.current && Date.now() > suppressClickUntilRef.current) {
      suppressClickUntilRef.current = 0;
    }
  }

  function releasePanPointerCapture(target: HTMLElement, pointerId: number) {
    if (!target.hasPointerCapture(pointerId)) {
      return;
    }

    try {
      target.releasePointerCapture(pointerId);
    } catch {
      // iOS Safari can report capture changes after cancellation; stale capture is safe to ignore.
    }
  }

  function resetPanState(target: HTMLElement, pointerId: number) {
    const panState = panStateRef.current;

    if (!panState || panState.pointerId !== pointerId) {
      return;
    }

    if (panState.isPanning) {
      suppressClickUntilRef.current = Date.now() + 350;
    }

    releasePanPointerCapture(target, pointerId);
    panStateRef.current = null;
  }

  function previewTemplateOutput() {
    // Preview output remains a development-only control.
  }

  async function updateBoardAndSaveDraft(createNextBoard: (currentBoard: BoardState) => BoardState) {
    let previous = boardRef.current, next = createNextBoard(previous);
    const oldGraph = privateGraph(previous, persistence.presentation), nextGraph = privateGraph(next, persistence.presentation);
    for (const card of nextGraph.cards) {
      const old = oldGraph.cards.find((item) => item.cardTemplateId === card.cardTemplateId);
      if (old && !sameContent(old.content, card.content) && !await confirmForeignCard(card.cardTemplateId)) return;
    }
    previous = boardRef.current; next = createNextBoard(previous);
    const before = privateGraph(previous, persistence.presentation), after = privateGraph(next, persistence.presentation);
    boardRef.current = next; setBoard(next);
    // Projection is pure; only entities changed by this completed edit are queued.
    if (!sameContent(before.content, after.content)) persistence.editDeck(after.content);
    for (const card of after.cards) {
      const old = before.cards.find((item) => item.cardTemplateId === card.cardTemplateId);
      if (old && !sameContent(old.content, card.content)) persistence.editCard(card.cardTemplateId, card.content);
    }
  }

  async function confirmForeignCard(id: string) {
    if (persistence.binding(id) !== "foreign" || confirmedCards.current.has(id)) return true;
    const accepted = await new Promise<boolean>((resolve) => setCopyConfirmation({ entity: "Card", resolve }));
    if (accepted) confirmedCards.current.add(id);
    return accepted;
  }
  async function changeCardVisibility(id: string, visibility: import("@/lib/cards/model").Visibility) {
    if (visibility === persistence.cards.get(id)!.desiredVisibility || !await confirmForeignCard(id)) return;
    persistence.setCardVisibility(id, visibility);
  }
  function navigateToReturnTarget() {
    router.push(collectionDestination().href);
  }

  async function openDrafts() {
    setIsDraftsOpen(true); setDraftsLoading(true); setDraftsError("");
    try { const result = await loadCreatorDraftEntries(persistence.request); setDrafts(result.items); setDraftsError(result.error); }
    catch { setDraftsError("Drafts could not be loaded. Close and reopen My Drafts to try again."); }
    finally { setDraftsLoading(false); }
  }
  useEffect(() => {
    if (!navigation?.openDrafts) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setIsDraftsOpen(true); setDraftsLoading(true); setDraftsError("");
      try { const result = await loadCreatorDraftEntries(persistence.request); if (active) { setDrafts(result.items); setDraftsError(result.error); } }
      catch { if (active) setDraftsError("Drafts could not be loaded. Close and reopen My Drafts to try again."); }
      finally { if (active) setDraftsLoading(false); }
    });
    return () => { active = false; };
  }, [navigation?.openDrafts, persistence]);
  function closeDrafts() {
    setIsDraftsOpen(false);
    requestAnimationFrame(() => draftsButtonRef.current?.focus());
  }
  async function switchDraft(id: string, kind: CreatorDraftEntry["kind"] = "deck") {
    if (switchingRef.current !== null) return;
    if (kind === "deck" && id === persistence.deckTemplateId) { closeDrafts(); return; }
    switchingRef.current = id; setSwitchingTo(id); setDraftsError("");
    try {
      await prepareForNavigation();
      router.push(creatorDraftHref(id, kind, currentDraftOrigin(window.location)));
    } catch {
      switchingRef.current = null; setSwitchingTo(null);
      setDraftsError("Current work could not be saved. Close My Drafts and review the save or upload errors before switching.");
    }
  }

  function handleReturnClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!anyPublishing && !navigationRef.current && !leaveConfirmationOpen) void leaveCreator(true);
  }
  async function prepareForNavigation() {
    await persistence.prepareToNavigate();
    if ([...uploadFailuresRef.current.values()].some((id) => id === null || !persistence.cards.get(id)?.detached)) throw new Error("UPLOAD_INCOMPLETE");
  }

  function confirmDeckWarning(ids: string[], newer: import("@/lib/cards/model").DeckPublicationReview["cards"] = []) {
    return new Promise<boolean>((resolve) => setDeckWarning({ ids, newer, resolve }));
  }
  function confirmPublicPublication(review: PublicPublicationReview) {
    publicTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return new Promise<boolean>((resolve) => setPublicConfirmation({ review, resolve }));
  }
  function closePublicConfirmation(accepted: boolean) {
    publicConfirmation?.resolve(accepted); setPublicConfirmation(null);
    requestAnimationFrame(() => publicTriggerRef.current?.focus());
  }
  function explainPublicationBlock(reason: string) {
    blockedTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBlockedPublication(reason);
  }
  function closePublicationBlock() {
    setBlockedPublication(null);
    requestAnimationFrame(() => blockedTriggerRef.current?.focus());
  }
  async function publishTemplate(target: "deck" | "all" | string = "deck") {
    setPublishMessage("");
    if (target === "all") setPublishStatus("publishing");
    try {
      const success = target === "all" ? await persistence.publishAndLeave(notes, confirmDeckWarning, confirmPublicPublication)
        : target === "deck" ? await persistence.publishDeck(notes.deck, confirmDeckWarning, confirmPublicPublication)
        : await persistence.publishCard(target, notes[target], confirmPublicPublication);
      setPublishStatus("idle"); return success;
    } catch (error) {
      setPublishStatus("error");
      const uncertain = target === "deck" ? persistence.deck.uncertainPublication : target === "all" ? persistence.deck.uncertainPublication || [...persistence.cards.values()].some((lane) => lane.uncertainPublication) : persistence.cards.get(target)?.uncertainPublication;
      setPublishMessage(uncertain ? "Publication outcome is not yet confirmed. It will be reconciled before another save or publication."
        : creatorPublicationErrorMessage(error));
      return false;
    }
  }
  async function publishBeforeLeaving() {
    setLeaveConfirmationOpen(false);
    if (await publishTemplate("all")) {
      navigationRef.current = true; setNavigationPending(true);
      try {
        await prepareForNavigation();
        if (persistence.hasWork()) throw new Error("NEW_OUTSTANDING_WORK");
        navigateToReturnTarget();
      } catch {
        navigationRef.current = false; setNavigationPending(false); setPublishStatus("error");
        setPublishMessage("New outstanding work or a save/upload failure remains. Review the current work before publishing and leaving again.");
      }
    }
  }
  function closeLeaveConfirmation() {
    setLeaveConfirmationOpen(false);
    requestAnimationFrame(() => returnLinkRef.current?.focus());
  }
  function hasUnpublishedChanges() {
    const roots = [...persistence.cards.values()].flatMap((lane) => lane.ack ? [lane.ack.root] : []);
    return !!persistence.deck.ack && deckPublicationPresentation(persistence.deck, roots).outstanding
      || [...persistence.cards.values()].some((lane) => !lane.detached && !!lane.ack && cardPublicationPresentation(lane).outstanding);
  }
  async function leaveCreator(reviewUnpublishedChanges: boolean) {
    setLeaveConfirmationOpen(false);
    navigationRef.current = true; setNavigationPending(true);
    try {
      await prepareForNavigation();
      if (reviewUnpublishedChanges && hasUnpublishedChanges()) {
        navigationRef.current = false; setNavigationPending(false); setLeaveConfirmationOpen(true);
      } else navigateToReturnTarget();
    }
    catch {
      navigationRef.current = false; setNavigationPending(false); setPublishStatus("error");
      setPublishMessage("Current work could not be saved. Review the save or upload errors before leaving.");
    }
  }
  function handleDragStart(event: DragStartEvent) {
    if (panStateRef.current && scrollShellRef.current) resetPanState(scrollShellRef.current, panStateRef.current.pointerId);
    const pairId = String(event.active.id);
    setActivePairId(board.pairs[pairId] && !isStepEmpty(board.pairs[pairId]) ? pairId : null);
  }
  async function handleDragEnd(event: DragEndEvent) {
    setActivePairId(null);
    const pairId = String(event.active.id);
    const target = event.over?.id ? String(event.over.id) as CellId : null;
    const source = findPairCell(boardRef.current.cells, pairId);
    if (!source || !target || source === target) return;
    const [sourceColumn, sourceRow] = source.split(":");
    const [destinationColumn, destinationRow] = target.split(":");
    const sourceCard = boardRef.current.columns.find((column) => column.id === sourceColumn);
    const destinationCard = boardRef.current.columns.find((column) => column.id === destinationColumn);
    if (!sourceCard?.cardId || !destinationCard?.cardId) return;
    if (sourceColumn === destinationColumn) {
      updateBoardAndSaveDraft((current) => {
        const next = { ...current, cells: { ...current.cells, [source]: current.cells[target], [target]: current.cells[source] } };
        return next;
      });
      return;
    }
    if ([sourceCard.cardId, destinationCard.cardId].some((id) => uploadingIntroMediaCardIds.has(id) || [...pairUploadSessionsRef.current.values()].some((session) => session.cardTemplateId === id))) return;
    try {
      const targetPair = boardRef.current.pairs[boardRef.current.cells[target]?.pairId ?? ""];
      if (!targetPair || !isStepEmpty(targetPair)) return;
      const dto = await persistence.move(sourceCard.cardId, destinationCard.cardId, Number(sourceRow), Number(destinationRow));
      const moved = creatorBoard(dto), current = boardRef.current;
      const next = { ...current, cells: { ...current.cells }, pairs: { ...current.pairs } };
      for (const id of [sourceCard.cardId, destinationCard.cardId]) {
        const column = current.columns.find((column) => column.cardId === id)!;
        const movedColumn = moved.columns.find((column) => column.cardId === id)!;
        for (const row of current.rows) {
          delete next.pairs[current.cells[getCreatorCellId(column.id, row)].pairId!];
          const cell = moved.cells[getCreatorCellId(movedColumn.id, row)], pair = moved.pairs[cell.pairId!];
          next.cells[getCreatorCellId(column.id, row)] = { ...cell }; next.pairs[pair.id] = pair;
        }
      }
      boardRef.current = next; setBoard(next);
    } catch (error) {
      setPublishStatus("error");
      setPublishMessage(error instanceof Error && error.message === "CROSS_CARD_MOVE_AFTER_REUSE"
        ? "Steps cannot move between Cards after either Card has been reused. Reordering within a Card is still available."
        : error instanceof Error ? error.message : "Step move failed");
    }
  }

  function handleDragCancel() {
    setActivePairId(null);
  }

  function addCard() {
    const next = appendCreatorCard(boardRef.current);
    next.columns = next.columns.map((column, index) => index === next.columns.length - 1 ? { ...column, targetDate: "" } : column);
    boardRef.current = next; setBoard(next);
    const graph = privateGraph(next, persistence.presentation), card = graph.cards.at(-1)!;
    persistence.addCard(card.cardTemplateId, card.content.steps.map((step) => step.stepId), graph.content);
  }

  function deleteActiveCard() {
    if (editSession?.target.type !== "card-title") return;
    const id = editSession.target.cardTemplateId;
    const column = boardRef.current.columns.find((column) => column.cardId === id);
    if (!column) return;
    const next = deleteCreatorCard(boardRef.current, column.id);
    boardRef.current = next; setBoard(next);
    persistence.detachCard(id, privateGraph(next, persistence.presentation).content);
    setEditSession(null);
  }

  function openEdit(target: EditTarget) {
    const id = target.type === "card-title" ? target.cardTemplateId : target.type === "pair-step" ? board.columns.find((column) => column.id === findPairCell(board.cells, target.pairId)?.split(":")[0])?.cardId : null;
    if (id ? persistence.cards.get(id)?.locked : persistence.deck.locked) return;
    const nextEditSession = getEditSession(board, target);

    if (nextEditSession) {
      setEditSession(nextEditSession);
    }
  }

  function openDateEdit(target: DateEditTarget) {
    const nextDateEditSession = getDateEditSession(board, target);

    if (nextDateEditSession) {
      setDateEditSession(nextDateEditSession);
    }
  }

  function saveEdit(value: string, title?: string, descriptionContent?: StepDescriptionSpan[], infoCardIds?: string[]) {
    if (!editSession) {
      return;
    }

    const target = editSession.target;

    updateBoardAndSaveDraft((currentBoard) => {
      if (target.type === "deck-title") {
        return { ...currentBoard, deckTitle: restoreCreatorDeckTitle(value, canonical?.publishedContent?.title) };
      }

      if (target.type === "stream-name") {
        return {
          ...currentBoard,
          streamNamesByRow: {
            ...currentBoard.streamNamesByRow,
            [target.row]: resolveCreatorStreamName(target.row, value),
          },
        };
      }

      if (target.type === "card-title") {
        return {
          ...currentBoard,
          columns: currentBoard.columns.map((column) => (column.cardId === target.cardTemplateId ? { ...column,
            ...(infoCardIds !== undefined ? { infoCardIds: [...infoCardIds] } : {}),
            cardTitle: resolveCreatorCardTitle(column, value, canonical?.cards.find((card) => card.root.cardTemplateId === column.cardId)?.publishedContent?.intro.title ?? null) } : column)),
        };
      }

      const pair = currentBoard.pairs[target.pairId];

      if (!pair) {
        return currentBoard;
      }

      return {
        ...currentBoard,
        pairs: {
          ...currentBoard.pairs,
          [target.pairId]: {
            ...pair,
            stepTitle: title?.trim() || null,
            stepDescriptionContent: descriptionContent,
            stepText: value.trim() === "" ? null : value,
          },
        },
      };
    });
    setEditSession(null);
  }

  function clearPairUploadState(pairId: PairId) {
    setUploadingMediaPairIds((currentPairIds) => {
      if (!currentPairIds.has(pairId)) {
        return currentPairIds;
      }

      const nextPairIds = new Set(currentPairIds);
      nextPairIds.delete(pairId);
      return nextPairIds;
    });
  }

  function clearIntroUploadState(cardTemplateId: string) {
    setUploadingIntroMediaCardIds((currentCardIds) => {
      if (!currentCardIds.has(cardTemplateId)) {
        return currentCardIds;
      }

      const nextCardIds = new Set(currentCardIds);
      nextCardIds.delete(cardTemplateId);
      return nextCardIds;
    });
  }

  function createPairUploadSession(pairId: PairId) {
    pairUploadSessionsRef.current.get(pairId)?.controller.abort();

    const session: UploadSession = {
      controller: new AbortController(),
      token: Symbol(pairId),
    };

    pairUploadSessionsRef.current.set(pairId, session);
    setUploadingMediaPairIds((currentPairIds) => {
      const nextPairIds = new Set(currentPairIds);
      nextPairIds.add(pairId);
      return nextPairIds;
    });

    return session;
  }

  function createIntroUploadSession(cardTemplateId: string) {
    introUploadSessionsRef.current.get(cardTemplateId)?.controller.abort();

    const session: UploadSession = {
      controller: new AbortController(),
      token: Symbol(cardTemplateId),
    };

    introUploadSessionsRef.current.set(cardTemplateId, session);
    setUploadingIntroMediaCardIds((currentCardIds) => {
      const nextCardIds = new Set(currentCardIds);
      nextCardIds.add(cardTemplateId);
      return nextCardIds;
    });

    return session;
  }

  function isActivePairUpload(pairId: PairId, session: UploadSession) {
    return pairUploadSessionsRef.current.get(pairId)?.token === session.token && !session.controller.signal.aborted;
  }

  function isActiveIntroUpload(cardTemplateId: string, session: UploadSession) {
    return introUploadSessionsRef.current.get(cardTemplateId)?.token === session.token && !session.controller.signal.aborted;
  }

  function finishPairUpload(pairId: PairId, session: UploadSession) {
    if (pairUploadSessionsRef.current.get(pairId)?.token !== session.token) {
      return;
    }

    pairUploadSessionsRef.current.delete(pairId);
    clearPairUploadState(pairId);
  }

  function finishIntroUpload(cardTemplateId: string, session: UploadSession) {
    if (introUploadSessionsRef.current.get(cardTemplateId)?.token !== session.token) {
      return;
    }

    introUploadSessionsRef.current.delete(cardTemplateId);
    clearIntroUploadState(cardTemplateId);
  }

  function cancelPairMediaUpload(pairId: PairId) {
    const session = pairUploadSessionsRef.current.get(pairId);

    if (!session) {
      return;
    }

    session.controller.abort();
    pairUploadSessionsRef.current.delete(pairId);
    clearPairUploadState(pairId);
  }

  function cancelIntroMediaUpload(cardTemplateId: string) {
    const session = introUploadSessionsRef.current.get(cardTemplateId);

    if (!session) {
      return;
    }

    session.controller.abort();
    introUploadSessionsRef.current.delete(cardTemplateId);
    clearIntroUploadState(cardTemplateId);
  }

  async function uploadPairMedia(pairId: PairId, file: File) {
    const sourceCell = findPairCell(boardRef.current.cells, pairId);
    const cardTemplateId = boardRef.current.columns.find((column) => column.id === sourceCell?.split(":")[0])?.cardId;
    const stepId = boardRef.current.pairs[pairId]?.stepId;
    if (!cardTemplateId || !stepId || !await confirmForeignCard(cardTemplateId)) return;
    const targetLane = persistence.cards.get(cardTemplateId);
    if (targetLane?.locked && !targetLane.publishing) return;
    if (file.type && !file.type.startsWith("video/")) { setPublishStatus("error"); setPublishMessage("Choose a video file."); return; }
    const session = createPairUploadSession(pairId); session.cardTemplateId = cardTemplateId;
    uploadFailuresRef.current.delete(pairId);
    const finishOperation = persistence.beginCardUpload(cardTemplateId);
    let uploaded = false;
    try {
      await persistence.flushCard(cardTemplateId);
      // A transfer may have completed while creation/saving was awaited. Never
      // authorize a Step upload against its former Card.
      if (!persistence.cards.get(cardTemplateId)?.desired.steps.some((step) => step.stepId === stepId)) return;
      const mediaItem = await uploadVideoMedia(await persistence.prepareUploadTarget(cardTemplateId, stepId), file, session.controller.signal);
      persistence.recordMediaProof(cardTemplateId, prospectiveAttachmentProof(mediaItem));
      uploaded = true;
      if (!isActivePairUpload(pairId, session)) return;
      const lane = persistence.cards.get(cardTemplateId)!;
      persistence.editCard(cardTemplateId, { ...lane.desired, steps: lane.desired.steps.map((step) => step.stepId === stepId ? { ...step, mediaItem } : step) });
      const current = boardRef.current;
      if (current.pairs[pairId]) {
        const next = { ...current, pairs: { ...current.pairs, [pairId]: { ...current.pairs[pairId], stepMediaItem: mediaItem } } };
        boardRef.current = next; setBoard(next);
      }
      await persistence.flushCard(cardTemplateId);
    } catch (error) {
      if (!uploaded && !persistence.cards.get(cardTemplateId)?.error && !session.controller.signal.aborted && !isAbortError(error)) uploadFailuresRef.current.set(pairId, cardTemplateId);
      if (!session.controller.signal.aborted && !isAbortError(error) && !persistence.cards.get(cardTemplateId)?.detached) { setPublishStatus("error"); setPublishMessage(SUPPORT_ERROR_MESSAGE); }
    } finally { finishOperation(); finishPairUpload(pairId, session); }
  }

  async function uploadIntroMedia(cardTemplateId: string, file: File) {
    if (!await confirmForeignCard(cardTemplateId)) return;
    if (file.type && !file.type.startsWith("video/")) { setPublishStatus("error"); setPublishMessage("Choose a video file."); return; }
    const session = createIntroUploadSession(cardTemplateId);
    uploadFailuresRef.current.delete(`intro:${cardTemplateId}`);
    const finishOperation = persistence.beginCardUpload(cardTemplateId);
    let uploaded = false;
    try {
      await persistence.flushCard(cardTemplateId);
      const mediaItem = await uploadVideoMedia(await persistence.prepareUploadTarget(cardTemplateId, "intro"), file, session.controller.signal);
      persistence.recordMediaProof(cardTemplateId, prospectiveAttachmentProof(mediaItem));
      uploaded = true;
      if (!isActiveIntroUpload(cardTemplateId, session)) return;
      const lane = persistence.cards.get(cardTemplateId)!;
      persistence.editCard(cardTemplateId, { ...lane.desired, intro: { ...lane.desired.intro, mediaItem } });
      const current = boardRef.current;
      const next = { ...current, columns: current.columns.map((column) => column.cardId === cardTemplateId ? { ...column, introMediaItem: mediaItem } : column) };
      boardRef.current = next; setBoard(next);
      await persistence.flushCard(cardTemplateId);
    } catch (error) {
      if (!uploaded && !persistence.cards.get(cardTemplateId)?.error && !session.controller.signal.aborted && !isAbortError(error)) uploadFailuresRef.current.set(`intro:${cardTemplateId}`, cardTemplateId);
      if (!session.controller.signal.aborted && !isAbortError(error) && !persistence.cards.get(cardTemplateId)?.detached) { setPublishStatus("error"); setPublishMessage(SUPPORT_ERROR_MESSAGE); }
    } finally { finishOperation(); finishIntroUpload(cardTemplateId, session); }
  }

  async function uploadDeckIntroduction(kind: "image" | "video", file: File) {
    uploadFailuresRef.current.delete(`deck:${kind}`);
    const finish = persistence.beginDeckUpload();
    try { if (kind === "image") await deckIntroductionUpload.uploadImage(file); else await deckIntroductionUpload.uploadVideo(file); }
    finally { finish(); }
  }
  async function handleDeckIntroductionUploadStarted() {
    if (persistence.binding() === "foreign") return;
    const content = privateGraph(boardRef.current, persistence.presentation).content;
    persistence.editDeck(content); await persistence.deck.flush();
  }
  async function handleDeckIntroductionUploadCompleted(result: CompletedMediaUpload) {
    persistence.recordMediaProof("deck", prospectiveAttachmentProof(result.mediaItem));
    await updateBoardAndSaveDraft((current) => result.kind === "image" ? setBoardDeckIntroductionImage(current, result.mediaItem) : setBoardDeckIntroductionVideo(current, result.mediaItem));
    await persistence.deck.flush();
  }

  function removeDeckIntroductionImage() {
    updateBoardAndSaveDraft((currentBoard) => setBoardDeckIntroductionImage(currentBoard, null));
    uploadFailuresRef.current.delete("deck:image");
    deckIntroductionUpload.clearImageError();
  }

  function saveDateEdit(value: string) {
    if (!dateEditSession || !isIsoDateOnlyString(value)) {
      return;
    }

    const target = dateEditSession.target;

    updateBoardAndSaveDraft((currentBoard) => ({
      ...currentBoard,
      columns: currentBoard.columns.map((column) => (column.cardId === target.cardTemplateId ? { ...column, targetDate: value } : column)),
    }));
    setDateEditSession(null);
  }

  function handlePanPointerDown(event: PointerEvent<HTMLElement>) {
    if (activePairId || event.button !== 0) {
      return;
    }

    clearExpiredClickSuppression();
    if (panStateRef.current) {
      resetPanState(event.currentTarget, panStateRef.current.pointerId);
    }

    const target = event.target as HTMLElement;

    if (target.closest("input, select, textarea, [contenteditable='true'], [data-creator-pan-exempt]")) {
      return;
    }

    const shouldCapturePanImmediately = Boolean(target.closest(".creator-board, [data-creator-pan-gutter], [data-creator-pan-surface]"));

    if (!shouldCapturePanImmediately) {
      return;
    }

    panStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: event.currentTarget.scrollLeft,
      isPanning: false,
      hasPointerCapture: event.pointerType !== "mouse",
    };

    if (event.pointerType !== "mouse") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        panStateRef.current.hasPointerCapture = false;
      }
    }
  }

  function handlePanPointerMove(event: PointerEvent<HTMLElement>) {
    const panState = panStateRef.current;

    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - panState.startClientX;
    const deltaY = event.clientY - panState.startClientY;

    if (!panState.isPanning) {
      if (Math.abs(deltaX) < CREATOR_GEOMETRY.panStartThreshold || Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }

      panState.isPanning = true;
      suppressClickUntilRef.current = Date.now() + 350;
      if (!panState.hasPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
        panState.hasPointerCapture = true;
      }
    }

    event.preventDefault();
    event.currentTarget.scrollLeft = panState.startScrollLeft - deltaX;
  }

  function stopPan(event: PointerEvent<HTMLElement>) {
    resetPanState(event.currentTarget, event.pointerId);
  }

  function handlePanClickCapture(event: MouseEvent<HTMLElement>) {
    if (Date.now() > suppressClickUntilRef.current) {
      return;
    }

    suppressClickUntilRef.current = 0;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <main className="creator-lab" style={creatorGeometryStyle} data-creator-entry={mode}>
      <header className="creator-header" inert={navigationLocked}>
        <div>
          {navigation?.creating ? <CreatorModeSelector mode="deck" disabled={anyPublishing || navigationPending} onChange={() => {
            if (navigationRef.current) return;
            navigationRef.current = true; setNavigationPending(true);
            void prepareForNavigation().then(() => router.push("/creator/info-cards/new")).catch(() => {
              navigationRef.current = false; setNavigationPending(false); setPublishStatus("error");
              setPublishMessage("Current work could not be saved. Review the save or upload errors before switching modes.");
            });
          }} /> : <p className="creator-kicker">Edit Template</p>}
          <p className="creator-edit-hint">Tap text to edit</p>
        </div>
        <div className="creator-header-actions">
          <button className="creator-drafts-trigger" type="button" ref={draftsButtonRef}
            disabled={publishStatus === "publishing" || persistence.deck.publishing || [...persistence.cards.values()].some((lane) => lane.publishing)}
            onClick={() => void openDrafts()}>My Drafts</button>
          {canPreviewOutput ? (
            <button className="creator-preview-output-button" onClick={previewTemplateOutput} type="button">
              Preview
            </button>
          ) : null}
          <div className="creator-publish-controls">
            <CreatorVisibilityControl label="Deck" value={persistence.deck.desiredVisibility}
              publishedPublic={persistence.deck.ack?.root.visibility === "public"} disabled={anyPublishing}
              onChange={(visibility) => persistence.setDeckVisibility(visibility)} />
            <CreatorPublishControl label="Deck" state={deckPresentation} onPublish={() => void publishTemplate("deck")} onBlocked={explainPublicationBlock} />
            {deckPresentation.visible ? <button className="creator-add-note" type="button" aria-label="Add note for Deck" disabled={publishStatus === "publishing"} onClick={() => setNoteSession({ key: "deck", label: "Deck", value: notes.deck ?? "" })}>Add note</button> : null}
          </div>
          <div className="creator-feedback">
          {publishMessage ? (
            publishStatus === "error" && publishMessage === SUPPORT_ERROR_MESSAGE ? (
              <SupportErrorMessage className={`creator-save-message creator-save-message--${publishStatus}`} />
            ) : (
              <p className={`creator-save-message creator-save-message--${publishStatus}`}>{publishMessage}</p>
            )
          ) : null}
      {[{ id: "deck", label: "Deck", lane: persistence.deck }, ...getCardColumns(board.columns).map((column, index) => ({ id: column.cardId!, label: `Card ${index + 1}`, lane: persistence.cards.get(column.cardId!)! }))].filter(({ lane }) => lane.error).map(({ id, label, lane }) => (
        <p className="creator-entity-save-error" role="alert" key={id}>
          {label}: {lane.error!.kind === "conflict" || lane.error!.kind === "recovery" ? "Save conflict. Local edits are retained; reload only after reviewing them." : "Changes could not be saved."}
          {lane.error!.kind !== "conflict" && lane.error!.kind !== "recovery" ? <button type="button" aria-label={`Retry Save ${label}`} onClick={() => id === "deck" ? persistence.retryDeck() : persistence.retryCard(id)}>Retry Save</button> : null}
        </p>
      ))}
          </div>
          <Link className="creator-back-link" ref={returnLinkRef} href={resolvedCreatorReturnTarget.href} onClick={handleReturnClick}>
            {resolvedCreatorReturnTarget.label}
          </Link>
        </div>
      </header>

      {!entryConfirmed ? <CreatorCopyConfirmation entity="Deck" onCancel={navigateToReturnTarget} onConfirm={() => setEntryConfirmed(true)} /> : null}
      {copyConfirmation ? <CreatorCopyConfirmation entity={copyConfirmation.entity} onCancel={() => { copyConfirmation.resolve(false); setCopyConfirmation(null); }}
        onConfirm={() => { copyConfirmation.resolve(true); setCopyConfirmation(null); }} /> : null}
      {persistence.recovering ? <p role="status">Recovering your submitted edit…</p> : null}
      {navigationPending ? <p className="creator-navigation-status" role="status">Finishing saves and uploads before leaving…</p> : null}
      {leaveConfirmationOpen ? <CreatorLeaveConfirmation onCancel={closeLeaveConfirmation}
        destinationUnavailable={persistence.deck.ack?.root.latestVersion === 0 || resolvedCreatorReturnTarget.label === "Library" && persistence.deck.ack?.root.visibility !== "public"}
        onLeave={() => void leaveCreator(false)} onPublishAndLeave={() => void publishBeforeLeaving()} /> : null}
      {publicConfirmation ? <CreatorPublicConfirmation review={publicConfirmation.review}
        onCancel={() => closePublicConfirmation(false)} onConfirm={() => closePublicConfirmation(true)} /> : null}
      {isDraftsOpen ? <CreatorDraftsModal drafts={drafts} currentDeckTemplateId={persistence.deckTemplateId} loading={draftsLoading} error={draftsError}
        switchingTo={switchingTo} onClose={closeDrafts} onSelect={(id, kind) => void switchDraft(id, kind)} /> : null}
      {blockedPublication ? <div className="creator-modal-backdrop"><div className="creator-modal" role="dialog" aria-modal="true" aria-label="Publication blocked"
        onKeyDown={(event) => { if (event.key === "Escape") closePublicationBlock(); if (event.key === "Tab") event.preventDefault(); }}>
        <p>{blockedPublication}</p><button className="creator-modal-secondary" type="button" autoFocus onClick={closePublicationBlock}>Close</button>
      </div></div> : null}

      {deckWarning ? <div className="creator-modal-backdrop"><div className="creator-modal" role="dialog" aria-modal="true" aria-label={deckWarning.newer.length ? "Newer Card publications" : "Unpublished Card changes"}>
        {deckWarning.ids.length > 0 && <p>One or more Cards have unpublished changes. Publish this Deck using their current published versions anyway?</p>}
        {deckWarning.newer.length > 0 && <><p>These shared Cards have newer publications than the versions selected for editing. This Deck will record their latest published versions. Your selected authoring versions and existing personal progress are preserved.</p>
          <ul>{deckWarning.newer.map((card) => <li key={card.cardTemplateId}>{board.columns.find((column) => column.cardId === card.cardTemplateId)?.cardTitle ?? "Shared Card"}: selected version {card.selectedVersion}, published version {card.latestVersion}</li>)}</ul></>}
        <div className="creator-modal-actions">
          <button type="button" onClick={() => { deckWarning.resolve(false); setDeckWarning(null); }}>Cancel</button>
          <button type="button" onClick={() => { deckWarning.resolve(true); setDeckWarning(null); }}>Publish anyway</button>
        </div>
      </div></div> : null}

      <DndContext
        id="creator-dnd-context"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <section
          className="creator-scroll-shell"
          inert={navigationLocked}
          aria-label="Creator drag lab canvas"
          ref={scrollShellRef}
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={stopPan}
          onPointerCancel={stopPan}
          onLostPointerCapture={stopPan}
          onClickCapture={handlePanClickCapture}
        >
          <div className="creator-canvas">
            <div className="creator-board">
              {renderingColumns.map((column) => {
                const cardPresentation = column.kind === "card" && persistence.binding(column.cardId!) !== "foreign" ? cardPublicationPresentation(persistence.cards.get(column.cardId!)!) : null;
                return (
                <section className="creator-column" key={column.cardId ?? column.id} data-card-template-id={column.cardId} aria-label={column.label}>
                  <header className="creator-card-header">
                    {column.kind === "card" ? (
                      <>
                        <div className="creator-card-meta-row">
                          <div className="creator-card-identity">
                            <span className="creator-card-label-button">{column.cardLabel}</span>
                            <CreatorVisibilityControl label={column.cardLabel!} value={persistence.cards.get(column.cardId!)!.desiredVisibility}
                              publishedPublic={persistence.cards.get(column.cardId!)!.ack?.root.visibility === "public"} disabled={anyPublishing}
                              onChange={(visibility) => void changeCardVisibility(column.cardId!, visibility)} />
                          </div>
                          <button className="creator-editable creator-card-date-button" onClick={() => openDateEdit({ type: "target-date", cardTemplateId: column.cardId! })} type="button">
                            {formatCreatorDateDisplay(column.targetDate ?? "")}
                          </button>
                        </div>
                        <div className="creator-card-title-row">
                          <button className="creator-editable creator-card-title-button" onClick={() => openEdit({ type: "card-title", cardTemplateId: column.cardId! })} type="button">
                            {column.cardTitle}
                          </button>
                          {cardPresentation?.visible ? <div className="creator-publish-controls creator-card-publish-controls">
                            <CreatorPublishControl label={column.cardLabel!} state={cardPresentation}
                              onPublish={() => void publishTemplate(column.cardId!)} onBlocked={explainPublicationBlock} />
                            <button className="creator-add-note" type="button" aria-label={`Add note for ${column.cardLabel}`} disabled={publishStatus === "publishing"} onClick={() => setNoteSession({ key: column.cardId!, label: column.cardLabel!, value: notes[column.cardId!] ?? "" })}>Add note</button>
                          </div> : null}
                        </div>
                        <CreatorMediaUploadSlot
                          ariaLabel={`Upload intro video for ${column.cardTitle ?? column.cardLabel ?? "card"}`}
                          className="creator-card-intro-media-slot"
                          isUploading={uploadingIntroMediaCardIds.has(column.cardId!)}
                          mediaItem={column.introMediaItem ?? null}
                          onCancelUpload={() => cancelIntroMediaUpload(column.cardId!)}
                          onUpload={(file) => void uploadIntroMedia(column.cardId!, file)}
                          placeholder="Upload video"
                          size="intro"
                        />
                      </>
                    ) : (
                      <button
                        aria-label="Edit deck title and introduction"
                        className="creator-editable creator-stream-header creator-deck-introduction-trigger"
                        onClick={() => openEdit({ type: "deck-title" })}
                        type="button"
                      >
                        <span>{board.deckTitle}</span>
                        <small>Edit intro</small>
                      </button>
                    )}
                  </header>
                  <div className="creator-column-cells">
                    {board.rows.map((row) => {
                      const cellId = getCreatorCellId(column.id, row);

                      return (
                        <BoardCell
                          activePairId={activePairId}
                          isMediaUploadBlocked={Boolean(column.cardId && persistence.cards.get(column.cardId)?.locked && !persistence.cards.get(column.cardId)?.publishing)}
                          cell={board.cells[cellId]}
                          cellId={cellId}
                          streamName={column.kind === "stream" ? board.streamNamesByRow[row] : undefined}
                          key={cellId}
                          onCancelMediaUpload={cancelPairMediaUpload}
                          onEdit={openEdit}
                          onUploadMedia={uploadPairMedia}
                          pair={board.cells[cellId].pairId ? board.pairs[board.cells[cellId].pairId] : undefined}
                          row={row}
                          uploadingMediaPairIds={uploadingMediaPairIds}
                        />
                      );
                    })}
                  </div>
                </section>
                );
              })}
              <AddCardControl onAddCard={addCard} />
          </div>
            {/* Dedicated pan gutter for mobile thumbs. It shares the scroll shell's pointer-pan handlers and is not a drop target. */}
            <div className="creator-pan-gutter" data-creator-pan-gutter aria-hidden="true" />
          </div>
        </section>

        <DragOverlay>
          {activePair && activeOriginCellId ? <PairPreview pair={activePair} /> : null}

        </DragOverlay>
      </DndContext>
      {editSession ? (
        <CreatorEditModal
          actor={currentUserId}
          request={persistence.request}
          publicInfoOnly={editingCardId !== null && requiresPublicInfoAttachments(persistence.deck, persistence.cards.get(editingCardId)!)}
          canDeleteCard={canDeleteActiveCard}
          videoReadinessTarget={persistence.deckReadinessTarget}
          deckIntroductionImage={board.deckIntroduction?.image ?? null}
          deckIntroductionImageMessage={deckIntroductionUpload.imageError}
          deckIntroductionVideo={board.deckIntroduction?.video ?? null}
          deckIntroductionVideoMessage={deckIntroductionUpload.videoError}
          isDeckIntroImageUploading={deckIntroductionUpload.isImageUploading}
          isDeckIntroVideoUploading={deckIntroductionUpload.isVideoUploading}
          deckIntroductionVideoUploadStage={deckIntroductionUpload.videoUploadStage}
          key={getEditTargetKey(editSession.target)}
          session={editSession}
          onClose={() => setEditSession(null)}
          onDeleteCard={editSession.target.type === "card-title" ? deleteActiveCard : undefined}
          onSave={saveEdit}
          copyControl={editingCardId && ["owned", "foreign"].includes(persistence.binding(editingCardId)) ? <CreatorCopyTo
            foreign={persistence.binding(editingCardId) === "foreign"}
            sourceVersion={persistence.foreignCardVersion(editingCardId)}
            cardTemplateId={persistence.cardIdentity(editingCardId)} deckTemplateId={persistence.deckTemplateId} request={persistence.request}
            ensureCreated={() => persistence.binding(editingCardId) === "foreign" ? Promise.resolve() : persistence.ensureCardCreated(editingCardId)}
            onReused={() => persistence.noteCardReused(editingCardId)} /> : undefined}
          onRemoveDeckIntroductionImage={removeDeckIntroductionImage}
          onUploadDeckIntroductionVideo={(file) => void uploadDeckIntroduction("video", file)}
          onUploadDeckIntroductionImage={(file) => void uploadDeckIntroduction("image", file)}
        />
      ) : null}
      {noteSession ? (
        <div className="creator-modal-backdrop" role="presentation">
          <form className="creator-modal creator-note-modal" role="dialog" aria-modal="true" aria-label={`Update note for ${noteSession.label}`} onKeyDown={(event) => { if (event.key === "Escape") setNoteSession(null); }} onSubmit={(event) => {
            event.preventDefault();
            setNotes((current) => ({ ...current, [noteSession.key]: noteSession.value }));
            setNoteSession(null);
          }}>
            <header className="creator-modal-header">
              <p>{noteSession.label} update note</p>
              <button className="creator-modal-close" type="button" onClick={() => setNoteSession(null)}>Cancel</button>
            </header>
            <label>
              Optional update note
              <textarea autoFocus className="creator-modal-field" aria-label={`Update note for ${noteSession.label}`} maxLength={2000} value={noteSession.value} onChange={(event) => setNoteSession({ ...noteSession, value: event.target.value })} />
            </label>
            <div className="creator-modal-actions"><button className="creator-modal-save" type="submit">Save note</button></div>
          </form>
        </div>
      ) : null}
      {dateEditSession ? <CreatorDateEditModal session={dateEditSession} onClose={() => setDateEditSession(null)} onSave={saveDateEdit} /> : null}
    </main>
  );
}
