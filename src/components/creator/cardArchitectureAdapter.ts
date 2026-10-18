import { createBlankCreatorBoard, createCreatorBoardFromTemplate, getCardColumns, getCreatorCellId, type BoardState } from "./creatorBoardState";
import type { CardContent, DeckContent } from "@/lib/cards/model";
import { layoutCardLabels } from "@/lib/cards/layout";
import { createDefaultDeckContent, DEFAULT_CARD_LABEL_PREFIX, restoreCreatorCardTitle } from "@/lib/cards/creatorDefaults";

export function blankPrivateBoard() {
  const board = createBlankCreatorBoard();
  board.columns = board.columns.map((column) => column.kind === "card" ? { ...column, targetDate: "" } : { ...column, label: "Themes" });
  return board;
}
export function layoutCreatorColumns(board: BoardState) {
  const cards = layoutCardLabels(DEFAULT_CARD_LABEL_PREFIX, getCardColumns(board.columns)).map((column, index) => ({ ...column, cardLabel: column.label, position: index + 1 }));
  return board.columns.map((column) => column.kind === "card" ? cards.find((card) => card.id === column.id)! : { ...column, position: 0 });
}
export type CreatorBoardDTO = { root: { deckTemplateId: string }; content: DeckContent; publishedContent?: DeckContent | null;
  cards: { root: { cardTemplateId: string }; content: CardContent; publishedContent: CardContent | null }[] };
export function creatorBoard(dto: CreatorBoardDTO): BoardState {
  const board = createCreatorBoardFromTemplate({ deckTemplateId: dto.root.deckTemplateId, title: dto.content.title,
    category: dto.content.categories[0] ?? null, introduction: dto.content.introduction, streams: dto.content.themes,
    cards: layoutCardLabels(dto.content.labelPrefix, dto.cards).map((card) => ({ cardId: card.root.cardTemplateId, label: card.label, ...card.content })) });
  board.columns = board.columns.map((column) => {
    if (column.kind !== "card") return { ...column, label: "Themes" };
    const card = dto.cards.find((card) => card.root.cardTemplateId === column.cardId)!;
    return { ...column, cardTitle: card.content.intro.title ?? "",
      defaultCardTitle: restoreCreatorCardTitle(null, card.publishedContent?.intro.title) };
  });
  // UI slots have their own composite keys; canonical Step IDs stay on the pair content.
  const pairs: BoardState["pairs"] = {};
  for (const column of getCardColumns(board.columns)) for (const row of board.rows) {
    const cell = board.cells[getCreatorCellId(column.id, row)];
    const pair = board.pairs[cell.pairId!]; const id = `${column.cardId}:${pair.stepId}`;
    pairs[id] = { ...pair, id }; cell.pairId = id;
  }
  return { ...board, pairs };
}
export function privateGraph(board: BoardState, baseline?: CreatorBoardDTO | null) {
  const columns = getCardColumns(board.columns);
  const content: DeckContent = { ...(baseline?.content ?? createDefaultDeckContent(board.rows.map((row) => board.streamIdsByRow[row]))),
    title: board.deckTitle, introduction: board.deckIntroduction,
    themes: baseline ? [...board.rows.flatMap((row) => {
      const old = baseline.content.themes[row];
      const title = board.streamNamesByRow[row] ?? old?.title;
      return old || title ? [{ id: old?.id ?? board.streamIdsByRow[row], title: title ?? "" }] : [];
    }), ...baseline.content.themes.slice(board.rows.length)] :
      board.rows.map((row) => ({ id: board.streamIdsByRow[row], title: board.streamNamesByRow[row] ?? "" })),
    cards: columns.map((column) => ({ cardTemplateId: column.cardId! })) };
  const cards = columns.map((column) => {
    const original = baseline?.cards.find((card) => card.root.cardTemplateId === column.cardId)?.content;
    const card: CardContent = { ...(original ?? {}), suggestedTargetDate: column.targetDate ?? "",
      intro: { title: column.cardTitle === "" && original?.intro.title == null ? null : column.cardTitle ?? null, description: column.introDescription ?? null, mediaItem: column.introMediaItem ?? null },
      steps: board.rows.map((row) => {
        const pair = board.pairs[board.cells[getCreatorCellId(column.id, row)].pairId!];
        const old = original?.steps.find((step) => step.stepId === pair.stepId);
        const retained = { ...old };
        delete retained.title;
        delete retained.descriptionContent;
        return { ...retained, stepId: pair.stepId,
          ...(pair.stepTitle != null ? { title: pair.stepTitle } : {}), description: pair.stepText,
          ...(pair.stepDescriptionContent !== undefined ? { descriptionContent: pair.stepDescriptionContent } : {}),
          ...(original && old?.mediaItem === undefined && pair.stepMediaItem === null ? {} : { mediaItem: pair.stepMediaItem }) };
      }) };
    return { cardTemplateId: column.cardId!, content: card };
  });
  return { deckTemplateId: board.deckTemplateId, content, cards };
}

export function sessionBoardDTO(session: import("@/lib/cards/creatorSession").CreatorSessionDTO): CreatorBoardDTO {
  return { root: { deckTemplateId: session.deck.kind === "owned" ? session.deck.owned.root.deckTemplateId : session.deck.source.deckTemplateId },
    content: session.deck.kind === "owned" ? session.deck.owned.content : session.deck.content,
    cards: session.cards.map((card) => card.kind === "owned" ? card.owned : { root: { cardTemplateId: card.source.cardTemplateId }, content: card.content, publishedContent: card.content }) };
}
