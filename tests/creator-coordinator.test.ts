import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { CreatorPersistenceCoordinator, CreatorRequestError, EntityLane, type CreatorTransport } from "../src/components/creator/creatorPersistenceCoordinator";
import { blankPrivateBoard, creatorBoard } from "../src/components/creator/cardArchitectureAdapter";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { sameContent } from "../src/lib/cards/publicationRules";
import type { CreatorDTO } from "../src/lib/cards/readModels";
import type { CardTemplateRoot } from "../src/lib/cards/model";
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const copy = <T>(value: T): T => structuredClone(value);
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function fixture(published = true): CreatorDTO {
  const now = new Date(), base = { ownerUserId: "alice", visibility: "private" as const, latestVersion: published ? 1 : 0, revision: 1, forkedFrom: null, createdAt: now, updatedAt: now };
  const content = { ...createDefaultDeckContent(["t1", "t2", "t3"]), title: "Path", cards: [{ cardTemplateId: "a" }, { cardTemplateId: "b" }] };
  return { root: { ...base, deckTemplateId: "deck", draft: published ? null : content }, content, publishedContent: published ? content : null,
    cards: ["a", "b"].map((id) => { const content = createDefaultCardContent([0, 1, 2].map((n) => `${id}-${n}`)); content.intro.title = id;
      return { root: { ...base, cardTemplateId: id, stepIds: content.steps.map((step) => step.stepId), draft: published ? null : content }, content, publishedContent: published ? content : null }; }) };
}
function harness(published = true) {
  let dto = fixture(published);
  const notes = new Map<string, string | undefined>();
  const cards = new Map(dto.cards.map((card) => [card.root.cardTemplateId, card]));
  const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];
  let intercept: ((url: string, method: string, body: Record<string, unknown>) => Promise<void>) | null = null;
  const request: CreatorTransport = async <T>(url: string, method = "GET", body?: unknown): Promise<T> => {
    const data = body as Record<string, unknown>; calls.push({ url, method, body: data }); await intercept?.(url, method, data);
    if (url.includes("card-templates/")) {
      const id = url.split("?")[0].split("/").at(-1)!, card = cards.get(id)!;
      if (url.includes("?version=")) return copy({ version: card.root.latestVersion, publishedByUserId: "alice", content: card.publishedContent, ...(notes.get(id) ? { updateNote: notes.get(id) } : {}) }) as T;
      if (method === "GET") return copy(card) as T;
      if (data.revision !== card.root.revision) throw new CreatorRequestError(409, "STALE_REVISION");
      card.root.revision++;
      if (data.type === "save") { card.content = copy(data.content as typeof card.content); card.root.draft = sameContent(card.content, card.publishedContent) ? null : copy(card.content); }
      else { card.root.latestVersion++; card.publishedContent = copy(card.content); card.root.draft = null; notes.set(id, (data.updateNote as string | undefined)?.trim() || undefined); }
      return copy(card) as T;
    }
    if (url === "/api/deck-templates") {
      const graph = data as unknown as { deckTemplateId: string; content: typeof dto.content; cards: { cardTemplateId: string; content: typeof dto.cards[0]["content"] }[] };
      dto = { ...dto, root: { ...dto.root, deckTemplateId: graph.deckTemplateId, revision: 0, latestVersion: 0, draft: copy(graph.content) }, content: copy(graph.content), publishedContent: null,
        cards: graph.cards.map((card) => { const item = { ...copy(fixture(false).cards[0]), content: copy(card.content), root: { ...copy(fixture(false).cards[0].root), cardTemplateId: card.cardTemplateId, revision: 0, draft: copy(card.content) } }; cards.set(card.cardTemplateId, item); return item; }) };
    } else if (url.includes("/publish?")) {
      return { deckTemplateId: dto.root.deckTemplateId, revision: dto.root.revision, cards: dto.content.cards.map(({ cardTemplateId }) => { const card = cards.get(cardTemplateId)!; return { cardTemplateId, revision: card.root.revision, latestVersion: card.root.latestVersion, hasDraft: !!card.root.draft }; }) } as T;
    } else if (method !== "GET") {
      if (data.revision !== dto.root.revision) throw new CreatorRequestError(409, "STALE_REVISION");
      dto.root.revision++;
      if (url.endsWith("/cards")) {
        const id = data.cardTemplateId as string, content = createDefaultCardContent(data.stepIds as string[]);
        const item = { ...copy(fixture(false).cards[0]), content, root: { ...copy(fixture(false).cards[0].root), cardTemplateId: id, revision: 0, draft: content } };
        cards.set(id, item); dto.content = copy(data.content as typeof dto.content); dto.root.draft = copy(dto.content);
        return copy({ deck: dto, card: item }) as T;
      } else if (url.endsWith("/saved")) { dto.content = copy(data.content as typeof dto.content); dto.root.draft = sameContent(dto.content, dto.publishedContent) ? null : copy(dto.content); }
      else { dto.root.latestVersion++; dto.publishedContent = copy(dto.content); dto.root.draft = null; }
    }
    dto.cards = dto.content.cards.map((ref) => cards.get(ref.cardTemplateId)!);
    return copy(dto) as T;
  };
  const initial = copy(dto), coordinator = new CreatorPersistenceCoordinator(creatorBoard(initial), initial, request);
  return { coordinator, calls, cards, get dto() { return dto; }, request, intercept(fn: typeof intercept) { intercept = fn; } };
}
const ack = (content: { text: string }, revision = 0) => ({ root: { ownerUserId: "alice", revision, latestVersion: 0, draft: content }, content, publishedContent: null });

