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
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { CREATOR_GEOMETRY, getCreatorGeometryStyle, getCreatorRows } from "@/components/creator/creatorDragLabGeometry";
import { deckTemplates } from "@/mocks/deckTemplates";

type ColumnId = "channels" | "card-1" | "card-2" | "card-3" | "card-4";
type PairId = string;
type CellId = `${ColumnId}:${number}`;
type CellKind = "empty" | "pair" | "locked";

type Column = {
  id: ColumnId;
  kind: "channel" | "card";
  label: string;
  cardTitle?: string;
  targetDate?: string;
};

type CellState = {
  kind: CellKind;
  pairId: PairId | null;
};

type Pair = {
  id: PairId;
  stepText: string;
  signalTitle: string;
};

type BoardState = {
  deckTitle: string;
  columns: Column[];
  rows: number[];
  cells: Record<CellId, CellState>;
  channelNamesByRow: Record<number, string>;
  pairs: Record<PairId, Pair>;
};

type EditTarget =
  | { type: "deck-title" }
  | { type: "channel-name"; row: number }
  | { type: "card-title"; columnId: ColumnId }
  | { type: "target-date"; columnId: ColumnId }
  | { type: "pair-step"; pairId: PairId }
  | { type: "pair-signal"; pairId: PairId };

type EditSession = {
  label: string;
  target: EditTarget;
  value: string;
};

const columns: Column[] = [
  { id: "channels", kind: "channel", label: "Channels" },
  { id: "card-1", kind: "card", label: "Card" },
  { id: "card-2", kind: "card", label: "Card" },
  { id: "card-3", kind: "card", label: "Card" },
  { id: "card-4", kind: "card", label: "Card" },
];

const rows = getCreatorRows();
const creatorGeometryStyle = getCreatorGeometryStyle();
const sourceDeckTemplate = deckTemplates[0];

function getCellId(columnId: ColumnId, rowIndex: number): CellId {
  return `${columnId}:${rowIndex}`;
}

function formatCreatorDateDisplay(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value.replace(/\s+\d{4}$/, "");
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function createInitialBoard(): BoardState {
  const templateCards = sourceDeckTemplate.cards.slice(0, columns.length - 1);
  const creatorColumns = columns.map((column, columnIndex) => {
    if (column.kind === "channel") {
      return column;
    }

    const templateCard = templateCards[columnIndex - 1];

    return {
      ...column,
      cardTitle: templateCard?.subtitle ?? templateCard?.title ?? column.label,
      targetDate: templateCard?.suggestedTargetDate ?? "",
    };
  });
  const cells = creatorColumns.reduce<Record<CellId, CellState>>((nextCells, column) => {
    for (const row of rows) {
      nextCells[getCellId(column.id, row)] = {
        kind: column.kind === "channel" ? "locked" : "empty",
        pairId: null,
      };
    }

    return nextCells;
  }, {} as Record<CellId, CellState>);
  const pairs = templateCards.reduce<Record<PairId, Pair>>((nextPairs, card, cardIndex) => {
    const column = creatorColumns[cardIndex + 1];

    for (const row of rows) {
      const item = card.items[row];
      const signal = card.signals[row];

      if (!item || !signal || !column) {
        continue;
      }

      const pairId = `${item.itemId}:${signal.signalId}`;
      nextPairs[pairId] = {
        id: pairId,
        stepText: item.description,
        signalTitle: signal.title,
      };
      cells[getCellId(column.id, row)] = { kind: "pair", pairId };
    }

    return nextPairs;
  }, {});

  return {
    deckTitle: sourceDeckTemplate.title,
    columns: creatorColumns,
    rows,
    channelNamesByRow: sourceDeckTemplate.channels.reduce<Record<number, string>>((nextChannels, channel, index) => {
      nextChannels[index] = channel.title;
      return nextChannels;
    }, {}),
    cells,
    pairs,
  };
}

function findPairCell(cells: BoardState["cells"], pairId: PairId) {
  return Object.entries(cells).find(([, cell]) => cell.pairId === pairId)?.[0] as CellId | undefined;
}

function isPairDroppableCell(cell: CellState | undefined) {
  return Boolean(cell && cell.kind === "empty" && !cell.pairId);
}

function getEditSession(board: BoardState, target: EditTarget): EditSession | null {
  if (target.type === "deck-title") {
    return { label: "Deck title", target, value: board.deckTitle };
  }

  if (target.type === "channel-name") {
    return { label: "Channel name", target, value: board.channelNamesByRow[target.row] ?? "" };
  }

  if (target.type === "card-title") {
    const column = board.columns.find((candidate) => candidate.id === target.columnId);

    if (!column) {
      return null;
    }

    return { label: "Card title", target, value: column.cardTitle ?? "" };
  }

  if (target.type === "target-date") {
    const column = board.columns.find((candidate) => candidate.id === target.columnId);

    if (!column) {
      return null;
    }

    return { label: "Target date", target, value: column.targetDate ?? "" };
  }

  const pair = board.pairs[target.pairId];

  if (!pair) {
    return null;
  }

  if (target.type === "pair-step") {
    return { label: "Step text", target, value: pair.stepText };
  }

  return { label: "Signal title", target, value: pair.signalTitle };
}

function CreatorEditModal({ session, onClose, onSave }: { session: EditSession; onClose: () => void; onSave: (value: string) => void }) {
  const [draftValue, setDraftValue] = useState(session.value);

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
        <textarea autoFocus className="creator-modal-field" onChange={(event) => setDraftValue(event.target.value)} value={draftValue} />
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

function PairBlock({ pair, isDragging = false, onEdit }: { pair: Pair; isDragging?: boolean; onEdit: (target: EditTarget) => void }) {
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
          <span className="creator-drag-handle-mark" aria-hidden="true">::</span>
        </button>
      </div>
      <button className="creator-editable creator-pair-signal" onClick={() => onEdit({ type: "pair-signal", pairId: pair.id })} type="button">
        {pair.signalTitle}
      </button>
    </div>
  );
}

function PairPreview() {
  return (
    <div className="creator-pair creator-pair--preview">
      <div className="creator-pair-step">Step</div>
      <div className="creator-pair-handle-row">
        <span className="creator-drag-handle creator-drag-handle--preview" aria-hidden="true">
          <span className="creator-drag-handle-mark">::</span>
        </span>
      </div>
      <div className="creator-pair-signal">Signal</div>
    </div>
  );
}

function BoardCell({
  activePairId,
  cell,
  cellId,
  channelName,
  onEdit,
  pair,
}: {
  activePairId: PairId | null;
  cell: CellState;
  cellId: CellId;
  channelName?: string;
  onEdit: (target: EditTarget) => void;
  pair?: Pair;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: cellId,
    data: { type: "cell", accepts: "pair" },
  });
  const isOccupied = Boolean(cell.pairId);
  const isLocked = cell.kind === "locked";
  const canDropActivePair = isOver && isPairDroppableCell(cell);
  const isEmptyPanSurface = cell.kind === "empty" && !cell.pairId;

  return (
    <div
      className={`creator-cell${isOccupied ? " creator-cell--occupied" : ""}${isLocked ? " creator-cell--locked" : ""}${canDropActivePair ? " creator-cell--can-drop" : ""}`}
      data-creator-pan-surface={isEmptyPanSurface ? true : undefined}
      ref={setNodeRef}
    >
      {/* Cells currently support empty, pair, and locked states. Channel cells are locked until channel dragging exists. */}
      {pair ? (
        <PairBlock pair={pair} isDragging={pair.id === activePairId} onEdit={onEdit} />
      ) : isLocked ? (
        <button className="creator-editable creator-channel-name" onClick={() => onEdit({ type: "channel-name", row: Number(cellId.split(":")[1]) })} type="button">
          {channelName}
        </button>
      ) : (
        <span className="creator-empty">empty</span>
      )}
    </div>
  );
}

