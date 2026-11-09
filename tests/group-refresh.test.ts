import assert from "node:assert/strict";
import { test } from "node:test";
import { createGroupResource } from "../src/components/group-experiences/groupResource";
import { GroupRequestError, type groupFetch } from "../src/components/group-experiences/groupClient";
import { workingCardStore } from "../src/lib/cards/workingCardStore";
import { aggregateLearning } from "../src/lib/groupExperiences/readModels";
import { retainedMediaPreview } from "../src/lib/mediaCollection/controller";
import { retainedReflection } from "../src/lib/reflections/controller";
import type { PreparedGroup } from "../src/lib/groupExperiences/preparation";
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
function fixture() {
  const actor = `refresh-${Math.random()}`, authority = { viewerUserId: actor, experienceId: "e", accessEpoch: 0, structureRevision: 0, adoptionRevision: 0 };
  const learning = [{ cardTemplateId: "c", version: 1, items: [{ stepId: "s", completionStatus: "todo" }], signalReadings: [{ stepId: "s", reading: 5 }] }];
  const media = { ...authority, cardTemplateId: "c", subjectUserId: null, items: [], total: 0, start: 0, olderCount: 0, older: null, newer: null, refresh: null, capabilities: { canManage: true } };
  const view = { kind: "group", experienceId: "e", mode: "group", accessEpoch: 0 };
  const feed = { ...authority, cardTemplateId: "c", view, items: [], collective: { source: { kind: "group-card", experienceId: "e", cardTemplateId: "c" }, text: "Retained note", revision: 0, canEdit: true } };
  const prepared = { ...authority, bootstrap: { ...authority, isAdmin: true, isFollower: false, canInspectFollowers: false, selection: { perspective: "group" },
    deck: { id: "d", version: 1, cards: [{ id: "c", cardTemplateId: "c", version: 1 }] }, group: learning, own: null, ownDates: null }, followers: [],
    aggregates: aggregateLearning(learning as never, []).cards, contributions: { media: { c: media }, reflections: { c: feed } } } as unknown as PreparedGroup;
  const refreshValue = () => ({ ...authority, selection: prepared.bootstrap.selection, cards: [{ cardTemplateId: "c", version: 1 }], group: prepared.bootstrap.group,
    learning: null, ownDates: null, aggregates: prepared.aggregates, contributions: prepared.contributions });
  const calls: string[] = [];
  const read: typeof groupFetch = async (_actor, url, _signal, method) => { calls.push(`${method ?? "GET"} ${url}`);
    return structuredClone(url.includes("/refresh?") ? refreshValue() : url.includes("/preparation") ? prepared : authority) as never; };
  const mediaContext = { kind: "group" as const, ...authority, cardTemplateId: "c" };
  const reflectionContext = { viewerUserId: actor, cardTemplateId: "c", adoptionRevision: 0, structureRevision: 0, view: view as import("../src/lib/reflections/controller").ReflectionAreaContext["view"] };
  return { actor, authority, prepared, refreshValue, calls, read, mediaContext, reflectionContext };
}

