import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCardLayout } from "../src/components/cards/cardLayout";
import { buildDeckLayout, buildOptimisticDeckLayout } from "../src/components/decks/deckLayout";
import { cardPresentationIdentity, hasPersonalCard, hasPersonalDeck, deckPresentationIdentity } from "../src/components/decks/presentation";
import { canonicalPresentationFixture } from "./fixtures/canonicalPresentation";

let ActiveCardFront: typeof import("../src/components/cards/ActiveCardFront").default;
let DeckTile: typeof import("../src/components/decks/DeckTile").default;
let DeckScene: typeof import("../src/components/decks/DeckScene").default;
let FocusedCardView: typeof import("../src/components/decks/FocusedCardView").default;
before(async () => {
  // These assertions check server-rendered structure, not CSS or geometry.
  // Node/tsx has no CSS-module loader; limit its empty stub to component imports
  // and restore the process-local hook before any test body executes.
  const requireForTest = createRequire(resolve("package.json"));
  const previous = requireForTest.extensions[".css"];
  requireForTest.extensions[".css"] = module => { module.exports = {}; };
  try {
    [ActiveCardFront, DeckTile, DeckScene, FocusedCardView] = await Promise.all([
      import("../src/components/cards/ActiveCardFront").then(module => module.default),
      import("../src/components/decks/DeckTile").then(module => module.default),
      import("../src/components/decks/DeckScene").then(module => module.default),
      import("../src/components/decks/FocusedCardView").then(module => module.default),
    ]);
  } finally {
    if (previous) requireForTest.extensions[".css"] = previous; else delete requireForTest.extensions[".css"];
  }
});

const deck = canonicalPresentationFixture(390), card = deck.cards[0];
const noop = () => undefined;
const personalDeckFields = { deckTemplateId: "working", hasUserDeckData: true, createdAt: null, updatedAt: null,
  canMutate: true, isOwnedByCurrentUser: true, ownerUserId: "alice", ownerUsername: "Alice", showOwnerTag: false, introduction: null };
const working = buildCardLayout({
  id: card.id, cardTemplateId: card.id, label: card.label, intro: card.intro,
  targetDate: "2026-10-08", reflection: "Private reflection", chats: [], mediaItems: [], signals: [],
  steps: card.steps.map((step) => ({ ...step, completionStatus: "skipped" })),
  dataOwnerUserId: "alice", adoptedVersion: 1,
}, { currentUserId: "alice", users: [] });

test("canonical presentation inputs contain no fabricated personal projection", () => {
  assert.equal(hasPersonalDeck(deck), false); assert.equal(hasPersonalCard(card), false);
  for (const field of ["targetDate", "progressPercentage", "signals", "reflection", "mediaItems", "chats", "dataOwnerUserId"]) assert.equal(field in card, false);
  for (const step of card.steps) assert.equal("completionStatus" in step, false);
});

test("presentation identity separates surface, immutable version and working user", () => {
  assert.notEqual(cardPresentationIdentity(card), cardPresentationIdentity(working));
  assert.notEqual(cardPresentationIdentity(card), cardPresentationIdentity({ ...card, version: 2 }));
  assert.notEqual(cardPresentationIdentity(working), cardPresentationIdentity({ ...working, dataOwnerUserId: "bob" }));
  assert.notEqual(deckPresentationIdentity(deck), deckPresentationIdentity({ ...deck, version: 2 }));
});

test("canonical front reserves personal slots without dates, progress, or mutation controls", () => {
  const html = renderToStaticMarkup(React.createElement(ActiveCardFront, { card, dateLabel: "Private date", variant: "focused", onAdjustTargetDate: noop, onCycleStepStatus: noop, onOpenStepView: noop }));
  assert.match(html, /personal-date-slot/); assert.match(html, /personal-layout-slot/);
  assert.match(html, /role="button" tabindex="0"/);
  assert.doesNotMatch(html, /Private date|Move target date|Update step progress|Progress preview|completion-strip-fill/);
  assert.match(html, /Practice 1/); assert.match(html, /Instruction 1/);
});

test("working front retains dates, completion controls and calculated progress", () => {
  const html = renderToStaticMarkup(React.createElement(ActiveCardFront, { card: working, dateLabel: "8 Oct", variant: "focused", onAdjustTargetDate: noop, onCycleStepStatus: noop, onOpenStepView: noop }));
  assert.match(html, /8 Oct/); assert.match(html, /Move target date/);
  assert.match(html, /Current status: skipped/); assert.match(html, /Progress preview/);
});

