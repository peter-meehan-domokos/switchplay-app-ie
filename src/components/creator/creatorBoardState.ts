import type { DeckTemplate } from "@/components/decks/types";
import { getCreatorRows } from "@/components/creator/creatorDragLabGeometry";

export type CardColumnId = `card-${number}`;
export type ColumnId = "channels" | CardColumnId;
export type PairId = string;
export type CellId = `${ColumnId}:${number}`;
export type CellKind = "empty" | "pair" | "locked";
export type SignalMinSymbol = "none" | "<";
export type SignalMaxSymbol = "none" | "+";

export type Column = {
  id: ColumnId;
  kind: "channel" | "card";
  label: string;
  cardLabel?: string;
  cardTitle?: string;
  defaultCardTitle?: string;
  targetDate?: string;
};

export type CellState = {
  kind: CellKind;
  pairId: PairId | null;
};

export type Pair = {
  id: PairId;
  signalMax: number | "";
  signalMaxSymbol: SignalMaxSymbol;
  signalMin: number | "";
  signalMinSymbol: SignalMinSymbol;
  stepText: string;
  signalTitle: string;
};

export const STEP_PLACEHOLDER_TEXT = "Describe the step";
export const SIGNAL_PLACEHOLDER_TEXT = "Progress signal";

const DEFAULT_EMPTY_SIGNAL_SETTINGS = {
  signalMax: 10,
  signalMaxSymbol: "none",
  signalMin: 0,
  signalMinSymbol: "none",
} as const satisfies Pick<Pair, "signalMax" | "signalMaxSymbol" | "signalMin" | "signalMinSymbol">;

type StepEmptyInput = Pick<Pair, "stepText"> | string;
type SignalEmptyInput = Pick<Pair, "signalTitle"> | string;

export function isStepEmpty(pairOrStepText: StepEmptyInput) {
  const stepText = typeof pairOrStepText === "string" ? pairOrStepText : pairOrStepText.stepText;

  return stepText.trim() === "";
}

export function isSignalEmpty(pairOrSignalTitle: SignalEmptyInput) {
  const signalTitle = typeof pairOrSignalTitle === "string" ? pairOrSignalTitle : pairOrSignalTitle.signalTitle;

  return signalTitle.trim() === "";
}

export function isPairEmpty(pair: Pair) {
  return isStepEmpty(pair) && isSignalEmpty(pair);
}

export function getStepDisplayText(pair: Pair) {
  return isStepEmpty(pair) ? STEP_PLACEHOLDER_TEXT : pair.stepText;
}

export function getSignalDisplayText(pair: Pair) {
  return isSignalEmpty(pair) ? SIGNAL_PLACEHOLDER_TEXT : pair.signalTitle;
}

export function createEmptySignal(): Pick<Pair, "signalMax" | "signalMaxSymbol" | "signalMin" | "signalMinSymbol" | "signalTitle"> {
  return {
    ...DEFAULT_EMPTY_SIGNAL_SETTINGS,
    signalTitle: "",
  };
}

export function createEmptyPair(pairId: PairId): Pair {
  return {
    id: pairId,
    ...createEmptySignal(),
    stepText: "",
  };
}

export function clearPair(pair: Pair): Pair {
  return createEmptyPair(pair.id);
}

export type BoardState = {
  deckTitle: string;
  columns: Column[];
  rows: number[];
  cells: Record<CellId, CellState>;
  channelNamesByRow: Record<number, string>;
  pairs: Record<PairId, Pair>;
};

const creatorColumns: Column[] = [
  { id: "channels", kind: "channel", label: "Channels" },
  { id: "card-1", kind: "card", label: "Card" },
  { id: "card-2", kind: "card", label: "Card" },
  { id: "card-3", kind: "card", label: "Card" },
  { id: "card-4", kind: "card", label: "Card" },
];

const starterCardTitles = ["Get started", "Make progress", "Build momentum", "Feel the difference"];
const starterTargetDates = ["2026-06-07", "2026-06-14", "2026-06-21", "2026-06-28"];
const starterChannelNames = ["Channel 1", "Channel 2", "Channel 3"];
const newCardTitle = "My New Card";

function getDefaultCardLabel(cardIndex: number) {
  return `Week ${cardIndex + 1}`;
}

function getCardPosition(columnId: ColumnId) {
  const matchedCardPosition = /^card-(\d+)$/.exec(columnId)?.[1];

  return matchedCardPosition ? Number(matchedCardPosition) : null;
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

function addUtcDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function formatUtcDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDaysToIsoDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);

  return formatUtcDateOnly(new Date(Date.UTC(year, month - 1, day + days)));
}

export function getCardColumns(columns: Column[]) {
  return columns.filter((column): column is Column & { id: CardColumnId; kind: "card" } => column.kind === "card");
}

export function getNextCardPosition(columns: Column[]) {
  const cardPositions = getCardColumns(columns)
    .map((column) => getCardPosition(column.id))
    .filter((position): position is number => position !== null);

  return Math.max(0, ...cardPositions) + 1;
}

export function createCardColumnId(position: number): CardColumnId {
  return `card-${position}`;
}

