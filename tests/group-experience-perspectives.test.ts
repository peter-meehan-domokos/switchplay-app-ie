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
  assert.match(html, /3\/11 doing · 2\/11 done/); assert.match(html, /Update step progress/);
  assert.match(html, /Group confidence not set/); assert.match(html, /Follower confidence not set/);
  const back = renderToStaticMarkup(React.createElement(Back, { card, focused: true, onChange: () => {} }));
  assert.match(back, /3 · 2/); assert.match(back, /Adjust .* reading/); assert.doesNotMatch(back, /Update step progress|Add media|reflection|Test count/);
});
test("foreign learning has no editing affordance or private fields while own date remains owner-only", () => {
  const data = fixture(), foreign = presentGroup(data, { perspective: "follower", subjectUserId: "subject0" }, true).cards[0];
  const own = presentGroup(data, { perspective: "self" }, true).cards[0];
  const front = renderToStaticMarkup(React.createElement(Front, { card: foreign, dateLabel: "", variant: "focused", onCycleStepStatus: () => {} }));
  const back = renderToStaticMarkup(React.createElement(Back, { card: foreign, focused: true, onChange: () => {} }));
  assert.doesNotMatch(front + back, /Update step progress|Adjust .* reading|Private to you|2027/);
  assert.equal("ownerDate" in foreign, false); assert.equal(own.ownerDate, "2027-01-20");
  const ownHtml = renderToStaticMarkup(React.createElement(Front, { card: own, dateLabel: "", variant: "focused" }));
  assert.match(ownHtml, /Private to you/); assert.doesNotMatch(ownHtml, /<sup/);
  assert.equal(presentGroup(data, { perspective: "group" }, false).cards[0].canWriteLearning, false);
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
