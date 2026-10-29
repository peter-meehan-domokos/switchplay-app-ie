import assert from "node:assert/strict";
import { test } from "node:test";
import { creatorNavigation, currentDraftOrigin, deckCollectionTarget, deckReturnOrigin, infoCollectionTarget, infoEditorHref, safeDraftOrigin } from "../src/components/creator/creatorNavigation";
import { creatorDraftHref } from "../src/components/creator/creatorDraftEntries";

test("creation intent survives stable autosave URLs without leaking into ordinary editing", () => {
  const context = creatorNavigation({}, true);
  assert.equal(infoEditorHref("id", true, context), "/creator/info-cards/id?entry=create");
  assert.equal(creatorNavigation({ entry: "create" }).creating, true);
  assert.equal(creatorNavigation({}).creating, false);
  assert.equal(infoEditorHref("id", false, context), "/creator/info-cards/new?draft=id&entry=create");
});
test("draft context is bounded without overriding collection destinations", () => {
  const origin = "/creator/edit/deck?returnTo=library&returnDeckId=deck";
  const href = creatorDraftHref("info", "infoCard", origin);
  const params = Object.fromEntries(new URL(href, "http://test").searchParams);
  const context = creatorNavigation(params);
  assert.equal(context.creating, false);
  assert.equal(infoCollectionTarget("info").href, "/library?tab=info-cards");
  assert.equal(deckReturnOrigin({ draftOrigin: origin }, "deck"), "library");
  assert.equal(deckReturnOrigin({ draftOrigin: origin }, "other-deck"), undefined);
  assert.equal(currentDraftOrigin({ pathname: "/creator/info-cards/info", search: new URL(href, "http://test").search }), origin);
  assert.equal(creatorNavigation({ drafts: "1" }).openDrafts, true);
});

test("hybrid destinations use current visibility for new items and sticky owned origins", () => {
  const base = { creating: true, visibility: "private" as const, copied: false, id: "actual" };
  assert.deepEqual(deckCollectionTarget(base), { label: "My Decks", href: "/decks?reveal=actual" });
  assert.equal(deckCollectionTarget({ ...base, visibility: "public" }).label, "Library");
  assert.equal(deckCollectionTarget({ ...base, creating: false, origin: "library" }).label, "Library");
  assert.equal(deckCollectionTarget({ ...base, creating: false, visibility: "public", origin: "my-decks" }).label, "My Decks");
  assert.equal(deckCollectionTarget({ ...base, creating: false, origin: "library", copied: true }).label, "My Decks");
  assert.equal(deckCollectionTarget({ ...base, reveal: false }).href, "/decks");
  assert.equal(infoCollectionTarget("draft").href, "/library?tab=info-cards");
  assert.equal(infoCollectionTarget("info", 2).href, "/library?tab=info-cards&published=info");
  assert.equal(deckCollectionTarget({ ...base, visibility: "public" }).href, "/library");
  assert.equal(deckCollectionTarget({ ...base, visibility: "public", publicationVersion: 2 }).href, "/library?published=actual");
  assert.equal(deckCollectionTarget({ ...base, creating: false, origin: "my-decks", visibility: "public", publicationVersion: 2 }).href, "/decks?reveal=actual");
});
test("draft navigation accepts only internal creator routes and bounded query fields", () => {
  for (const path of ["https://evil.test/creator/new", "//evil.test/creator/new", "/decks", "/creator/new#other", "/creator/edit/..", "/creator/info-cards/%2e%2e"]) assert.equal(safeDraftOrigin(path), null);
  assert.equal(safeDraftOrigin("/creator/new?entry=create&drafts=1&draftOrigin=recursive&unexpected=1"), "/creator/new?entry=create");
  assert.equal(creatorDraftHref("id", "deck", "https://evil.test"), "/creator/edit/id");
});