test("one in-flight request coalesces edits and an older response cannot replace desired content", async () => {
  const h = harness(), gate = deferred<void>(); h.intercept(async (url, method) => { if (url.endsWith("/a") && method === "PATCH") await gate.promise; });
  const lane = h.coordinator.cards.get("a")!;
  h.coordinator.editCard("a", { ...lane.desired, intro: { ...lane.desired.intro, title: "First" } });
  await turn(); h.coordinator.editCard("a", { ...lane.desired, intro: { ...lane.desired.intro, title: "Second" } });
  h.coordinator.editCard("a", { ...lane.desired, intro: { ...lane.desired.intro, title: "Newest" } });
  assert.equal(h.calls.filter((call) => call.method === "PATCH").length, 1);
  gate.resolve(); await lane.flush();
  assert.equal(lane.desired.intro.title, "Newest"); assert.equal(lane.ack!.content.intro.title, "Newest");
  assert.equal(h.calls.filter((call) => call.method === "PATCH").length, 2);
});
test("Card A and Deck failures do not block Card B saves or publication", async () => {
  const h = harness(false); h.intercept(async (url, method) => { if (method === "PATCH" && (url.endsWith("/a") || url.endsWith("/saved"))) throw new CreatorRequestError(403, "FORBIDDEN"); });
  h.coordinator.editCard("a", { ...h.cards.get("a")!.content, suggestedTargetDate: "2026-10-08" });
  h.coordinator.editDeck({ ...h.dto.content, title: "Changed" });
  await turn(); await h.coordinator.publishCard("b");
  assert.equal(h.coordinator.cards.get("a")!.error?.kind, "rejected"); assert.equal(h.coordinator.deck.error?.kind, "rejected");
  assert.equal(h.coordinator.cards.get("b")!.ack!.root.latestVersion, 1);
});
test("bounded transient retries use 1s/3s/8s and the latest desired content", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const bodies: string[] = [], initial = ack({ text: "old" }); let reject = true;
  const lane = new EntityLane(initial.content, initial, () => {}, async (content, revision) => { bodies.push(content.text); if (reject) throw new Error("network"); return ack(content, revision + 1); }, async () => initial);
  lane.set({ text: "first" }); await turn(); assert.equal(bodies.length, 1);
  t.mock.timers.tick(999); await turn(); assert.equal(bodies.length, 1);
  lane.set({ text: "latest" }); t.mock.timers.tick(1); await turn(); assert.deepEqual(bodies, ["first", "latest"]);
  t.mock.timers.tick(3000); await turn(); t.mock.timers.tick(8000); await turn();
  assert.equal(bodies.length, 4); assert.equal(lane.error?.kind, "transient"); assert.equal(lane.desired.text, "latest");
  reject = false; lane.retry(); await lane.flush(); assert.equal(lane.ack!.content.text, "latest");
});
for (const [status, code, kind] of [[400, "INVALID_CONTENT", "rejected"], [401, "UNAUTHORIZED", "rejected"], [409, "STALE_REVISION", "conflict"], [409, "ADD_CARD_RECOVERY_CONFLICT", "recovery"]] as const) {
  test(`${code} stops automatic retries and preserves local content`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] }); let count = 0; const initial = ack({ text: "old" });
    const lane = new EntityLane(initial.content, initial, () => {}, async () => { count++; throw new CreatorRequestError(status, code); }, async () => initial);
    lane.set({ text: "local" }); await turn(); t.mock.timers.tick(12000); await turn();
    assert.equal(count, 1); assert.equal(lane.error?.kind, kind); assert.equal(lane.desired.text, "local");
  });
}
test("a committed save with lost response is reconciled before a newer edit is sent", async () => {
  const initial = ack({ text: "old" }); let remote = initial, calls = 0;
  const lane = new EntityLane(initial.content, initial, () => {}, async (content, revision) => { calls++; remote = ack(copy(content), revision + 1); if (calls === 1) throw new Error("lost response"); return remote; }, async () => remote);
  lane.set({ text: "new" }); await lane.flush(); assert.equal(calls, 1); assert.equal(lane.ack!.root.revision, 1);
});
test("remote mismatch becomes conflict without replacing local content", async () => {
  const initial = ack({ text: "old" }); const lane = new EntityLane(initial.content, initial, () => {}, async () => { throw new Error("uncertain"); }, async () => ack({ text: "another tab" }, 1));
  lane.set({ text: "local" }); await turn(); assert.equal(lane.error?.kind, "conflict"); assert.equal(lane.desired.text, "local");
});
test("untouched zero-Card Create open/flush does not write", async () => {
  let calls = 0; const c = new CreatorPersistenceCoordinator(blankPrivateBoard(), null, async () => { calls++; throw new Error("must not call"); });
  await c.flushAll(); assert.equal(calls, 0); assert.equal(c.hasWork(), false); assert.equal(c.publicationState().deck, false);
});
test("first Deck edit creates only the Deck graph", async () => {
  const h = harness(), board = blankPrivateBoard(), c = new CreatorPersistenceCoordinator(board, null, h.request);
  c.editDeck({ ...c.deck.desired, title: "Named path" }); await c.deck.flush();
  assert.deepEqual(h.calls[0].body.cards, []); assert.equal(h.calls.filter((call) => call.method === "PATCH").length, 0); assert.equal(c.publicationState().deck, true);
});
test("navigation preparation waits for attached uploads and their latest saves without publishing", async () => {
  const h = harness(), c = h.coordinator, finish = c.beginCardUpload("a"), gate = deferred<void>();
  let ready = false;
  const navigation = c.prepareToNavigate().then(() => { ready = true; });
  await turn(); assert.equal(ready, false);
  h.intercept(async (url, method) => { if (url.endsWith("/a") && method === "PATCH") await gate.promise; });
  c.editCard("a", { ...c.cards.get("a")!.desired, suggestedTargetDate: "2027-01-01" });
  finish(); await turn(); assert.equal(ready, false);
  gate.resolve(); await navigation;
  assert.equal(c.cards.get("a")!.ack!.content.suggestedTargetDate, "2027-01-01");
  assert.equal(h.calls.some((call) => call.body?.type === "publish"), false);
});
test("navigation preparation preserves failed/conflicted local work and ignores detached background uploads", async () => {
  for (const status of [400, 409]) {
    const h = harness(), c = h.coordinator;
    h.intercept(async (url, method) => { if (url.endsWith("/a") && method === "PATCH") throw new CreatorRequestError(status, status === 409 ? "STALE_REVISION" : "INVALID_CONTENT"); });
    c.editCard("a", { ...c.cards.get("a")!.desired, suggestedTargetDate: "2027-01-01" }); await turn();
    await assert.rejects(c.prepareToNavigate());
    assert.equal(c.cards.get("a")!.desired.suggestedTargetDate, "2027-01-01");
  }
  const h = harness(), c = h.coordinator, finish = c.beginCardUpload("a");
  c.detachCard("a", { ...c.deck.desired, cards: c.deck.desired.cards.slice(1) });
  await c.prepareToNavigate(); finish();
  let calls = 0;
  const untouched = new CreatorPersistenceCoordinator(blankPrivateBoard(), null, async () => { calls++; throw new Error("no writes"); });
  await untouched.prepareToNavigate(); assert.equal(calls, 0);
});
test("Add renders a default dependency; immediate edits wait for creation, with stable IDs", async () => {
  const h = harness(), gate = deferred<void>(); h.intercept(async (url) => { if (url.endsWith("/cards")) await gate.promise; });
  const next = { ...h.dto.content, cards: [...h.dto.content.cards, { cardTemplateId: "new" }] };
  h.coordinator.addCard("new", ["n1", "n2", "n3"], next);
  const lane = h.coordinator.cards.get("new")!; h.coordinator.editCard("new", { ...lane.desired, intro: { ...lane.desired.intro, title: "Edited immediately" } });
  await turn(); assert.equal(lane.creationPending, true); assert.equal(h.calls.filter((call) => call.url.endsWith("/new")).length, 0);
  gate.resolve(); await h.coordinator.flushCard("new"); await h.coordinator.deck.flush();
  assert.equal(lane.ack!.content.intro.title, "Edited immediately"); assert.equal(lane.ack!.root.cardTemplateId, "new");
});
test("two rapid Adds preserve both references, and removal before Add acknowledgement detaches afterward", async () => {
  const h = harness(), gate = deferred<void>(); h.intercept(async (url) => { if (url.endsWith("/cards")) await gate.promise; });
  const c = h.coordinator;
  c.addCard("x", ["x1", "x2", "x3"], { ...c.deck.desired, cards: [...c.deck.desired.cards, { cardTemplateId: "x" }] });
  c.addCard("y", ["y1", "y2", "y3"], { ...c.deck.desired, cards: [...c.deck.desired.cards, { cardTemplateId: "y" }] });
  c.detachCard("x", { ...c.deck.desired, cards: c.deck.desired.cards.filter((ref) => ref.cardTemplateId !== "x") });
  gate.resolve(); await c.deck.flush(); await c.flushCard("y");
  assert.deepEqual(c.deck.ack!.content.cards.map((ref) => ref.cardTemplateId), ["a", "b", "y"]); assert.equal(h.cards.has("x"), true); assert.equal(c.cards.get("x")!.detached, true);
});
test("default new Card cue is inactive until confirmed eligible save", async () => {
  const h = harness(), c = h.coordinator;
  c.addCard("x", ["x1", "x2", "x3"], { ...c.deck.desired, cards: [...c.deck.desired.cards, { cardTemplateId: "x" }] }); await c.deck.flush();
  assert.equal(c.publicationState().cards.x, false);
  const gate = deferred<void>(); h.intercept(async (url) => { if (url.endsWith("/x")) await gate.promise; });
  c.editCard("x", { ...c.cards.get("x")!.desired, intro: { ...c.cards.get("x")!.desired.intro, title: "Custom" } });
  assert.equal(c.publicationState().cards.x, false); gate.resolve(); await c.flushCard("x"); assert.equal(c.publicationState().cards.x, true); assert.equal(c.publicationState().deck, false);
});
test("detached Card pending save continues independently and failures have no visible lane", async () => {
  const h = harness(), gate = deferred<void>(), c = h.coordinator; h.intercept(async (url, method) => { if (url.endsWith("/a") && method === "PATCH") await gate.promise; });
  c.editCard("a", { ...c.cards.get("a")!.desired, suggestedTargetDate: "2026-10-08" });
  c.detachCard("a", { ...c.deck.desired, cards: [{ cardTemplateId: "b" }] }); await c.deck.flush();
  gate.resolve(); await c.flushCard("a"); assert.equal(h.cards.get("a")!.content.suggestedTargetDate, "2026-10-08"); assert.equal(c.cards.get("a")!.detached, true);
  h.intercept(async (url) => { if (url.endsWith("/a")) throw new CreatorRequestError(400, "INVALID_CONTENT"); });
  c.editCard("a", { ...c.cards.get("a")!.desired, suggestedTargetDate: "bad" }); await turn();
  assert.equal(c.cards.get("a")!.error?.kind, "rejected"); assert.equal(c.dto!.cards.some((card) => card.root.cardTemplateId === "a"), false);
});
test("Card Publish flushes only itself and preserves edits made while publication is running", async () => {
  const h = harness(false), gate = deferred<void>(), c = h.coordinator;
  h.intercept(async (url, method, body) => { if (url.endsWith("/a") && method === "PATCH" && body.type === "publish") await gate.promise; });
  const operation = c.publishCard("a"); await turn();
  c.editCard("a", { ...c.cards.get("a")!.desired, intro: { ...c.cards.get("a")!.desired.intro, title: "After publication snapshot" } });
  gate.resolve(); await operation; await c.flushCard("a");
  assert.equal(c.cards.get("a")!.ack!.publishedContent!.intro.title, "a"); assert.equal(c.cards.get("a")!.ack!.content.intro.title, "After publication snapshot");
  assert.equal(c.publicationState().cards.a, true); assert.ok(h.calls.every((call) => call.url.endsWith("/a")));
});
test("Deck Publish warns about saved, pending and failed Card edits, without flushing Cards", async () => {
  const h = harness(), c = h.coordinator;
  c.editDeck({ ...c.deck.desired, title: "New Deck title" }); await c.deck.flush();
  h.intercept(async (url, method) => { if (url.endsWith("/a") && method === "PATCH") throw new CreatorRequestError(400, "INVALID_CONTENT"); });
  c.editCard("a", { ...c.cards.get("a")!.desired, intro: { ...c.cards.get("a")!.desired.intro, title: "Local failed change" } }); await turn();
  const count = h.calls.filter((call) => call.url.endsWith("/a")).length;
  let warned: string[] = []; assert.equal(await c.publishDeck(undefined, async (ids) => { warned = ids; return false; }), false);
  assert.deepEqual(warned, ["a"]); assert.equal(h.dto.root.latestVersion, 1);
  await c.publishDeck(undefined, async () => true); assert.equal(h.dto.root.latestVersion, 2);
  assert.equal(h.calls.filter((call) => call.url.endsWith("/a")).length, count);
});
test("warning confirmation invalidates when local material state changes", async () => {
  const h = harness(false), c = h.coordinator;
  await assert.rejects(c.publishDeck(undefined, async () => { c.editCard("a", { ...c.cards.get("a")!.desired, suggestedTargetDate: "2026-10-08" }); return true; }), /REVIEW_CONFLICT/);
  assert.equal(h.calls.some((call) => call.method === "POST" && call.url.endsWith("/publish")), false);
});
test("lost successful publication response does not create duplicate version", async () => {
  const h = harness(false), c = h.coordinator, original = c.request;
  let lose = true;
  const transport: CreatorTransport = async <T>(url: string, method?: string, body?: unknown) => { const result = await original<T>(url, method, body); if (method === "PATCH" && (body as { type?: string })?.type === "publish" && lose) { lose = false; throw new Error("lost response"); } return result; };
  const next = new CreatorPersistenceCoordinator(creatorBoard(h.dto), copy(h.dto), transport);
  await next.publishCard("a"); await next.publishCard("a");
  assert.equal(next.cards.get("a")!.confirmedPublicationVersion, 1);
  assert.equal(h.cards.get("a")!.root.latestVersion, 1); assert.equal(h.calls.filter((call) => call.method === "PATCH" && call.body.type === "publish").length, 1);
});

