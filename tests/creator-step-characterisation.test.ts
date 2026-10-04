import assert from "node:assert/strict";
import test from "node:test";
import {
  createCreatorBoardFromTemplate, creatorBoardToDeckTemplate, getCreatorCellId, getNextCardDate,
  moveCreatorStepToEmptyCell, type BoardState,
} from "../src/components/creator/creatorBoardState";
import { createCurrentDeckFixture } from "./fixtures/currentDeck";

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

function createBoard(): BoardState {
  return freezeDeep(createCreatorBoardFromTemplate(createCurrentDeckFixture().template));
}

test("Creator round-trip retains Card/Step IDs, text, titles, rich text, dates, themes and canonical media", () => {
  const { template } = createCurrentDeckFixture();
  const board = createCreatorBoardFromTemplate(freezeDeep(template));
  assert.deepEqual(creatorBoardToDeckTemplate(freezeDeep(board)), template);
});

test("Creator round-trip currently omits optional legacy signal definitions", () => {
  const { template } = createCurrentDeckFixture();
  template.cards[0].signals = [{
    signalId: "legacy-signal", title: "Legacy confidence", order: "increasing",
    minValue: 1, maxValue: 10, unit: null,
  }];
  const output = creatorBoardToDeckTemplate(createCreatorBoardFromTemplate(template));
  assert.equal(output.cards[0].signals, undefined);
  assert.deepEqual(output.cards[0].steps, template.cards[0].steps);
});

test("Creator new-Card dates use hardcoded seven-day cadence after the last Card, or UTC today if invalid", () => {
  const board = createCreatorBoardFromTemplate(createCurrentDeckFixture().template);
  assert.equal(getNextCardDate(board.columns), "2026-06-15");
  board.columns[board.columns.length - 1].targetDate = "invalid";
  assert.equal(getNextCardDate(board.columns, new Date("2026-03-01T23:59:00Z")), "2026-03-08");
});

test("same-Card Step drag swaps content and Step IDs with an empty slot, retaining UI pair/cell keys", () => {
  const board = createBoard();
  const moved = moveCreatorStepToEmptyCell(board, "a-1", getCreatorCellId("card-1", 2));
  assert.notEqual(moved, board);
  assert.equal(moved.cells, board.cells);
  assert.deepEqual(moved.pairs["a-empty"], { ...board.pairs["a-1"], id: "a-empty" });
  assert.deepEqual(moved.pairs["a-1"], { ...board.pairs["a-empty"], id: "a-1" });
  const output = creatorBoardToDeckTemplate(moved);
  assert.deepEqual(output.cards[0].steps, [
    createCurrentDeckFixture().template.cards[0].steps[2],
    createCurrentDeckFixture().template.cards[0].steps[1],
    createCurrentDeckFixture().template.cards[0].steps[0],
  ]);
  assert.deepEqual(output.cards[1], createCurrentDeckFixture().template.cards[1]);
});

test("legacy cross-Card Step drag transfers identity/content and returns destination empty Step identity to source", () => {
  const board = createBoard();
  const moved = moveCreatorStepToEmptyCell(board, "a-1", getCreatorCellId("card-2", 1));
  const { template } = createCurrentDeckFixture();
  const output = creatorBoardToDeckTemplate(moved);
  assert.equal(moved.cells, board.cells);
  assert.deepEqual(output.cards[0].steps[0], template.cards[1].steps[1]);
  assert.deepEqual(output.cards[1].steps[1], template.cards[0].steps[0]);
  assert.deepEqual(output.cards[0].steps.slice(1), template.cards[0].steps.slice(1));
  assert.deepEqual([output.cards[1].steps[0], output.cards[1].steps[2]], [template.cards[1].steps[0], template.cards[1].steps[2]]);
  assert.deepEqual(output.cards.map((card) => card.cardId), ["card-001", "card-002"]);
});

test("individual Step drag is a no-op for occupied, same, absent, theme, or empty-source slots", () => {
  const board = createBoard();
  assert.equal(moveCreatorStepToEmptyCell(board, "a-1", "card-1:1"), board);
  assert.equal(moveCreatorStepToEmptyCell(board, "a-1", "card-1:0"), board);
  assert.equal(moveCreatorStepToEmptyCell(board, "a-1", "card-99:0"), board);
  assert.equal(moveCreatorStepToEmptyCell(board, "a-1", "streams:0"), board);
  assert.equal(moveCreatorStepToEmptyCell(board, "a-empty", "card-2:1"), board);
  assert.equal(moveCreatorStepToEmptyCell(board, "missing", "card-2:1"), board);
});
