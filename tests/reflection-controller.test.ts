import assert from "node:assert/strict";
import { test } from "node:test";
import { ReflectionController, retainedReflection } from "../src/lib/reflections/controller";
import type { ReflectionFeed } from "../src/lib/reflections/reads";
import { workingCardStore } from "../src/lib/cards/workingCardStore";
import { personalWork } from "../src/lib/cards/personalWork";
const context = { viewerUserId: "alice", cardTemplateId: "c", view: { kind: "personal" as const } };
function feed(text = "Old", revision = 1): ReflectionFeed {
  return { ...context, accessEpoch: null, adoptionRevision: null, items: [{ entry: { source: { kind: "personal", cardTemplateId: "c" }, authorUserId: "alice", authorName: "Alice", text, revision, createdAt: null, originName: "Personal", groupVisible: false }, empty: !text, private: false, label: null, canEdit: true, canDelete: true, canHide: false, explanation: null }] };
}
function gate<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
test("Personal reflection survives unsubscribe/remount and delayed reads around a save", async () => {
  const read = gate<ReflectionFeed>(), write = gate<{ revision: number }>(); let held = false, calls = 0;
  const c = new ReflectionController(context, { read: () => { calls++; return held ? read.promise : Promise.resolve(feed()); }, write: () => write.promise });
  await c.refresh(); const off = c.subscribe(() => {}); off(); assert.equal(c.snapshot().feed!.items[0].entry.text, "Old");
  held = true; const pending = c.refresh(), duplicate = c.refresh(); assert.equal(calls, 2);
  const save = c.save(feed().items[0].entry.source, "New", 1, "save"); assert.equal(c.snapshot().feed!.items[0].entry.text, "New");
  write.resolve({ revision: 2 }); await save; read.resolve(feed()); await Promise.all([pending, duplicate]);
  assert.equal(c.snapshot().feed!.items[0].entry.text, "New"); assert.equal(c.snapshot().feed!.items[0].entry.revision, 2); c.dispose();
});
test("a read started during an optimistic save cannot overwrite its text", async () => {
  const write = gate<{ revision: number }>();
  const c = new ReflectionController(context, { read: async () => feed(), write: () => write.promise });
  await c.refresh(); const save = c.save(feed().items[0].entry.source, "Pending", 1, "save"); await c.refresh();
  assert.equal(c.snapshot().feed!.items[0].entry.text, "Pending"); write.resolve({ revision: 2 }); await save; c.dispose();
});
test("failed or conflicted save rolls back the source, keeps errors and permits reconciliation", async () => {
  for (const status of [500, 409]) {
    const c = new ReflectionController(context, { read: async () => feed(), write: async () => { throw Object.assign(Error("Save failed"), { status, code: "REFLECTION_REVISION_CONFLICT" }); } });
    await c.refresh(); await assert.rejects(c.save(feed().items[0].entry.source, "Unsaved", 1, "save"));
    assert.equal(c.snapshot().feed!.items[0].entry.text, "Old"); assert.equal(c.snapshot().saving, false); c.dispose();
  }
});
test("network failures retain known reflection data; wrong actor and expired account results cannot populate it", async () => {
  let fail = false;
  const c = new ReflectionController(context, { read: async () => { if (fail) throw Error("Offline"); return feed(); }, write: async () => ({ revision: 2 }) });
  await c.refresh(); fail = true; await c.refresh(); assert.equal(c.snapshot().feed!.items[0].entry.text, "Old"); c.dispose();
  const wrong = new ReflectionController(context, { read: async () => ({ ...feed(), viewerUserId: "bob" }), write: async () => ({ revision: 2 }) });
  await wrong.refresh(); assert.equal(wrong.snapshot().feed, null); wrong.dispose();
  const read = gate<ReflectionFeed>(), late = new ReflectionController(context, { read: () => read.promise, write: async () => ({ revision: 2 }) });
  const pending = late.refresh(); workingCardStore.clearUser("alice"); read.resolve(feed("Secret")); await pending;
  assert.equal(late.snapshot().feed, null); late.dispose();
});

for (const collective of [false, true]) test(`${collective ? "collective" : "individual Group"} source keeps its save while unrelated feed rows refresh`, async () => {
  const groupContext = { ...context, adoptionRevision: 2, view: { kind: "group" as const, experienceId: "g", mode: collective ? "group" as const : "own" as const, accessEpoch: 1 } };
  const snapshot = (): ReflectionFeed => ({ ...feed(), ...groupContext, accessEpoch: 1,
    items: [{ ...feed().items[0], entry: { ...feed().items[0].entry, source: { kind: "group", experienceId: "g", reflectionId: "r", cardTemplateId: "c" }, groupVisible: true } }],
    ...(collective ? { collective: { source: { kind: "group-card" as const, experienceId: "g", cardTemplateId: "c" }, text: "Shared old", revision: 4, canEdit: true } } : {}) });
  let held = false; const old = gate<ReflectionFeed>(), write = gate<{ revision: number }>();
  const c = new ReflectionController(groupContext, { read: () => held ? old.promise : Promise.resolve(snapshot()), write: () => write.promise });
  await c.refresh(); held = true; const pending = c.refresh();
  const source = collective ? snapshot().collective!.source : snapshot().items[0].entry.source;
  const save = c.save(source, "Submitted", collective ? 4 : 1, "save");
  write.resolve({ revision: collective ? 5 : 2 }); await save;
  const changed = snapshot(); changed.items.push({ ...feed().items[0], entry: { ...feed().items[0].entry, source: { kind: "group", experienceId: collective ? "g" : "another-origin", cardTemplateId: "c", reflectionId: "independent" }, authorUserId: collective ? "bob" : "alice", text: "Independent changed note", groupVisible: true } });
  old.resolve(changed); await pending;
  assert.equal(collective ? c.snapshot().feed!.collective!.text : c.snapshot().feed!.items[0].entry.text, "Submitted");
  assert.equal(c.snapshot().feed!.items[1].entry.text, "Independent changed note"); c.dispose();
});

test("retained Personal source is reused across Deck placements; account clearance drops it", async () => {
  const first = retainedReflection({ ...context, deckTemplateId: "first" }, { read: async () => feed(), write: async () => ({ revision: 2 }) });
  await first.refresh(); const next = retainedReflection({ ...context, deckTemplateId: "second" });
  assert.equal(first, next); assert.equal(next.snapshot().feed!.items[0].entry.text, "Old");
  workingCardStore.clearUser("alice"); assert.equal(first.snapshot().feed, null);
  assert.notEqual(retainedReflection(context), first); workingCardStore.clearUser("alice");
});
test("submitted reflection work outlives view disposal and cannot repopulate its cleared controller", async () => {
  const actor = "pending-reflection-owner", write = gate<{ revision: number }>();
  const value = { ...feed(), viewerUserId: actor, items: feed().items.map(item => ({ ...item, entry: { ...item.entry, authorUserId: actor } })) };
  const c = new ReflectionController({ ...context, viewerUserId: actor }, { read: async () => value, write: () => write.promise });
  await c.refresh(); const saving = c.save(value.items[0].entry.source, "Submitted", 1, "save");
  const scope = { userId: actor, cardIds: ["c"] };
  assert.equal(personalWork.hasWork(scope), true); c.dispose();
  assert.equal(personalWork.hasWork(scope), true); write.resolve({ revision: 2 }); await saving;
  assert.equal(personalWork.hasWork(scope), false); assert.equal(c.snapshot().feed, null);
});