for (const mismatchedReceipt of [false, true]) test(`visibility-only publication recovery validates immutable visibility (${mismatchedReceipt ? "conflict" : "exact commit"})`, async () => {
  const h = harness(), dto = h.dto;
  const card = h.cards.get("a")!;
  const root = card.root as CardTemplateRoot;
  root.draft = copy(card.content); root.draftVisibility = "public";
  let lost = false;
  const transport: CreatorTransport = async <T>(url: string, method?: string, body?: unknown): Promise<T> => {
    const result = await h.request<T>(url, method, body);
    if (url.includes("?version=")) return { ...result, visibility: mismatchedReceipt ? "private" : "public" } as T;
    if (method === "PATCH" && (body as { type?: string }).type === "publish") {
      root.visibility = "public"; delete root.draftVisibility;
      lost = true; throw new Error("Lost publication response");
    }
    return result;
  };
  const coordinator = new CreatorPersistenceCoordinator(creatorBoard(dto), copy(dto), transport);
  assert.equal(coordinator.publicationState().cards.a, true);
  if (mismatchedReceipt) await assert.rejects(coordinator.publishCard("a", undefined, async () => true), { code: "RECOVERY_REVISION_CONFLICT" });
  else { await coordinator.publishCard("a", undefined, async () => true); await coordinator.publishCard("a"); }
  assert.equal(coordinator.cards.get("a")!.confirmedPublicationVersion, mismatchedReceipt ? null : 2);
  assert.equal(lost, true);
  assert.equal(card.root.latestVersion, 2);
  assert.equal(h.calls.filter((call) => call.body?.type === "publish").length, 1);
});
test("Publish and leave keeps earlier successes and retries only outstanding work", async () => {
  const h = harness(false), c = h.coordinator; let failDeck = true;
  h.intercept(async (url, method) => { if (url.endsWith("/publish") && method === "POST" && failDeck) throw new CreatorRequestError(400, "SIMULATED_FAILURE"); });
  await assert.rejects(c.publishAndLeave({}, async () => true));
  assert.equal(c.cards.get("a")!.ack!.root.latestVersion, 1); assert.equal(c.cards.get("b")!.ack!.root.latestVersion, 1);
  failDeck = false; assert.equal(await c.publishAndLeave({}, async () => true), true);
  assert.equal(h.calls.filter((call) => call.method === "PATCH" && call.body.type === "publish").length, 2);
});
test("Creator has no top-level Save Draft and stable Card keys/upload/edit identity", () => {
  const source = readFileSync(new URL("../src/components/creator/CreatorDragLab.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, />Save Draft</); assert.match(source, /key=\{column.cardId \?\? column.id\}/);
  assert.match(source, /uploadIntroMedia\(column.cardId!/); assert.match(source, /type: "card-title"; cardTemplateId: string/);
});

test("lost save response followed by unavailable reconciliation is read before any replay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); let requests = 0, reads = 0;
  const initial = ack({ text: "original" }); let remote = initial;
  const lane = new EntityLane(initial.content, initial, () => {}, async (content, revision) => { requests++; remote = ack(copy(content), revision + 1); if (requests === 1) throw new Error("lost"); return remote; }, async () => { reads++; if (reads === 1) throw new Error("read unavailable"); return remote; });
  lane.set({ text: "committed" }); await turn(); lane.set({ text: "newer" });
  t.mock.timers.tick(1000); await lane.flush();
  assert.equal(requests, 2); assert.equal(reads, 2); assert.equal(lane.ack!.root.revision, 2); assert.equal(lane.ack!.content.text, "newer");
});

test("Add recovery conflict preserves allocated identity and cannot blindly reattach", async () => {
  const h = harness(), c = h.coordinator;
  h.intercept(async (url) => { if (url.endsWith("/cards")) throw new CreatorRequestError(409, "ADD_CARD_RECOVERY_CONFLICT"); });
  c.addCard("stable", ["s1", "s2", "s3"], { ...c.deck.desired, cards: [...c.deck.desired.cards, { cardTemplateId: "stable" }] });
  await turn(); assert.equal(c.deck.error?.kind, "recovery"); assert.equal(c.cards.get("stable")!.creationPending, true);
  c.retryDeck(); await turn(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].body.cardTemplateId, "stable");
});

test("detached transient save exhaustion retains failure without returning it to visible Cards", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); const h = harness(), c = h.coordinator;
  h.intercept(async (url, method) => { if (url.endsWith("/a") && method === "PATCH") throw new Error("network"); });
  c.editCard("a", { ...c.cards.get("a")!.desired, suggestedTargetDate: "2026-10-08" });
  c.detachCard("a", { ...c.deck.desired, cards: [{ cardTemplateId: "b" }] }); await turn();
  for (const delay of [1000, 3000, 8000]) { t.mock.timers.tick(delay); await turn(); }
  assert.equal(c.cards.get("a")!.error?.kind, "transient"); assert.equal(c.cards.get("a")!.detached, true);
  assert.equal(Object.hasOwn(c.publicationState().cards, "a"), false);
});

