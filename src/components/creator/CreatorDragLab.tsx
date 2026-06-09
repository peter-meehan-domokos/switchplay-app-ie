"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
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
  createCreatorDeckTemplateId,
  createEmptySignal,
  creatorBoardToDeckTemplate,
  deleteCreatorCard,
  getCardColumns,
  getCreatorCellId,
  getSignalDisplayText,
  getStepDisplayText,
  isPairEmpty,
  isSignalEmpty,
  isStepEmpty,
  resolveCreatorCardLabel,
  resolveCreatorCardTitle,
  resolveCreatorChannelName,
  swapCreatorBoardRows,
  type BoardState,
  type CellId,
  type CellState,
  type ColumnId,
  type Pair,
  type PairId,
  type SignalMaxSymbol,
  type SignalMinSymbol,
} from "@/components/creator/creatorBoardState";
import { CREATOR_GEOMETRY, getCreatorGeometryStyle } from "@/components/creator/creatorDragLabGeometry";
import type { DeckTemplate, SignalOrder } from "@/components/decks/types";

type EditTarget =
  | { type: "deck-title" }
  | { type: "channel-name"; row: number }
  | { type: "card-label"; columnId: ColumnId }
  | { type: "card-title"; columnId: ColumnId }
  | { type: "pair-step"; pairId: PairId };

type EditSession = {
  helperText?: string;
  inputKind: "long-text" | "short-text";
  label: string;
  target: EditTarget;
  value: string;
};

type DateEditTarget = { type: "target-date"; columnId: ColumnId };

type DateEditSession = {
  label: string;
  target: DateEditTarget;
  value: string;
};

type SignalEditTarget = { type: "pair-signal"; pairId: PairId };

type SignalEditSession = {
  target: SignalEditTarget;
  signalMax: number | null;
  signalMaxSymbol: SignalMaxSymbol;
  signalMin: number | null;
  signalMinSymbol: SignalMinSymbol;
  signalOrder: SignalOrder;
  signalTitle: string | null;
};

type SignalEditValue = Omit<SignalEditSession, "target">;
type DragType = "channel" | "pair";
type CreatorSelectOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type SaveStatus = "idle" | "saving" | "success" | "error";

const creatorGeometryStyle = getCreatorGeometryStyle();
const STEP_TEXT_WARNING_LENGTH = 70;
const CARD_LABEL_MAX_LENGTH = 8;
const creatorSignalMinSymbolOptions: CreatorSelectOption<SignalMinSymbol>[] = [
  { label: "exact", value: "none" },
  { label: "≤", value: "<" },
];
const creatorSignalMaxSymbolOptions: CreatorSelectOption<SignalMaxSymbol>[] = [
  { label: "exact", value: "none" },
  { label: "+", value: "+" },
];
const creatorSignalOrderOptions: CreatorSelectOption<SignalOrder>[] = [
  { label: "High scores are better", value: "increasing" },
  { label: "Low scores are better", value: "decreasing" },
];

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

function getSaveErrorMessage(errorBody: unknown, fallback: string) {
  if (typeof errorBody === "object" && errorBody !== null && "error" in errorBody && typeof errorBody.error === "string") {
    return errorBody.error;
  }

  return fallback;
}

async function saveCreatorDeckTemplate({
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
    throw new Error(getSaveErrorMessage(responseBody, "Unable to save template."));
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
    throw new Error(`Template saved, but deck data could not be initialized: ${getSaveErrorMessage(responseBody, "Unable to initialize deck data.")}`);
  }

  return responseBody;
}