export function getNextCardLabel(columns: Column[]) {
  const cardColumns = getCardColumns(columns);
  const nextPosition = cardColumns.length + 1;

  return hasSequentialCardLabels(columns, "Week") ? getDefaultCardLabel(nextPosition - 1) : `Card ${nextPosition}`;
}

export function getNextCardDate(columns: Column[], today = new Date()) {
  const previousCard = getCardColumns(columns).at(-1);
  const previousTargetDate = previousCard?.targetDate ?? "";

  if (isIsoDateOnlyString(previousTargetDate)) {
    return addDaysToIsoDate(previousTargetDate, 7);
  }

  return formatUtcDateOnly(addUtcDays(today, 7));
}

export function createNewCardColumn(columns: Column[]): Column & { id: CardColumnId; kind: "card" } {
  const cardTitle = newCardTitle;

  return {
    id: createCardColumnId(getNextCardPosition(columns)),
    kind: "card",
    label: "Card",
    cardLabel: getNextCardLabel(columns),
    cardTitle,
    defaultCardTitle: cardTitle,
    targetDate: getNextCardDate(columns),
  };
}

export function createEmptyPairsForNewCard(columnId: CardColumnId, rows: number[]) {
  return rows.reduce<{
    cells: Record<CellId, CellState>;
    pairs: Record<PairId, Pair>;
  }>(
    (nextState, row) => {
      const pairId = `starter-${columnId}-row-${row + 1}`;

      nextState.pairs[pairId] = createEmptyPair(pairId);
      nextState.cells[getCreatorCellId(columnId, row)] = { kind: "pair", pairId };

      return nextState;
    },
    { cells: {} as Record<CellId, CellState>, pairs: {} }
  );
}

export function appendCreatorCard(board: BoardState): BoardState {
  const column = createNewCardColumn(board.columns);
  const { cells, pairs } = createEmptyPairsForNewCard(column.id, board.rows);

  return {
    ...board,
    columns: [...board.columns, column],
    cells: {
      ...board.cells,
      ...cells,
    },
    pairs: {
      ...board.pairs,
      ...pairs,
    },
  };
}

export function hasSequentialCardLabels(columns: Column[], labelPrefix: "Week" | "Card") {
  const cardColumns = getCardColumns(columns);

  return cardColumns.length > 0 && cardColumns.every((column, index) => column.cardLabel === `${labelPrefix} ${index + 1}`);
}

export function deleteCreatorCard(board: BoardState, columnId: ColumnId): BoardState {
  const cardColumns = getCardColumns(board.columns);
  const columnToDelete = cardColumns.find((column) => column.id === columnId);

  if (!columnToDelete || cardColumns.length <= 1) {
    return board;
  }

  const shouldRelabelWeeks = hasSequentialCardLabels(board.columns, "Week");
  const deletedPairIds = new Set<PairId>();

  for (const row of board.rows) {
    const deletedCell = board.cells[getCreatorCellId(columnId, row)];

    if (deletedCell?.pairId) {
      deletedPairIds.add(deletedCell.pairId);
    }
  }

  const nextPairs = Object.entries(board.pairs).reduce<Record<PairId, Pair>>((pairs, [pairId, pair]) => {
    if (!deletedPairIds.has(pairId)) {
      pairs[pairId] = pair;
    }

    return pairs;
  }, {});
  const nextCells: Record<CellId, CellState> = {};
  let nextCardIndex = 0;

  const nextColumns = board.columns.reduce<Column[]>((columns, column) => {
    if (column.id === columnId) {
      return columns;
    }

    if (column.kind === "channel") {
      columns.push(column);

      for (const row of board.rows) {
        const cellId = getCreatorCellId(column.id, row);
        nextCells[cellId] = board.cells[cellId] ?? { kind: "locked", pairId: null };
      }

      return columns;
    }

    nextCardIndex += 1;
    const nextColumnId = createCardColumnId(nextCardIndex);
    const nextColumn: Column = {
      ...column,
      id: nextColumnId,
      cardLabel: shouldRelabelWeeks ? `Week ${nextCardIndex}` : column.cardLabel,
    };

    columns.push(nextColumn);

    for (const row of board.rows) {
      nextCells[getCreatorCellId(nextColumnId, row)] = board.cells[getCreatorCellId(column.id, row)] ?? { kind: "empty", pairId: null };
    }

    return columns;
  }, []);

  return {
    ...board,
    columns: nextColumns,
    cells: nextCells,
    pairs: nextPairs,
  };
}

export function getDefaultChannelName(row: number) {
  return starterChannelNames[row] ?? `Channel ${row + 1}`;
}

export function getDeletedCardLabelFallback(columnId: ColumnId) {
  const cardPosition = getCardPosition(columnId);

  return `Card ${cardPosition ?? 1}`;
}

export function resolveCreatorChannelName(row: number, value: string) {
  return value.trim() === "" ? getDefaultChannelName(row) : value;
}

export function resolveCreatorCardLabel(columnId: ColumnId, value: string) {
  return value.trim() === "" ? getDeletedCardLabelFallback(columnId) : value;
}