test("Publish and leave stays in Creator if a newer edit remains after an earlier publication", async () => {
  const h = harness(false), c = h.coordinator;
  h.intercept(async (url, method) => {
    if (url.endsWith("/publish") && method === "POST") c.editCard("a", { ...c.cards.get("a")!.desired, suggestedTargetDate: "2026-10-08" });
  });
  assert.equal(await c.publishAndLeave({}, async () => true), false);
  assert.equal(c.cards.get("a")!.ack!.root.latestVersion, 1); assert.equal(c.publicationState().cards.a, true);
});

test("uncertain publication with a different immutable update note is a conflict, never a duplicate version", async () => {
  const h = harness(false);
  const request: CreatorTransport = async <T>(url: string, method?: string, body?: unknown) => {
    if (method === "PATCH" && (body as { type?: string })?.type === "publish") {
      await h.request<T>(url, method, { ...(body as object), updateNote: "Another tab's note" }); throw new Error("lost response");
    }
    return h.request<T>(url, method, body);
  };
  const c = new CreatorPersistenceCoordinator(creatorBoard(h.dto), copy(h.dto), request);
  await assert.rejects(c.publishCard("a", "My note"), /RECOVERY_REVISION_CONFLICT/);
  await turn(); assert.equal(c.cards.get("a")!.error?.kind, "conflict"); assert.equal(h.cards.get("a")!.root.latestVersion, 1);
});

