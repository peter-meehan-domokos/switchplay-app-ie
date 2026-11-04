import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchMediaCentreMetadata } from "../src/lib/mediaCollection/transport";
const context = { kind: "owner" as const, viewerUserId: "player", cardTemplateId: "card" };
const item = (n: number) => ({ source: { kind: "personal", cardTemplateId: "card", mediaItemId: `image-${n}` }, authorUserId: "player", mediaType: "image", description: `Photo ${n}`, uploadedAt: null, originName: "Personal", private: false });
test("opening Media Centre loads all metadata in bounded requests, oldest first, without extra controls", async () => {
  const original = global.fetch, calls: string[] = [];
  global.fetch = (async input => {
    const url = new URL(String(input), "http://local.test"); calls.push(url.search);
    const old = url.searchParams.has("cursor");
    return Response.json({ viewerUserId: "player", cardTemplateId: "card", total: 35, items: Array.from({ length: old ? 5 : 30 }, (_, n) => item(n + (old ? 0 : 5))), older: old ? null : "older", newer: null, olderCount: old ? 30 : 5 });
  }) as typeof fetch;
  try { const page = await fetchMediaCentreMetadata(context); assert.equal(page.items.length, 35); assert.deepEqual(page.items.map(i => i.description), Array.from({ length: 35 }, (_, n) => `Photo ${n}`)); assert.equal(calls.length, 2); assert.ok(calls.every(c => c.includes("limit=30"))); assert.equal(page.older, null); }
  finally { global.fetch = original; }
});
test("a changed authority or total while loading the rails fails closed", async () => {
  const original = global.fetch;
  global.fetch = (async input => { const older = String(input).includes("cursor="); return Response.json({ viewerUserId: "player", cardTemplateId: "card", total: older ? 34 : 35, items: Array.from({ length: older ? 4 : 30 }, (_, n) => item(n)), older: older ? null : "older", newer: null, olderCount: 0 }); }) as typeof fetch;
  try { await assert.rejects(fetchMediaCentreMetadata(context), /Media history changed/); } finally { global.fetch = original; }
});
