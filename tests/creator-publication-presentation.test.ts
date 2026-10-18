import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CreatorPublishControl from "../src/components/creator/CreatorPublishControl";
import { cardPublicationPresentation, deckPublicationPresentation } from "../src/components/creator/creatorPublicationPresentation";
import { sameContent } from "../src/lib/cards/publicationRules";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { isPhase2MockVideo } from "../src/lib/phase2MediaFixture";
import nextConfig from "../next.config";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";

function lane<C>(content: C, published: C | null = null) {
  return { desired: structuredClone(content), ack: { root: { latestVersion: published ? 1 : 0, draft: published && sameContent(content, published) ? null : content }, content, publishedContent: published },
    dirty: false, running: null as unknown, error: null as { kind: string } | null, publishing: false, creationPending: false,
    pendingOperations: 0, tasks: [], uncertainSaves: [] as unknown[], uncertainPublication: null as unknown };
}
test("never-published default Deck/Card controls are hidden before and after persistence", () => {
  const deck = lane(createDefaultDeckContent(["t1", "t2", "t3"]));
  const card = lane(createDefaultCardContent(["a", "b", "c"]));
  for (const state of [deckPublicationPresentation({ ...deck, ack: null }, []), deckPublicationPresentation(deck, []), cardPublicationPresentation({ ...card, ack: null }), cardPublicationPresentation(card)]) {
    assert.equal(state.visible, false);
    assert.equal(state.cleanPublished, false); assert.equal(state.outstanding, false); assert.equal(state.eligible, false); assert.equal(state.blockedReason, null);
  }
});