test("a late original commit causing stale revision on retry is reconciled without losing a newer edit", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); const initial = ack({ text: "old" }); let remote = initial, calls = 0;
  const lane = new EntityLane(initial.content, initial, () => {}, async (content, revision) => {
    calls++;
    if (calls === 1) throw new Error("timed out before commit");
    if (calls === 2) { remote = ack({ text: "first" }, 1); throw new CreatorRequestError(409, "STALE_REVISION"); }
    remote = ack(copy(content), revision + 1); return remote;
  }, async () => remote);
  lane.set({ text: "first" }); await turn(); lane.set({ text: "latest" }); t.mock.timers.tick(1000); await lane.flush();
  assert.equal(calls, 3); assert.equal(lane.error, null); assert.equal(lane.ack!.root.revision, 2); assert.equal(lane.desired.text, "latest"); assert.equal(lane.ack!.content.text, "latest");
});

test("construction Step transfer uses a scoped three-entity barrier and reconciles a lost committed response", async () => {
  const dto = fixture(false), source = dto.cards[0], destination = dto.cards[1];
  const oldSourceId = source.content.steps[0].stepId, oldDestinationId = destination.content.steps[2].stepId;
  const calls: string[] = [];
  const request: CreatorTransport = async <T>(url: string, method = "GET") => {
    calls.push(`${method} ${url}`);
    if (url.endsWith("/move-step")) {
      [source.content.steps[0], destination.content.steps[2]] = [destination.content.steps[2], source.content.steps[0]];
      source.root.revision++; destination.root.revision++; dto.root.revision++;
      source.root.draft = copy(source.content); destination.root.draft = copy(destination.content);
      throw new Error("committed transaction response lost");
    }
    return copy(dto) as T;
  };
  const c = new CreatorPersistenceCoordinator(creatorBoard(copy(dto)), copy(dto), request);
  await c.move("a", "b", 0, 2);
  assert.equal(c.cards.get("a")!.desired.steps[0].stepId, oldDestinationId); assert.equal(c.cards.get("b")!.desired.steps[2].stepId, oldSourceId);
  assert.deepEqual(calls, ["POST /api/deck-templates/deck/move-step", "GET /api/deck-templates/deck"]);
});

