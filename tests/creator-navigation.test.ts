import assert from "node:assert/strict";
import { test } from "node:test";
import { creatorNavigation, currentDraftOrigin, draftsReturnTarget, infoEditorHref, safeDraftOrigin } from "../src/components/creator/creatorNavigation";
import { creatorDraftHref } from "../src/components/creator/creatorDraftEntries";

test("creation intent survives stable autosave URLs without leaking into ordinary editing", () => {
  const context = creatorNavigation({}, true);
  assert.equal(infoEditorHref("id", true, context), "/creator/info-cards/id?entry=create");
  assert.equal(creatorNavigation({ entry: "create" }).creating, true);
  assert.equal(creatorNavigation({}).creating, false);
  assert.equal(infoEditorHref("id", false, context), "/creator/info-cards/new?draft=id&entry=create");
});
test("draft returns reopen the originating dialog and do not grow recursive origins", () => {
  const origin = "/creator/edit/deck?returnTo=library&returnDeckId=deck";
  const href = creatorDraftHref("info", "infoCard", origin);
  const params = Object.fromEntries(new URL(href, "http://test").searchParams);
  const context = creatorNavigation(params);
  assert.equal(context.creating, false);
  assert.equal(draftsReturnTarget(context.draftOrigin!).href, origin + "&drafts=1");
  assert.equal(currentDraftOrigin({ pathname: "/creator/info-cards/info", search: new URL(href, "http://test").search }), origin);
  assert.equal(creatorNavigation({ drafts: "1" }).openDrafts, true);
});
test("draft navigation accepts only internal creator routes and bounded query fields", () => {
  for (const path of ["https://evil.test/creator/new", "//evil.test/creator/new", "/decks", "/creator/new#other", "/creator/edit/..", "/creator/info-cards/%2e%2e"]) assert.equal(safeDraftOrigin(path), null);
  assert.equal(safeDraftOrigin("/creator/new?entry=create&drafts=1&draftOrigin=recursive&unexpected=1"), "/creator/new?entry=create");
  assert.equal(creatorDraftHref("id", "deck", "https://evil.test"), "/creator/edit/id");
});
