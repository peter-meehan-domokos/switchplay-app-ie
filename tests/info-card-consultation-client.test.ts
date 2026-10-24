import assert from "node:assert/strict";
import { test } from "node:test";
import { loadInfoConsultation, type ConsultationRequest } from "../src/components/info-cards/infoCardConsultationClient";
import type { InfoConsultationSnapshot, PublishedInfo } from "../src/lib/infoCards/model";

const request: ConsultationRequest = { actor: "alice", mainCardId: "main", version: 3, mode: "working", deckTemplateId: "deck", attachmentIds: ["a", "b"] };
const info: PublishedInfo = { infoCardId: "a", version: 7, visibility: "public", ownerUserId: "bob", creatorUsername: "bob",
  content: { title: "Signs", body: "Keep the sign.", seriesId: "s", mediaItem: null },
  series: { seriesId: "s", title: "Basics", createdByUserId: "carol", creatorUsername: "carol" } };
const snapshot = (): InfoConsultationSnapshot => ({ mainCardId: "main", mainCardVersion: 3,
  entries: [{ status: "available", info: structuredClone(info) }, { status: "unavailable" }] });
function result(value: unknown) { return Response.json(value, { headers: { "X-Personal-Viewer": "alice" } }); }

test("consultation client binds actor/main context without sending attachment IDs and pins publication metadata", async t => {
  const calls: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init }); return url === "/api/auth/me" ? Response.json({ user: { id: "alice" } }) : result(snapshot());
  });
  const cards = await loadInfoConsultation(request, new AbortController().signal);
  assert.equal(calls.length, 2); assert.equal(calls[0].url, "/api/card-templates/main/info-cards?mode=working&version=3&deckTemplateId=deck");
  assert.equal(calls[0].init?.cache, "no-store"); assert.equal(new Headers(calls[0].init?.headers).get("X-Personal-Viewer"), "alice");
  assert.equal(cards[0].unavailable, undefined);
  if (!cards[0].unavailable) assert.deepEqual(cards[0].publication, { infoCardId: "a", kind: "publication", version: 7 });
  assert.deepEqual(cards[1], { id: "main:unavailable:1", unavailable: true });
  assert.equal(JSON.stringify(cards[1]).includes('"b"'), false);
});

test("wrong actor header, main identity, main version, count and available position fail closed", async t => {
  for (const invalid of [
    { ...snapshot(), mainCardId: "other" }, { ...snapshot(), mainCardVersion: 4 }, { ...snapshot(), entries: [] },
    { ...snapshot(), entries: [{ status: "available", info: { ...info, infoCardId: "b" } }, { status: "unavailable" }] },
    { ...snapshot(), entries: [{ status: "available", info: { ...info, version: 0 } }, { status: "unavailable" }] },
  ]) {
    t.mock.method(globalThis, "fetch", async (url: string) => url === "/api/auth/me" ? Response.json({ user: { id: "alice" } }) : result(invalid));
    await assert.rejects(loadInfoConsultation(request, new AbortController().signal)); t.mock.restoreAll();
  }
  t.mock.method(globalThis, "fetch", async () => Response.json(snapshot(), { headers: { "X-Personal-Viewer": "bob" } }));
  await assert.rejects(loadInfoConsultation(request, new AbortController().signal), /unavailable/);
});

test("post-response account changes and cancellation cannot install private snapshot content", async t => {
  t.mock.method(globalThis, "fetch", async (url: string) => url === "/api/auth/me" ? Response.json({ user: { id: "bob" } }) : result(snapshot()));
  await assert.rejects(loadInfoConsultation(request, new AbortController().signal), /session changed/);
  t.mock.restoreAll();
  let release!: (value: Response) => void, reached!: () => void;
  const held = new Promise<Response>(resolve => { release = resolve; }), authStarted = new Promise<void>(resolve => { reached = resolve; });
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url !== "/api/auth/me") return result(snapshot()); reached(); return held;
  });
  const abort = new AbortController(), pending = loadInfoConsultation(request, abort.signal); await authStarted;
  abort.abort(); release(Response.json({ user: { id: "alice" } }));
  await assert.rejects(pending, { name: "AbortError" });
});
