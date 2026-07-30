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
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent } from "react";
import {
  appendCreatorCard,
  creatorBoardToDeckTemplate,
  deleteCreatorCard,
  getCardColumns,
  getCreatorCellId,
  getStepDisplayText,
  getStepMediaDisplayText,
  isPairEmpty,
  isStepMediaEmpty,
  isStepEmpty,
  resolveCreatorCardLabel,
  resolveCreatorCardTitle,
  resolveCreatorStreamName,
  swapCreatorBoardRows,
  type BoardState,
  type CellId,
  type CellState,
  type ColumnId,
  type Pair,
  type PairId,
} from "@/components/creator/creatorBoardState";
import AppUtilityNav from "@/components/layout/AppUtilityNav";
import CreatorMediaUploadSlot from "@/components/creator/CreatorMediaUploadSlot";
import SupportErrorMessage from "@/components/support/SupportErrorMessage";
import { CREATOR_GEOMETRY, getCreatorGeometryStyle } from "@/components/creator/creatorDragLabGeometry";
import type { DeckTemplate, StepDescriptionSpan } from "@/components/decks/types";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";

type EditTarget =
  | { type: "deck-title" }
  | { type: "stream-name"; row: number }
  | { type: "card-label"; columnId: ColumnId }
  | { type: "card-title"; columnId: ColumnId }
  | { type: "pair-step"; pairId: PairId };

type EditSession = {
  descriptionContent?: StepDescriptionSpan[];
  helperText?: string;
  inputKind: "long-text" | "short-text";
  label: string;
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

type DateEditTarget = { type: "target-date"; columnId: ColumnId };

type DateEditSession = {
  label: string;
  target: DateEditTarget;
  value: string;
};

type DragType = "stream" | "pair";

type PublishStatus = "idle" | "publishing" | "success" | "error";

type StreamDirectUploadResponse = {
  uid: string;
  uploadURL: string;
  maxDurationSeconds: number;
};

type VideoDimensions = {
  width: number;
  height: number;
};

type SavedDeckTemplateResponse = {
  copied?: boolean;
  deckTemplateId?: string;
};

type UploadSession = {
  controller: AbortController;
  token: symbol;
};

const creatorGeometryStyle = getCreatorGeometryStyle();
const STEP_TEXT_WARNING_LENGTH = 70;
const CARD_LABEL_MAX_LENGTH = 8;
const SUPPORT_ERROR_MESSAGE = "support";

function createStepLinkId() {
  return `step-link-${crypto.randomUUID()}`;
}

function createTemplateSnapshot(board: BoardState, deckTemplateId = board.deckTemplateId) {
  return JSON.stringify({
    ...creatorBoardToDeckTemplate(board),
    deckTemplateId,
  });
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

function getPublishErrorMessage(errorBody: unknown, fallback: string) {
  if (typeof errorBody === "object" && errorBody !== null && "error" in errorBody && typeof errorBody.error === "string") {
    return errorBody.error;
  }

  return fallback;
}

function isStreamDirectUploadResponse(value: unknown): value is StreamDirectUploadResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "uid" in value &&
    typeof value.uid === "string" &&
    value.uid.trim() !== "" &&
    "uploadURL" in value &&
    typeof value.uploadURL === "string" &&
    value.uploadURL.trim() !== "" &&
    "maxDurationSeconds" in value &&
    typeof value.maxDurationSeconds === "number"
  );
}

function createCloudflareStreamPlaybackUrl(uid: string) {
  return `https://iframe.videodelivery.net/${encodeURIComponent(uid)}`;
}

function getLocalVideoDimensions(file: File): Promise<VideoDimensions | null> {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let isSettled = false;
    let timeoutId: number | null = null;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const settle = (dimensions: VideoDimensions | null) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      cleanup();
      resolve(dimensions);
    };

    timeoutId = window.setTimeout(() => settle(null), 10_000);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener(
      "loadedmetadata",
      () => {
        const width = video.videoWidth;
        const height = video.videoHeight;
        const hasDimensions = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;

        settle(hasDimensions ? { width, height } : null);
      },
      { once: true }
    );
    video.addEventListener("error", () => settle(null), { once: true });
    video.src = objectUrl;
    video.load();
  });
}

function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function throwIfUploadAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Upload cancelled.", "AbortError");
  }
}

async function requestStreamDirectUpload(file: File, signal: AbortSignal): Promise<StreamDirectUploadResponse> {
  const response = await fetch("/api/media/stream/direct-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: file.name }),
    signal,
  });
  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getPublishErrorMessage(responseBody, "Unable to prepare video upload."));
  }

  if (!isStreamDirectUploadResponse(responseBody)) {
    throw new Error("Video upload could not be prepared.");
  }

  return responseBody;
}

async function uploadFileToCloudflareStream(uploadURL: string, file: File, signal: AbortSignal) {
  const uploadBody = new FormData();

  uploadBody.append("file", file);

  const response = await fetch(uploadURL, {
    method: "POST",
    body: uploadBody,
    signal,
  });

  if (!response.ok) {
    throw new Error("Video upload failed.");
  }
}

