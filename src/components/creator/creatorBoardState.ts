import type { DeckIntroduction, DeckTemplate, StepDescriptionSpan } from "@/components/decks/types";
import { getCreatorRows } from "@/components/creator/creatorDragLabGeometry";
import { normalizeDeckIntroductionForRuntime } from "@/lib/deckApiTransforms";
import type { MediaItem } from "@/lib/media";
import { clientId } from "@/lib/clientId";
import { createDefaultDeckContent, DEFAULT_CREATOR_CARD_TITLE, DEFAULT_DECK_CADENCE_DAYS, defaultCreatorThemeTitle, restoreCreatorCardTitle } from "@/lib/cards/creatorDefaults";

export type CardColumnId = `card-${number}`;
export type ColumnId = "streams" | CardColumnId;
export type PairId = string;
export type CellId = `${ColumnId}:${number}`;
export type CellKind = "empty" | "pair" | "locked";

export type Column = {
  id: ColumnId;
  kind: "stream" | "card";
  label: string;
  cardId?: string;
  cardLabel?: string;
  cardTitle?: string;
  infoCardIds?: string[];
  defaultCardTitle?: string;
  introDescription?: string | null;
  introMediaItem?: MediaItem | null;
  targetDate?: string;
};

export type CellState = {
  kind: CellKind;
  pairId: PairId | null;
};

export type Pair = {
  id: PairId;
  stepId: string;
  stepTitle?: string | null;
  stepDescriptionContent?: StepDescriptionSpan[];
  stepMediaItem: MediaItem | null;
  stepText: string | null;
};

export const STEP_PLACEHOLDER_TEXT = "Describe the step";
export const VIDEO_PLACEHOLDER_TEXT = "Video placeholder";

function createCreatorId(prefix: string) {
  return `${prefix}-${clientId()}`;
}

export function createCreatorDeckTemplateId() {
  return createCreatorId("deck");
}

function isStepTextEmpty(pair: Pair): boolean {
  return pair.stepText === null || pair.stepText.trim() === "";
}

export function isStepMediaEmpty(pairOrStepMediaItem: Pair | MediaItem | null): boolean {
  const stepMediaItem =
    pairOrStepMediaItem === null || "mediaType" in pairOrStepMediaItem
      ? pairOrStepMediaItem
      : pairOrStepMediaItem.stepMediaItem;

  return stepMediaItem === null;
}

/**
 * A step is empty only when ALL content fields are absent:
 * title, description text, rich description content, and media.
 */
export function isStepEmpty(pair: Pair): boolean {
  const titleEmpty = !pair.stepTitle || pair.stepTitle.trim() === "";
  const textEmpty = isStepTextEmpty(pair);
  const contentEmpty = (pair.stepDescriptionContent?.length ?? 0) === 0;
  const mediaEmpty = isStepMediaEmpty(pair);

  return titleEmpty && textEmpty && contentEmpty && mediaEmpty;
}

export function getStepDisplayText(pair: Pair) {
  return isStepTextEmpty(pair) ? STEP_PLACEHOLDER_TEXT : pair.stepText;
}

export function getStepMediaDisplayText(pair: Pair) {
  return isStepMediaEmpty(pair) ? VIDEO_PLACEHOLDER_TEXT : pair.stepMediaItem?.description ?? VIDEO_PLACEHOLDER_TEXT;
}

export function createEmptyPair(pairId: PairId, stepId = createCreatorId("step")): Pair {
  return {
    id: pairId,
    stepId,
    stepTitle: null,
    stepMediaItem: null,
    stepText: null,
  };
}

export function clearPair(pair: Pair): Pair {
  return createEmptyPair(pair.id, pair.stepId);
}

export type BoardState = {
  deckTemplateId: string;
  deckTitle: string;
  category: DeckTemplate["category"];
  deckIntroduction: DeckIntroduction | null;
  columns: Column[];
  rows: number[];
  cells: Record<CellId, CellState>;
  streamIdsByRow: Record<number, string>;
  streamNamesByRow: Record<number, string>;
  pairs: Record<PairId, Pair>;
};

