import assert from "node:assert/strict";
import { test } from "node:test";
import { createGroupResource } from "../src/components/group-experiences/groupResource";
import { GroupRequestError, type groupFetch } from "../src/components/group-experiences/groupClient";
import { workingCardStore } from "../src/lib/cards/workingCardStore";
import { aggregateLearning } from "../src/lib/groupExperiences/readModels";
import { packPreparation } from "../src/lib/groupExperiences/preparationPaging";
import type { PreparedGroup } from "../src/lib/groupExperiences/preparation";
import type { PerspectiveSelection } from "../src/lib/groupExperiences/model";
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function fixture(count = 2, dual = false, byteBudget?: number) {
 const actor = `followup-${Math.random()}`, experienceId = "e";
 const authority = { viewerUserId: actor, experienceId, structureRevision: 0, accessEpoch: 0, adoptionRevision: 0 };
 const cards = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, cardTemplateId: `c${i}`, version: 1 }));
 const learning = cards.map(card => ({ cardTemplateId: card.id, version: 1, items: [{ stepId: "s", completionStatus: "todo" }], signalReadings: [{ stepId: "s", reading: null }] }));
 const followers = Array.from({ length: count }, (_, i) => ({ userId: dual && !i ? actor : `member${i}`, username: `Member ${i}`, learning }));
 const bootstrap = { ...authority, isAdmin: true, isFollower: dual, canInspectFollowers: true, allowFollowerInspection: true, selection: { perspective: "group" },
  deck: { id: "d", deckTemplateId: "d", version: 1, cards }, group: learning, own: dual ? learning : null, ownDates: dual ? [] : null, nextCardOffset: null } as PreparedGroup["bootstrap"];
 const contributions = (selection: PerspectiveSelection) => ({ media: Object.fromEntries(cards.map(card => [card.id, { ...authority, cardTemplateId: card.id, subjectUserId: selection.perspective === "follower" ? selection.subjectUserId : null,
  items: [], total: 0, start: 0, olderCount: 0, older: null, newer: null, refresh: null, capabilities: { canUpload: false, canManage: false, canHideOthers: false, canRemoveOwn: false } }])),
  reflections: Object.fromEntries(cards.map(card => [card.id, { viewerUserId: actor, cardTemplateId: card.id, accessEpoch: 0, adoptionRevision: 0, view: { kind: "group", experienceId, accessEpoch: 0,
   mode: selection.perspective === "self" ? "own" : selection.perspective === "group" ? "group" : "inspection", ...(selection.perspective === "follower" ? { subjectUserId: selection.subjectUserId } : {}) }, items: [] }])) });
 const value = (selection: PerspectiveSelection = { perspective: "group" }) => structuredClone({ ...authority, bootstrap: { ...bootstrap, selection }, followers, aggregates: aggregateLearning(learning as never, followers.map(row => row.learning) as never).cards, contributions: contributions(selection) }) as PreparedGroup;
 const entries = [{ index: 0, value: { cards: cards.map(card => ({ cardTemplateId: card.id, version: 1 })), followers: followers.map(({ userId, username }) => ({ userId, username })) } },
  ...followers.filter(row => row.userId !== actor).flatMap(row => cards.map(card => { const content = contributions({ perspective: "follower", subjectUserId: row.userId }); return { subjectUserId: row.userId, cardTemplateId: card.id,
   learning: learning.find(l => l.cardTemplateId === card.id), media: content.media[card.id], reflection: content.reflections[card.id] }; })).map((value, i) => ({ index: i + 1, value }))];
 const calls: string[] = [];
 const read: typeof groupFetch = async (_actor, url, _signal, method, body) => {
  calls.push(`${method ?? "GET"} ${url}`);
  const params = new URL(url, "http://localhost").searchParams;
  if (url.includes("/preparation/followers")) return packPreparation(authority, entries[0].value, entries, entries.length, params.get("after") ?? undefined, undefined, byteBudget ?? (count > 20 ? 200_000 : undefined)) as never;
  if (url.endsWith("/authority")) return { ...authority } as never;
  if (method === "PATCH") return {} as never;
  const selection = (body as { selection?: PerspectiveSelection })?.selection ?? (params.has("perspective") ? { perspective: params.get("perspective"), ...(params.has("subjectUserId") ? { subjectUserId: params.get("subjectUserId") } : {}) } : undefined);
  return value(selection as PerspectiveSelection | undefined) as never;
 };
 return { actor, bootstrap, value, calls, read, entries, authority };
}