async function uploadCreatorVideo(file: File, signal: AbortSignal): Promise<CloudflareStreamVideoMediaItem> {
  const dimensions = await getLocalVideoDimensions(file);
  throwIfUploadAborted(signal);
  const directUpload = await requestStreamDirectUpload(file, signal);

  await uploadFileToCloudflareStream(directUpload.uploadURL, file, signal);
  throwIfUploadAborted(signal);

  return {
    id: `stream-${directUpload.uid}`,
    mediaType: "video",
    provider: "cloudflare-stream",
    assetId: directUpload.uid,
    src: createCloudflareStreamPlaybackUrl(directUpload.uid),
    description: file.name || "Video attached",
    ...(dimensions ?? {}),
  };
}

async function publishCreatorDeckTemplate({
  deckTemplateId,
  method,
  template,
}: {
  deckTemplateId?: string;
  method: "PATCH" | "POST";
  template: DeckTemplate;
}) {
  const response = await fetch(method === "PATCH" ? `/api/deck-templates/${encodeURIComponent(deckTemplateId ?? "")}` : "/api/deck-templates", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ template }),
  });
  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getPublishErrorMessage(responseBody, "Unable to publish template."));
  }

  return responseBody;
}

async function saveCreatorDeckTemplateDraft({
  deckTemplateId,
  template,
}: {
  deckTemplateId: string;
  template: DeckTemplate;
}): Promise<SavedDeckTemplateResponse> {
  const response = await fetch(`/api/deck-templates/${encodeURIComponent(deckTemplateId)}/saved`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ template }),
  });
  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getPublishErrorMessage(responseBody, "Unable to save draft."));
  }

  return typeof responseBody === "object" && responseBody !== null ? responseBody as SavedDeckTemplateResponse : {};
}

async function publishSavedCreatorDeckTemplate(deckTemplateId: string) {
  const response = await fetch(`/api/deck-templates/${encodeURIComponent(deckTemplateId)}/publish`, {
    method: "POST",
  });
  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getPublishErrorMessage(responseBody, "Unable to publish template."));
  }

  return responseBody;
}

