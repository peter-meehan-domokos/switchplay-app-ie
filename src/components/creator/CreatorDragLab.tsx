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
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { CREATOR_GEOMETRY, getCreatorGeometryStyle, getCreatorRows } from "@/components/creator/creatorDragLabGeometry";

type ColumnId = "channels" | "week-1" | "week-2" | "week-3" | "week-4";
type PairId = string;
type CellId = `${ColumnId}:${number}`;
type CellKind = "empty" | "pair" | "locked";

type Column = {
  id: ColumnId;
  kind: "channel" | "week";
  label: string;
};

type CellState = {
  kind: CellKind;
  pairId: PairId | null;
};

type BoardState = {
  columns: Column[];
  rows: number[];
  cells: Record<CellId, CellState>;
  pairs: Record<PairId, { id: PairId }>;
};

const columns: Column[] = [
  { id: "channels", kind: "channel", label: "Channels" },
  { id: "week-1", kind: "week", label: "Week 1" },
  { id: "week-2", kind: "week", label: "Week 2" },
  { id: "week-3", kind: "week", label: "Week 3" },
  { id: "week-4", kind: "week", label: "Week 4" },
];

const rows = getCreatorRows();
const creatorGeometryStyle = getCreatorGeometryStyle();

function getCellId(columnId: ColumnId, rowIndex: number): CellId {
  return `${columnId}:${rowIndex}`;
}

function createInitialBoard(): BoardState {
  const cells = columns.reduce<Record<CellId, CellState>>((nextCells, column) => {
    for (const row of rows) {
      nextCells[getCellId(column.id, row)] = {
        kind: column.kind === "channel" ? "locked" : "empty",
        pairId: null,
      };
    }

    return nextCells;
  }, {} as Record<CellId, CellState>);

  cells[getCellId("week-1", 0)] = { kind: "pair", pairId: "pair-1" };
  cells[getCellId("week-2", 1)] = { kind: "pair", pairId: "pair-2" };
  cells[getCellId("week-3", 2)] = { kind: "pair", pairId: "pair-3" };

  return {
    columns,
    rows,
    cells,
    pairs: {
      "pair-1": { id: "pair-1" },
      "pair-2": { id: "pair-2" },
      "pair-3": { id: "pair-3" },
    },
  };
}

function findPairCell(cells: BoardState["cells"], pairId: PairId) {
  return Object.entries(cells).find(([, cell]) => cell.pairId === pairId)?.[0] as CellId | undefined;
}

function isPairDroppableCell(cell: CellState | undefined) {
  return Boolean(cell && cell.kind === "empty" && !cell.pairId);
}

function PairBlock({ id, isDragging = false }: { id: PairId; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id,
    data: { type: "pair" },
  });

  return (
    <div className={`creator-pair${isDragging ? " creator-pair--dragging" : ""}`} ref={setNodeRef}>
      <div className="creator-pair-step">Step {id}</div>
      <div className="creator-pair-handle-row">
        {/* Drag begins only from explicit handles. This avoids future conflicts with editing, scrolling, and other interactions inside creator mode. */}
        <button className="creator-drag-handle" type="button" aria-label="Drag pair" data-creator-drag-handle {...listeners} {...attributes}>
          <span aria-hidden="true">::</span>
        </button>
      </div>
      <div className="creator-pair-signal">Signal {id}</div>
    </div>
  );
}

function PairPreview() {
  return (
    <div className="creator-pair creator-pair--preview">
      <div className="creator-pair-step">Step</div>
      <div className="creator-pair-handle-row">
        <span className="creator-drag-handle creator-drag-handle--preview" aria-hidden="true">
          ::
        </span>
      </div>
      <div className="creator-pair-signal">Signal</div>
    </div>
  );
}

function BoardCell({ cellId, cell, activePairId }: { cellId: CellId; cell: CellState; activePairId: PairId | null }) {
  const { isOver, setNodeRef } = useDroppable({
    id: cellId,
    data: { type: "cell", accepts: "pair" },
  });
  const isOccupied = Boolean(cell.pairId);
  const isLocked = cell.kind === "locked";
  const canDropActivePair = isOver && isPairDroppableCell(cell);

  return (
    <div
      className={`creator-cell${isOccupied ? " creator-cell--occupied" : ""}${isLocked ? " creator-cell--locked" : ""}${canDropActivePair ? " creator-cell--can-drop" : ""}`}
      ref={setNodeRef}
    >
      {/* Cells currently support empty, pair, and locked states. Channel cells are locked until channel dragging exists. */}
      {cell.pairId ? <PairBlock id={cell.pairId} isDragging={cell.pairId === activePairId} /> : <span className="creator-empty">{isLocked ? "locked" : "empty"}</span>}
    </div>
  );
}

export default function CreatorDragLab() {
  const [board, setBoard] = useState<BoardState>(() => createInitialBoard());
  const [activePairId, setActivePairId] = useState<PairId | null>(null);
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

  function handlePanPointerDown(event: PointerEvent<HTMLElement>) {
    if (activePairId || event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest("[data-creator-drag-handle]")) {
      return;
    }

    const isPanGutterTarget = Boolean(target.closest("[data-creator-pan-gutter]"));

    panStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: event.currentTarget.scrollLeft,
      isPanning: false,
      hasPointerCapture: isPanGutterTarget,
    };

    if (isPanGutterTarget) {
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
          <h1>Drag Lab</h1>
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
                  <h2>{column.label}</h2>
                  <div className="creator-column-cells">
                    {board.rows.map((row) => {
                      const cellId = getCellId(column.id, row);

                      return <BoardCell activePairId={activePairId} cell={board.cells[cellId]} cellId={cellId} key={cellId} />;
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
    </main>
  );
}
