import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ActiveCardFront from "../src/components/cards/ActiveCardFront";
import DeckTile from "../src/components/decks/DeckTile";
import { canonicalMediaDTO, libraryCardPresentation, libraryDeckPresentation, previewManifest } from "../src/lib/cards/libraryProjection";
import { decodeLibraryCursor, libraryCollection, libraryDetail, libraryViewerStatus } from "../src/lib/cards/libraryReadModels";
import { libraryQuery } from "../src/lib/cards/libraryHttp";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import type { CardRepository } from "../src/lib/cards/repository";
import type { CardTemplateVersion, DeckTemplateVersion } from "../src/lib/cards/model";

test("Library media allow-list strips nested operational/personal fields without changing playback identifiers", () => {
  const media = { id: "v", description: "Instruction", mediaType: "video" as const, provider: "cloudflare-stream" as const,
    assetId: "uid", src: "https://videodelivery.net/uid", width: 1920, height: 1080, thumbnailSrc: "https://example.invalid/poster",
    uploadUrl: "secret", personalMedia: "private", receipt: { private: true } };
  assert.deepEqual(canonicalMediaDTO(media), { id: "v", description: "Instruction", mediaType: "video", provider: "cloudflare-stream",
    assetId: "uid", src: media.src, width: 1920, height: 1080, thumbnailSrc: media.thumbnailSrc });
  assert.deepEqual(canonicalMediaDTO({ id: "image", description: "Legacy", mediaType: "image", src: "/image.png" }),
    { id: "image", description: "Legacy", mediaType: "image", src: "/image.png" });
});

test("Library DTOs contain presentation and immutable selections, never roots, receipts, Step ancestry or fabricated personal state", () => {
  const content = createDefaultCardContent(["a", "b", "c"]);
  content.steps[0].forkedFrom = { cardTemplateId: "private-source", version: 1, stepId: "private-step" };
  const cardVersion: CardTemplateVersion = { cardTemplateId: "x", version: 2, visibility: "public", content,
    publishedAt: new Date(), publishedByUserId: "internal-user-id", forkPublicationReceipt: { revision: 42 } };
  const card = libraryCardPresentation(cardVersion, "Card 1", { username: "Alice", immediateSourceUsername: "Bob" });
  const deckVersion: DeckTemplateVersion = { deckTemplateId: "d", version: 3, visibility: "public",
    publishedAt: new Date(), publishedByUserId: "internal-user-id", copyReceipt: { revision: 42, cardTemplateId: "x", contentHash: "secret" },
    content: { ...createDefaultDeckContent([]), title: "Published", cards: [{ cardTemplateId: "x", cardVersionAtPublish: 1 }] } };
  const deck = libraryDeckPresentation(deckVersion, "Alice", [card]);
  assert.deepEqual(previewManifest(deck), { deckTemplateId: "d", deckVersion: 3, cards: [{ cardTemplateId: "x", version: 2 }] });
  const json = JSON.stringify(deck);
  for (const key of ["publishedByUserId", "forkPublicationReceipt", "copyReceipt", "revision", "forkedFrom", "private-source", "internal-user-id",
    "targetDate", "completionStatus", "signalReadings", "reflection", "tests", "chats", "historySourceCardTemplateId", "draftVisibility"]) assert.equal(json.includes(key), false, key);
  assert.equal(deck.surface, "canonical"); assert.equal(deck.cards[0].creator.immediateSourceUsername, "Bob");
  const front = renderToStaticMarkup(React.createElement(ActiveCardFront, { card, dateLabel: "", variant: "focused" }));
  assert.match(front, /personal-layout-slot/); assert.doesNotMatch(front, /completion-strip-fill|Move target date|Update step progress/);
  const noop = () => undefined;
  const tile = renderToStaticMarkup(React.createElement(DeckTile, { deck, transition: {}, onSelect: noop, onFrontCardAction: noop, onIntroAnchorChange: noop }));
  assert.match(tile, /Published/); assert.doesNotMatch(tile, /0%|Confidence|Completed/);
  for (const visibility of ["private", undefined] as const) {
    assert.throws(() => libraryCardPresentation({ ...cardVersion, visibility }, "Card 1", card.creator), { code: "LIBRARY_CARD_FORBIDDEN" });
    assert.throws(() => libraryDeckPresentation({ ...deckVersion, visibility }, "Alice", [card]), { code: "LIBRARY_DECK_FORBIDDEN" });
  }
});

test("Library cursors validate timestamp, shape and bounds; query parameters cannot select personal/private/history modes", () => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  assert.deepEqual(decodeLibraryCursor(encode({ v: 1, publishedAt: null, deckTemplateId: "d" })), { publishedAt: null, deckTemplateId: "d" });
  assert.deepEqual(decodeLibraryCursor(encode({ v: 1, publishedAt: "2026-10-08T10:00:00.000Z", deckTemplateId: "d" })),
    { publishedAt: "2026-10-08T10:00:00.000Z", deckTemplateId: "d" });
  for (const invalid of ["!", "", encode(null), encode({ v: 2, publishedAt: null, deckTemplateId: "d" }), encode({ v: 1, publishedAt: "bad", deckTemplateId: "d" }),
    encode({ v: 1, publishedAt: null, deckTemplateId: { $gt: "" } }), encode({ v: 1, publishedAt: null, deckTemplateId: "d", actor: "bob" })]) {
    assert.throws(() => decodeLibraryCursor(invalid), { code: "INVALID_LIBRARY_CURSOR" });
  }
  for (const parameter of ["actor", "version", "draft", "mode"]) assert.throws(() => libraryQuery(new Request(`http://localhost/library?${parameter}=1`), []), { code: "INVALID_LIBRARY_QUERY" });
});

test("Library reads require an actor and propagate database failures rather than returning an empty/unavailable collection", async () => {
  const failure = new Error("database unavailable");
  const repo = { transaction: async () => { throw failure; } } as unknown as CardRepository;
  await assert.rejects(libraryCollection(repo, ""), { code: "LIBRARY_AUTHENTICATION_REQUIRED" });
  await assert.rejects(libraryDetail(repo, "", "d"), { code: "LIBRARY_AUTHENTICATION_REQUIRED" });
  await assert.rejects(libraryViewerStatus(repo, "", { deckTemplateIds: [], cardTemplateIds: [] }), { code: "LIBRARY_AUTHENTICATION_REQUIRED" });
  await assert.rejects(libraryCollection(repo, "alice"), (error) => error === failure);
  await assert.rejects(libraryDetail(repo, "alice", "d"), (error) => error === failure);
  for (const limit of [0, 51, 1.5]) await assert.rejects(libraryCollection(repo, "alice", { limit }), { code: "INVALID_LIBRARY_LIMIT" });
});
