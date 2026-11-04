import assert from "node:assert/strict";
import { test, before } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { canonicalPresentationFixture } from "./fixtures/canonicalPresentation";
import { aggregateLearning } from "../src/lib/groupExperiences/readModels";
import { presentGroup } from "../src/components/group-experiences/groupPresentation";
import { cardPresentationIdentity, hasPersonalCard } from "../src/components/decks/presentation";
import ConfidencePair from "../src/components/group-experiences/ConfidencePair";
import CardSemanticAnchors from "../src/components/decks/CardSemanticAnchors";
import type { CardLayout } from "../src/components/cards/cardLayout";
import type { LoadedGroup } from "../src/components/group-experiences/groupResource";
let Front: typeof import("../src/components/cards/ActiveCardFront").default;
let Back: typeof import("../src/components/group-experiences/GroupCardBack").default;
before(async () => {
  const loader = createRequire(resolve("package.json")), previous = loader.extensions[".css"];
  loader.extensions[".css"] = module => { module.exports = {}; };
  try { Front = (await import("../src/components/cards/ActiveCardFront")).default; Back = (await import("../src/components/group-experiences/GroupCardBack")).default; }
  finally { if (previous) loader.extensions[".css"] = previous; else delete loader.extensions[".css"]; }
});
function fixture(): LoadedGroup {
  const deck = canonicalPresentationFixture(390);
  const group = deck.cards.map(card => ({ cardTemplateId: card.id, version: card.version,
    items: card.steps.map(step => ({ stepId: step.stepId, completionStatus: "todo" as const })),
    signalReadings: card.steps.map(step => ({ stepId: step.stepId, reading: null })) }));
  const statuses = ["inProgress", "inProgress", "inProgress", "done", "done", "skipped", ...Array(6).fill("todo")];
  const followers = statuses.map((status, i) => ({ userId: `subject${i}`, username: `Person ${i}`, learning: group.map(row => ({ ...row,
    items: row.items.map(item => ({ ...item, completionStatus: status })) })) }));
  return { bootstrap: { viewerUserId: "alice", experienceId: "experience", structureRevision: 0, adoptionRevision: 0, accessEpoch: 0,
    name: "Galway U18", deckTemplateId: deck.deckTemplateId, deckVersion: deck.version, isAdmin: true, isFollower: true, activeCardId: deck.cards[0].id,
    canInspectFollowers: true, allowFollowerInspection: true, selection: { perspective: "group" }, deck, group, own: group,
    ownDates: group.map(row => ({ cardTemplateId: row.cardTemplateId, targetDate: "2027-01-20" })), nextCardOffset: null,
    deferred: ["assessments", "private-content", "group-contributions"] }, followers,
    aggregates: aggregateLearning(group, followers.map(row => row.learning)).cards } as LoadedGroup;
}
test("group front/back render exact inline eligible counts and G/F without fake personal data", () => {
  const data = fixture(), card = presentGroup(data, { perspective: "group" }, true).cards[0];
  assert.equal(hasPersonalCard(card), false); assert.equal("targetDate" in card, false);
  const html = renderToStaticMarkup(React.createElement(Front, { card, dateLabel: "", variant: "focused", onCycleStepStatus: () => {} }));
  assert.match(html, />3\u00a0\u00a02<\/span>/); assert.match(html, /Update step progress/);
  assert.match(html, /Group confidence not set/); assert.match(html, /Follower confidence not set/);
  assert.match(html, /data-group-card=""/);
  const back = renderToStaticMarkup(React.createElement(Back, { card, focused: true, onChange: () => {} }));
  assert.match(back, />3\u00a0\u00a02<\/span>/); assert.match(back, /Adjust .* reading/); assert.doesNotMatch(back, /Update step progress|Add media|reflection|Test count/);
  const heading = back.split('class="group-back-heading">')[1].split("</p>")[0];
  assert(heading.indexOf('class="group-step-counts"') < heading.indexOf('class="step-progress-strip '));
  assert.equal((back.match(/class="group-confidence-pair"/g) ?? []).length, 1);
  assert.match(back, /data-group-card=""/);
  assert.doesNotMatch(back, /group-back-confidence/);
  assert.equal((back.match(/class="group-back-heading"/g) ?? []).length, card.steps.length);
  for (const focused of [false, true]) {
    const markup = renderToStaticMarkup(React.createElement(Back, { card, focused, onChange: () => {} }));
    assert.equal((markup.match(/class="group-confidence-pair"/g) ?? []).length, 1);
    assert.equal((markup.match(/focused-card-signal-trace/g) ?? []).length, card.steps.length);
  }
});
test("foreign learning has no editing affordance or private fields while own date remains owner-only", () => {
  const data = fixture(), foreign = presentGroup(data, { perspective: "follower", subjectUserId: "subject0" }, true).cards[0];
  const own = presentGroup(data, { perspective: "self" }, true).cards[0];
  const front = renderToStaticMarkup(React.createElement(Front, { card: foreign, dateLabel: "", variant: "focused", onCycleStepStatus: () => {} }));
  const back = renderToStaticMarkup(React.createElement(Back, { card: foreign, focused: true, onChange: () => {} }));
  assert.doesNotMatch(front + back, /Update step progress|Adjust .* reading|Private in this Group|2027/);
  assert.equal("ownerDate" in foreign, false); assert.equal(own.ownerDate, "2027-01-20");
  const ownHtml = renderToStaticMarkup(React.createElement(Front, { card: own, dateLabel: "", variant: "focused" }));
  assert.match(ownHtml, /Private in this Group/); assert.doesNotMatch(ownHtml, /<sup/);
  assert.equal(presentGroup(data, { perspective: "group" }, false).cards[0].canWriteLearning, false);
});
test("individual back headings contain only titles and progress, preserving signal graphics", () => {
  const data = fixture();
  const own = presentGroup(data, { perspective: "self" }, true).cards[0];
  const foreign = presentGroup(data, { perspective: "follower", subjectUserId: "subject0" }, true).cards[0];
  own.learning.signalReadings[0].reading = 6.4;
  for (const card of [own, foreign]) for (const focused of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(Back, { card, focused }));
    assert.doesNotMatch(html, /group-back-confidence|group-step-counts/);
    assert.equal((html.match(/focused-card-signal-trace/g) ?? []).length, card.steps.length);
    for (const heading of html.split('class="group-back-heading">').slice(1)) {
      assert.doesNotMatch(heading.split("</p>")[0], /—/);
      assert.match(heading.split("</p>")[0], /step-progress-strip/);
    }
  }
});
test("unset Card confidence is blank for personal and individual views on both faces; Group pairs remain", () => {
  const data = fixture();
  const own = presentGroup(data, { perspective: "self" }, true).cards[0];
  const foreign = presentGroup(data, { perspective: "follower", subjectUserId: "subject0" }, true).cards[0];
  const group = presentGroup(data, { perspective: "group" }, true).cards[0];
  // Only the fields consumed by the shared personal header are needed here.
  const personal = { label: own.label, signals: own.steps.map(() => ({ rawReading: null })), progressPercentage: 0 } as CardLayout;
  for (const variant of ["front", "back", "focused"] as const) {
    for (const card of [personal, own, foreign]) {
      const html = renderToStaticMarkup(React.createElement(CardSemanticAnchors, { card, dateLabel: "", variant }));
      assert.doesNotMatch(html, /—|group-confidence-pair/);
    }
    const html = renderToStaticMarkup(React.createElement(CardSemanticAnchors, { card: group, dateLabel: "", variant }));
    assert.equal((html.match(/group-confidence-missing/g) ?? []).length, 2);
    for (const card of [{ ...personal, signals: [{ rawReading: 6 }] } as CardLayout, { ...own, confidence: 6 }, { ...foreign, confidence: 6 }]) {
      const numeric = renderToStaticMarkup(React.createElement(CardSemanticAnchors, { card, dateLabel: "", variant }));
      assert.match(numeric, /Confidence 6 out of 10/);
      assert.match(numeric, />6<\/span>/);
    }
  }
});
test("physical Card identity survives subject changes while security identities remain distinct", () => {
  const data = fixture(), group = presentGroup(data, { perspective: "group" }, true).cards[0];
  const other = presentGroup(data, { perspective: "follower", subjectUserId: "subject0" }, true).cards[0];
  assert.equal(cardPresentationIdentity(group), cardPresentationIdentity(other)); assert.notEqual(group.dataIdentity, other.dataIdentity);
});
test("no active followers omits F; active followers without readings show a missing dash", () => {
  const empty = renderToStaticMarkup(React.createElement(ConfidencePair, { group: null, follower: null, activeTotal: 0 }));
  const unset = renderToStaticMarkup(React.createElement(ConfidencePair, { group: null, follower: null, activeTotal: 2 }));
  assert.doesNotMatch(empty, /Follower|>F</); assert.match(unset, /Follower confidence not set/); assert.doesNotMatch(unset, />0</);
});
test("Group Card confidence keeps both slots for all four states and zero followers", () => {
  for (const [group, follower] of [[7, 4], [7, null], [null, 4], [null, null]] as const) {
    const html = renderToStaticMarkup(React.createElement(ConfidencePair, { group, follower, activeTotal: 0, groupCard: true }));
    assert.match(html, /data-group-card=""/);
    assert.match(html, />G<\/sup>/); assert.match(html, />F<\/sup>/);
    assert.equal((html.match(/class="group-confidence-missing"/g) ?? []).length, Number(group === null) + Number(follower === null));
  }
});