async function reconcileCreatorDeckData({
  oldDeckTemplateId,
  newDeckTemplateId,
}: {
  oldDeckTemplateId: string;
  newDeckTemplateId: string;
}) {
  const response = await fetch("/api/decks-data/reconcile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ oldDeckTemplateId, newDeckTemplateId }),
  });
  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Template saved, but deck data reconciliation failed: ${getSaveErrorMessage(responseBody, "Unable to reconcile deck data.")}`);
  }

  return responseBody;
}

function findPairCell(cells: BoardState["cells"], pairId: PairId) {
  return Object.entries(cells).find(([, cell]) => cell.pairId === pairId)?.[0] as CellId | undefined;
}

function getDragType(event: DragStartEvent | DragOverEvent | DragEndEvent): DragType | null {
  const dragType = event.active.data.current?.type;

  return dragType === "pair" || dragType === "channel" ? dragType : null;
}

function getChannelRowFromDragEvent(event: DragStartEvent | DragEndEvent) {
  const row = event.active.data.current?.row;

  return typeof row === "number" ? row : null;
}

function getChannelRowFromOverEvent(event: DragEndEvent | DragOverEvent) {
  const overData = event.over?.data.current;

  return overData?.type === "channel-row" && typeof overData.row === "number" ? overData.row : null;
}

function getEditSession(board: BoardState, target: EditTarget): EditSession | null {
  if (target.type === "deck-title") {
    return { inputKind: "long-text", label: "Deck title", target, value: board.deckTitle };
  }

  if (target.type === "channel-name") {
    return {
      helperText: "Short label. One word works best.",
      inputKind: "short-text",
      label: "Channel name",
      target,
      value: board.channelNamesByRow[target.row] ?? "",
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

function getSignalEditSession(board: BoardState, target: SignalEditTarget): SignalEditSession | null {
  const pair = board.pairs[target.pairId];

  if (!pair) {
    return null;
  }

  return {
    target,
    signalMax: pair.signalMax,
    signalMaxSymbol: pair.signalMaxSymbol,
    signalMin: pair.signalMin,
    signalMinSymbol: pair.signalMinSymbol,
    signalOrder: pair.signalOrder,
    signalTitle: pair.signalTitle,
  };
}

function getEditTargetKey(target: EditTarget) {
  if (target.type === "deck-title") {
    return target.type;
  }

  if (target.type === "channel-name") {
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
  onSave: (value: string) => void;
  session: EditSession;
}) {
  const [draftValue, setDraftValue] = useState(session.value);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const isLongText = session.inputKind === "long-text";
  const isCardTitle = session.target.type === "card-title";
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(draftValue);
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
          <textarea autoFocus className={fieldClassName} onChange={(event) => setDraftValue(event.target.value)} value={draftValue} />
        ) : (
          <input
            autoFocus
            className="creator-modal-text-input"
            maxLength={maxLength}
            onChange={(event) => setDraftValue(event.target.value)}
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
                <p className="creator-modal-delete-note">This will remove this card and steps/signals inside it.</p>
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

function CreatorSelect<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: TValue) => void;
  options: CreatorSelectOption<TValue>[];
  value: TValue;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<"above" | "below">("below");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  function updatePlacement() {
    const triggerRect = rootRef.current?.getBoundingClientRect();

    if (!triggerRect) {
      return;
    }

    const estimatedMenuHeight = Math.min(options.length, 6) * 44 + 8;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    setPlacement(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? "above" : "below");
  }

  function openSelect() {
    updatePlacement();
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePlacement();

    window.addEventListener("resize", updatePlacement);
    window.addEventListener("orientationchange", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("orientationchange", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isOpen, options.length]);

  return (
    <div
      className="creator-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
      ref={rootRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="creator-modal-select"
        onClick={() => (isOpen ? setIsOpen(false) : openSelect())}
        type="button"
      >
        <span>{selectedOption?.label ?? label}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {isOpen ? (
        <div className={`creator-select-menu creator-select-menu--${placement}`} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className="creator-select-option"
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CreatorSignalEditModal({
  session,
  onClose,
  onSave,
}: {
  session: SignalEditSession;
  onClose: () => void;
  onSave: (value: SignalEditValue) => void;
}) {
  const [signalTitle, setSignalTitle] = useState(session.signalTitle);
  const [signalMin, setSignalMin] = useState(session.signalMin === null ? "" : String(session.signalMin));
  const [signalMax, setSignalMax] = useState(session.signalMax === null ? "" : String(session.signalMax));
  const [signalMinSymbol, setSignalMinSymbol] = useState<SignalMinSymbol>(session.signalMinSymbol);
  const [signalMaxSymbol, setSignalMaxSymbol] = useState<SignalMaxSymbol>(session.signalMaxSymbol);
  const [signalOrder, setSignalOrder] = useState<SignalOrder>(session.signalOrder);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const parsedMin = signalMin.trim() === "" ? null : Number(signalMin);
  const parsedMax = signalMax.trim() === "" ? null : Number(signalMax);
  const hasInvalidNumber = (signalMin.trim() !== "" && Number.isNaN(parsedMin)) || (signalMax.trim() !== "" && Number.isNaN(parsedMax));
  const hasInvertedRange = parsedMin !== null && parsedMax !== null && !Number.isNaN(parsedMin) && !Number.isNaN(parsedMax) && parsedMax < parsedMin;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (hasInvalidNumber) {
      setErrorMessage("Min and max must be numbers.");
      return;
    }

    onSave({
      signalMax: parsedMax,
      signalMaxSymbol,
      signalMin: parsedMin,
      signalMinSymbol,
      signalOrder,
      signalTitle: signalTitle ?? "",
    });
  }

  return (
    <div className="creator-modal-backdrop" role="presentation">
      <form className="creator-modal creator-modal--signal-settings" onSubmit={handleSubmit}>
        <header className="creator-modal-header">
          <p>Signal settings</p>
          <button className="creator-modal-close" onClick={onClose} type="button">
            Close
          </button>
        </header>

        <label className="creator-modal-label">
          Signal title
          <input autoFocus className="creator-modal-text-input" onChange={(event) => setSignalTitle(event.target.value)} type="text" value={signalTitle ?? ""} />
        </label>

        <div className="creator-signal-settings-grid">
          <label className="creator-modal-label">
            Min value
            <input
              className="creator-modal-text-input"
              onChange={(event) => {
                setSignalMin(event.target.value);
                setErrorMessage(null);
              }}
              type="number"
              value={signalMin}
            />
          </label>
          <label className="creator-modal-label">
            Max value
            <input
              className="creator-modal-text-input"
              onChange={(event) => {
                setSignalMax(event.target.value);
                setErrorMessage(null);
              }}
              type="number"
              value={signalMax}
            />
          </label>
          <label className="creator-modal-label">
            Lower bound
            <CreatorSelect label="Lower bound" onChange={setSignalMinSymbol} options={creatorSignalMinSymbolOptions} value={signalMinSymbol} />
          </label>
          <label className="creator-modal-label">
            Upper bound
            <CreatorSelect label="Upper bound" onChange={setSignalMaxSymbol} options={creatorSignalMaxSymbolOptions} value={signalMaxSymbol} />
          </label>
          <label className="creator-modal-label creator-signal-order-field">
            Score direction
            <CreatorSelect label="Score direction" onChange={setSignalOrder} options={creatorSignalOrderOptions} value={signalOrder} />
          </label>
        </div>

        {hasInvertedRange ? <p className="creator-modal-counter creator-modal-counter--warning">Max is less than min. You can save, but the range may read oddly.</p> : null}
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
  pair,
  isDragging = false,
  onEdit,
  onSignalEdit,
}: {
  pair: Pair;
  isDragging?: boolean;
  onEdit: (target: EditTarget) => void;
  onSignalEdit: (target: SignalEditTarget) => void;
}) {
  const { setNodeRef } = useDraggable({
    id: pair.id,
    data: { type: "pair" },
    disabled: isPairEmpty(pair),
  });
  const isEmptyPair = isPairEmpty(pair);
  const stepClassName = `creator-editable creator-pair-step${isStepEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;
  const signalClassName = `creator-editable creator-pair-signal${isSignalEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;
  const handleClassName = `creator-drag-handle${isEmptyPair ? " creator-drag-handle--disabled" : ""}`;

  return (
    <div className={`creator-pair${isDragging ? " creator-pair--dragging" : ""}`} ref={setNodeRef}>
      <button className={stepClassName} onClick={() => onEdit({ type: "pair-step", pairId: pair.id })} type="button">
        {getStepDisplayText(pair)}
      </button>
      <div className="creator-pair-handle-row">
        {/* Stage 1 pan-first mode keeps reorder inactive while preserving the handle for future long-press restoration. */}
        <button
          className={handleClassName}
          type="button"
          aria-label={isEmptyPair ? "Empty pair slot" : "Pair reorder temporarily disabled"}
          data-creator-drag-handle
          disabled={isEmptyPair}
        >
          <DragHandleMark />
        </button>
      </div>
      <button className={signalClassName} onClick={() => onSignalEdit({ type: "pair-signal", pairId: pair.id })} type="button">
        {getSignalDisplayText(pair)}
      </button>
    </div>
  );
}

function DragHandleMark({ rows = 2, variant }: { rows?: 2 | 3; variant?: "channel" }) {
  const dotCount = rows * 2;

  return (
    <span className={`creator-drag-handle-mark${variant === "channel" ? " creator-channel-drag-handle-mark" : ""}`} aria-hidden="true">
      {Array.from({ length: dotCount }, (_, dotIndex) => (
        <span className="creator-drag-handle-dot" key={dotIndex} />
      ))}
    </span>
  );
}

function PairPreview({ pair }: { pair: Pair }) {
  const stepClassName = `creator-pair-step${isStepEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;
  const signalClassName = `creator-pair-signal${isSignalEmpty(pair) ? " creator-pair-title--placeholder" : ""}`;

  return (
    <div className="creator-pair creator-pair--preview">
      <div className={stepClassName}>{getStepDisplayText(pair)}</div>
      <div className="creator-pair-handle-row">
        <span className="creator-drag-handle creator-drag-handle--preview" aria-hidden="true">
          <DragHandleMark />
        </span>
      </div>
      <div className={signalClassName}>{getSignalDisplayText(pair)}</div>
    </div>
  );
}

function ChannelRow({
  channelName,
  isDragging = false,
  onEdit,
  row,
}: {
  channelName?: string;
  isDragging?: boolean;
  onEdit: (target: EditTarget) => void;
  row: number;
}) {
  const { setNodeRef } = useDraggable({
    id: `channel:${row}`,
    data: { type: "channel", row },
  });

  return (
    <div className={`creator-channel-row${isDragging ? " creator-channel-row--dragging" : ""}`} ref={setNodeRef}>
      <button
        aria-label="Channel reorder temporarily disabled"
        className="creator-channel-drag-handle"
        data-creator-channel-drag-handle
        data-creator-drag-handle
        type="button"
      >
        <DragHandleMark rows={3} variant="channel" />
      </button>
      <button className="creator-editable creator-channel-name" onClick={() => onEdit({ type: "channel-name", row })} type="button">
        {channelName}
      </button>
    </div>
  );
}

function ChannelRowPreview({ channelName }: { channelName?: string }) {
  return (
    <div className="creator-channel-drag-preview">
      <DragHandleMark rows={3} variant="channel" />
      <span>{channelName}</span>
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
  activeChannelRow,
  activeChannelOverRow,
  cell,
  cellId,
  channelName,
  onEdit,
  onSignalEdit,
  pair,
  row,
}: {
  activePairId: PairId | null;
  activeChannelRow: number | null;
  activeChannelOverRow: number | null;
  cell: CellState;
  cellId: CellId;
  channelName?: string;
  onEdit: (target: EditTarget) => void;
  onSignalEdit: (target: SignalEditTarget) => void;
  pair?: Pair;
  row: number;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: cellId,
    data: cell.kind === "locked" ? { type: "channel-row", row } : { type: "cell", accepts: "pair" },
  });
  const isOccupied = Boolean(cell.pairId);
  const isLocked = cell.kind === "locked";
  const canDropActivePair = Boolean(isOver && activePairId && pair && pair.id !== activePairId && isPairEmpty(pair));
  const isEmptyPanSurface = cell.kind === "empty" && !cell.pairId;
  const isChannelRowDragging = activeChannelRow === row;
  const isChannelRowTarget = activeChannelOverRow === row && activeChannelOverRow !== activeChannelRow;

  return (
    <div
      className={`creator-cell${isOccupied ? " creator-cell--occupied" : ""}${isLocked ? " creator-cell--locked" : ""}${canDropActivePair ? " creator-cell--can-drop" : ""}${isChannelRowDragging ? " creator-cell--channel-row-dragging" : ""}${isChannelRowTarget ? " creator-cell--channel-row-target" : ""}`}
      data-creator-pan-surface={isEmptyPanSurface ? true : undefined}
      ref={setNodeRef}
    >
      {/* Cells currently support empty, pair, and locked states. Channel cells are locked until channel dragging exists. */}
      {pair ? (
        <PairBlock pair={pair} isDragging={pair.id === activePairId} onEdit={onEdit} onSignalEdit={onSignalEdit} />
      ) : isLocked ? (
        <ChannelRow channelName={channelName} isDragging={activeChannelRow === row} onEdit={onEdit} row={row} />
      ) : (
        <span className="creator-empty">empty</span>
      )}
    </div>
  );
}