export function resolveCreatorCardTitle(column: Column, value: string) {
  return value.trim() === "" ? column.defaultCardTitle ?? column.cardTitle ?? column.label : value;
}

export function getCreatorCellId(columnId: ColumnId, rowIndex: number): CellId {
  return `${columnId}:${rowIndex}`;
}

export function swapCreatorBoardRows(board: BoardState, fromRow: number, toRow: number): BoardState {
  if (fromRow === toRow || !board.rows.includes(fromRow) || !board.rows.includes(toRow)) {
    return board;
  }

  const nextCells = { ...board.cells };

  for (const column of board.columns) {
    const fromCellId = getCreatorCellId(column.id, fromRow);
    const toCellId = getCreatorCellId(column.id, toRow);
    const fromCell = nextCells[fromCellId];

    nextCells[fromCellId] = nextCells[toCellId];
    nextCells[toCellId] = fromCell;
  }

  return {
    ...board,
    channelNamesByRow: {
      ...board.channelNamesByRow,
      [fromRow]: board.channelNamesByRow[toRow],
      [toRow]: board.channelNamesByRow[fromRow],
    },
    cells: nextCells,
  };
}

function createBaseCells(columns: Column[], rows: number[]) {
  return columns.reduce<Record<CellId, CellState>>((nextCells, column) => {
    for (const row of rows) {
      nextCells[getCreatorCellId(column.id, row)] = {
        kind: column.kind === "channel" ? "locked" : "empty",
        pairId: null,
      };
    }

    return nextCells;
  }, {} as Record<CellId, CellState>);
}

function createBlankColumns(): Column[] {
  return creatorColumns.map((column, columnIndex) => {
    if (column.kind === "channel") {
      return column;
    }

    const cardIndex = columnIndex - 1;

    const cardTitle = starterCardTitles[cardIndex] ?? column.label;

    return {
      ...column,
      cardLabel: getDefaultCardLabel(cardIndex),
      cardTitle,
      defaultCardTitle: cardTitle,
      targetDate: starterTargetDates[cardIndex] ?? "",
    };
  });
}

function createTemplateColumns(template: DeckTemplate): Column[] {
  const templateCards = template.cards.slice(0, creatorColumns.length - 1);

  return creatorColumns.map((column, columnIndex) => {
    if (column.kind === "channel") {
      return column;
    }

    const templateCard = templateCards[columnIndex - 1];

    const cardTitle = templateCard?.subtitle ?? templateCard?.title ?? column.label;

    return {
      ...column,
      cardLabel: getDefaultCardLabel(columnIndex - 1),
      cardTitle,
      defaultCardTitle: cardTitle,
      targetDate: templateCard?.suggestedTargetDate ?? "",
    };
  });
}

export function createBlankCreatorBoard(): BoardState {
  const rows = getCreatorRows();
  const columns = createBlankColumns();
  const cells = createBaseCells(columns, rows);
  const pairs: Record<PairId, Pair> = {};

  for (const column of columns) {
    if (column.kind !== "card") {
      continue;
    }

    for (const row of rows) {
      const pairId = `starter-${column.id}-row-${row + 1}`;

      pairs[pairId] = createEmptyPair(pairId);
      cells[getCreatorCellId(column.id, row)] = { kind: "pair", pairId };
    }
  }

  return {
    deckTitle: "My Next Path",
    columns,
    rows,
    channelNamesByRow: starterChannelNames.reduce<Record<number, string>>((nextChannels, channel, index) => {
      nextChannels[index] = getDefaultChannelName(index);
      return nextChannels;
    }, {}),
    cells,
    pairs,
  };
}

export function createCreatorBoardFromTemplate(template: DeckTemplate): BoardState {
  const rows = getCreatorRows();
  const templateCards = template.cards.slice(0, creatorColumns.length - 1);
  const columns = createTemplateColumns(template);
  const cells = createBaseCells(columns, rows);
  const pairs = templateCards.reduce<Record<PairId, Pair>>((nextPairs, card, cardIndex) => {
    const column = columns[cardIndex + 1];

    for (const row of rows) {
      const step = card.steps[row];
      const signal = card.signals[row];

      if (!step || !signal || !column) {
        continue;
      }

      const pairId = `${step.stepId}:${signal.signalId}`;
      nextPairs[pairId] = {
        id: pairId,
        signalMax: signal.maxValue,
        signalMaxSymbol: signal.isTheoreticalMax ? "+" : "none",
        signalMin: signal.minValue,
        signalMinSymbol: signal.isTheoreticalMin ? "<" : "none",
        stepText: step.description,
        signalTitle: signal.title,
      };
      cells[getCreatorCellId(column.id, row)] = { kind: "pair", pairId };
    }

    return nextPairs;
  }, {});

  return {
    deckTitle: template.title,
    columns,
    rows,
    channelNamesByRow: template.channels.reduce<Record<number, string>>((nextChannels, channel, index) => {
      nextChannels[index] = channel.title;
      return nextChannels;
    }, {}),
    cells,
    pairs,
  };
}