const streamColumn: Column = { id: "streams", kind: "stream", label: "Streams" };

function createCreatorColumns(cardCount: number): Column[] {
  const normalizedCardCount = Math.max(0, Math.floor(cardCount));

  return [
    streamColumn,
    ...Array.from({ length: normalizedCardCount }, (_, index): Column => ({
      id: createCardColumnId(index + 1),
      kind: "card",
      label: "Card",
    })),
  ];
}

function getDefaultCardLabel(cardIndex: number) {
  return `Stage ${cardIndex + 1}`;
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
    return addDaysToIsoDate(previousTargetDate, DEFAULT_DECK_CADENCE_DAYS);
  }

  return formatUtcDateOnly(addUtcDays(today, DEFAULT_DECK_CADENCE_DAYS));
}

export function createNewCardColumn(columns: Column[]): Column & { id: CardColumnId; kind: "card" } {
  const cardTitle = DEFAULT_CREATOR_CARD_TITLE;

  return {
    id: createCardColumnId(getNextCardPosition(columns)),
    kind: "card",
    label: "Card",
    cardId: createCreatorId("card"),
    cardLabel: getNextCardLabel(columns),
    cardTitle,
    defaultCardTitle: cardTitle,
    introDescription: null,
    introMediaItem: null,
    targetDate: getNextCardDate(columns),
  };
}