type CreatorDragLabProps = {
  canPreviewOutput: boolean;
  canUpdateExistingTemplate: boolean;
  initialBoard: BoardState;
  mode: "edit" | "new";
};

export default function CreatorDragLab({ canPreviewOutput, canUpdateExistingTemplate, initialBoard, mode }: CreatorDragLabProps) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardState>(() => initialBoard);
  const [activePairId, setActivePairId] = useState<PairId | null>(null);
  const [activeChannelRow, setActiveChannelRow] = useState<number | null>(null);
  const [activeChannelOverRow, setActiveChannelOverRow] = useState<number | null>(null);
  const [editSession, setEditSession] = useState<EditSession | null>(null);
  const [dateEditSession, setDateEditSession] = useState<DateEditSession | null>(null);
  const [deckDataPendingTemplateId, setDeckDataPendingTemplateId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [signalEditSession, setSignalEditSession] = useState<SignalEditSession | null>(null);
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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: CREATOR_GEOMETRY.pairDragActivationDistance,
      },
    }),
  );

  const activeOriginCellId = useMemo(() => {
    return activePairId ? findPairCell(board.cells, activePairId) ?? null : null;
  }, [activePairId, board.cells]);
  const activePair = activePairId ? board.pairs[activePairId] ?? null : null;
  const activeChannelName = activeChannelRow === null ? null : board.channelNamesByRow[activeChannelRow] ?? null;
  const canDeleteActiveCard = editSession?.target.type === "card-title" && getCardColumns(board.columns).length > 1;

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

  async function saveTemplate() {
    if (saveStatus === "saving") {
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const shouldUpdateExistingTemplate = mode === "edit" && canUpdateExistingTemplate;
      const shouldCreateFreshDeckData = mode === "new";
      const originalDeckTemplateId = board.deckTemplateId;
      const nextDeckTemplateId = shouldUpdateExistingTemplate
        ? board.deckTemplateId
        : deckDataPendingTemplateId ?? (mode === "new" ? board.deckTemplateId : createCreatorDeckTemplateId());
      const template = {
        ...creatorBoardToDeckTemplate(board),
        deckTemplateId: nextDeckTemplateId,
      };
      const hasCreatedTemplateAwaitingDeckData = !shouldUpdateExistingTemplate && deckDataPendingTemplateId === nextDeckTemplateId;

      await saveCreatorDeckTemplate({
        deckTemplateId: nextDeckTemplateId,
        method: shouldUpdateExistingTemplate || hasCreatedTemplateAwaitingDeckData ? "PATCH" : "POST",
        template,
      });

      if (!shouldUpdateExistingTemplate) {
        setDeckDataPendingTemplateId(nextDeckTemplateId);
      }

      if (shouldCreateFreshDeckData) {
        await initializeCreatorDeckData(nextDeckTemplateId);
      } else if (!shouldUpdateExistingTemplate) {
        await reconcileCreatorDeckData({
          oldDeckTemplateId: originalDeckTemplateId,
          newDeckTemplateId: nextDeckTemplateId,
        });
      }

      if (!shouldUpdateExistingTemplate) {
        setDeckDataPendingTemplateId(null);
      }

      setSaveStatus("success");
      setSaveMessage("Saved.");

      if (!shouldUpdateExistingTemplate) {
        setBoard((currentBoard) => ({
          ...currentBoard,
          deckTemplateId: nextDeckTemplateId,
        }));
        router.replace(`/creator/edit/${encodeURIComponent(nextDeckTemplateId)}`);
      }
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(error instanceof Error ? error.message : "Unable to save template.");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    panStateRef.current = null;
    const dragType = getDragType(event);

    if (dragType === "channel") {
      setActivePairId(null);
      setActiveChannelRow(getChannelRowFromDragEvent(event));
      setActiveChannelOverRow(null);
      return;
    }

    setActiveChannelRow(null);
    setActiveChannelOverRow(null);
    const pairId = String(event.active.id);
    const activePairCandidate = board.pairs[pairId];

    setActivePairId(activePairCandidate && !isPairEmpty(activePairCandidate) ? pairId : null);
  }

  function handleDragOver(event: DragOverEvent) {
    if (getDragType(event) !== "channel") {
      return;
    }

    setActiveChannelOverRow(getChannelRowFromOverEvent(event));
  }

  function handleDragEnd(event: DragEndEvent) {
    const dragType = getDragType(event);

    setActivePairId(null);
    setActiveChannelRow(null);
    setActiveChannelOverRow(null);

    if (dragType === "channel") {
      const fromRow = getChannelRowFromDragEvent(event);
      const toRow = getChannelRowFromOverEvent(event);

      if (fromRow === null || toRow === null || fromRow === toRow) {
        return;
      }

      setBoard((currentBoard) => swapCreatorBoardRows(currentBoard, fromRow, toRow));
      return;
    }

    const pairId = String(event.active.id);
    const targetCellId = event.over?.id ? String(event.over.id) as CellId : null;

    if (!targetCellId) {
      return;
    }

    setBoard((currentBoard) => {
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
    setActiveChannelRow(null);
    setActiveChannelOverRow(null);
  }

  function addCard() {
    setBoard((currentBoard) => appendCreatorCard(currentBoard));
  }

  function deleteActiveCard() {
    if (!editSession || editSession.target.type !== "card-title") {
      return;
    }

    const columnId = editSession.target.columnId;

    setBoard((currentBoard) => deleteCreatorCard(currentBoard, columnId));
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

  function openSignalEdit(target: SignalEditTarget) {
    const nextSignalEditSession = getSignalEditSession(board, target);

    if (nextSignalEditSession) {
      setSignalEditSession(nextSignalEditSession);
    }
  }

  function saveEdit(value: string) {
    if (!editSession) {
      return;
    }

    const target = editSession.target;

    setBoard((currentBoard) => {
      if (target.type === "deck-title") {
        return { ...currentBoard, deckTitle: value };
      }

      if (target.type === "channel-name") {
        return {
          ...currentBoard,
          channelNamesByRow: {
            ...currentBoard.channelNamesByRow,
            [target.row]: resolveCreatorChannelName(target.row, value),
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
            stepText: value.trim() === "" ? null : value,
          },
        },
      };
    });
    setEditSession(null);
  }

  function saveDateEdit(value: string) {
    if (!dateEditSession || !isIsoDateOnlyString(value)) {
      return;
    }

    const target = dateEditSession.target;

    setBoard((currentBoard) => ({
      ...currentBoard,
      columns: currentBoard.columns.map((column) => (column.id === target.columnId ? { ...column, targetDate: value } : column)),
    }));
    setDateEditSession(null);
  }

  function saveSignalEdit(value: SignalEditValue) {
    if (!signalEditSession) {
      return;
    }

    const target = signalEditSession.target;

    setBoard((currentBoard) => {
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
            ...(isSignalEmpty(value.signalTitle)
              ? {
                  ...createEmptySignal(),
                  signalOrder: value.signalOrder,
                }
              : {
                  ...value,
                  signalTitle: value.signalTitle,
                }),
          },
        },
      };
    });
    setSignalEditSession(null);
  }

  function handlePanPointerDown(event: PointerEvent<HTMLElement>) {
    if (activePairId || activeChannelRow !== null || event.button !== 0) {
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
      hasPointerCapture: true,
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      panStateRef.current.hasPointerCapture = false;
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
          <button className="creator-save-button" disabled={saveStatus === "saving"} onClick={saveTemplate} type="button">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "success" ? "Saved" : "Save"}
          </button>
          {saveMessage ? <p className={`creator-save-message creator-save-message--${saveStatus}`}>{saveMessage}</p> : null}
          <Link className="creator-back-link" href="/">
            Decks
          </Link>
        </div>
      </header>

      <DndContext
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
                      </>
                    ) : (
                      <span className="creator-channel-header">Channels</span>
                    )}
                  </header>
                  <div className="creator-column-cells">
                    {board.rows.map((row) => {
                      const cellId = getCreatorCellId(column.id, row);

                      return (
                        <BoardCell
                          activePairId={activePairId}
                          activeChannelRow={activeChannelRow}
                          activeChannelOverRow={activeChannelOverRow}
                          cell={board.cells[cellId]}
                          cellId={cellId}
                          channelName={column.kind === "channel" ? board.channelNamesByRow[row] : undefined}
                          key={cellId}
                          onEdit={openEdit}
                          onSignalEdit={openSignalEdit}
                          pair={board.cells[cellId].pairId ? board.pairs[board.cells[cellId].pairId] : undefined}
                          row={row}
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
          {activeChannelRow !== null ? <ChannelRowPreview channelName={activeChannelName ?? undefined} /> : null}
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
      {signalEditSession ? <CreatorSignalEditModal session={signalEditSession} onClose={() => setSignalEditSession(null)} onSave={saveSignalEdit} /> : null}
    </main>
  );
}