test("canonical tiles and empty Decks use the shared renderer without personal values", () => {
  const tile = renderToStaticMarkup(React.createElement(DeckTile, { deck, onFrontCardAction: noop, onSelect: noop, onIntroAnchorChange: noop, transition: {} }));
  assert.match(tile, /3 cards/); assert.doesNotMatch(tile, /0%|Completed|null%/);
  const empty = renderToStaticMarkup(React.createElement(DeckScene, { deck: { ...deck, cards: [] }, onBack: noop, transition: {} }));
  assert.match(empty, /Presentation 390/); assert.doesNotMatch(empty, /deck-card is-active|focused-card-layer|0%|Confidence/);
});

test("canonical focused view structurally omits personal back face and editors", () => {
  const html = renderToStaticMarkup(React.createElement(FocusedCardView, {
    card, cardIndex: 0, totalCards: 3, deckTemplateId: deck.id, isDeckFlipped: true,
    onClose: noop, onPrevious: noop, onNext: noop, traversalDirection: "next", transition: {},
  }));
  assert.match(html, /focused-card-surface--front/);
  assert.doesNotMatch(html, /focused-card-surface--back|Card media|Edit reflection|Private reflection|Update step progress/);
});

test("working empty and unavailable progress reserves layout without fabricated percentages or completion", () => {
  const empty = buildDeckLayout({
    ...personalDeckFields, id: "empty-working", deckTemplateId: "empty-working", title: "Empty working Deck", category: null,
    introduction: null, streams: [], cards: [], activeCardId: "", dataOwnerUserId: "alice", hasUserDeckData: true,
  }, { currentUserId: "alice", users: [] });
  assert.equal(empty.progressPercentage, null);
  assert.equal(buildOptimisticDeckLayout(empty, []).progressPercentage, null);
  const tile = renderToStaticMarkup(React.createElement(DeckTile, { deck: empty, onFrontCardAction: noop, onSelect: noop, onIntroAnchorChange: noop, transition: {} }));
  assert.match(tile, /0 cards/); assert.doesNotMatch(tile, /0%|null%|NaN|Completed/);
  const scene = renderToStaticMarkup(React.createElement(DeckScene, { deck: empty, onBack: noop, transition: {} }));
  assert.doesNotMatch(scene, /Completion 0|Completed|null%|NaN/); assert.match(scene, /detail-progress personal-layout-slot/);
  const front = renderToStaticMarkup(React.createElement(ActiveCardFront, { card: { ...working, progressPercentage: null }, dateLabel: "8 Oct" }));
  assert.doesNotMatch(front, /completion-strip-fill|null%|NaN/); assert.match(front, /completion-strip personal-layout-slot/);
});

test("working all-skipped Card/Deck is 100%, while genuine zero remains visible", () => {
  assert.equal(working.progressPercentage, 100);
  const deck = buildDeckLayout({ ...personalDeckFields, id: "working", title: "Practice", category: null, streams: [], cards: [working],
    activeCardId: working.id, dataOwnerUserId: "alice", hasUserDeckData: true }, { currentUserId: "alice", users: [] });
  const tile = (value: typeof deck) => renderToStaticMarkup(React.createElement(DeckTile, { deck: value,
    onFrontCardAction: noop, onSelect: noop, onIntroAnchorChange: noop, transition: {} }));
  assert.equal(deck.progressPercentage, 100); assert.match(tile(deck), /Completed/);
  const front = renderToStaticMarkup(React.createElement(ActiveCardFront, { card: working, dateLabel: "8 Oct" }));
  assert.match(front, /width:100%/);
  const zero = buildOptimisticDeckLayout(deck, [buildCardLayout({ ...working,
    steps: working.steps.map((step) => ({ ...step, completionStatus: "todo" })) }, { currentUserId: "alice", users: [] })]);
  assert.equal(zero.progressPercentage, 0); assert.match(tile(zero), /0%/); assert.doesNotMatch(tile(zero), /Completed/);
});

test("static Item Card selection reuses content without players, nested actions, dates or personal state", () => {
  const selected = { ...card, intro: { ...card.intro, description: "Selection description" } };
  const html = renderToStaticMarkup(React.createElement(ActiveCardFront, { card: selected, dateLabel: "", staticSelection: true,
    variant: "focused", onOpenIntroView: noop, onOpenStepView: noop }));
  assert.match(html, /active-card-front/); assert.match(html, /Selection description/); assert.match(html, /Instruction 1/);
  assert.doesNotMatch(html, /<button|<video|role="button"|href=|Update step progress|Move target date|card-confidence/);
  const ordinary = renderToStaticMarkup(React.createElement(ActiveCardFront, { card: selected, dateLabel: "" }));
  assert.doesNotMatch(ordinary, /Selection description/);
});
