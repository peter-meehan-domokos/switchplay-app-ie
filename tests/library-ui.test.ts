import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CardCreatorAttribution from "../src/components/cards/CardCreatorAttribution";
import { deckEntryAction, workingDeckHref, libraryFetch, LibraryRequestError } from "../src/components/library/libraryClient";
import { canonicalPresentationFixture } from "./fixtures/canonicalPresentation";
import { publishedVideoGuard } from "../src/components/media/publishedVideo";

test("Library primary actions and exact Card navigation remain separate", () => {
  assert.equal(deckEntryAction("not-added"), "Add to My Decks");
  assert.equal(deckEntryAction("active"), "Open in My Decks");
  assert.equal(deckEntryAction("archived"), "Restore to My Decks");
  assert.equal(workingDeckHref("deck x", "card x"), "/decks?openDeck=deck+x&openCard=card+x");
});
test("Card attribution renders neutral fallback or current creator, not technical provenance", () => {
  const card = canonicalPresentationFixture(390).cards[0];
  assert.match(renderToStaticMarkup(React.createElement(CardCreatorAttribution, { card })), /Unknown creator/);
  const html = renderToStaticMarkup(React.createElement(CardCreatorAttribution, { card: { ...card, creator: { username: "Alice", immediateSourceUsername: "Bob" } } }));
  assert.match(html, /Alice/); assert.match(html, /show source creator/);
  assert.doesNotMatch(html, /dataOwnerUserId|cardTemplateId|Bob/); // Source appears only on request.
});
test("long creator usernames retain their complete accessible name in the bounded attribution label", () => {
  const username = "a_creator_with_an_exceptionally_long_username";
  const card = { ...canonicalPresentationFixture(390).cards[0], creator: { username, immediateSourceUsername: "Earlier creator" } };
  const html = renderToStaticMarkup(React.createElement(CardCreatorAttribution, { card }));
  assert.match(html, /class="card-creator-name"/);
  assert.ok(html.includes(`title="${username}"`));
  assert.ok(html.includes(`aria-label="Card creator ${username}; show source creator"`));
});
test("published video checks are lazy, version-scoped and reused only inside one playback context", async () => {
  const original = globalThis.fetch, urls: string[] = [];
  globalThis.fetch = async (input) => { urls.push(String(input)); return Response.json({ status: "ready" }); };
  try {
    const guard = publishedVideoGuard("card", "x", 3);
    assert.equal(urls.length, 0);
    const video = { id: "i", description: "", mediaType: "video" as const, provider: "cloudflare-stream" as const, assetId: "uid", src: "https://videodelivery.net/uid/manifest/video.m3u8" };
    await guard(video, new AbortController().signal); await guard(video, new AbortController().signal);
    assert.equal(urls.length, 1); assert.match(urls[0], /kind=card&templateId=x&version=3&assetId=uid/);
    await publishedVideoGuard("card", "x", 4)(video, new AbortController().signal);
    assert.equal(urls.length, 2);
  } finally { globalThis.fetch = original; }
});
test("Library API failures remain explicit and stale-preview codes remain available to the modal", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ code: "LIBRARY_PREVIEW_CONFLICT" }, { status: 409 });
  try { await assert.rejects(libraryFetch("/preview", new AbortController().signal), (error) => error instanceof LibraryRequestError && error.code === "LIBRARY_PREVIEW_CONFLICT"); }
  finally { globalThis.fetch = original; }
});
