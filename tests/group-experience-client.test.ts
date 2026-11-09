import assert from "node:assert/strict";
import { test } from "node:test";
import { createGroupResource, retainedGroupResource, GROUP_AUTHORITY_MS } from "../src/components/group-experiences/groupResource";
import { workingCardStore } from "../src/lib/cards/workingCardStore";
import { personalWork } from "../src/lib/cards/personalWork";
import { groupFetch, GroupRequestError } from "../src/components/group-experiences/groupClient";
import type { GroupBootstrap, GroupPerspectivePage, GroupAggregates } from "../src/lib/groupExperiences/presentationReads";
import { aggregateLearning } from "../src/lib/groupExperiences/readModels";

function fixture() {
  const authority = { viewerUserId: "alice", experienceId: "e", structureRevision: 0, adoptionRevision: 0, accessEpoch: 0 };
  const learning = { cardTemplateId: "c", version: 1, items: [{ stepId: "s", completionStatus: "todo" as const }], signalReadings: [{ stepId: "s", reading: null }] };
  const bootstrap = { ...authority, name: "Test group", deckTemplateId: "d", deckVersion: 1, isAdmin: true, isFollower: false, activeCardId: "c",
    canInspectFollowers: true, allowFollowerInspection: false, selection: { perspective: "group" },
    deck: { surface: "canonical", id: "d", deckTemplateId: "d", version: 1, title: "Practice", category: "Practice", introduction: null,
      streams: [], ownerUsername: "Test group", showOwnerTag: true, cards: [] }, group: [learning], own: null, ownDates: null, nextCardOffset: null,
    deferred: ["assessments", "private-content", "group-contributions"] } as GroupBootstrap;
  const peers = { ...authority, followers: [{ userId: "bob", username: "Bob", learning: [learning] }], nextCursor: null, nextCardOffset: null } as GroupPerspectivePage;
  const aggregates = { ...authority, cards: [], nextCardOffset: null } as unknown as GroupAggregates;
  const calls: string[] = [], writes: unknown[] = [];
  const read: typeof groupFetch = async (_actor, url, _signal, method, body) => {
    calls.push(url); if (method === "PATCH") { writes.push(body); return { ...authority, ok: true } as never; }
    return (url.includes("/preparation") ? { ...authority, bootstrap, followers: peers.followers, aggregates: aggregates.cards, contributions: { media: {}, reflections: {} } } : url.includes("/presentation?") ? bootstrap : url.includes("/perspectives?") ? peers : url.includes("/aggregates?") ? aggregates : authority) as never;
  };
  return { authority, bootstrap, peers, aggregates, calls, writes, read };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }

test("an overlapping personal save preserves its source and accepts unrelated bootstrap content, then repairs F only", async () => {
  const f = fixture(), heldRead = gate(), heldSave = gate(); let pause = false, reading = false;
  f.bootstrap.isFollower = true; f.bootstrap.own = structuredClone(f.bootstrap.group);
  f.aggregates.cards = aggregateLearning(f.bootstrap.group, [f.bootstrap.own]).cards;
  const read: typeof groupFetch = async <T>(...args: Parameters<typeof groupFetch>) => {
    if (args[3] === "PATCH") { await heldSave.promise; return {} as T; }
    const value = structuredClone(await f.read<T>(...args));
    if (pause && args[1].includes("/presentation?")) { reading = true; await heldRead.promise; }
    return value;
  };
  const resource = createGroupResource("alice", "e", { read });
  try {
    await resource.load(); f.bootstrap.name = "Updated independently"; pause = true;
    const pending = resource.load(); await tick(); assert.equal(reading, true);
    const save = resource.save("c", "personal", 1, 0, { kind: "signal", stepId: "s", reading: 8 });
    heldRead.release(); await pending;
    assert.equal(resource.snapshot().data!.bootstrap.name, "Updated independently");
    assert.equal(resource.snapshot().data!.bootstrap.own![0].signalReadings[0].reading, 8);
    assert.equal(resource.snapshot().data!.bootstrap.group[0].signalReadings[0].reading, null);
    const count = f.calls.filter(url => url.includes("/presentation?")).length;
    heldSave.release(); await save;
    assert.equal(f.calls.filter(url => url.includes("/presentation?")).length, count, "save reconciliation must not bootstrap the whole Group");
  } finally { heldRead.release(); heldSave.release(); resource.dispose(); }
});

