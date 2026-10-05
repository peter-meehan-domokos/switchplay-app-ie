import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultCardContent, createDefaultDeckContent, DEFAULT_CREATOR_CARD_TITLE, DEFAULT_CREATOR_DECK_TITLE,
  defaultCreatorThemeTitle, restoreCreatorCardTitle, restoreCreatorDeckTitle } from "../src/lib/cards/creatorDefaults";
import { cardPublicationIssue, deckPublicationIssue, sameContent } from "../src/lib/cards/publicationRules";
import { assertCardContent, assertDeckContent } from "../src/lib/cards/domain";
import { appendCreatorCard, createBlankCreatorBoard, getCardColumns, resolveCreatorStreamName } from "../src/components/creator/creatorBoardState";
import { blankPrivateBoard, creatorBoard, privateGraph } from "../src/components/creator/cardArchitectureAdapter";
import type { CreatorDTO } from "../src/lib/cards/readModels";
import { PATCH as retiredCardMutation } from "../src/app/api/deck-templates/[deckTemplateId]/cards/[cardTemplateId]/route";

const card = () => createDefaultCardContent(["step-a", "step-b", "step-c"]);
const deck = () => createDefaultDeckContent(["theme-a", "theme-b", "theme-c"]);

test("new Creator allocates stable local identity with zero Cards and shared defaults", () => {
  const board = createBlankCreatorBoard();
  assert.ok(board.deckTemplateId); assert.equal(board.deckTitle, DEFAULT_CREATOR_DECK_TITLE);
  assert.deepEqual(getCardColumns(board.columns), []); assert.deepEqual(board.pairs, {});
  assert.deepEqual(Object.values(board.streamNamesByRow), ["Theme 1", "Theme 2", "Theme 3"]);
  const graph = privateGraph(blankPrivateBoard());
  assert.deepEqual(graph.cards, []); assert.deepEqual(graph.content.cards, []);
  assert.equal(graph.content.cadence.intervalDays, 7); assert.equal(graph.content.labelPrefix, "Card");
  assertDeckContent(graph.content);
});

test("new Cards use My Next Card, sparse Steps, caller identities and independent defaults", () => {
  const first = card(), second = card(); first.steps[0].description = "Changed";
  assert.equal(second.steps[0].description, null); assert.equal(second.intro.title, DEFAULT_CREATOR_CARD_TITLE);
  assert.deepEqual(second.steps.map((step) => step.stepId), ["step-a", "step-b", "step-c"]);
  assertCardContent(second);
  const board = appendCreatorCard(appendCreatorCard(createBlankCreatorBoard()));
  assert.deepEqual(getCardColumns(board.columns).map((column) => column.cardTitle), ["My Next Card", "My Next Card"]);
  assert.equal(new Set(getCardColumns(board.columns).map((column) => column.cardId)).size, 2);
  assert.equal(new Set(Object.values(board.pairs).map((pair) => pair.stepId)).size, 6);
});

test("Theme fallback uses Theme N while nonblank stored/custom text is preserved", () => {
  assert.equal(resolveCreatorStreamName(0, "  "), "Theme 1");
  assert.equal(resolveCreatorStreamName(2, ""), "Theme 3");
  assert.equal(defaultCreatorThemeTitle(3), "Theme 4");
  assert.equal(resolveCreatorStreamName(0, " Stream 1 "), " Stream 1 ");
});

test("first Deck publication checks outer-trimmed title and exact reference prerequisites, including zero Cards", () => {
  for (const title of ["", "  ", "My Next Path", " My Next Path "]) {
    assert.equal(deckPublicationIssue(0, { ...deck(), title }, null, []), "DECK_FIRST_PUBLICATION_TITLE_REQUIRED");
  }
  const content = { ...deck(), title: " Training Plan " };
  assert.equal(deckPublicationIssue(0, content, null, []), null);
  assert.equal(content.title, " Training Plan ");
  for (const title of ["MyNext Path", "My Next  Path"]) assert.equal(deckPublicationIssue(0, { ...content, title }, null, []), null);
  content.cards.push({ cardTemplateId: "a" });
  assert.equal(deckPublicationIssue(0, content, null, []), "MISSING_CARD_REFERENCE");
  assert.equal(deckPublicationIssue(0, content, null, [{ cardTemplateId: "a", latestVersion: 0 }]), "UNPUBLISHED_CARDS_BLOCK_DECK");
  assert.equal(deckPublicationIssue(0, content, null, [{ cardTemplateId: "a", latestVersion: 1 }]), null);
});

