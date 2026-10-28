import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCreatorDraftEntries, creatorDraftHref } from "../src/components/creator/creatorDraftEntries";
import type { CreatorTransport } from "../src/components/creator/creatorRequest";
import { clientId } from "../src/lib/clientId";

test("My Drafts loads every independent info page and keeps types distinct from equal deck IDs", async () => {
  const seen: string[] = [];
  const request: CreatorTransport = async <T>(url: string) => {
    seen.push(url);
    if (url === "/api/creator/drafts") return [{ deckTemplateId: "same", title: "Deck", status: "unpublished", updatedAt: "2026-10-22" }] as T;
    return { items: [{ infoCardId: url.includes("offset=50") ? "last" : "same", draft: { title: "Info" }, updatedAt: "2026-10-23" }], nextOffset: url.includes("offset=50") ? null : 50 } as T;
  };
  const result = await loadCreatorDraftEntries(request);
  assert.equal(result.error, ""); assert.equal(result.items.length, 3); assert.equal(seen.length, 3);
  assert.equal(creatorDraftHref("same", "infoCard"), "/creator/info-cards/same"); assert.equal(creatorDraftHref("same", "deck"), "/creator/edit/same");
});
test("an unavailable info index does not hide existing deck drafts or claim a complete list", async () => {
  const request: CreatorTransport = async <T>(url: string) => {
    if (url !== "/api/creator/drafts") throw Error("INFO_INDEX_SETUP_REQUIRED");
    return [{ deckTemplateId: "deck", title: "Saved deck", updatedAt: "2026-10-22" }] as T;
  };
  const result = await loadCreatorDraftEntries(request); assert.equal(result.items.length, 1); assert.match(result.error, /Info Card drafts could not be loaded/);
});
test("LAN-safe IDs use cryptographic bytes without requiring randomUUID", () => {
  assert.match(clientId(), /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
  assert.notEqual(clientId(), clientId());
});
