import assert from "node:assert/strict";
import { test } from "node:test";
import { createGroupResource, GROUP_AUTHORITY_MS } from "../src/components/group-experiences/groupResource";
import { groupFetch, GroupRequestError } from "../src/components/group-experiences/groupClient";
import type { GroupBootstrap, GroupPerspectivePage, GroupAggregates } from "../src/lib/groupExperiences/presentationReads";

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
    return (url.includes("/presentation?") ? bootstrap : url.includes("/perspectives?") ? peers : url.includes("/aggregates?") ? aggregates : authority) as never;
  };
  return { authority, bootstrap, peers, aggregates, calls, writes, read };
}
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
  await resource.load(); assert.equal(resource.snapshot().verified, false); assert.equal(resource.snapshot().data?.followers.length, 0);
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
  const slow: typeof groupFetch = async (...args) => { if (args[1].endsWith("/e") && ++baseReads === 2) now += GROUP_AUTHORITY_MS + 1; return f.read(...args); };
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
    if (pause && args[1] === "/api/group-experiences/e") {
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
