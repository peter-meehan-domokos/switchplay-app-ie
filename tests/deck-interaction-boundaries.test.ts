import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCardLayout } from "../src/components/cards/cardLayout";
import BackCardFaceContent from "../src/components/decks/BackCardFaceContent";
import MediaCentreControl from "../src/components/media/MediaCentreControl";
import type { ExperienceCardPresentation } from "../src/components/decks/presentation";
import { canonicalPresentationFixture } from "./fixtures/canonicalPresentation";

let GroupCardBack: typeof import("../src/components/group-experiences/GroupCardBack").default;
before(async () => {
  const requireForTest = createRequire(resolve("package.json")), previous = requireForTest.extensions[".css"];
  requireForTest.extensions[".css"] = module => { module.exports = {}; };
  try { GroupCardBack = (await import("../src/components/group-experiences/GroupCardBack")).default; }
  finally { if (previous) requireForTest.extensions[".css"] = previous; else delete requireForTest.extensions[".css"]; }
});
const noop = () => {};
const content = canonicalPresentationFixture(390).cards[0];
const personal = buildCardLayout({
  id: content.id, label: "Card 1", targetDate: "2026-11-09", intro: content.intro, steps: [],
  reflection: "Keep this known note", chats: [],
  mediaItems: [{ id: "image", mediaType: "image", src: "/photo.png", description: "Known photo" }],
  signals: [{ id: "s", title: "Prepare", reading: 5, rawReading: 5, unit: null, order: "increasing" }],
}, { currentUserId: "alice", users: [] });

test("Personal Deck back keeps complete media, signals and notes without interactive child controls", () => {
  const html = renderToStaticMarkup(createElement(BackCardFaceContent, { card: personal, deckTemplateId: "d", dateLabel: "9 Nov", variant: "deck", onOpenMedia: noop, onEditMedia: noop, onEditReflection: noop }));
  assert.match(html, /Known photo/); assert.match(html, /Keep this known note/); assert.match(html, /focused-card-signal-trace/);
  assert.match(html, /<span class="focused-card-back-media-action media-centre-control"/);
  assert.doesNotMatch(html, /back-card-media-carousel-item--button|reflection-fragment--editable|Adjust Prepare reading|aria-haspopup="dialog"/);
});
test("Personal focused back retains media, reflection and signal controls", () => {
  const html = renderToStaticMarkup(createElement(BackCardFaceContent, { card: personal, deckTemplateId: "d", dateLabel: "9 Nov", variant: "focused", onOpenMedia: noop, onEditMedia: noop, onEditReflection: noop }));
  assert.match(html, /back-card-media-carousel-item--button/); assert.match(html, /reflection-fragment--editable/);
  assert.match(html, /Adjust Prepare reading/); assert.match(html, /aria-label="Media Centre"/);
});
test("Group Deck signal markings remain passive even for a read-only follower", () => {
  const card: ExperienceCardPresentation = { ...content, surface: "experience", experienceId: "e", viewerUserId: "alice", dataIdentity: "read-only-group", canWriteLearning: false, completion: 0, confidence: null,
    learning: { items: content.steps.map(step => ({ stepId: step.stepId, completionStatus: "todo" })), signalReadings: [] },
    steps: content.steps.map(step => ({ ...step, completionStatus: "todo" })) };
  const passive = renderToStaticMarkup(createElement(GroupCardBack, { card, focused: false, readOnlyReason: "Only a Group Admin can change this value." }));
  assert.match(passive, /focused-card-signal-trace/); assert.doesNotMatch(passive, /focused-card-signal-slot--read-only|role="button"/);
  const focused = renderToStaticMarkup(createElement(GroupCardBack, { card, focused: true, readOnlyReason: "Only a Group Admin can change this value." }));
  assert.match(focused, /focused-card-signal-slot--read-only/); assert.doesNotMatch(focused, /Adjust .* reading/);
});
test("passive Media Centre preserves its icon and total without a button or focus target", () => {
  const passive = renderToStaticMarkup(createElement(MediaCentreControl, { total: 12 }));
  const focused = renderToStaticMarkup(createElement(MediaCentreControl, { total: 12, onOpen: noop }));
  for (const html of [passive, focused]) { assert.match(html, /media-centre-icon/); assert.match(html, /media-centre-count">12/); }
  assert.doesNotMatch(passive, /<button|tabindex|aria-haspopup/); assert.match(focused, /<button/);
});