test("simultaneous publication barriers cannot acquire the same entity twice", async () => {
  const h = harness(), lane = h.coordinator.cards.get("a")!;
  const results = await Promise.allSettled([lane.acquire(), lane.acquire()]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  assert.match(String(rejected.reason), /ENTITY_BUSY/);
  lane.release();
});

test("construction Step transfer cannot race an upload on either participating Card", async () => {
  const h = harness(false), c = h.coordinator;
  const before = copy(c.cards.get("a")!.desired);
  const finish = c.beginCardUpload("b");
  await assert.rejects(c.move("a", "b", 0, 2), /STEP_MOVE_UPLOAD_IN_PROGRESS/);
  assert.equal(h.calls.length, 0);
  assert.deepEqual(c.cards.get("a")!.desired, before);
  assert.equal(c.cards.get("a")!.locked, false);
  finish();
});

test("Publish and leave waits for attached uploads, while detached uploads do not prevent completion", async () => {
  const h = harness(false), c = h.coordinator, finish = c.beginCardUpload("a");
  const publishing = c.publishAndLeave({}, async () => true); await turn(); assert.equal(h.calls.length, 0);
  c.detachCard("a", { ...c.deck.desired, cards: [{ cardTemplateId: "b" }] });
  assert.equal(await publishing, true); assert.equal(c.cards.get("a")!.pendingOperations, 1); finish();
});

test("reverting to acknowledged content still reconciles an outstanding uncertain write", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); const initial = ack({ text: "original" }); let remote = initial, calls = 0;
  const lane = new EntityLane(initial.content, initial, () => {}, async (content, revision) => {
    calls++; if (calls <= 4) throw new Error("unavailable"); remote = ack(copy(content), revision + 1); return remote;
  }, async () => remote);
  lane.set({ text: "uncertain first edit" }); await turn();
  for (const delay of [1000, 3000, 8000]) { t.mock.timers.tick(delay); await turn(); }
  lane.set({ text: "original" }); remote = ack({ text: "uncertain first edit" }, 1); // original timed-out request committed late
  lane.retry(); await lane.flush();
  assert.equal(lane.ack!.content.text, "original"); assert.equal(lane.ack!.root.revision, 2); assert.equal(calls, 5);
});