test("collective G edits never invalidate F or refetch follower learning", async () => {
  const f = fixture(); f.aggregates.cards = aggregateLearning(f.bootstrap.group, [f.bootstrap.group]).cards;
  const resource = createGroupResource("alice", "e", { read: f.read });
  try {
    await resource.load(); const before = f.calls.length;
    await resource.save("c", "group", 1, 0, { kind: "signal", stepId: "s", reading: 9 });
    assert.equal(resource.snapshot().data!.bootstrap.group[0].signalReadings[0].reading, 9);
    assert.equal(resource.snapshot().data!.aggregates[0].followers.confidence, null);
    assert.deepEqual(f.calls.slice(before), ["/api/group-experiences/e/cards/c/group-learning"]);
    await resource.save("c", "group", 1, 0, { kind: "completion", stepId: "s", completionStatus: "done" });
    assert.equal(resource.snapshot().data!.aggregates[0].group.completion, 100);
    assert.equal(resource.snapshot().data!.aggregates[0].followers.done, 0);
    assert.deepEqual(resource.snapshot().data!.aggregatePending, {});
    assert.equal(f.calls.slice(before).filter(url => url.includes("/aggregates?") || url.includes("/perspectives?")).length, 0);
  } finally { resource.dispose(); }
});

test("a first Group presentation repairs a dependency changed during loading before publishing any R1 placeholder", async () => {
  const f = fixture(), held = gate(); f.bootstrap.isFollower = true; f.bootstrap.own = structuredClone(f.bootstrap.group);
  f.aggregates.cards = aggregateLearning(f.bootstrap.group, [f.bootstrap.own]).cards;
  const resource = createGroupResource("alice", "e", { read: f.read });
  const change = { kind: "signal" as const, stepId: "s", reading: 7 };
  const save = personalWork.run({ userId: "alice", cardIds: ["c"] }, "initial-overlap", () => held.promise);
  workingCardStore.publishLearning("alice", "c", change, "start");
  try {
    const loading = resource.load(); await tick(); assert.equal(resource.snapshot().data, undefined);
    f.bootstrap.own![0].signalReadings[0].reading = 7; f.aggregates.cards = aggregateLearning(f.bootstrap.group, [f.bootstrap.own]).cards;
    workingCardStore.publishLearning("alice", "c", change, "settled"); held.release(); await save; await loading;
    assert.equal(resource.snapshot().data!.aggregates[0].followers.confidence, 7);
    assert.deepEqual(resource.snapshot().data!.aggregatePending, {});
  } finally { held.release(); resource.dispose(); }
});

test("several queued player changes coalesce F reconciliation and keep newer edits through an earlier failure", async () => {
  const f = fixture(), held = gate(); let writes = 0;
  f.bootstrap.isFollower = true; f.bootstrap.own = structuredClone(f.bootstrap.group);
  f.aggregates.cards = aggregateLearning(f.bootstrap.group, [f.bootstrap.own]).cards;
  const read: typeof groupFetch = async (...args) => {
    if (args[3] === "PATCH") {
      if (++writes === 1) { await held.promise; throw Error("First save failed"); }
      const change = (args[4] as { change: { reading: number } }).change;
      f.bootstrap.own![0].signalReadings[0].reading = change.reading;
      f.aggregates.cards = aggregateLearning(f.bootstrap.group, [f.bootstrap.own!]).cards;
      return {} as never;
    }
    return structuredClone(await f.read(...args));
  };
  const resource = createGroupResource("alice", "e", { read });
  try {
    await resource.load(); const before = f.calls.length;
    const first = resource.save("c", "personal", 1, 0, { kind: "signal", stepId: "s", reading: 5 });
    const newer = resource.save("c", "personal", 1, 0, { kind: "signal", stepId: "s", reading: 9 });
    assert.equal(resource.snapshot().data!.aggregatePending!.c.confidence, true);
    assert.equal(resource.snapshot().data!.aggregatePending!.c.progress, false);
    held.release(); await Promise.all([first, newer]);
    assert.equal(resource.snapshot().data!.bootstrap.own![0].signalReadings[0].reading, 9);
    assert.equal(resource.snapshot().data!.aggregates[0].followers.confidence, 9);
    assert.deepEqual(resource.snapshot().data!.aggregatePending, {});
    assert.equal(f.calls.slice(before).filter(url => url.includes("/aggregates?")).length, 1);
    assert.equal(f.calls.slice(before).filter(url => url.includes("/presentation?")).length, 0);
  } finally { held.release(); resource.dispose(); }
});
test("already authorised complete follower inputs calculate exact F immediately without an R1 placeholder", async () => {
  const f = fixture(), held = gate(); f.bootstrap.isFollower = true; f.bootstrap.own = structuredClone(f.bootstrap.group);
  f.peers.followers = [{ userId: "alice", username: "Alice", learning: structuredClone(f.bootstrap.own) }];
  f.aggregates.cards = aggregateLearning(f.bootstrap.group, [f.bootstrap.own]).cards;
  const read: typeof groupFetch = async (...args) => {
    if (args[3] === "PATCH") { await held.promise; f.aggregates.cards[0].followers.confidence = 8; return {} as never; }
    return f.read(...args);
  };
  const resource = createGroupResource("alice", "e", { read });
  try {
    await resource.load(); const save = resource.save("c", "personal", 1, 0, { kind: "signal", stepId: "s", reading: 8 });
    assert.equal(resource.snapshot().data!.aggregates[0].followers.confidence, 8);
    assert.equal(resource.snapshot().data!.aggregatePending!.c.confidence, false);
    assert.equal(resource.snapshot().data!.aggregates[0].group.confidence, null);
    held.release(); await save;
  } finally { held.release(); resource.dispose(); }
});

