import assert from "node:assert/strict";
import { test } from "node:test";
import { matchingAreaCards, rankAreaDecks, type AreaDeckDestination } from "../src/lib/frameworks/destinations";
import { frameworkFixtures, cardFixture } from "./fixtures/frameworks";
import { readProgressPosition, rememberProgressPosition, readProgressReturn, withProgressReturn, progressReturnHref } from "../src/lib/frameworks/progressNavigation";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";

test("Area matching deduplicates references but counts originals and forks independently, including nested ancestry", () => {
  const cards = [cardFixture("original"), cardFixture("fork", "original"), cardFixture("nested", "fork"), cardFixture("second"), cardFixture("unmapped")];
  const graph = new Map(cards.map((card) => [card.root.cardTemplateId, card.root])), frameworks = frameworkFixtures();
  assert.deepEqual(matchingAreaCards(frameworks[0], "skills", ["original", "fork", "fork", "nested", "second", "unmapped"], graph),
    { cardTemplateIds: ["original", "fork", "nested", "second"], incomplete: false });
  assert.deepEqual(matchingAreaCards(frameworks[1], "skills", ["second", "fork"], graph), { cardTemplateIds: ["fork"], incomplete: false });
  assert.equal(matchingAreaCards(frameworks[0], "skills", ["missing"], graph).incomplete, true);
  assert.deepEqual(matchingAreaCards(frameworks[0], "skills", ["unmapped"], graph), { cardTemplateIds: [], incomplete: false });
});
test("Deck ranking has deterministic count, title and identity tie breaks", () => {
  const entry = (id: string, title: string, count: number) => ({ deckTemplateId: id, front: { title }, matchingCardCount: count }) as AreaDeckDestination;
  assert.deepEqual(rankAreaDecks([entry("z", "Beta", 2), entry("b", "Alpha", 2), entry("a", "Alpha", 2), entry("c", "Low", 1), entry("d", "High", 3)]).map((entry) => entry.deckTemplateId), ["d", "a", "b", "z", "c"]);
});
test("Progress return destinations are local and session scroll remains actor/Framework scoped", () => {
  const context = readProgressReturn(new URLSearchParams("progressFramework=practice&progressArea=skills&progressRestored=1"))!;
  assert.equal(withProgressReturn("/decks?openDeck=deck&openCard=card", context), "/decks?openDeck=deck&openCard=card&progressFramework=practice&progressArea=skills&progressRestored=1");
  assert.equal(progressReturnHref(context), "/progress?framework=practice&area=skills");
  assert.equal(withProgressReturn("https://example.com/decks", context), "https://example.com/decks");
  assert.equal(withProgressReturn("/library/public-deck", context), "/library/public-deck?progressFramework=practice&progressArea=skills&progressRestored=1");
  assert.equal(withProgressReturn("/library", context), "/library");
  assert.equal(withProgressReturn("https://example.com/library/public-deck", context), "https://example.com/library/public-deck");
  assert.equal(withProgressReturn("/library/public-deck", null), "/library/public-deck");
  assert.equal(readProgressReturn(new URLSearchParams("progressFramework=%20bad")), null);
  const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  rememberProgressPosition(storage, "alice", "practice", 450);
  assert.equal(readProgressPosition(storage, "alice", "practice"), 450);
  assert.equal(readProgressPosition(storage, "bob", "practice"), null);
  assert.equal(readProgressPosition(storage, "alice", "other"), null);
  assert.equal(readProgressPosition({ getItem: () => "invalid" }, "alice", "practice"), null);
});
test("shared Deck front keeps canonical metadata private-free and static representations mount no player or interactive intro", async () => {
  const bundle = await build({ stdin: { contents: `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import Contents from "@/components/decks/DeckFrontContents";
    import { deckFrontPresentation } from "@/components/decks/deckFrontPresentation";
    export { deckFrontPresentation };
    export function render(front) { return renderToStaticMarkup(React.createElement(Contents, { front })); }
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", packages: "external", write: false, jsx: "automatic" });
  const fixtureModule = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve(process.cwd(), "package.json")), fixtureModule, fixtureModule.exports);
  const api = fixtureModule.exports as { deckFrontPresentation: (deck: unknown) => Record<string, unknown>; render: (front: unknown) => string };
  const common = { id: "deck", title: "A Path", category: null, ownerUsername: "owner", showOwnerTag: true, cards: [{ id: "card" }], streams: [] };
  const canonical = api.deckFrontPresentation({ ...common, surface: "canonical", progressPercentage: 77, confidenceScore: 9 });
  assert.equal(canonical.context, "canonical"); assert.equal("completion" in canonical, false); assert.equal("confidence" in canonical, false);
  const html = api.render({ ...canonical, hasIntroVideo: true });
  assert.equal(html.includes("77%"), false); assert.equal(html.includes("<video"), false); assert.equal(html.includes("<button"), false);
  const personal = api.render({ ...canonical, context: "personal", completion: 77, confidence: 9 });
  assert.ok(personal.includes("77%")); assert.ok(personal.includes("deck-tile-meta-confidence"));
});