test("first Card publication needs only its nondefault nonblank intro title; Steps may stay sparse", () => {
  for (const title of [null, "", " ", "My Next Card", " My Next Card "]) {
    assert.equal(cardPublicationIssue(0, { ...card(), intro: { ...card().intro, title } }, null), "CARD_FIRST_PUBLICATION_TITLE_REQUIRED");
  }
  for (const title of ["Custom", " My Next  Card "]) {
    const content = card(); content.intro.title = title;
    assertCardContent(content); assert.equal(cardPublicationIssue(0, content, null), null);
  }
});

test("later publication compares saved content to published content and does not reapply title rules", () => {
  const publishedCard = card(), draftCard = card(); draftCard.steps[0].description = "An edit";
  assert.equal(cardPublicationIssue(1, draftCard, publishedCard), null);
  assert.equal(cardPublicationIssue(1, card(), publishedCard), "NO_UNPUBLISHED_CHANGES");
  assert.equal(cardPublicationIssue(1, null, publishedCard), "NO_UNPUBLISHED_CHANGES");
  const publishedDeck = deck(), draftDeck = deck(); draftDeck.themes[0].title = "Changed";
  assert.equal(deckPublicationIssue(1, draftDeck, publishedDeck, []), null);
  assert.equal(deckPublicationIssue(1, deck(), publishedDeck, []), "NO_UNPUBLISHED_CHANGES");
  assert.equal(deckPublicationIssue(1, null, publishedDeck, []), "NO_UNPUBLISHED_CHANGES");
  assert.equal(sameContent({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), true);
  assert.equal(sameContent({ b: [1, 2] }, { b: [2, 1] }), false);
  assert.equal(sameContent({ a: undefined }, {}), false);
});

test("title clearing uses published baseline or creation default while preserving supplied nonblank text", () => {
  assert.equal(restoreCreatorDeckTitle(""), "My Next Path");
  assert.equal(restoreCreatorCardTitle(null), "My Next Card");
  assert.equal(restoreCreatorDeckTitle(" ", "Latest Deck"), "Latest Deck");
  assert.equal(restoreCreatorCardTitle("", "Latest Card"), "Latest Card");
  assert.equal(restoreCreatorDeckTitle("", "  "), "My Next Path");
  assert.equal(restoreCreatorCardTitle("", null), "My Next Card");
  assert.equal(restoreCreatorDeckTitle(" My Next  Path ", "Latest Deck"), " My Next  Path ");
});

test("old four-Card draft and stored My New Card content round-trip without normalization", () => {
  const now = new Date();
  const cards = Array.from({ length: 4 }, (_, index) => {
    const content = createDefaultCardContent([0, 1, 2].map((step) => `old-${index}-${step}`));
    content.intro.title = index === 0 ? "My New Card" : `Old ${index}`;
    return { root: { cardTemplateId: `old-card-${index}`, ownerUserId: "alice", visibility: "private" as const,
      latestVersion: 0, draft: content, stepIds: content.steps.map((step) => step.stepId), revision: 0, forkedFrom: null, createdAt: now, updatedAt: now }, content, publishedContent: null };
  });
  const content = { ...deck(), title: "Old draft", themes: [{ id: "old-theme", title: "Stream 1" }], cards: cards.map((card) => ({ cardTemplateId: card.root.cardTemplateId })) };
  const dto: CreatorDTO = { root: { deckTemplateId: "old-deck", ownerUserId: "alice", visibility: "private", latestVersion: 0,
    draft: content, revision: 0, forkedFrom: null, createdAt: now, updatedAt: now }, content, publishedContent: null, cards };
  const before = structuredClone(dto);
  const graph = privateGraph(creatorBoard(dto), dto);
  assert.deepEqual(graph.content, content); assert.deepEqual(graph.cards.map((card) => card.content), cards.map((card) => card.content));
  assert.deepEqual(dto, before);
});

test("retired nested canonical Card mutation returns a fixed response without any database lookup", async () => {
  const response = await retiredCardMutation();
  assert.equal(response.status, 410); assert.equal((await response.json()).code, "CARD_MUTATION_ROUTE_RETIRED");
});
