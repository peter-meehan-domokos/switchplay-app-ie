import assert from "node:assert/strict";
import { test } from "node:test";
import { preparePersonalIntroduction, openPersonalPreparation } from "../src/lib/cards/personalPreparationClient";
import { workingCardStore } from "../src/lib/cards/workingCardStore";
import { retainedMediaPreview } from "../src/lib/mediaCollection/controller";
import { workingRequest, workingReadBatch, WorkingRequestError } from "../src/components/decks/updateClient";
import type { preparePersonalDeck } from "../src/lib/cards/preparation";
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
function fixture() {
  const actor = `intro-${Math.random()}`;
  const value = { viewerUserId: actor, deck: { id: "d", deckTemplateId: "d", dataOwnerUserId: actor, adoptedVersion: 1,
    cards: [{ id: "c", cardTemplateId: "c", adoptedVersion: 1, targetDate: null, mediaItems: [] }], preparedAssessments: { c: { viewerUserId: actor, cardTemplateId: "c" } } },
    contributions: { media: { c: { viewerUserId: actor, cardTemplateId: "c", items: [], total: 0, start: 0, olderCount: 0, older: null, newer: null, refresh: null } },
      reflections: { c: { viewerUserId: actor, cardTemplateId: "c", view: { kind: "personal" }, items: [] } } } } as unknown as Awaited<ReturnType<typeof preparePersonalDeck>>;
  return { actor, value };
}
test("introduction preparation shares a read and entering early joins it before genuine opening initialisation", async () => {
  const f = fixture(), held = gate(), calls: { method: string; body: unknown }[] = [];
  const request: typeof workingRequest = async (_actor, _url, method = "GET", body) => {
    calls.push({ method, body });
    if (method === "GET") { await held.promise; return structuredClone(f.value) as never; }
    return { ...structuredClone(f.value), reusePrepared: true, contributions: { media: {}, reflections: {} },
      deck: { ...f.value.deck, openedAt: "2026-11-09T12:00:00.000Z", cards: f.value.deck.cards.map(card => ({ ...card, targetDate: "2026-11-09" })), preparedAssessments: undefined } } as never;
  };
  try {
    const first = preparePersonalIntroduction(f.actor, "d", undefined, request), second = preparePersonalIntroduction(f.actor, "d", undefined, request);
    assert.equal(first, second);
    const opening = openPersonalPreparation(f.actor, "d", { localDate: "2026-11-09" }, request); await tick();
    assert.deepEqual(calls.map(c => c.method), ["GET"]);
    held.release(); const [, entry] = await Promise.all([first, opening]);
    assert.deepEqual(calls.map(c => c.method), ["GET", "POST"]);
    assert.ok((calls[1].body as { preparedComposition: string }).preparedComposition);
    assert.equal(entry.prepared.deck.cards[0].targetDate, "2026-11-09");
    assert.ok(entry.prepared.deck.preparedAssessments?.c);
    assert.equal(retainedMediaPreview({ kind: "owner", viewerUserId: f.actor, cardTemplateId: "c" }).snapshot().page!.total, 0);
    await preparePersonalIntroduction(f.actor, "d", undefined, request); assert.equal(calls.length, 2, "accepted preparation survives a later introduction");
  } finally { held.release(); workingCardStore.clearUser(f.actor); }
});
test("a failed speculative read does not prevent a genuine complete opening retry", async () => {
  const f = fixture(), held = gate(), calls: string[] = [];
  const request: typeof workingRequest = async (_actor, _url, method = "GET") => { calls.push(method);
    if (method === "GET") { await held.promise; throw Error("Temporary offline"); } return f.value as never;
  };
  try {
    const prep = preparePersonalIntroduction(f.actor, "d", undefined, request); const failure = assert.rejects(prep);
    const opening = openPersonalPreparation(f.actor, "d", { localDate: "2026-11-09" }, request);
    held.release(); await failure; assert.ok((await opening).prepared.deck.preparedAssessments); assert.deepEqual(calls, ["GET", "POST"]);
  } finally { held.release(); workingCardStore.clearUser(f.actor); }
});
test("an account clear rejects pending introduction data and does not retain it for a later login", async () => {
  const f = fixture(), held = gate(); let reads = 0;
  const request: typeof workingRequest = async () => { reads++; await held.promise; return f.value as never; };
  const pending = preparePersonalIntroduction(f.actor, "d", undefined, request), rejected = assert.rejects(pending);
  workingCardStore.clearUser(f.actor); held.release(); await rejected;
  try { await preparePersonalIntroduction(f.actor, "d", undefined, request); assert.equal(reads, 2); }
  finally { workingCardStore.clearUser(f.actor); }
});

test("a Personal refresh batch checks actor only after all protected responses and rejects a cookie change", async t => {
  const held = gate(); let actor = "first", checks = 0;
  t.mock.method(globalThis, "fetch", async (input: string) => {
    if (input === "/api/auth/me") { checks++; return Response.json({ user: { id: actor } }); }
    if (input === "/second") await held.promise;
    return Response.json({ viewerUserId: "first" }, { headers: { "X-Personal-Viewer": "first" } });
  });
  const promise = workingReadBatch("first", ["/first", "/second"]), rejected = assert.rejects(promise, (cause: unknown) => cause instanceof WorkingRequestError && cause.code === "UPDATE_SESSION_CONFLICT");
  await tick(); assert.equal(checks, 0); actor = "second"; held.release(); await rejected; assert.equal(checks, 1);
});

test("temporary Personal session-check failure rejects new data without claiming confirmed account change", async t => {
  t.mock.method(globalThis, "fetch", async (input: string) => input === "/api/auth/me" ? Response.json({ error: "Unavailable" }, { status: 503 })
    : Response.json({ viewerUserId: "first" }, { headers: { "X-Personal-Viewer": "first" } }));
  await assert.rejects(workingReadBatch("first", ["/first", "/second"]), cause => cause instanceof Error && !(cause instanceof WorkingRequestError));
});