export default function CreatorDragLab() {
  const [board, setBoard] = useState<BoardState>(() => createInitialBoard());
  const [activePairId, setActivePairId] = useState<PairId | null>(null);
  const [editSession, setEditSession] = useState<EditSession | null>(null);
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

  function handleDragStart(event: DragStartEvent) {
    panStateRef.current = null;
    setActivePairId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const pairId = String(event.active.id);
    const targetCellId = event.over?.id ? String(event.over.id) as CellId : null;

    setActivePairId(null);

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

  function openEdit(target: EditTarget) {
    const nextEditSession = getEditSession(board, target);

    if (nextEditSession) {
      setEditSession(nextEditSession);
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

      if (target.type === "target-date") {
        return {
          ...currentBoard,
          columns: currentBoard.columns.map((column) => (column.id === target.columnId ? { ...column, targetDate: value } : column)),
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
            ...(target.type === "pair-step" ? { stepText: value } : { signalTitle: value }),
          },
        },
      };
    });
    setEditSession(null);
  }

  function handlePanPointerDown(event: PointerEvent<HTMLElement>) {
    if (activePairId || event.button !== 0) {
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
          <p className="creator-kicker">Creator Mode Prototype</p>
          <button className="creator-editable creator-deck-title" onClick={() => openEdit({ type: "deck-title" })} type="button">
            {board.deckTitle}
          </button>
        </div>
        <Link className="creator-back-link" href="/">
          Decks
        </Link>
      </header>

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActivePairId(null)}>
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
                        <button className="creator-editable creator-card-title-button" onClick={() => openEdit({ type: "card-title", columnId: column.id })} type="button">
                          {column.cardTitle}
                        </button>
                        <button className="creator-editable creator-card-date-button" onClick={() => openEdit({ type: "target-date", columnId: column.id })} type="button">
                          {formatCreatorDateDisplay(column.targetDate ?? "")}
                        </button>
                      </>
                    ) : (
                      <span className="creator-channel-header">Channels</span>
                    )}
                  </header>
                  <div className="creator-column-cells">
                    {board.rows.map((row) => {
                      const cellId = getCellId(column.id, row);

                      return (
                        <BoardCell
                          activePairId={activePairId}
                          cell={board.cells[cellId]}
                          cellId={cellId}
                          channelName={column.kind === "channel" ? board.channelNamesByRow[row] : undefined}
                          key={cellId}
                          onEdit={openEdit}
                          pair={board.cells[cellId].pairId ? board.pairs[board.cells[cellId].pairId] : undefined}
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

        <DragOverlay>{activePairId && activeOriginCellId ? <PairPreview /> : null}</DragOverlay>
      </DndContext>
      {editSession ? <CreatorEditModal session={editSession} onClose={() => setEditSession(null)} onSave={saveEdit} /> : null}
    </main>
  );
}