test("primary preparation shares work, keeps current selection, and ready switching never needs metadata", async () => {
 const f = fixture(2, true), held = gate(); let holding = false;
 const read: typeof groupFetch = async (...args) => { const value = await f.read(...args); if (args[1].includes("perspective=self")) { holding = true; await held.promise; } return value as never; };
 const resource = createGroupResource(f.actor, "e", { read });
 try {
  await resource.prepare(); const original = resource.snapshot().data!;
  const first = resource.preparePerspective({ perspective: "self" }); const second = resource.preparePerspective({ perspective: "self" });
  await tick(); assert.equal(holding, true); assert.equal(resource.isPrepared({ perspective: "self" }), false); assert.equal(resource.snapshot().data, original);
  held.release(); assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(f.calls.filter(url => url.includes("perspective=self")).length, 1); assert.equal(resource.snapshot().data!.bootstrap.selection.perspective, "group");
  const calls = f.calls.length; assert.equal(await resource.preparePerspective({ perspective: "self" }), true); assert.equal(f.calls.length, calls);
  await resource.navigate({ perspective: "self" }); assert.equal(f.calls.length, calls + 1); assert.match(f.calls.at(-1)!, /PATCH.*navigation/);
  assert.equal(resource.isPrepared({ perspective: "group" }), true);
 } finally { held.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("normal automatic preparation prioritises Group then Me then one shared follower operation", async () => {
 const f = fixture(16, true), resource = createGroupResource(f.actor, "e", { read: f.read });
 try {
  await resource.prepare({ perspective: "self" }); assert.equal(resource.isPrepared({ perspective: "group" }), false);
  await resource.prepareNext(() => false); assert.equal(f.calls.length, 1);
  await resource.prepareNext(() => true); assert.match(f.calls.at(-1)!, /perspective=group/);
  assert.equal(resource.snapshot().data!.bootstrap.selection.perspective, "self");
  await Promise.all([resource.prepareNext(() => true), resource.prepareFollowers()]);
  assert.equal(resource.followersReady(), true); assert.equal(f.calls.filter(url => url.includes("/preparation/followers")).length, 1);
  for (const row of f.entries.slice(1)) assert.equal(resource.isPrepared({ perspective: "follower", subjectUserId: (row.value as { subjectUserId: string }).subjectUserId }), true);
  const before = f.calls.length; assert.equal(await resource.prepareNext(() => true), false); assert.equal(await resource.prepareFollowers(), true); assert.equal(f.calls.length, before);
 } finally { resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("large follower transport pauses after an in-flight page, retains it and publishes only the complete resumed set", async () => {
 const f = fixture(100), held = gate(); let first = true;
 const read: typeof groupFetch = async (...args) => { const value = await f.read(...args); if (args[1].includes("/preparation/followers") && first) { first = false; await held.promise; } return value as never; };
 const resource = createGroupResource(f.actor, "e", { read });
 try {
  await resource.prepare(); const before = f.calls.length; assert.equal(await resource.prepareNext(() => true), false); assert.equal(f.calls.length, before);
  const pending = resource.prepareFollowers(); await tick(); resource.setFollowerIntent(false); held.release(); assert.equal(await pending, false);
  assert.equal(resource.followersReady(), false); assert.equal(resource.snapshot().preparation?.followers, "paused");
  assert.equal(f.calls.filter(url => url.includes("/preparation/followers")).length, 1);
  f.bootstrap.group[0].signalReadings[0].reading = 7;
  await resource.prepare(); // A newer compatible read while the first follower page is retained.
  assert.equal(await resource.prepareFollowers(), true); assert.equal(resource.followersReady(), true);
  assert.equal(resource.snapshot().data!.followers[0].learning[0].signalReadings[0].reading, 7, "a resumed old page must not acquire a new read order");
  assert.equal(f.calls.filter(url => url.includes("/preparation/followers") && !url.includes("after=")).length, 1);
  const calls = f.calls.length; await resource.prepareFollowers(); assert.equal(f.calls.length, calls);
 } finally { held.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("pending follow-ups cannot repopulate confirmed revoked or account-cleared scopes", async () => {
 for (const reason of ["account", "revoked", "scope"] as const) {
  const f = fixture(2, true), held = gate(); let deny = false;
  const read: typeof groupFetch = async (...args) => {
   if (deny && args[1].endsWith("/authority")) { if (reason === "revoked") throw new GroupRequestError("GROUP_FORBIDDEN", 403); return { ...f.authority, structureRevision: 1 } as never; }
   const result = await f.read(...args); if (args[1].includes("perspective=self")) await held.promise; return result as never;
  };
  const resource = createGroupResource(f.actor, "e", { read });
  try {
   await resource.prepare(); const pending = resource.preparePerspective({ perspective: "self" }); await tick();
   if (reason === "account") workingCardStore.clearUser(f.actor); else { deny = true; await resource.renewAuthority(); }
   held.release(); assert.equal(await pending, false); assert.equal(resource.isPrepared({ perspective: "self" }), false); assert.equal(resource.snapshot().verified, false);
  } finally { held.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
 }
});

test("already prepared Group remains immediately selectable while an own save invalidates unknown F inputs", async () => {
 const f = fixture(16, true), held = gate();
 const read: typeof groupFetch = async (...args) => {
  if (args[3] === "PATCH") { await held.promise; return {} as never; }
  if (args[1].includes("/aggregates?")) return { ...f.authority, cards: f.value().aggregates, nextCardOffset: null } as never;
  const response = structuredClone(await f.read(...args)) as PreparedGroup;
  response.bootstrap.canInspectFollowers = false; response.followers = response.followers.filter(row => row.userId === f.actor);
  return response as never;
 };
 const resource = createGroupResource(f.actor, "e", { read });
 try {
  await resource.prepare();
  const save = resource.save("c0", "personal", 1, 0, { kind: "signal", stepId: "s", reading: 8 });
  assert.equal(resource.snapshot().data!.aggregatePending!.c0.confidence, true);
  const calls = f.calls.length;
  assert.equal(resource.isPrepared({ perspective: "group" }), true);
  assert.equal(await resource.preparePerspective({ perspective: "group" }), true);
  assert.equal(f.calls.length, calls, "R1 must not turn a retained complete view into a metadata wait");
  held.release(); await save;
 } finally { held.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("own learning saved during Group preparation keeps its newer field while independent metadata is accepted", async () => {
 const f = fixture(2, true), heldRead = gate(), heldSave = gate(); let holdGroup = false;
 const read: typeof groupFetch = async (...args) => {
  if (args[3] === "PATCH") { await heldSave.promise; return {} as never; }
  const value = structuredClone(await f.read(...args));
  if (holdGroup && args[1].includes("perspective=group")) await heldRead.promise;
  return value as never;
 };
 const resource = createGroupResource(f.actor, "e", { read });
 try {
  await resource.prepare({ perspective: "self" }); holdGroup = true;
  const preparing = resource.preparePerspective({ perspective: "group" }); await tick();
  const save = resource.save("c0", "personal", 1, 0, { kind: "signal", stepId: "s", reading: 9 });
  heldRead.release(); assert.equal(await preparing, true);
  const data = resource.snapshot().data!;
  assert.equal(data.bootstrap.own![0].signalReadings[0].reading, 9);
  assert.equal(data.bootstrap.group[0].signalReadings[0].reading, null);
  assert.equal(resource.isPrepared({ perspective: "group" }), true);
  assert.equal(data.bootstrap.selection.perspective, "self");
  assert.equal(data.aggregates[0].followers.confidence, 9);
  heldSave.release(); await save;
 } finally { heldRead.release(); heldSave.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});

test("idle preparation distinguishes pending foreground work from a retained failed retry", async () => {
 const { PersonalWork } = await import("../src/lib/cards/personalWork");
 const work = new PersonalWork(), held = gate(), scope = { userId: "work-owner", cardIds: ["c"] };
 const save = work.run(scope, "reflection", async () => { await held.promise; throw Error("Retry retained"); });
 assert.equal(work.hasPending(scope), true);
 const failure = assert.rejects(save, /Retry retained/); held.release(); await failure;
 assert.equal(work.hasPending(scope), false); assert.equal(work.hasWork(scope), true);
 await assert.rejects(work.wait(scope), /could not be saved/);
});

test("a collective save suspends starting further automatic follower pages without blocking that save", async () => {
 const f = fixture(16, false, 20_000), heldRead = gate(), heldSave = gate(); let first = true;
 const read: typeof groupFetch = async (...args) => {
  if (args[3] === "PATCH") { await heldSave.promise; return {} as never; }
  const value = await f.read(...args);
  if (args[1].includes("/preparation/followers") && first) { first = false; await heldRead.promise; }
  return value as never;
 };
 const resource = createGroupResource(f.actor, "e", { read });
 try {
  await resource.prepare();
  const background = resource.prepareNext(() => true); await tick();
  const save = resource.save("c0", "group", 1, 0, { kind: "signal", stepId: "s", reading: 8 });
  heldRead.release(); await background;
  assert.equal(resource.snapshot().preparation?.followers, "paused");
  assert.equal(f.calls.filter(url => url.includes("/preparation/followers")).length, 1);
  assert.equal(resource.snapshot().data!.bootstrap.group[0].signalReadings[0].reading, 8);
  heldSave.release(); await save; await resource.prepareNext(() => true);
  assert.equal(resource.followersReady(), true);
 } finally { heldRead.release(); heldSave.release(); resource.dispose(); workingCardStore.clearUser(f.actor); }
});