test("Publish and leave publishes Card-only work without manufacturing a Deck version", async () => {
  const h = harness(), c = h.coordinator;
  c.editCard("a", { ...c.cards.get("a")!.desired, suggestedTargetDate: "2026-10-08" });
  assert.equal(await c.publishAndLeave({}, async () => true), true);
  assert.equal(h.dto.root.latestVersion, 1); assert.equal(h.cards.get("a")!.root.latestVersion, 2);
  assert.equal(h.calls.some((call) => call.url.includes("deck-templates")), false);
});

test("Copy identity preparation does not flush failed local Card content or unrelated Deck work", async () => {
  const h = harness(false), c = h.coordinator, lane = c.cards.get("a")!;
  lane.error = { kind: "rejected", code: "LOCAL_SAVE_FAILED" };
  lane.set({ ...lane.desired, intro: { ...lane.desired.intro, title: "Keep pending local title" } });
  c.deck.error = { kind: "rejected", code: "UNRELATED_DECK_FAILURE" };
  await c.ensureCardCreated("a");
  assert.equal(h.calls.length, 0); assert.equal(lane.desired.intro.title, "Keep pending local title");
  c.noteCardReused("a");
  // A late pre-Copy response cannot erase the monotonic local restriction.
  lane.accept(copy(h.cards.get("a")!), lane.acknowledgedGeneration);
  await assert.rejects(c.move("a", "b", 0, 0), /CROSS_CARD_MOVE_AFTER_REUSE/);
  assert.equal(h.calls.length, 0);
});
