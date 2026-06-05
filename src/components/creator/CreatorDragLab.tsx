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
import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import {
  getCreatorCellId,
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
  signalMax: number | "";
  signalMaxSymbol: SignalMaxSymbol;
  signalMin: number | "";
  signalMinSymbol: SignalMinSymbol;
  signalTitle: string;
};

type SignalEditValue = Omit<SignalEditSession, "target">;
type DragType = "channel" | "pair";

const creatorGeometryStyle = getCreatorGeometryStyle();
const STEP_TEXT_WARNING_LENGTH = 70;
const CARD_LABEL_MAX_LENGTH = 8;

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

function findPairCell(cells: BoardState["cells"], pairId: PairId) {
  return Object.entries(cells).find(([, cell]) => cell.pairId === pairId)?.[0] as CellId | undefined;
}

function isPairDroppableCell(cell: CellState | undefined) {
  return Boolean(cell && cell.kind === "empty" && !cell.pairId);
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
      value: pair.stepText,
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
    signalTitle: pair.signalTitle,
  };
}

function CreatorEditModal({ session, onClose, onSave }: { session: EditSession; onClose: () => void; onSave: (value: string) => void }) {
  const [draftValue, setDraftValue] = useState(session.value);
  const isLongText = session.inputKind === "long-text";
  const showStepCounter = session.target.type === "pair-step";
  const maxLength = session.target.type === "card-label" ? CARD_LABEL_MAX_LENGTH : undefined;
  const isStepWarningVisible = showStepCounter && draftValue.length > STEP_TEXT_WARNING_LENGTH;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        {session.helperText ? <p className="creator-modal-note">{session.helperText}</p> : null}
        {isLongText ? (
          <textarea autoFocus className="creator-modal-field" onChange={(event) => setDraftValue(event.target.value)} value={draftValue} />
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
  const [signalMin, setSignalMin] = useState(String(session.signalMin));
  const [signalMax, setSignalMax] = useState(String(session.signalMax));
  const [signalMinSymbol, setSignalMinSymbol] = useState<SignalMinSymbol>(session.signalMinSymbol);
  const [signalMaxSymbol, setSignalMaxSymbol] = useState<SignalMaxSymbol>(session.signalMaxSymbol);
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
      signalMax: parsedMax ?? "",
      signalMaxSymbol,
      signalMin: parsedMin ?? "",
      signalMinSymbol,
      signalTitle,
    });
  }

  return (
    <div className="creator-modal-backdrop" role="presentation">
      <form className="creator-modal" onSubmit={handleSubmit}>
        <header className="creator-modal-header">
          <p>Signal settings</p>
          <button className="creator-modal-close" onClick={onClose} type="button">
            Close
          </button>
        </header>

        <label className="creator-modal-label">
          Signal title
          <input autoFocus className="creator-modal-text-input" onChange={(event) => setSignalTitle(event.target.value)} type="text" value={signalTitle} />
        </label>
        <p className="creator-modal-note">Short signal name. Aim for 1-3 words.</p>

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
            <select className="creator-modal-select" onChange={(event) => setSignalMinSymbol(event.target.value as SignalMinSymbol)} value={signalMinSymbol}>
              <option value="none">exact</option>
              <option value="<">≤</option>
            </select>
          </label>
          <label className="creator-modal-label">
            Upper bound
            <select className="creator-modal-select" onChange={(event) => setSignalMaxSymbol(event.target.value as SignalMaxSymbol)} value={signalMaxSymbol}>
              <option value="none">exact</option>
              <option value="+">+</option>
            </select>
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
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: pair.id,
    data: { type: "pair" },
  });

  return (
    <div className={`creator-pair${isDragging ? " creator-pair--dragging" : ""}`} ref={setNodeRef}>
      <button className="creator-editable creator-pair-step" onClick={() => onEdit({ type: "pair-step", pairId: pair.id })} type="button">
        {pair.stepText}
      </button>
      <div className="creator-pair-handle-row">
        {/* Drag begins only from explicit handles. This avoids future conflicts with editing, scrolling, and other interactions inside creator mode. */}
        <button className="creator-drag-handle" type="button" aria-label="Drag pair" data-creator-drag-handle {...listeners} {...attributes}>
          <DragHandleMark />
        </button>
      </div>
      <button className="creator-editable creator-pair-signal" onClick={() => onSignalEdit({ type: "pair-signal", pairId: pair.id })} type="button">
        {pair.signalTitle}
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

function PairPreview() {
  return (
    <div className="creator-pair creator-pair--preview">
      <div className="creator-pair-step">Step</div>
      <div className="creator-pair-handle-row">
        <span className="creator-drag-handle creator-drag-handle--preview" aria-hidden="true">
          <DragHandleMark />
        </span>
      </div>
      <div className="creator-pair-signal">Signal</div>
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
  const { attributes, listeners, setActivatorNodeRef, setNodeRef } = useDraggable({
    id: `channel:${row}`,
    data: { type: "channel", row },
  });

  return (
    <div className={`creator-channel-row${isDragging ? " creator-channel-row--dragging" : ""}`} ref={setNodeRef}>
      <button
        aria-label={`Drag ${channelName ?? "channel"}`}
        className="creator-channel-drag-handle"
        data-creator-channel-drag-handle
        data-creator-drag-handle
        ref={setActivatorNodeRef}
        type="button"
        {...listeners}
        {...attributes}
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
  const canDropActivePair = isOver && isPairDroppableCell(cell);
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
  initialBoard: BoardState;
  mode: "edit" | "new";
};

export default function CreatorDragLab({ initialBoard, mode }: CreatorDragLabProps) {
  const [board, setBoard] = useState<BoardState>(() => initialBoard);
  const [activePairId, setActivePairId] = useState<PairId | null>(null);
  const [activeChannelRow, setActiveChannelRow] = useState<number | null>(null);
  const [activeChannelOverRow, setActiveChannelOverRow] = useState<number | null>(null);
  const [editSession, setEditSession] = useState<EditSession | null>(null);
  const [dateEditSession, setDateEditSession] = useState<DateEditSession | null>(null);
  const [signalEditSession, setSignalEditSession] = useState<SignalEditSession | null>(null);
  const scrollShellRef = useRef<HTMLElement | null>(null);
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
  const activeChannelName = activeChannelRow === null ? null : board.channelNamesByRow[activeChannelRow] ?? null;

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
    setActivePairId(String(event.active.id));
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

      if (!originCellId || originCellId === targetCellId || !isPairDroppableCell(targetCell)) {
        return currentBoard;
      }

      return {
        ...currentBoard,
        cells: {
          ...currentBoard.cells,
          [originCellId]: { kind: "empty", pairId: null },
          [targetCellId]: { kind: "pair", pairId },
        },
      };
    });
  }

  function handleDragCancel() {
    setActivePairId(null);
    setActiveChannelRow(null);
    setActiveChannelOverRow(null);
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
            [target.row]: value,
          },
        };
      }

      if (target.type === "card-title") {
        return {
          ...currentBoard,
          columns: currentBoard.columns.map((column) => (column.id === target.columnId ? { ...column, cardTitle: value } : column)),
        };
      }

      if (target.type === "card-label") {
        return {
          ...currentBoard,
          columns: currentBoard.columns.map((column) => (column.id === target.columnId ? { ...column, cardLabel: value.slice(0, CARD_LABEL_MAX_LENGTH) } : column)),
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
            stepText: value,
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
            ...value,
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

    const target = event.target as HTMLElement;

    if (target.closest("[data-creator-drag-handle]")) {
      return;
    }

    const shouldCapturePanImmediately = Boolean(target.closest("[data-creator-pan-gutter], [data-creator-pan-surface]"));

    panStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: event.currentTarget.scrollLeft,
      isPanning: false,
      hasPointerCapture: shouldCapturePanImmediately,
    };

    if (shouldCapturePanImmediately) {
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
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
      if (!panState.hasPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
        panState.hasPointerCapture = true;
      }
    }

    event.preventDefault();
    event.currentTarget.scrollLeft = panState.startScrollLeft - deltaX;
  }

  function stopPan(event: PointerEvent<HTMLElement>) {
    const panState = panStateRef.current;

    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    panStateRef.current = null;
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
        <Link className="creator-back-link" href="/">
          Decks
        </Link>
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
          </div>
            {/* Dedicated pan gutter for mobile thumbs. It shares the scroll shell's pointer-pan handlers and is not a drop target. */}
            <div className="creator-pan-gutter" data-creator-pan-gutter aria-hidden="true" />
          </div>
        </section>

        <DragOverlay>
          {activePairId && activeOriginCellId ? <PairPreview /> : null}
          {activeChannelRow !== null ? <ChannelRowPreview channelName={activeChannelName ?? undefined} /> : null}
        </DragOverlay>
      </DndContext>
      {editSession ? <CreatorEditModal session={editSession} onClose={() => setEditSession(null)} onSave={saveEdit} /> : null}
      {dateEditSession ? <CreatorDateEditModal session={dateEditSession} onClose={() => setDateEditSession(null)} onSave={saveDateEdit} /> : null}
      {signalEditSession ? <CreatorSignalEditModal session={signalEditSession} onClose={() => setSignalEditSession(null)} onSave={saveSignalEdit} /> : null}
    </main>
  );
}
