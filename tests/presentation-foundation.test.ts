import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ActiveCardFront from "../src/components/cards/ActiveCardFront";
import DeckTile from "../src/components/decks/DeckTile";
import DeckScene from "../src/components/decks/DeckScene";
import FocusedCardView from "../src/components/decks/FocusedCardView";
import { buildCardLayout } from "../src/components/cards/cardLayout";
import { cardPresentationIdentity, hasPersonalCard, hasPersonalDeck, deckPresentationIdentity } from "../src/components/decks/presentation";
import { canonicalPresentationFixture } from "./fixtures/canonicalPresentation";

const deck = canonicalPresentationFixture(390), card = deck.cards[0];
const noop = () => undefined;
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
