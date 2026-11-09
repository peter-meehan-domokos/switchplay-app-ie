import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptGroupLoginDefault, needsGroupLoginDefault, startGroupLogin } from "../src/lib/groupExperiences/loginPerspective";
import { preparationSelectionCommand, selectionCommand } from "../src/lib/groupExperiences/navigation";
function storage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; }
test("a successful new login resets each Group once and retains subsequent session navigation", () => {
  const s = storage(); startGroupLogin("alice", s);
  assert.equal(needsGroupLoginDefault("alice", "one", s), true);
  acceptGroupLoginDefault("alice", "one", s);
  assert.equal(needsGroupLoginDefault("alice", "one", s), false);
  assert.equal(needsGroupLoginDefault("alice", "two", s), true);
  assert.equal(needsGroupLoginDefault("bob", "one", s), false);
  startGroupLogin("alice", s);
  assert.equal(needsGroupLoginDefault("alice", "one", s), true);
  startGroupLogin("bob", s); acceptGroupLoginDefault("alice", "one", s);
  assert.equal(needsGroupLoginDefault("bob", "one", s), true);
});
test("login intent survives unavailable browser storage without consuming failed entries", () => {
  const s = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  startGroupLogin("carol", s);
  assert.equal(needsGroupLoginDefault("carol", "one", s), true);
  assert.equal(needsGroupLoginDefault("carol", "one", s), true);
  acceptGroupLoginDefault("carol", "one", s);
  assert.equal(needsGroupLoginDefault("carol", "one", s), false);
});
test("only initial preparation accepts a role default, without a foreign subject", () => {
  assert.deepEqual(preparationSelectionCommand({ perspective: "default" }), { perspective: "default" });
  assert.throws(() => preparationSelectionCommand({ perspective: "default", subjectUserId: "bob" }));
  assert.throws(() => selectionCommand({ perspective: "default" }));
  assert.deepEqual(preparationSelectionCommand({ perspective: "follower", subjectUserId: "bob" }), { perspective: "follower", subjectUserId: "bob" });
});
