import assert from "node:assert/strict";
import { test } from "node:test";
import { blankPrivateBoard, creatorBoard, privateGraph } from "../src/components/creator/cardArchitectureAdapter";
import { assertDisposableDatabase } from "../src/lib/cards/localDatabase";
import { selectAllVisibleUserCardMediaItems } from "../src/lib/userCardMedia";
import type { CreatorDTO } from "../src/lib/cards/readModels";
import { createStep } from "../src/lib/cards/domain";
import { WorkingCardStore } from "../src/lib/cards/workingCardStore";
import { buildCardLayout } from "../src/components/cards/cardLayout";
import { persistStepCompletionStatus, persistCardTargetDate, flushPersonalMutations } from "../src/lib/deckMutations";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BackCardMediaCarousel from "../src/components/decks/BackCardMediaCarousel";
function fixture(): CreatorDTO {
  const now = new Date();
  const content = { intro: { title: null, description: " Keep spaces ", mediaItem: { id: "intro", mediaType: "image" as const, src: "/intro.png", description: "Intro" } },
    suggestedTargetDate: "", mediaItem: { id: "top", mediaType: "image" as const, src: "/top.png", description: "Top" },
    steps: [ { ...createStep(" Text "), title: "Title", descriptionContent: [{ type: "link" as const, text: "Link", url: "https://example.com" }] }, createStep(), createStep() ] };
  const deck = { title: "Deck", introduction: null, categories: ["one", "two"], themes: [], cadence: { intervalDays: 14 }, labelPrefix: "Card", cards: [{ cardTemplateId: "card-global" }] };
  return { root: { deckTemplateId: "deck-global", ownerUserId: "alice", visibility: "private", latestVersion: 1, draft: null, revision: 1, forkedFrom: null, createdAt: now, updatedAt: now },
    content: deck, publishedContent: deck, cards: [{ root: { cardTemplateId: "card-global", stepIds: content.steps.map((step) => step.stepId), ownerUserId: "alice", visibility: "private", latestVersion: 1, draft: null, revision: 1, forkedFrom: null, createdAt: now, updatedAt: now }, content, publishedContent: content }] };
}
test("private Creator adapter preserves canonical content independently of UI geometry", () => {
  const dto = fixture(), board = creatorBoard(dto), graph = privateGraph(board, dto);
  assert.deepEqual(graph.content, dto.content); assert.deepEqual(graph.cards[0].content, dto.cards[0].content);
  assert.ok(Object.keys(board.pairs).every((key) => key.startsWith("card-global:")));
  const a = board.cells["card-1:0"], b = board.cells["card-1:2"]; board.cells["card-1:0"] = b; board.cells["card-1:2"] = a;
  const reordered = privateGraph(board, dto); assert.equal(reordered.cards[0].content.steps[2].stepId, dto.cards[0].content.steps[0].stepId);
  assert.deepEqual(reordered.cards[0].content.steps[2].descriptionContent, dto.cards[0].content.steps[0].descriptionContent);
});
test("new Creator drafts do not invent intrinsic target dates", () => {
  const graph = privateGraph(blankPrivateBoard()); assert.ok(graph.cards.every((card) => card.content.suggestedTargetDate === "")); assert.equal(graph.content.cadence.intervalDays, 7);
});
test("application guard refuses Atlas and non-disposable names before connecting", () => {
  assert.throws(() => assertDisposableDatabase("mongodb+srv://secret@example.com", "switchplay_phase2_test"));
  assert.throws(() => assertDisposableDatabase("mongodb://remote.example:27017", "switchplay_phase2_test"));
  assert.throws(() => assertDisposableDatabase("mongodb://127.0.0.1:27017", "production"));
  assert.throws(() => assertDisposableDatabase("mongodb://user:password@127.0.0.1:27017", "switchplay_phase2_test"));
  assert.doesNotThrow(() => assertDisposableDatabase("mongodb://127.0.0.1:27017/?replicaSet=test", "switchplay_phase2_test"));
});
test("trusted legacy images display without relaxing new upload validation", () => {
  const image = { id: "legacy", mediaType: "image" as const, description: "Legacy", src: "/legacy.png" };
  assert.deepEqual(selectAllVisibleUserCardMediaItems([image]), [image]);
});
test("trusted legacy media renders without interpreting a video page as an image", () => {
  const markup = renderToStaticMarkup(createElement(BackCardMediaCarousel, { items: [
    { id: "legacy", mediaType: "image", description: "Legacy image", src: "/legacy.png" },
    { id: "yt", mediaType: "video", provider: "youtube", description: "Stored video", assetId: "trusted", src: "https://example.invalid/embed/trusted", thumbnailSrc: "/trusted-thumb.png" },
  ] }));
  assert.match(markup, /src="\/legacy.png"/); assert.match(markup, /src="\/trusted-thumb.png"/);
  assert.match(markup, /back-card-media-carousel-play-affordance/); assert.doesNotMatch(markup, /src="https:\/\/example.invalid\/embed/);
});
test("global Card snapshots retain personal state without leaking Deck placement or user identity", () => {
  const content = fixture().cards[0].content;
  const card = buildCardLayout({ id: "card-global", label: "Card 1", adoptedVersion: 1, intro: content.intro,
    steps: content.steps.map((step) => ({ ...step, completionStatus: "done" })), targetDate: "2026-10-11", reflection: "Keep",
    mediaItems: [], chats: [], signals: content.steps.map((step) => ({ id: step.stepId, title: "", reading: 1, rawReading: 1, unit: null, order: "increasing" })) }, { currentUserId: "alice", users: [] });
  const store = new WorkingCardStore(); store.accept("alice", [card]);
  const placement = { ...card, label: "Card 7", reflection: "Stale", steps: card.steps.map((step) => ({ ...step, completionStatus: "todo" as const })) };
  assert.equal(store.project("alice", placement).label, "Card 7"); assert.equal(store.project("alice", placement).reflection, "Keep");
  assert.equal(store.project("alice", placement).steps[0].completionStatus, "done");
  assert.equal(store.project("bob", placement).reflection, "Stale");
  assert.equal(store.project("alice", { ...placement, adoptedVersion: 2 }).reflection, "Stale");
  store.accept("alice", [placement]); assert.equal(store.project("alice", card).reflection, "Stale");
  store.clearUser("alice"); assert.equal(store.personal("alice", card.id), undefined);
});
test("personal mutations serialize a global Card field across Deck contexts and flush before navigation", async () => {
  const original = globalThis.fetch, requests: { path: string; body: Record<string, unknown>; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = (input, init) => new Promise((resolve) => { requests.push({ path: String(input), body: JSON.parse(String(init?.body)), resolve }); });
  try {
    const first = persistStepCompletionStatus("deck-a", "global", "step-global", "inProgress");
    const second = persistStepCompletionStatus("deck-b", "global", "step-global", "done");
    const date = persistCardTargetDate("deck-a", "global", "2026-10-12");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests.length, 2); assert.equal(requests[0].body.cardTemplateId, "global"); assert.equal(requests[0].body.stepId, "step-global");
    requests[0].resolve(Response.json({ ok: true })); requests[1].resolve(Response.json({ ok: true })); await first; await date;
    await new Promise((resolve) => setImmediate(resolve)); assert.equal(requests.length, 3); assert.match(requests[2].path, /deck-b$/);
    let flushed = false; const flush = flushPersonalMutations().then(() => { flushed = true; });
    await new Promise((resolve) => setImmediate(resolve)); assert.equal(flushed, false);
    requests[2].resolve(Response.json({ ok: true })); await second; await flush; assert.equal(flushed, true);
  } finally { globalThis.fetch = original; }
});