test("multiple active consumers share one four-second refresh clock and content satisfies authority freshness", async () => {
  const f = fixture(); let time = 0, next = 0;
  const timers = new Map<number, { due: number; run(): void }>();
  const resource = createGroupResource(f.actor, "e", { read: f.read, now: () => time,
    schedule: (run, delay) => { const id = ++next; timers.set(id, { due: time + delay, run }); return id as unknown as ReturnType<typeof setTimeout>; },
    cancel: id => { timers.delete(id as unknown as number); } });
  async function advance(end: number) {
    while (true) {
      const task = [...timers].filter(([, v]) => v.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!task) break;
      time = task[1].due; timers.delete(task[0]); task[1].run(); await tick();
    }
    time = end; await tick();
  }
  try {
    await resource.prepare(); const first = resource.watch(), second = resource.watch();
    await advance(12000);
    assert.equal(f.calls.filter(url => url.includes("/refresh?")).length, 3);
    assert.equal(f.calls.filter(url => url.includes("/authority")).length, 3);
    assert.equal(resource.snapshot().verified, true);
    first(); await advance(16000); assert.equal(f.calls.filter(url => url.includes("/refresh?")).length, 4);
    second(); const count = f.calls.length; await advance(30000); assert.equal(f.calls.length, count);
    assert.ok(resource.snapshot().data); assert.equal(resource.snapshot().verified, false, "lease expiry restricts editing without clearing the Card");
  } finally { resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("refresh and resume share work, retain identical snapshots and renew without a trailing authority request", async () => {
  const f = fixture(), held = gate(); let holding = false, checks = 0;
  const resource = createGroupResource(f.actor, "e", { read: async (...args) => { const value = await f.read(...args); if (args[1].includes("/refresh?")) { holding = true; await held.promise; } return value as never; }, checkSession: async () => { checks++; } });
  try {
    await resource.prepare(); const data = resource.snapshot().data, media = retainedMediaPreview(f.mediaContext).snapshot().page, feed = retainedReflection(f.reflectionContext).snapshot().feed;
    const reads = [resource.refresh(), resource.refresh(), resource.resume(), resource.resume()]; await tick(); assert.equal(holding, true);
    assert.equal(checks, 1); assert.equal(f.calls.filter(url => url.includes("/refresh?")).length, 1);
    assert.equal(retainedMediaPreview(f.mediaContext).snapshot().page, media); assert.equal(retainedReflection(f.reflectionContext).snapshot().feed, feed);
    held.release(); await Promise.all(reads);
    assert.equal(resource.snapshot().data, data, "unchanged refresh keeps the accepted Group snapshot reference");
    assert.equal(retainedMediaPreview(f.mediaContext).snapshot().page, media); assert.equal(retainedReflection(f.reflectionContext).snapshot().feed, feed);
    assert.equal(f.calls.filter(url => url.includes("/authority")).length, 0);
  } finally { held.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("a refresh begun before a collective save preserves newer G and accepts unrelated reflections and media", async () => {
  const f = fixture(), reading = gate(), saving = gate();
  const resource = createGroupResource(f.actor, "e", { read: async (...args) => {
    if (args[3] === "PATCH") { await saving.promise; return {} as never; }
    const value = await f.read(...args);
    if (args[1].includes("/refresh?")) await reading.promise;
    return value as never;
  } });
  try {
    await resource.prepare(); f.prepared.contributions.reflections.c.collective!.text = "Independent remote note"; f.prepared.contributions.reflections.c.collective!.revision = 1;
    const pending = resource.refresh(); await tick();
    const save = resource.save("c", "group", 1, 0, { kind: "signal", stepId: "s", reading: 9 });
    reading.release(); await pending;
    assert.equal(resource.snapshot().data!.bootstrap.group[0].signalReadings[0].reading, 9);
    assert.equal(retainedReflection(f.reflectionContext).snapshot().feed!.collective!.text, "Independent remote note");
    assert.deepEqual(resource.snapshot().data!.aggregatePending, {}); assert.ok(retainedMediaPreview(f.mediaContext).snapshot().page);
    saving.release(); await save; assert.equal(f.calls.filter(url => url.includes("/aggregates")).length, 0);
  } finally { reading.release(); saving.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("temporary failures preserve complete data read-only, recovery restores editing and confirmed denial clears it", async () => {
  const f = fixture(); let failure: Error | undefined;
  const resource = createGroupResource(f.actor, "e", { checkSession: async () => {}, read: async (...args) => { if (failure) throw failure; return f.read(...args); } });
  try {
    await resource.prepare(); failure = Error("Offline"); await resource.refresh();
    assert.ok(resource.snapshot().data); assert.equal(resource.snapshot().verified, false);
    assert.ok(retainedMediaPreview(f.mediaContext).snapshot().page); assert.ok(retainedReflection(f.reflectionContext).snapshot().feed);
    failure = undefined; await resource.resume(); assert.equal(resource.snapshot().verified, true);
    failure = new GroupRequestError("GROUP_FORBIDDEN", 403); await resource.refresh();
    assert.equal(resource.snapshot().data, undefined); assert.equal(resource.snapshot().verified, false);
  } finally { resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("an older failed renewal cannot cancel a newer compatible content grant", async () => {
  const f = fixture(), held = gate();
  const resource = createGroupResource(f.actor, "e", { read: async (...args) => {
    if (args[1].endsWith("/authority")) { await held.promise; throw Error("Old timeout"); }
    return f.read(...args);
  } });
  try {
    await resource.prepare(); const renewing = resource.renewAuthority(); await tick(); await resource.refresh(); held.release(); await renewing;
    assert.equal(resource.snapshot().verified, true);
  } finally { held.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("resume checks the current session and cannot restore a different account", async () => {
  const f = fixture();
  const resource = createGroupResource(f.actor, "e", { read: f.read, checkSession: async () => { throw new GroupRequestError("GROUP_SESSION_CONFLICT", 409); } });
  await resource.prepare(); const count = f.calls.length; await resource.resume();
  assert.equal(f.calls.length, count); assert.equal(resource.snapshot().data, undefined); assert.equal(resource.isDisposed(), true);
});

test("Group introduction is read-only, shares a held read, and real entry reuses it through the protected open", async () => {
  const f = fixture(), held = gate();
  const resource = createGroupResource(f.actor, "e", { read: async (...args) => {
    if (args[1].endsWith("/open")) { f.calls.push("POST /open"); return { ...f.authority, activeCardId: "c", selection: { perspective: "group" } } as never; }
    const value = await f.read(...args); if (args[1].includes("/preparation")) await held.promise; return value as never;
  } });
  try {
    const prep = resource.prefetch({ perspective: "default" }); assert.equal(resource.prefetch({ perspective: "default" }), prep);
    const open = resource.prepare({ perspective: "default" }); await tick();
    assert.equal(f.calls.length, 1); assert.match(f.calls[0], /^GET .*preparation/);
    held.release(); await Promise.all([prep, open]); assert.equal(f.calls.length, 2); assert.equal(f.calls[1], "POST /open");
    assert.equal(resource.isPrepared({ perspective: "group" }), true); assert.equal(resource.snapshot().data!.bootstrap.activeCardId, "c");
    const count = f.calls.length; await resource.prefetch({ perspective: "default" }); assert.equal(f.calls.length, count);
  } finally { held.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("an open acknowledgement exposing a newer scope cannot be repaired with an older preparation response", async () => {
  const f = fixture();
  const resource = createGroupResource(f.actor, "e", { read: async (...args) => {
    if (args[1].endsWith("/open")) return { ...f.authority, structureRevision: 1, activeCardId: "c" } as never;
    return f.read(...args);
  } });
  try {
    await resource.prefetch(); await resource.prepare();
    assert.equal(resource.snapshot().verified, false); assert.ok(resource.snapshot().error);
  } finally { resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("a temporary resume identity-service failure retains complete data while a definite expiry clears it", async t => {
  const f = fixture(); let status = 503;
  t.mock.method(globalThis, "fetch", async () => status === 200 ? Response.json({ user: { id: f.actor } }) : new Response("Unavailable", { status }));
  const resource = createGroupResource(f.actor, "e", { read: f.read });
  try {
    await resource.prepare(); const data = resource.snapshot().data;
    await resource.resume(); assert.equal(resource.snapshot().data, data); assert.equal(resource.snapshot().verified, false);
    status = 200; await resource.resume(); assert.equal(resource.snapshot().verified, true);
    status = 401; await resource.resume(); assert.equal(resource.snapshot().data, undefined); assert.equal(resource.isDisposed(), true);
  } finally { resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("post-save F repair never waits for a stale background snapshot and that older response cannot undo it", async () => {
  const f = fixture(), held = gate();
  f.prepared.bootstrap.isFollower = true; f.prepared.bootstrap.own = structuredClone(f.prepared.bootstrap.group);
  const foreign = structuredClone(f.prepared.bootstrap.group);
  f.prepared.aggregates = aggregateLearning(f.prepared.bootstrap.group, [f.prepared.bootstrap.own, foreign]).cards;
  let aggregateReads = 0;
  const resource = createGroupResource(f.actor, "e", { read: async (...args) => {
    if (args[3] === "PATCH") {
      f.prepared.bootstrap.own![0].signalReadings[0].reading = 9;
      f.prepared.aggregates = aggregateLearning(f.prepared.bootstrap.group, [f.prepared.bootstrap.own!, foreign]).cards;
      return {} as never;
    }
    if (args[1].includes("/aggregates?")) { aggregateReads++; return { ...f.authority, cards: f.prepared.aggregates, nextCardOffset: null } as never; }
    const value = await f.read(...args); if (args[1].includes("/refresh?")) await held.promise; return value as never;
  } });
  try {
    await resource.prepare(); const old = resource.refresh(); await tick();
    await resource.save("c", "personal", 1, 0, { kind: "signal", stepId: "s", reading: 9 });
    assert.equal(aggregateReads, 1); assert.equal(resource.snapshot().data!.aggregates[0].followers.confidence, 7);
    held.release(); await old; assert.equal(resource.snapshot().data!.aggregates[0].followers.confidence, 7);
    assert.deepEqual(resource.snapshot().data!.aggregatePending, {});
  } finally { held.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("a removed retained return Card falls back through complete current entry rather than preserving stale access", async () => {
  const f = fixture();
  const resource = createGroupResource(f.actor, "e", { read: async (...args) => {
    if (args[1].endsWith("/open")) throw new GroupRequestError("GROUP_CARD_FORBIDDEN", 403);
    return f.read(...args);
  } });
  try { await resource.prefetch(); await resource.prepare(undefined, "removed"); assert.equal(resource.snapshot().verified, true); assert.equal(resource.isPrepared({ perspective: "group" }), true); }
  finally { resource.dispose(); workingCardStore.clearUser(f.actor); }
});