test("Personal edits notify matching retained projections; inactive resources retain dirty data without starting reads", async () => {
  const f = fixture(); f.bootstrap.isFollower = true; f.bootstrap.own = structuredClone(f.bootstrap.group);
  f.aggregates.cards = aggregateLearning(f.bootstrap.group, [f.bootstrap.own]).cards;
  const resource = createGroupResource("alice", "e", { read: f.read });
  try {
    await resource.load(); resource.setActive(false); const before = f.calls.length;
    const change = { kind: "completion" as const, stepId: "s", completionStatus: "done" as const };
    workingCardStore.publishLearning("alice", "c", change, "start");
    workingCardStore.publishLearning("alice", "c", change, "settled"); await tick();
    assert.equal(f.calls.length, before); assert.equal(resource.snapshot().data!.bootstrap.own![0].items[0].completionStatus, "done");
    assert.deepEqual(resource.snapshot().data!.aggregatePending!.c.progressSteps, ["s"]);
    assert.equal(resource.snapshot().data!.aggregatePending!.c.confidence, false);
    workingCardStore.clearUser("alice"); assert.equal(resource.snapshot().data, undefined);
  } finally { resource.dispose(); }
  const retained = retainedGroupResource("retention-actor", "group-one");
  assert.equal(retainedGroupResource("retention-actor", "group-one"), retained);
  assert.notEqual(retainedGroupResource("retention-actor", "group-two"), retained);
  workingCardStore.clearUser("retention-actor");
  assert.notEqual(retainedGroupResource("retention-actor", "group-one"), retained); workingCardStore.clearUser("retention-actor");
});
test("shared resource coalesces concurrent loads and expires cached peer authority from verification start", async () => {
  const f = fixture(); let now = 100, expire!: () => void;
  const resource = createGroupResource("alice", "e", { read: f.read, now: () => now,
    schedule: callback => { expire = callback as () => void; return 1 as unknown as ReturnType<typeof setTimeout>; }, cancel: () => {} });
  await Promise.all([resource.load(), resource.load()]);
  assert.equal(f.calls.length, 5); assert.equal(resource.snapshot().verified, true);
  assert.equal(resource.snapshot().data!.followers[0].username, "Bob");
  now += GROUP_AUTHORITY_MS; expire(); assert.equal(resource.snapshot().verified, false);
  resource.dispose();
});
test("a failed verification or changed structural generation never authorizes stale peer pages", async () => {
  const f = fixture(), resource = createGroupResource("alice", "e", { read: f.read });
  await resource.load(); f.authority.structureRevision++;
  await resource.load(); assert.equal(resource.snapshot().verified, false); assert.equal(resource.snapshot().data?.followers.length ?? 0, 0);
  resource.dispose();
});
test("late account-disposed reads cannot repopulate a previous resource", async () => {
  const f = fixture(); let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const read: typeof groupFetch = async (...args) => { await held; return f.read(...args); };
  const resource = createGroupResource("alice", "e", { read });
  const pending = resource.load(); resource.dispose(); release(); await pending;
  assert.equal(resource.snapshot().data, undefined); assert.equal(resource.snapshot().verified, false);
});
test("mutation ownership and target are captured independently of perspective navigation", async () => {
  const f = fixture(), resource = createGroupResource("alice", "e", { read: f.read });
  await resource.load();
  await Promise.all([resource.save("original-card", "group", 2, 3, { kind: "completion", stepId: "stable", completionStatus: "done" }),
    resource.navigate({ perspective: "follower", subjectUserId: "bob" })]);
  assert.ok(f.calls.some(url => url.endsWith("/cards/original-card/group-learning")));
  assert.ok(f.writes.some(body => JSON.stringify(body).includes('"version":2') && JSON.stringify(body).includes('"accessEpoch":3')));
  resource.dispose();
});
test("failed mutation rolls back its own field even when subsequent verification is unavailable", async () => {
  const f = fixture(); let fail = false;
  const read: typeof groupFetch = async (...args) => { if (fail) throw new Error("Offline"); return f.read(...args); };
  const resource = createGroupResource("alice", "e", { read }); await resource.load(); fail = true;
  await resource.save("c", "group", 1, 0, { kind: "completion", stepId: "s", completionStatus: "done" });
  assert.equal(resource.snapshot().data!.bootstrap.group[0].items[0].completionStatus, "todo");
  assert.equal(resource.snapshot().verified, false); assert.match(resource.snapshot().mutationError!, /Offline/); resource.dispose();
});
test("fresh server revocation clears cached group data and a slow final check cannot renew a lease", async () => {
  const f = fixture();
  for (const [code, status] of [["GROUP_FORBIDDEN", 403], ["GROUP_SESSION_CONFLICT", 409]] as const) {
    let fail = false;
    const read: typeof groupFetch = async (...args) => { if (fail) throw new GroupRequestError(code, status); return f.read(...args); };
    const resource = createGroupResource("alice", "e", { read }); await resource.load(); fail = true; await resource.load();
    assert.equal(resource.snapshot().data, undefined, "revoked or different-account data must be cleared, including owner dates"); resource.dispose();
  }
  let now = 0, baseReads = 0;
  const slow: typeof groupFetch = async (...args) => { if (args[1].endsWith("/authority") && ++baseReads === 2) now += GROUP_AUTHORITY_MS + 1; return f.read(...args); };
  const delayed = createGroupResource("alice", "e", { read: slow, now: () => now }); await delayed.load();
  assert.equal(delayed.snapshot().verified, false); delayed.dispose();
});
test("a different experience response cannot populate or retain this resource even with matching revisions", async () => {
  const f = fixture(); let mismatch = false;
  const read: typeof groupFetch = async <T>(...args: Parameters<typeof groupFetch>) => {
    const value = await f.read<T>(...args);
    return mismatch ? { ...value as object, experienceId: "another-experience" } as T : value;
  };
  const resource = createGroupResource("alice", "e", { read }); await resource.load(); mismatch = true; await resource.load();
  assert.equal(resource.snapshot().verified, false); assert.equal(resource.snapshot().data, undefined); resource.dispose();
});
test("navigation writes serialize and coalesce so an older response cannot restore stale selection", async () => {
  const f = fixture(); let release!: () => void, reached!: () => void;
  const ready = new Promise<void>(resolve => { reached = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  let first = true;
  const read: typeof groupFetch = async (...args) => {
    if (args[1].endsWith("/navigation") && first) { first = false; reached(); await held; }
    return f.read(...args);
  };
  const resource = createGroupResource("alice", "e", { read }); await resource.load();
  const older = resource.navigate({ perspective: "group" }); await ready;
  const newer = resource.navigate({ perspective: "follower", subjectUserId: "bob" }); release(); await Promise.all([older, newer]);
  assert.deepEqual((f.writes.at(-1) as { selection: unknown }).selection, { perspective: "follower", subjectUserId: "bob" }); resource.dispose();
});
test("leaving a view cancels reads but finishes already queued owner-bound learning saves", async () => {
  const f = fixture(); let reached!: () => void, release!: () => void, first = true;
  const ready = new Promise<void>(resolve => { reached = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  const read: typeof groupFetch = async (...args) => {
    if (args[3] === "PATCH") {
      assert.equal(args[0], "alice"); assert.equal(args[2], undefined, "view disposal cannot abort a scalar save");
      if (first) { first = false; reached(); await held; }
    }
    return f.read(...args);
  };
  const resource = createGroupResource("alice", "e", { read }); await resource.load();
  const older = resource.save("c", "personal", 1, 0, { kind: "completion", stepId: "s", completionStatus: "done" }); await ready;
  const newer = resource.save("c", "personal", 1, 0, { kind: "completion", stepId: "s", completionStatus: "skipped" });
  resource.dispose(); release(); await Promise.all([older, newer]);
  assert.equal(f.writes.length, 2); assert.deepEqual((f.writes[1] as { change: unknown }).change, { kind: "completion", stepId: "s", completionStatus: "skipped" });
  assert.equal(resource.snapshot().data, undefined, "save responses cannot repopulate a disposed view");
});

for (const boundary of ["first", "final", "revoked"] as const) test(`post-save revalidation replaces a pre-commit ${boundary} authority read without trusting stale data`, async () => {
  const f = fixture(); let pause = false, paused = false, baseReads = 0, revoked = false, release!: () => void, reached!: () => void;
  const gate = new Promise<void>(r => { release = r; }), ready = new Promise<void>(r => { reached = r; });
  const read: typeof groupFetch = async <T>(...args: Parameters<typeof groupFetch>) => {
    if (revoked) throw new GroupRequestError("GROUP_FORBIDDEN", 403);
    const result = structuredClone(await f.read<T>(...args));
    if (pause && args[1] === "/api/group-experiences/e/authority") {
      baseReads++;
      if (!paused && (boundary !== "final" || baseReads === 2)) { paused = true; reached(); await gate; }
    }
    return result;
  };
  const resource = createGroupResource("alice", "e", { read });
  try {
    await resource.load(); pause = true; const older = resource.load(); await ready;
    f.authority.structureRevision = 1; f.bootstrap.structureRevision = 1; f.peers.structureRevision = 1; f.aggregates.structureRevision = 1;
    const fresh = resource.revalidate(1);
    if (boundary === "revoked") revoked = true;
    release(); await older;
    assert.equal(await fresh, boundary !== "revoked");
    if (boundary === "revoked") { assert.equal(resource.snapshot().data, undefined); assert.equal(resource.snapshot().verified, false); }
    else { assert.equal(resource.snapshot().verified, true); assert.equal(resource.snapshot().data!.bootstrap.structureRevision, 1); }
  } finally { release(); resource.dispose(); }
});

test("fresh authority renews independently while a slow content refresh remains pending", async () => {
  const f = fixture(); let now = 0, hold = false, release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const timers: (() => void)[] = [];
  const read: typeof groupFetch = async (...args) => {
    if (hold && args[1].includes("/presentation?")) await held;
    return f.read(...args);
  };
  const resource = createGroupResource("alice", "e", { read, now: () => now,
    schedule: callback => { timers.push(callback); return timers.length as unknown as ReturnType<typeof setTimeout>; }, cancel: () => {} });
  await resource.load(); hold = true; const refresh = resource.load();
  await new Promise<void>(resolve => setImmediate(resolve));
  now = 2000; const count = f.calls.length;
  assert.equal(await resource.renewAuthority(), true);
  assert.equal(f.calls.length, count + 1, "renewal must not reload presentation or peer pages");
  now = GROUP_AUTHORITY_MS; timers[0](); assert.equal(resource.snapshot().verified, true);
  assert.equal(resource.snapshot().data!.followers[0].username, "Bob");
  now = 2000 + GROUP_AUTHORITY_MS; timers.at(-1)!(); assert.equal(resource.snapshot().verified, false);
  release(); await refresh; resource.dispose();
});

test("authority renewal rejects changed scopes, revocation and slow responses without widening the lease", async () => {
  for (const field of ["structureRevision", "accessEpoch", "adoptionRevision"] as const) {
    const f = fixture(), resource = createGroupResource("alice", "e", { read: f.read });
    await resource.load(); f.authority[field]++;
    assert.equal(await resource.renewAuthority(), false);
    assert.equal(resource.snapshot().verified, false);
    assert.equal(resource.snapshot().data?.followers.length, 0);
    resource.dispose();
  }
  for (const [code, status] of [["GROUP_FORBIDDEN", 403], ["GROUP_SESSION_CONFLICT", 409]] as const) {
    const f = fixture(); let fail = false;
    const read: typeof groupFetch = async (...args) => { if (fail) throw new GroupRequestError(code, status); return f.read(...args); };
    const resource = createGroupResource("alice", "e", { read }); await resource.load(); fail = true;
    assert.equal(await resource.renewAuthority(), false); assert.equal(resource.snapshot().data, undefined); resource.dispose();
  }
  const f = fixture(); let now = 0, slow = false;
  const read: typeof groupFetch = async (...args) => { if (slow) now += GROUP_AUTHORITY_MS; return f.read(...args); };
  const resource = createGroupResource("alice", "e", { read, now: () => now }); await resource.load(); slow = true;
  assert.equal(await resource.renewAuthority(), false); assert.equal(resource.snapshot().verified, false); resource.dispose();
});

test("disposed or superseded authority renewals cannot restore stale access", async () => {
  const f = fixture(); let hold = false, release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const read: typeof groupFetch = async <T>(...args: Parameters<typeof groupFetch>) => { const value = await f.read<T>(...args); if (hold) await held; return value; };
  const resource = createGroupResource("alice", "e", { read }); await resource.load(); hold = true;
  const renewal = resource.renewAuthority(); resource.dispose(); release(); await renewal;
  assert.equal(resource.snapshot().verified, false); assert.equal(resource.snapshot().data, undefined);
});

test("a late old renewal cannot invalidate a newly acknowledged Group generation", async () => {
  const f = fixture(); let hold = false, first = true, release!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { reached = resolve; });
  const read: typeof groupFetch = async <T>(...args: Parameters<typeof groupFetch>) => {
    const value = structuredClone(await f.read<T>(...args));
    if (hold && first && args[1].endsWith("/authority")) { first = false; reached(); await held; }
    return value;
  };
  const resource = createGroupResource("alice", "e", { read }); await resource.load(); hold = true;
  const old = resource.renewAuthority(); await ready;
  for (const value of [f.authority, f.bootstrap, f.peers, f.aggregates]) value.structureRevision = 1;
  assert.equal(await resource.revalidate(1), true);
  release(); await old;
  assert.equal(resource.snapshot().verified, true); assert.equal(resource.snapshot().data!.bootstrap.structureRevision, 1);
  resource.dispose();
});

test("an older same-scope transient renewal failure cannot withdraw a newer unexpired verification", async () => {
  for (const failure of ["expired", "network"] as const) {
    const f = fixture(); let now = 0, hold = false, held = false, release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const read: typeof groupFetch = async (...args) => {
      if (hold && !held && args[1].endsWith("/authority")) { held = true; await gate; if (failure === "network") throw Error("Offline"); }
      return f.read(...args);
    };
    let expire!: () => void;
    const resource = createGroupResource("alice", "e", { read, now: () => now, schedule: fn => { expire = fn; return 1 as never; }, cancel() {} });
    await resource.load(); now = 1000; hold = true; const old = resource.renewAuthority();
    now = 4000; await resource.load(); assert.equal(resource.snapshot().verified, true);
    now = 6001; release(); await old;
    assert.equal(resource.snapshot().verified, true, `${failure} from the old request must not collapse valid grid/overlay authority`);
    now = 9000; expire(); assert.equal(resource.snapshot().verified, false, "the newer request-start lease still expires after five seconds");
    resource.dispose();
  }
});
test("revocation and scope conflicts still withdraw authority after a newer same-scope success", async () => {
  for (const hard of ["revoked", "scope"] as const) {
    const f = fixture(); let hold = false, held = false, release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const read: typeof groupFetch = async (...args) => {
      if (hold && !held && args[1].endsWith("/authority")) { held = true; await gate;
        if (hard === "revoked") throw new GroupRequestError("GROUP_FORBIDDEN", 403);
        return { ...f.authority, structureRevision: 1 } as never;
      } return f.read(...args);
    };
    const resource = createGroupResource("alice", "e", { read }); await resource.load(); hold = true;
    const old = resource.renewAuthority(); await resource.load(); release(); await old;
    assert.equal(resource.snapshot().verified, false); if (hard === "revoked") assert.equal(resource.snapshot().data, undefined);
    resource.dispose();
  }
});


test("bootstrap presentation, peers and aggregates start together after common authority and reject mixed scopes", async () => {
  const f = fixture(), started = new Set<string>();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const read: typeof groupFetch = async (...args) => {
    for (const kind of ["presentation", "perspectives", "aggregates"]) if (args[1].includes(`/${kind}?`)) { started.add(kind); await gate; }
    return f.read(...args);
  };
  const resource = createGroupResource("alice", "e", { read });
  const pending = resource.load();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([...started].sort(), ["aggregates", "perspectives", "presentation"]);
  f.aggregates.adoptionRevision++; release(); await pending;
  assert.equal(resource.snapshot().verified, false); assert.equal(resource.snapshot().data, undefined);
  resource.dispose();
});

test("composed initial preparation publishes only after complete scoped contribution hydration without authority bookends", async () => {
 const f = fixture(), gateRead = gate(); let called = false;
 const read: typeof groupFetch = async <T>(_actor: string, url: string) => {
  f.calls.push(url); called = true; await gateRead.promise;
  return { ...f.authority, bootstrap: f.bootstrap, followers: f.peers.followers, aggregates: [], contributions: { media: {}, reflections: {} } } as T;
 };
 const resource = createGroupResource("alice", "e", { read });
 const pending = resource.prepare(); await tick(); assert.equal(called, true); assert.equal(resource.snapshot().data, undefined);
 gateRead.release(); await pending;
 assert.equal(resource.snapshot().verified, true); assert.equal(resource.snapshot().data!.bootstrap, f.bootstrap);
 assert.deepEqual(f.calls, ["/api/group-experiences/e/preparation"]); resource.dispose();
});

test("wrong-account composed responses cannot enter retained Group data", async () => {
 const f = fixture(); const read: typeof groupFetch = async <T>() => ({ ...f.authority, viewerUserId: "other", bootstrap: f.bootstrap, followers: [], aggregates: [], contributions: { media: {}, reflections: {} } }) as T;
 const resource = createGroupResource("alice", "e", { read }); await resource.prepare();
 assert.equal(resource.snapshot().data, undefined); assert.equal(resource.snapshot().verified, false); resource.dispose();
});

test("an older composed response cannot undo a newer confirmed authority scope", async () => {
 for (const field of ["structureRevision", "accessEpoch", "adoptionRevision"] as const) {
  const f = fixture(), held = gate(); let hold = false;
  const read: typeof groupFetch = async <T>(...args: Parameters<typeof groupFetch>) => {
   const response = structuredClone(await f.read<T>(...args));
   if (hold && args[1].includes("/preparation")) await held.promise;
   return response;
  };
  const resource = createGroupResource("alice", "e", { read }); await resource.prepare();
  hold = true; const old = resource.prepare(); await tick(); f.authority[field]++;
  assert.equal(await resource.renewAuthority(), false); held.release(); await old;
  assert.equal(resource.snapshot().verified, false); assert.equal(resource.snapshot().data!.followers.length, 0);
  hold = false; f.bootstrap[field]++; await resource.prepare(); assert.equal(resource.snapshot().verified, true); resource.dispose();
 }
});

test("entries share compatible in-flight work and authorise a prepared next perspective through actual open", async () => {
 const f = fixture(), held = gate(); const selections: unknown[] = [];
 const read: typeof groupFetch = async <T>(...args: Parameters<typeof groupFetch>) => {
  const response = structuredClone(await f.read<T>(...args));
  if (args[1].includes("/preparation") || args[1].endsWith("/open")) {
   const selection = (args[4] as { selection?: unknown })?.selection; selections.push(selection);
   if (selections.length === 1) await held.promise;
   if (args[1].endsWith("/open")) return { ...f.authority, selection, activeCardId: null } as T;
   (response as { bootstrap: GroupBootstrap }).bootstrap.selection = selection as GroupBootstrap["selection"];
  }
  return response;
 };
 const resource = createGroupResource("alice", "e", { read });
 const first = resource.prepare({ perspective: "group" });
 assert.equal(resource.prepare({ perspective: "group" }), first);
 const other = resource.prepare({ perspective: "follower", subjectUserId: "bob" }); await tick(); assert.equal(selections.length, 1);
 held.release(); await Promise.all([first, other]); assert.equal(selections.length, 2);
 assert.equal(f.calls.filter(url => url.includes("/preparation")).length, 1); assert.equal(f.calls.filter(url => url.endsWith("/open")).length, 1);
 assert.deepEqual(resource.snapshot().data!.bootstrap.selection, { perspective: "follower", subjectUserId: "bob" }); resource.dispose();
});