export function createEmptyPairsForNewCard(columnId: CardColumnId, rows: number[]) {
  return rows.reduce<{
    cells: Record<CellId, CellState>;
    pairs: Record<PairId, Pair>;
  }>(
    (nextState, row) => {
      const pairId = createCreatorId("pair");

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

  if (!columnToDelete) {
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

    if (column.kind === "stream") {
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

export function getDefaultStreamName(row: number) {
  return defaultCreatorThemeTitle(row);
}

export function getDeletedCardLabelFallback(columnId: ColumnId) {
  const cardPosition = getCardPosition(columnId);

  return `Card ${cardPosition ?? 1}`;
}

export function resolveCreatorStreamName(row: number, value: string) {
  return value.trim() === "" ? getDefaultStreamName(row) : value;
}

export function resolveCreatorCardLabel(columnId: ColumnId, value: string) {
  return value.trim() === "" ? getDeletedCardLabelFallback(columnId) : value;
}

export function resolveCreatorCardTitle(column: Column, value: string, publishedTitle: string | null | undefined = column.defaultCardTitle) {
  return restoreCreatorCardTitle(value, publishedTitle);
}

export function getCreatorCellId(columnId: ColumnId, rowIndex: number): CellId {
  return `${columnId}:${rowIndex}`;
}

// Legacy drag operation: UI pair keys stay in their cells; Step IDs travel with content.
export function moveCreatorStepToEmptyCell(board: BoardState, pairId: PairId, targetCellId: CellId): BoardState {
  const originCellId = Object.entries(board.cells).find(([, cell]) => cell.pairId === pairId)?.[0];
  const targetCell = board.cells[targetCellId];
  const sourcePair = board.pairs[pairId];
  const targetPairId = targetCell?.pairId;
  const targetPair = targetPairId ? board.pairs[targetPairId] : undefined;

  if (!originCellId || originCellId === targetCellId || !sourcePair || isStepEmpty(sourcePair) || !targetPair || !isStepEmpty(targetPair)) {
    return board;
  }

  return {
    ...board,
    pairs: {
      ...board.pairs,
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
    streamIdsByRow: {
      ...board.streamIdsByRow,
      [fromRow]: board.streamIdsByRow[toRow],
      [toRow]: board.streamIdsByRow[fromRow],
    },
    streamNamesByRow: {
      ...board.streamNamesByRow,
      [fromRow]: board.streamNamesByRow[toRow],
      [toRow]: board.streamNamesByRow[fromRow],
    },
    cells: nextCells,
  };
}

function normalizeCreatorText(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

function normalizeCreatorStepDescriptionContent(content: StepDescriptionSpan[] | null | undefined) {
  const normalizedContent = (content ?? [])
    .map((span): StepDescriptionSpan | null => {
      if (span.type === "text") {
        return span.text === "" ? null : { type: "text", text: span.text };
      }

      const text = span.text.trim();
      const url = span.url.trim();

      return text === "" || url === "" ? null : { type: "link", text, url };
    })
    .filter((span): span is StepDescriptionSpan => span !== null);

  return normalizedContent.length > 0 ? normalizedContent : undefined;
}

function getPairForTemplateSlot(board: BoardState, columnId: ColumnId, row: number) {
  const pairId = board.cells[getCreatorCellId(columnId, row)]?.pairId;

  return pairId ? board.pairs[pairId] ?? null : null;
}

export function creatorBoardToDeckTemplate(board: BoardState): DeckTemplate {
  return {
    deckTemplateId: board.deckTemplateId,
    title: board.deckTitle,
    category: board.category,
    introduction: board.deckIntroduction,
    streams: board.rows.map((row) => ({
      id: board.streamIdsByRow[row],
      title: resolveCreatorStreamName(row, board.streamNamesByRow[row] ?? ""),
    })),
    cards: getCardColumns(board.columns).map((column) => {
      const cardTitle = column.cardTitle ?? "";

      return {
        cardId: column.cardId ?? column.id,
        label: column.cardLabel ?? column.label,
        suggestedTargetDate: column.targetDate ?? "",
        ...(column.infoCardIds !== undefined ? { infoCardIds: [...column.infoCardIds] } : {}),
        intro: {
          title: normalizeCreatorText(cardTitle),
          description: column.introDescription ?? null,
          mediaItem: column.introMediaItem ?? null,
        },
        steps: board.rows.map((row) => {
          const pair = getPairForTemplateSlot(board, column.id, row);
          const normalizedTitle = normalizeCreatorText(pair?.stepTitle);

          return {
            stepId: pair?.stepId ?? `${column.cardId ?? column.id}-step-${row + 1}`,
            ...(normalizedTitle ? { title: normalizedTitle } : {}),
            description: normalizeCreatorText(pair?.stepText),
            descriptionContent: normalizeCreatorStepDescriptionContent(pair?.stepDescriptionContent),
            mediaItem: pair?.stepMediaItem ?? null,
          };
        }),
      };
    }),
  };
}

export function updateBoardDeckIntroductionImage(board: BoardState, image: DeckIntroduction["image"]): BoardState {
  const currentIntroduction = board.deckIntroduction;

  return {
    ...board,
    deckIntroduction:
      currentIntroduction === null
        ? image === null
          ? null
          : { image, video: null }
        : {
            ...currentIntroduction,
            image,
          },
  };
}

export function setBoardDeckIntroductionImage(board: BoardState, image: DeckIntroduction["image"]): BoardState {
  return updateBoardDeckIntroductionImage(board, image);
}

export function updateBoardDeckIntroductionVideo(board: BoardState, video: DeckIntroduction["video"]): BoardState {
  const currentIntroduction = board.deckIntroduction;

  return {
    ...board,
    deckIntroduction:
      currentIntroduction === null
        ? video === null
          ? null
          : { image: null, video }
        : {
            ...currentIntroduction,
            video,
          },
  };
}

export function setBoardDeckIntroductionVideo(board: BoardState, video: DeckIntroduction["video"]): BoardState {
  return updateBoardDeckIntroductionVideo(board, video);
}

function createBaseCells(columns: Column[], rows: number[]) {
  return columns.reduce<Record<CellId, CellState>>((nextCells, column) => {
    for (const row of rows) {
      nextCells[getCreatorCellId(column.id, row)] = {
        kind: column.kind === "stream" ? "locked" : "empty",
        pairId: null,
      };
    }

    return nextCells;
  }, {} as Record<CellId, CellState>);
}

function createBlankStreamIds(rows: number[]) {
  return rows.reduce<Record<number, string>>((nextStreamIds, row) => {
    nextStreamIds[row] = createCreatorId("stream");
    return nextStreamIds;
  }, {});
}

function createTemplateStreamIds(template: DeckTemplate, rows: number[]) {
  return rows.reduce<Record<number, string>>((nextStreamIds, row) => {
    nextStreamIds[row] = template.streams[row]?.id ?? createCreatorId("stream");
    return nextStreamIds;
  }, {});
}

function createTemplateColumns(template: DeckTemplate): Column[] {
  const templateCards = template.cards;

  return createCreatorColumns(templateCards.length).map((column, columnIndex) => {
    if (column.kind === "stream") {
      return column;
    }

    const templateCard = templateCards[columnIndex - 1];

    const cardTitle = templateCard?.intro.title ?? templateCard?.label ?? column.label;

    return {
      ...column,
      cardId: templateCard?.cardId ?? createCreatorId("card"),
      cardLabel: templateCard?.label ?? getDefaultCardLabel(columnIndex - 1),
      cardTitle,
      defaultCardTitle: cardTitle,
      introDescription: templateCard?.intro.description ?? null,
      introMediaItem: templateCard?.intro.mediaItem ?? null,
      targetDate: templateCard?.suggestedTargetDate ?? "",
      ...(templateCard?.infoCardIds !== undefined ? { infoCardIds: [...templateCard.infoCardIds] } : {}),
    };
  });
}

export function createBlankCreatorBoard(): BoardState {
  const rows = getCreatorRows();
  const columns = createCreatorColumns(0);
  const cells = createBaseCells(columns, rows);
  const streamIdsByRow = createBlankStreamIds(rows);
  const defaults = createDefaultDeckContent(rows.map((row) => streamIdsByRow[row]));

  return {
    deckTemplateId: createCreatorDeckTemplateId(),
    deckTitle: defaults.title,
    category: null,
    deckIntroduction: null,
    columns,
    rows,
    streamIdsByRow,
    streamNamesByRow: rows.reduce<Record<number, string>>((nextStreams, row) => {
      nextStreams[row] = defaultCreatorThemeTitle(row);
      return nextStreams;
    }, {}),
    cells,
    pairs: {},
  };
}

export function createCreatorBoardFromTemplate(template: DeckTemplate): BoardState {
  const rows = getCreatorRows();
  const templateCards = template.cards;
  const columns = createTemplateColumns(template);
  const cells = createBaseCells(columns, rows);
  const pairs = columns.reduce<Record<PairId, Pair>>((nextPairs, column, columnIndex) => {
    if (column.kind !== "card") {
      return nextPairs;
    }

    const card = templateCards[columnIndex - 1];

    for (const row of rows) {
      const step = card?.steps[row];
      const pairId = step ? step.stepId : createCreatorId("pair");
      const emptyPair = createEmptyPair(pairId, step?.stepId);

      nextPairs[pairId] =
        step
          ? {
              ...emptyPair,
              stepTitle: step.title ?? null,
              stepDescriptionContent: step.descriptionContent,
              stepMediaItem: step.mediaItem ?? null,
              stepText: step.description,
            }
          : emptyPair;
      cells[getCreatorCellId(column.id, row)] = { kind: "pair", pairId };
    }

    return nextPairs;
  }, {});

  return {
    deckTemplateId: template.deckTemplateId,
    deckTitle: template.title,
    category: template.category,
    deckIntroduction: normalizeDeckIntroductionForRuntime(template.introduction),
    columns,
    rows,
    streamIdsByRow: createTemplateStreamIds(template, rows),
    streamNamesByRow: template.streams.reduce<Record<number, string>>((nextStreams, stream, index) => {
      nextStreams[index] = stream.title;
      return nextStreams;
    }, {}),
    cells,
    pairs,
  };
}