async function initializeCreatorDeckData(deckTemplateId: string) {
  const response = await fetch("/api/decks-data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ deckTemplateId }),
  });
  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Template published, but deck data could not be initialized: ${getPublishErrorMessage(responseBody, "Unable to initialize deck data.")}`);
  }

  return responseBody;
}

function findPairCell(cells: BoardState["cells"], pairId: PairId) {
  return Object.entries(cells).find(([, cell]) => cell.pairId === pairId)?.[0] as CellId | undefined;
}

function getDragType(event: DragStartEvent | DragOverEvent | DragEndEvent): DragType | null {
  const dragType = event.active.data.current?.type;

  return dragType === "pair" || dragType === "stream" ? dragType : null;
}

function getStreamRowFromDragEvent(event: DragStartEvent | DragEndEvent) {
  const row = event.active.data.current?.row;

  return typeof row === "number" ? row : null;
}

function getStreamRowFromOverEvent(event: DragEndEvent | DragOverEvent) {
  const overData = event.over?.data.current;

  return overData?.type === "stream-row" && typeof overData.row === "number" ? overData.row : null;
}

function getEditSession(board: BoardState, target: EditTarget): EditSession | null {
  if (target.type === "deck-title") {
    return { inputKind: "long-text", label: "Deck title", target, value: board.deckTitle };
  }

  if (target.type === "stream-name") {
    return {
      helperText: "Short label. One word works best.",
      inputKind: "short-text",
      label: "Stream name",
      target,
      value: board.streamNamesByRow[target.row] ?? "",
    };
  }

  if (target.type === "card-title") {
    const column = board.columns.find((candidate) => candidate.id === target.columnId);

    if (!column) {
      return null;
    }

    return {
      helperText: "Short card title. Aim for 1-4 words.",
      inputKind: "long-text",
      label: "Card title",
      target,
      value: column.cardTitle ?? "",
    };
  }

  if (target.type === "card-label") {
    const column = board.columns.find((candidate) => candidate.id === target.columnId);

    if (!column) {
      return null;
    }

    return {
      helperText: "Short label, e.g. Week 1",
      inputKind: "short-text",
      label: "Card label",
      target,
      value: column.cardLabel ?? "",
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
      target,
      value: pair.stepText ?? "",
    };
  }

  return null;
}

function getDateEditSession(board: BoardState, target: DateEditTarget): DateEditSession | null {
  const column = board.columns.find((candidate) => candidate.id === target.columnId);

  if (!column) {
    return null;
  }

  return { label: "Target date", target, value: column.targetDate ?? "" };
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

  return `${target.type}:${target.columnId}`;
}

function CreatorEditModal({
  canDeleteCard = false,
  onClose,
  onDeleteCard,
  onSave,
  session,
}: {
  canDeleteCard?: boolean;
  onClose: () => void;
  onDeleteCard?: () => void;
  onSave: (value: string, descriptionContent?: StepDescriptionSpan[]) => void;
  session: EditSession;
}) {
  const [draftValue, setDraftValue] = useState(session.value);
  const [linkRanges, setLinkRanges] = useState<StepLinkRange[]>(() =>
    getLinkRangesFromDescriptionContent(session.descriptionContent, session.value)
  );
  const [pendingLink, setPendingLink] = useState<PendingStepLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isLongText = session.inputKind === "long-text";
  const isCardTitle = session.target.type === "card-title";
  const isStepText = session.target.type === "pair-step";
  const modalClassName = `creator-modal creator-modal--${session.target.type}`;
  const fieldClassName = [
    "creator-modal-field",
    session.target.type === "pair-step" ? "creator-modal-field--step" : undefined,
    session.target.type === "card-title" ? "creator-modal-field--card-title" : undefined,
    session.target.type === "deck-title" ? "creator-modal-field--deck-title" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const showStepCounter = session.target.type === "pair-step";
  const maxLength = session.target.type === "card-label" ? CARD_LABEL_MAX_LENGTH : undefined;
  const isStepWarningVisible = showStepCounter && draftValue.length > STEP_TEXT_WARNING_LENGTH;

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
    onSave(draftValue, isStepText ? buildStepDescriptionContent(draftValue, linkRanges) : undefined);
  }

  return (
    <div className="creator-modal-backdrop" role="presentation">
      <form className={modalClassName} onSubmit={handleSubmit}>
        <header className="creator-modal-header">
          <p>{session.label}</p>
          <button className="creator-modal-close" onClick={onClose} type="button">
            Close
          </button>
        </header>
        {session.helperText ? <p className="creator-modal-note">{session.helperText}</p> : null}
        {isLongText ? (
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
            maxLength={maxLength}
            onChange={(event) => handleDraftValueChange(event.target.value)}
            type="text"
            value={draftValue}
          />
        )}
        {session.target.type === "card-label" ? <p className="creator-modal-counter">{draftValue.length}/{CARD_LABEL_MAX_LENGTH} characters</p> : null}
        {showStepCounter ? (
          <p className={`creator-modal-counter${isStepWarningVisible ? " creator-modal-counter--warning" : ""}`}>
            {isStepWarningVisible ? `${draftValue.length} characters - this may truncate on the card.` : `${draftValue.length} characters`}
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
  pair,
  isDragging = false,
  onCancelMediaUpload,
  onEdit,
  onUploadMedia,
}: {
  isMediaUploading?: boolean;
  pair: Pair;
  isDragging?: boolean;
  onCancelMediaUpload: (pairId: PairId) => void;
  onEdit: (target: EditTarget) => void;
  onUploadMedia: (pairId: PairId, file: File) => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: pair.id,
    data: { type: "pair" },
    disabled: isPairEmpty(pair),
  });
  const isEmptyPair = isPairEmpty(pair);
  const stepClassName = `creator-editable creator-pair-step${isStepEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;
  const mediaClassName = `creator-pair-media${isStepMediaEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;
  const handleClassName = `creator-drag-handle${isEmptyPair ? " creator-drag-handle--disabled" : ""}`;

  return (
    <div className={`creator-pair${isDragging ? " creator-pair--dragging" : ""}`} ref={setNodeRef}>
      <button className={stepClassName} onClick={() => onEdit({ type: "pair-step", pairId: pair.id })} type="button">
        {getStepDisplayText(pair)}
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
      <div className={stepClassName}>{getStepDisplayText(pair)}</div>
      <div className="creator-pair-handle-row">
        <span className="creator-drag-handle creator-drag-handle--preview" aria-hidden="true">
          <DragHandleMark />
        </span>
      </div>
      <div className={mediaClassName}>{getStepMediaDisplayText(pair)}</div>
    </div>
  );
}

function StreamRow({
  streamName,
  isDragging = false,
  onEdit,
  row,
}: {
  streamName?: string;
  isDragging?: boolean;
  onEdit: (target: EditTarget) => void;
  row: number;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `stream:${row}`,
    data: { type: "stream", row },
  });

  return (
    <div className={`creator-stream-row${isDragging ? " creator-stream-row--dragging" : ""}`} ref={setNodeRef}>
      <button
        aria-label="Long press to reorder stream"
        className="creator-stream-drag-handle"
        data-creator-stream-drag-handle
        data-creator-drag-handle
        type="button"
        {...listeners}
        {...attributes}
      >
        <DragHandleMark rows={3} variant="stream" />
      </button>
      <button className="creator-editable creator-stream-name" onClick={() => onEdit({ type: "stream-name", row })} type="button">
        {streamName}
      </button>
    </div>
  );
}

function StreamRowPreview({ streamName }: { streamName?: string }) {
  return (
    <div className="creator-stream-drag-preview">
      <DragHandleMark rows={3} variant="stream" />
      <span>{streamName}</span>
    </div>
  );
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
  activeStreamRow,
  activeStreamOverRow,
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
  activeStreamRow: number | null;
  activeStreamOverRow: number | null;
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
    data: cell.kind === "locked" ? { type: "stream-row", row } : { type: "cell", accepts: "pair" },
  });
  const isOccupied = Boolean(cell.pairId);
  const isLocked = cell.kind === "locked";
  const canDropActivePair = Boolean(isOver && activePairId && pair && pair.id !== activePairId && isPairEmpty(pair));
  const isEmptyPanSurface = cell.kind === "empty" && !cell.pairId;
  const isStreamRowDragging = activeStreamRow === row;
  const isStreamRowTarget = activeStreamOverRow === row && activeStreamOverRow !== activeStreamRow;

  return (
    <div
      className={`creator-cell${isOccupied ? " creator-cell--occupied" : ""}${isLocked ? " creator-cell--locked" : ""}${canDropActivePair ? " creator-cell--can-drop" : ""}${isStreamRowDragging ? " creator-cell--stream-row-dragging" : ""}${isStreamRowTarget ? " creator-cell--stream-row-target" : ""}`}
      data-creator-pan-surface={isEmptyPanSurface ? true : undefined}
      ref={setNodeRef}
    >
      {/* Cells currently support empty, pair, and locked states. Stream cells are locked until row dragging exists. */}
      {pair ? (
        <PairBlock
          pair={pair}
          isDragging={pair.id === activePairId}
          isMediaUploading={uploadingMediaPairIds.has(pair.id)}
          onCancelMediaUpload={onCancelMediaUpload}
          onEdit={onEdit}
          onUploadMedia={onUploadMedia}
        />
      ) : isLocked ? (
        <StreamRow streamName={streamName} isDragging={activeStreamRow === row} onEdit={onEdit} row={row} />
      ) : (
        <span className="creator-empty">empty</span>
      )}
    </div>
  );
}

type CreatorDragLabProps = {
  canPreviewOutput: boolean;
  creatorReturnTarget?: {
    label: "Deck" | "Decks";
    href: string;
  };
  initialBoard: BoardState;
  initialPublishedBoard?: BoardState;
  mode: "edit" | "new";
};

export default function CreatorDragLab({ canPreviewOutput, creatorReturnTarget, initialBoard, initialPublishedBoard, mode }: CreatorDragLabProps) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardState>(() => initialBoard);
  console.log("CreatorDragLab board", board);
  const [publishedTemplateSnapshot, setPublishedTemplateSnapshot] = useState(() => createTemplateSnapshot(initialPublishedBoard ?? initialBoard));
  const [hasPublishedBaseline, setHasPublishedBaseline] = useState(mode === "edit");
  const [activePairId, setActivePairId] = useState<PairId | null>(null);
  const [activeStreamRow, setActiveStreamRow] = useState<number | null>(null);
  const [activeStreamOverRow, setActiveStreamOverRow] = useState<number | null>(null);
  const [editSession, setEditSession] = useState<EditSession | null>(null);
  const [dateEditSession, setDateEditSession] = useState<DateEditSession | null>(null);
  const [deckDataPendingTemplateId, setDeckDataPendingTemplateId] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState("");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [uploadingMediaPairIds, setUploadingMediaPairIds] = useState<ReadonlySet<PairId>>(() => new Set());
  const [uploadingIntroMediaColumnIds, setUploadingIntroMediaColumnIds] = useState<ReadonlySet<ColumnId>>(() => new Set());
  const boardRef = useRef<BoardState>(initialBoard);
  const pairUploadSessionsRef = useRef<Map<PairId, UploadSession>>(new Map());
  const introUploadSessionsRef = useRef<Map<ColumnId, UploadSession>>(new Map());
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
  const activeStreamName = activeStreamRow === null ? null : board.streamNamesByRow[activeStreamRow] ?? null;
  const canDeleteActiveCard = editSession?.target.type === "card-title" && getCardColumns(board.columns).length > 1;
  const resolvedCreatorReturnTarget = creatorReturnTarget ?? { label: "Decks" as const, href: "/decks" };
  const currentTemplateSnapshot = useMemo(() => createTemplateSnapshot(board), [board]);
  const hasUnpublishedChanges = currentTemplateSnapshot !== publishedTemplateSnapshot;
  const hasMediaUploadInFlight = uploadingMediaPairIds.size > 0 || uploadingIntroMediaColumnIds.size > 0;
  const isPublishedState = publishStatus !== "publishing" && !hasUnpublishedChanges && hasPublishedBaseline;
  const shouldShowLeaveConfirm = isLeaveConfirmOpen && hasUnpublishedChanges;
  const publishButtonLabel =
    publishStatus === "publishing" ? "Publishing…" : hasMediaUploadInFlight ? "Uploading…" : hasUnpublishedChanges || !hasPublishedBaseline ? "Publish" : "Published";

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    const pairUploadSessions = pairUploadSessionsRef.current;
    const introUploadSessions = introUploadSessionsRef.current;

    return () => {
      for (const session of pairUploadSessions.values()) {
        session.controller.abort();
      }
      for (const session of introUploadSessions.values()) {
        session.controller.abort();
      }
      pairUploadSessions.clear();
      introUploadSessions.clear();
    };
  }, []);

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
    console.log("Creator DeckTemplate preview", creatorBoardToDeckTemplate(board));
  }

  async function persistSavedDraft(nextBoard: BoardState) {
    if (mode !== "edit") {
      return nextBoard;
    }

    const sourceDeckTemplateId = nextBoard.deckTemplateId;
    const template = creatorBoardToDeckTemplate(nextBoard);

    try {
      const responseBody = await saveCreatorDeckTemplateDraft({
        deckTemplateId: sourceDeckTemplateId,
        template,
      });
      const savedDeckTemplateId = responseBody.deckTemplateId?.trim();

      if (savedDeckTemplateId && savedDeckTemplateId !== sourceDeckTemplateId) {
        const copiedBoard = {
          ...nextBoard,
          deckTemplateId: savedDeckTemplateId,
        };

        boardRef.current = copiedBoard;
        setBoard(copiedBoard);
        router.replace(`/creator/edit/${encodeURIComponent(savedDeckTemplateId)}`);

        setPublishStatus("idle");
        setPublishMessage("");

        return copiedBoard;
      }

      setPublishStatus("idle");
      setPublishMessage("");

      return nextBoard;
    } catch {
      setPublishStatus("error");
      setPublishMessage(SUPPORT_ERROR_MESSAGE);

      return null;
    }
  }

  function updateBoardAndSaveDraft(createNextBoard: (currentBoard: BoardState) => BoardState) {
    const nextBoard = createNextBoard(boardRef.current);

    boardRef.current = nextBoard;
    setBoard(nextBoard);
    void persistSavedDraft(nextBoard);
  }

  function updateBoardLocally(createNextBoard: (currentBoard: BoardState) => BoardState) {
    const nextBoard = createNextBoard(boardRef.current);

    boardRef.current = nextBoard;
    setBoard(nextBoard);
  }

  function navigateToReturnTarget() {
    router.push(resolvedCreatorReturnTarget.href);
  }

  function handleReturnClick(event: MouseEvent<HTMLAnchorElement>) {
    if (publishStatus === "publishing") {
      event.preventDefault();
      return;
    }

    if (!hasUnpublishedChanges) {
      setIsLeaveConfirmOpen(false);
      return;
    }

    event.preventDefault();
    setIsLeaveConfirmOpen(true);
  }

  async function publishTemplate() {
    if (publishStatus === "publishing" || hasMediaUploadInFlight) {
      return false;
    }

    setPublishStatus("publishing");
    setPublishMessage("");

    try {
      if (mode === "edit") {
        const savedBoard = await persistSavedDraft(boardRef.current);

        if (!savedBoard) {
          return false;
        }

        await publishSavedCreatorDeckTemplate(savedBoard.deckTemplateId);

        setPublishedTemplateSnapshot(createTemplateSnapshot(savedBoard));
        setHasPublishedBaseline(true);
        setPublishStatus("success");
        setPublishMessage("");

        return true;
      }

      const nextDeckTemplateId = deckDataPendingTemplateId ?? board.deckTemplateId;
      const template = {
        ...creatorBoardToDeckTemplate(boardRef.current),
        deckTemplateId: nextDeckTemplateId,
      };
      const nextPublishedTemplateSnapshot = JSON.stringify(template);
      const hasCreatedTemplateAwaitingDeckData = deckDataPendingTemplateId === nextDeckTemplateId;

      await publishCreatorDeckTemplate({
        deckTemplateId: nextDeckTemplateId,
        method: hasCreatedTemplateAwaitingDeckData ? "PATCH" : "POST",
        template,
      });

      setDeckDataPendingTemplateId(nextDeckTemplateId);

      await initializeCreatorDeckData(nextDeckTemplateId);
      setDeckDataPendingTemplateId(null);

      setPublishedTemplateSnapshot(nextPublishedTemplateSnapshot);
      setHasPublishedBaseline(true);

      setPublishStatus("success");
      setPublishMessage("");

      const publishedBoard = {
        ...boardRef.current,
        deckTemplateId: nextDeckTemplateId,
      };

      boardRef.current = publishedBoard;
      setBoard(publishedBoard);
      router.replace(`/creator/edit/${encodeURIComponent(nextDeckTemplateId)}`);

      return true;
    } catch {
      setPublishStatus("error");
      setPublishMessage(SUPPORT_ERROR_MESSAGE);

      return false;
    }
  }

  async function publishBeforeLeaving() {
    const didPublish = await publishTemplate();

    if (!didPublish) {
      return;
    }

    setIsLeaveConfirmOpen(false);
    navigateToReturnTarget();
  }

  function leaveWithoutPublishing() {
    setIsLeaveConfirmOpen(false);
    navigateToReturnTarget();
  }

  function handleDragStart(event: DragStartEvent) {
    if (panStateRef.current && scrollShellRef.current) {
      resetPanState(scrollShellRef.current, panStateRef.current.pointerId);
    }
    const dragType = getDragType(event);

    if (dragType === "stream") {
      setActivePairId(null);
      setActiveStreamRow(getStreamRowFromDragEvent(event));
      setActiveStreamOverRow(null);
      return;
    }

    setActiveStreamRow(null);
    setActiveStreamOverRow(null);
    const pairId = String(event.active.id);
    const activePairCandidate = board.pairs[pairId];

    setActivePairId(activePairCandidate && !isPairEmpty(activePairCandidate) ? pairId : null);
  }

  function handleDragOver(event: DragOverEvent) {
    if (getDragType(event) !== "stream") {
      return;
    }

    setActiveStreamOverRow(getStreamRowFromOverEvent(event));
  }

  function handleDragEnd(event: DragEndEvent) {
    const dragType = getDragType(event);

    setActivePairId(null);
    setActiveStreamRow(null);
    setActiveStreamOverRow(null);

    if (dragType === "stream") {
      const fromRow = getStreamRowFromDragEvent(event);
      const toRow = getStreamRowFromOverEvent(event);

      if (fromRow === null || toRow === null || fromRow === toRow) {
        return;
      }

      updateBoardLocally((currentBoard) => swapCreatorBoardRows(currentBoard, fromRow, toRow));
      return;
    }

    const pairId = String(event.active.id);
    const targetCellId = event.over?.id ? String(event.over.id) as CellId : null;

    if (!targetCellId) {
      return;
    }

    updateBoardLocally((currentBoard) => {
      const originCellId = findPairCell(currentBoard.cells, pairId);
      const targetCell = currentBoard.cells[targetCellId];
      const sourcePair = currentBoard.pairs[pairId];
      const targetPairId = targetCell?.pairId;
      const targetPair = targetPairId ? currentBoard.pairs[targetPairId] : undefined;

      if (!originCellId || originCellId === targetCellId || !sourcePair || isPairEmpty(sourcePair) || !targetPair || !isPairEmpty(targetPair)) {
        return currentBoard;
      }

      return {
        ...currentBoard,
        pairs: {
          ...currentBoard.pairs,
          [pairId]: {
            ...targetPair,
            id: pairId,
          },
          [targetPair.id]: {
            ...sourcePair,
            id: targetPair.id,
          },
        },
      };
    });
  }

  function handleDragCancel() {
    setActivePairId(null);
    setActiveStreamRow(null);
    setActiveStreamOverRow(null);
  }

  function addCard() {
    updateBoardLocally((currentBoard) => appendCreatorCard(currentBoard));
  }

  function deleteActiveCard() {
    if (!editSession || editSession.target.type !== "card-title") {
      return;
    }

    const columnId = editSession.target.columnId;

    updateBoardLocally((currentBoard) => deleteCreatorCard(currentBoard, columnId));
    setEditSession(null);
  }

  function openEdit(target: EditTarget) {
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

  function saveEdit(value: string, descriptionContent?: StepDescriptionSpan[]) {
    if (!editSession) {
      return;
    }

    const target = editSession.target;

    updateBoardAndSaveDraft((currentBoard) => {
      if (target.type === "deck-title") {
        return { ...currentBoard, deckTitle: value };
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
          columns: currentBoard.columns.map((column) => (column.id === target.columnId ? { ...column, cardTitle: resolveCreatorCardTitle(column, value) } : column)),
        };
      }

      if (target.type === "card-label") {
        return {
          ...currentBoard,
          columns: currentBoard.columns.map((column) =>
            column.id === target.columnId ? { ...column, cardLabel: resolveCreatorCardLabel(column.id, value).slice(0, CARD_LABEL_MAX_LENGTH) } : column
          ),
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

  function clearIntroUploadState(columnId: ColumnId) {
    setUploadingIntroMediaColumnIds((currentColumnIds) => {
      if (!currentColumnIds.has(columnId)) {
        return currentColumnIds;
      }

      const nextColumnIds = new Set(currentColumnIds);
      nextColumnIds.delete(columnId);
      return nextColumnIds;
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

  function createIntroUploadSession(columnId: ColumnId) {
    introUploadSessionsRef.current.get(columnId)?.controller.abort();

    const session: UploadSession = {
      controller: new AbortController(),
      token: Symbol(columnId),
    };

    introUploadSessionsRef.current.set(columnId, session);
    setUploadingIntroMediaColumnIds((currentColumnIds) => {
      const nextColumnIds = new Set(currentColumnIds);
      nextColumnIds.add(columnId);
      return nextColumnIds;
    });

    return session;
  }

  function isActivePairUpload(pairId: PairId, session: UploadSession) {
    return pairUploadSessionsRef.current.get(pairId)?.token === session.token && !session.controller.signal.aborted;
  }

  function isActiveIntroUpload(columnId: ColumnId, session: UploadSession) {
    return introUploadSessionsRef.current.get(columnId)?.token === session.token && !session.controller.signal.aborted;
  }

  function finishPairUpload(pairId: PairId, session: UploadSession) {
    if (pairUploadSessionsRef.current.get(pairId)?.token !== session.token) {
      return;
    }

    pairUploadSessionsRef.current.delete(pairId);
    clearPairUploadState(pairId);
  }

  function finishIntroUpload(columnId: ColumnId, session: UploadSession) {
    if (introUploadSessionsRef.current.get(columnId)?.token !== session.token) {
      return;
    }

    introUploadSessionsRef.current.delete(columnId);
    clearIntroUploadState(columnId);
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

  function cancelIntroMediaUpload(columnId: ColumnId) {
    const session = introUploadSessionsRef.current.get(columnId);

    if (!session) {
      return;
    }

    session.controller.abort();
    introUploadSessionsRef.current.delete(columnId);
    clearIntroUploadState(columnId);
  }

  async function uploadPairMedia(pairId: PairId, file: File) {
    if (file.type && !file.type.startsWith("video/")) {
      setPublishStatus("error");
      setPublishMessage("Choose a video file.");
      return;
    }

    const uploadSession = createPairUploadSession(pairId);

    setPublishMessage("");
    setPublishStatus("idle");

    try {
      const mediaItem = await uploadCreatorVideo(file, uploadSession.controller.signal);

      if (!isActivePairUpload(pairId, uploadSession)) {
        return;
      }

      finishPairUpload(pairId, uploadSession);

      const nextBoard = (() => {
        const currentBoard = boardRef.current;
        const pair = currentBoard.pairs[pairId];

        if (!pair) {
          return currentBoard;
        }

        return {
          ...currentBoard,
          pairs: {
            ...currentBoard.pairs,
            [pairId]: {
              ...pair,
              stepMediaItem: mediaItem,
            },
          },
        };
      })();

      boardRef.current = nextBoard;
      setBoard(nextBoard);
      await persistSavedDraft(nextBoard);
    } catch (error) {
      if (uploadSession.controller.signal.aborted || isAbortError(error)) {
        return;
      }

      setPublishStatus("error");
      setPublishMessage(SUPPORT_ERROR_MESSAGE);
    } finally {
      finishPairUpload(pairId, uploadSession);
    }
  }

  async function uploadIntroMedia(columnId: ColumnId, file: File) {
    if (file.type && !file.type.startsWith("video/")) {
      setPublishStatus("error");
      setPublishMessage("Choose a video file.");
      return;
    }

    const uploadSession = createIntroUploadSession(columnId);

    setPublishMessage("");
    setPublishStatus("idle");

    try {
      const mediaItem = await uploadCreatorVideo(file, uploadSession.controller.signal);

      if (!isActiveIntroUpload(columnId, uploadSession)) {
        return;
      }

      finishIntroUpload(columnId, uploadSession);

      const currentBoard = boardRef.current;
      const nextBoard = {
        ...currentBoard,
        columns: currentBoard.columns.map((column) =>
          column.id === columnId && column.kind === "card"
            ? {
                ...column,
                introMediaItem: mediaItem,
              }
            : column
        ),
      };

      boardRef.current = nextBoard;
      setBoard(nextBoard);
      await persistSavedDraft(nextBoard);
    } catch (error) {
      if (uploadSession.controller.signal.aborted || isAbortError(error)) {
        return;
      }

      setPublishStatus("error");
      setPublishMessage(SUPPORT_ERROR_MESSAGE);
    } finally {
      finishIntroUpload(columnId, uploadSession);
    }
  }

  function saveDateEdit(value: string) {
    if (!dateEditSession || !isIsoDateOnlyString(value)) {
      return;
    }

    const target = dateEditSession.target;

    updateBoardAndSaveDraft((currentBoard) => ({
      ...currentBoard,
      columns: currentBoard.columns.map((column) => (column.id === target.columnId ? { ...column, targetDate: value } : column)),
    }));
    setDateEditSession(null);
  }

  function handlePanPointerDown(event: PointerEvent<HTMLElement>) {
    if (activePairId || activeStreamRow !== null || event.button !== 0) {
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
    <main className="creator-lab" style={creatorGeometryStyle}>
      <AppUtilityNav className="app-utility-nav app-utility-nav--creator" />
      <header className="creator-header">
        <div>
          <p className="creator-kicker">{mode === "edit" ? "Edit Template" : "Create New Deck"}</p>
          <button className="creator-editable creator-deck-title" onClick={() => openEdit({ type: "deck-title" })} type="button">
            {board.deckTitle}
          </button>
          <p className="creator-edit-hint">Tap text to edit</p>
        </div>
        <div className="creator-header-actions">
          {canPreviewOutput ? (
            <button className="creator-preview-output-button" onClick={previewTemplateOutput} type="button">
              Preview
            </button>
          ) : null}
          <button
            className={`creator-save-button${isPublishedState ? " creator-save-button--published" : ""}`}
            disabled={publishStatus === "publishing" || hasMediaUploadInFlight}
            onClick={() => void publishTemplate()}
            type="button"
          >
            {publishButtonLabel}
          </button>
          {publishMessage ? (
            publishStatus === "error" && publishMessage === SUPPORT_ERROR_MESSAGE ? (
              <SupportErrorMessage className={`creator-save-message creator-save-message--${publishStatus}`} />
            ) : (
              <p className={`creator-save-message creator-save-message--${publishStatus}`}>{publishMessage}</p>
            )
          ) : null}
          <Link className="creator-back-link" href={resolvedCreatorReturnTarget.href} onClick={handleReturnClick}>
            {resolvedCreatorReturnTarget.label}
          </Link>
          {shouldShowLeaveConfirm ? (
            <div className="creator-leave-confirm" role="dialog" aria-label="Leave Creator confirmation">
              <p className="creator-leave-confirm-title">Leave Creator?</p>
              <p className="creator-leave-confirm-body">Your changes are saved as a draft. They will not appear in the live deck until you publish.</p>
              <div className="creator-leave-confirm-actions">
                <button className="creator-leave-confirm-cancel" onClick={() => setIsLeaveConfirmOpen(false)} type="button">
                  Stay
                </button>
                <button className="creator-leave-confirm-leave" onClick={leaveWithoutPublishing} type="button">
                  Leave without publishing
                </button>
                <button className="creator-leave-confirm-save" disabled={publishStatus === "publishing"} onClick={() => void publishBeforeLeaving()} type="button">
                  {publishStatus === "publishing" ? "Publishing…" : "Publish and leave"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <DndContext
        id="creator-dnd-context"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <section
          className="creator-scroll-shell"
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
              {board.columns.map((column) => (
                <section className="creator-column" key={column.id} aria-label={column.label}>
                  <header className="creator-card-header">
                    {column.kind === "card" ? (
                      <>
                        <div className="creator-card-meta-row">
                          <button className="creator-editable creator-card-label-button" onClick={() => openEdit({ type: "card-label", columnId: column.id })} type="button">
                            {column.cardLabel}
                          </button>
                          <button className="creator-editable creator-card-date-button" onClick={() => openDateEdit({ type: "target-date", columnId: column.id })} type="button">
                            {formatCreatorDateDisplay(column.targetDate ?? "")}
                          </button>
                        </div>
                        <button className="creator-editable creator-card-title-button" onClick={() => openEdit({ type: "card-title", columnId: column.id })} type="button">
                          {column.cardTitle}
                        </button>
                        <CreatorMediaUploadSlot
                          ariaLabel={`Upload intro video for ${column.cardTitle ?? column.cardLabel ?? "card"}`}
                          className="creator-card-intro-media-slot"
                          isUploading={uploadingIntroMediaColumnIds.has(column.id)}
                          mediaItem={column.introMediaItem ?? null}
                          onCancelUpload={() => cancelIntroMediaUpload(column.id)}
                          onUpload={(file) => void uploadIntroMedia(column.id, file)}
                          placeholder="Upload video"
                          size="intro"
                        />
                      </>
                    ) : (
                      <span className="creator-stream-header">Streams</span>
                    )}
                  </header>
                  <div className="creator-column-cells">
                    {board.rows.map((row) => {
                      const cellId = getCreatorCellId(column.id, row);

                      return (
                        <BoardCell
                          activePairId={activePairId}
                          activeStreamRow={activeStreamRow}
                          activeStreamOverRow={activeStreamOverRow}
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
              ))}
              <AddCardControl onAddCard={addCard} />
          </div>
            {/* Dedicated pan gutter for mobile thumbs. It shares the scroll shell's pointer-pan handlers and is not a drop target. */}
            <div className="creator-pan-gutter" data-creator-pan-gutter aria-hidden="true" />
          </div>
        </section>

        <DragOverlay>
          {activePair && activeOriginCellId ? <PairPreview pair={activePair} /> : null}
          {activeStreamRow !== null ? <StreamRowPreview streamName={activeStreamName ?? undefined} /> : null}
        </DragOverlay>
      </DndContext>
      {editSession ? (
        <CreatorEditModal
          canDeleteCard={canDeleteActiveCard}
          key={getEditTargetKey(editSession.target)}
          session={editSession}
          onClose={() => setEditSession(null)}
          onDeleteCard={editSession.target.type === "card-title" ? deleteActiveCard : undefined}
          onSave={saveEdit}
        />
      ) : null}
      {dateEditSession ? <CreatorDateEditModal session={dateEditSession} onClose={() => setDateEditSession(null)} onSave={saveDateEdit} /> : null}
    </main>
  );
}
