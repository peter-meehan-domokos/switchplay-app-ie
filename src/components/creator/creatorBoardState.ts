import type { DeckTemplate } from "@/components/decks/types";
import { getCreatorRows } from "@/components/creator/creatorDragLabGeometry";

export type ColumnId = "channels" | "card-1" | "card-2" | "card-3" | "card-4";
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

function getDefaultCardLabel(cardIndex: number) {
  return `Week ${cardIndex + 1}`;
}

export function getCreatorCellId(columnId: ColumnId, rowIndex: number): CellId {
  return `${columnId}:${rowIndex}`;
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

    return {
      ...column,
      cardLabel: getDefaultCardLabel(cardIndex),
      cardTitle: starterCardTitles[cardIndex] ?? column.label,
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

    return {
      ...column,
      cardLabel: getDefaultCardLabel(columnIndex - 1),
      cardTitle: templateCard?.subtitle ?? templateCard?.title ?? column.label,
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

      pairs[pairId] = {
        id: pairId,
        signalMax: 10,
        signalMaxSymbol: "none",
        signalMin: 0,
        signalMinSymbol: "none",
        stepText: "Describe the step",
        signalTitle: "Progress signal",
      };
      cells[getCreatorCellId(column.id, row)] = { kind: "pair", pairId };
    }
  }

  return {
    deckTitle: "My Next Path",
    columns,
    rows,
    channelNamesByRow: starterChannelNames.reduce<Record<number, string>>((nextChannels, channel, index) => {
      nextChannels[index] = channel;
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
      const item = card.items[row];
      const signal = card.signals[row];

      if (!item || !signal || !column) {
        continue;
      }

      const pairId = `${item.itemId}:${signal.signalId}`;
      nextPairs[pairId] = {
        id: pairId,
        signalMax: signal.maxValue,
        signalMaxSymbol: signal.isTheoreticalMax ? "+" : "none",
        signalMin: signal.minValue,
        signalMinSymbol: signal.isTheoreticalMin ? "<" : "none",
        stepText: item.description,
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