for (const entity of ["Deck", "Card"] as const) {
  const deckDefault = createDefaultDeckContent(["t1", "t2", "t3"]);
  const deckChanged = { ...deckDefault, title: "A path", cards: [{ cardTemplateId: "a" }] };
  const cardDefault = createDefaultCardContent(["a", "b", "c"]);
  const cardChanged = { ...cardDefault, intro: { ...cardDefault.intro, title: "A Card" } };
  const cardBlocked = structuredClone(cardDefault); cardBlocked.steps[0].description = "Sparse content";
  const deckLater = { ...deckChanged, title: "A revised path" };
  const cardLater = { ...cardChanged, intro: { ...cardChanged.intro, title: "A revised Card" } };
  const savedCard = { cardTemplateId: "a", latestVersion: 1 };
  const cases = [
    { name: "never published and untouched", visible: false, outstanding: false, eligible: false, blocked: false, published: false,
      state: entity === "Deck" ? deckPublicationPresentation(lane(deckDefault), []) : cardPublicationPresentation(lane(cardDefault)) },
    { name: "never published with eligible changes", visible: true, outstanding: true, eligible: true, blocked: false, published: false,
      state: entity === "Deck" ? deckPublicationPresentation(lane(deckChanged), [savedCard]) : cardPublicationPresentation(lane(cardChanged)) },
    { name: "never published with blocked changes", visible: true, outstanding: true, eligible: false, blocked: true, published: false,
      state: entity === "Deck" ? deckPublicationPresentation(lane(deckChanged), [{ ...savedCard, latestVersion: 0 }]) : cardPublicationPresentation(lane(cardBlocked)) },
    { name: "published and clean", visible: true, outstanding: false, eligible: false, blocked: false, published: true,
      state: entity === "Deck" ? deckPublicationPresentation(lane(deckChanged, deckChanged), [savedCard]) : cardPublicationPresentation(lane(cardChanged, cardChanged)) },
    { name: "published with eligible changes", visible: true, outstanding: true, eligible: true, blocked: false, published: false,
      state: entity === "Deck" ? deckPublicationPresentation(lane(deckLater, deckChanged), [savedCard]) : cardPublicationPresentation(lane(cardLater, cardChanged)) },
    { name: "published with blocked changes", visible: true, outstanding: true, eligible: false, blocked: true, published: false,
      state: entity === "Deck" ? deckPublicationPresentation(lane(deckLater, deckChanged), [{ ...savedCard, latestVersion: 0 }])
        : cardPublicationPresentation({ ...lane(cardLater, cardChanged), error: { kind: "conflict" } }) },
  ];
  for (const expected of cases) test(`${entity} control: ${expected.name}`, () => {
    const state = expected.state;
    assert.equal(state.visible, expected.visible); assert.equal(state.outstanding, expected.outstanding);
    assert.equal(state.eligible, expected.eligible); assert.equal(state.cleanPublished, expected.published);
    assert.equal(!!state.blockedReason, expected.blocked);
    const html = renderToStaticMarkup(createElement(CreatorPublishControl, { label: entity, state, onPublish: () => {}, onBlocked: () => {} }));
    if (!expected.visible) { assert.equal(html, ""); return; }
    assert.match(html, expected.published ? />Published</ : />Publish</);
    assert.equal(html.includes("creator-save-button--published"), !expected.outstanding);
    assert.equal(html.includes('aria-label="Publication blocked"'), expected.blocked);
    if (expected.eligible || expected.blocked) assert.doesNotMatch(html, /disabled=/);
  });
  test(`${entity} visibility uses content and publication history, not root existence`, () => {
    const state = entity === "Deck" ? deckPublicationPresentation(lane(deckDefault, deckDefault), []) : cardPublicationPresentation(lane(cardDefault, cardDefault));
    assert.equal(state.visible, true); assert.equal(state.cleanPublished, true);
    // A local edit generation alone is not meaningful content.
    assert.equal(entity === "Deck" ? deckPublicationPresentation({ ...lane(deckDefault), dirty: true }, []).visible : cardPublicationPresentation({ ...lane(cardDefault), dirty: true }).visible, false);
  });
}
test("blocked Deck retains outstanding colour independently of eligibility", () => {
  const content = { ...createDefaultDeckContent([]), title: "Custom", cards: [{ cardTemplateId: "a" }] };
  const state = deckPublicationPresentation(lane(content), [{ cardTemplateId: "a", latestVersion: 0 }]);
  assert.equal(state.outstanding, true); assert.equal(state.eligible, false); assert.match(state.blockedReason!, /published at least once/);
  assert.equal(deckPublicationPresentation(lane(content), [{ cardTemplateId: "a", latestVersion: 1 }]).eligible, true);
});
test("sparse Card changes with default title are outstanding but title-blocked", () => {
  const content = createDefaultCardContent(["a", "b", "c"]); content.steps[0].description = "An edit";
  const state = cardPublicationPresentation(lane(content));
  assert.equal(state.outstanding, true); assert.match(state.blockedReason!, /My Next Card/);
  content.intro.title = "Custom"; assert.equal(cardPublicationPresentation(lane(content)).eligible, true);
});
test("Published requires history and no newer saved/local/uncertain work", () => {
  const content = createDefaultCardContent(["a", "b", "c"]), card = lane(content, content);
  assert.equal(cardPublicationPresentation(card).cleanPublished, true);
  card.desired.intro.title = "Local edit"; card.dirty = true;
  assert.equal(cardPublicationPresentation(card).cleanPublished, false);
  assert.equal(cardPublicationPresentation(card).outstanding, true);
  card.desired = structuredClone(content); card.dirty = false; card.uncertainSaves.push({});
  assert.equal(cardPublicationPresentation(card).cleanPublished, false);
});
test("Card changes do not change a clean Deck's publication presentation", () => {
  const content = { ...createDefaultDeckContent([]), title: "Path", cards: [{ cardTemplateId: "a" }] };
  const state = deckPublicationPresentation(lane(content, content), [{ cardTemplateId: "a", latestVersion: 2 }]);
  assert.equal(state.cleanPublished, true); assert.equal(state.outstanding, false);
});
test("save conflicts and uploads never masquerade as Published", () => {
  const content = createDefaultCardContent(["a", "b", "c"]), card = lane(content, content);
  card.pendingOperations = 1; assert.equal(cardPublicationPresentation(card).cleanPublished, false); assert.equal(cardPublicationPresentation(card).busy, true);
  card.pendingOperations = 0; card.desired.intro.title = "Local"; card.error = { kind: "conflict" };
  assert.match(cardPublicationPresentation(card).blockedReason!, /conflict/);
});
test("fixture notice requires both mock mode and synthetic identity", () => {
  assert.equal(isPhase2MockVideo("fixture-123", true), true);
  assert.equal(isPhase2MockVideo("fixture-123", false), false);
  assert.equal(isPhase2MockVideo("real-stream-uid", true), false);
});
test("Next output overrides are development-only, even with inherited test flags", () => {
  const previous = process.env.PHASE2_BROWSER_TEST, interactive = process.env.PHASE2_INTERACTIVE;
  try {
    process.env.PHASE2_BROWSER_TEST = "1"; process.env.PHASE2_INTERACTIVE = "0";
    assert.equal(nextConfig(PHASE_DEVELOPMENT_SERVER).distDir, ".next-phase2-test");
    assert.equal(nextConfig(PHASE_DEVELOPMENT_SERVER).typescript!.tsconfigPath, "phase2-test-results/tsconfig-test.json");
    for (const phase of [PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER]) {
      assert.equal(nextConfig(phase).distDir, undefined); assert.equal(nextConfig(phase).typescript, undefined);
    }
    process.env.PHASE2_INTERACTIVE = "1";
    assert.equal(nextConfig(PHASE_DEVELOPMENT_SERVER).distDir, ".next-phase2");
    assert.equal(nextConfig(PHASE_DEVELOPMENT_SERVER).typescript!.tsconfigPath, "phase2-test-results/tsconfig-dev.json");
    delete process.env.PHASE2_BROWSER_TEST; assert.equal(nextConfig(PHASE_DEVELOPMENT_SERVER).distDir, undefined);
  } finally {
    if (previous === undefined) delete process.env.PHASE2_BROWSER_TEST; else process.env.PHASE2_BROWSER_TEST = previous;
    if (interactive === undefined) delete process.env.PHASE2_INTERACTIVE; else process.env.PHASE2_INTERACTIVE = interactive;
  }
});

test("visibility-only publication work is active and public Decks explain private Card blocking", () => {
  const deck = { ...createDefaultDeckContent([]), title: "Programme", cards: [{ cardTemplateId: "card" }] };
  const deckLane = lane(deck, deck);
  const stagedDeck = { ...deckLane, ack: { ...deckLane.ack, root: { ...deckLane.ack.root, draft: deck,
    visibility: "private" as const, draftVisibility: "public" as const } } };
  const blocked = deckPublicationPresentation(stagedDeck, [{ cardTemplateId: "card", latestVersion: 1, visibility: "private" }]);
  assert.equal(blocked.outstanding, true); assert.equal(blocked.cleanPublished, false); assert.equal(blocked.eligible, false);
  assert.match(blocked.blockedReason!, /published publicly/);
  assert.equal(deckPublicationPresentation(stagedDeck, [{ cardTemplateId: "card", latestVersion: 1, visibility: "public" }]).eligible, true);
  const card = createDefaultCardContent(["a", "b", "c"]), cardLane = lane(card, card);
  assert.equal(cardPublicationPresentation({ ...cardLane, ack: { ...cardLane.ack, root: { ...cardLane.ack.root, draft: card,
    visibility: "private", draftVisibility: "public" } } }).eligible, true);
});
