import assert from "node:assert/strict";
import { test } from "node:test";
import { packPreparation, preparationCursor } from "../src/lib/groupExperiences/preparationPaging";
import { PreparationAssembly } from "../src/lib/groupExperiences/preparationPages";
const authority = { viewerUserId: "alice", experienceId: "e", structureRevision: 1, accessEpoch: 2, adoptionRevision: 3 };
test("bounded pages preserve exact Unicode, large reflection text and independent complete items", () => {
  const values = [{ title: "Header" }, { text: "🏀\"\\\n".repeat(4000), revision: 8 }, { knownEmpty: [] }];
  const entries = values.map((value, index) => ({ index, value })), assembly = new PreparationAssembly();
  let after: string | undefined, count = 0;
  do {
    const page = packPreparation(authority, ["manifest", "roster"], entries, entries.length, after, undefined, 2000);
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 2000);
    assembly.accept(page); after = page.next ?? undefined; count++;
  } while (after);
  assert.ok(count > 2); assert.deepEqual([...assembly.values.values()], values);
});
test("continuation rejects changed authority/roster and a changed fragmented source", () => {
  const rows = [{ index: 0, value: { text: "x".repeat(9000) } }];
  const first = packPreparation(authority, "old", rows, 1, undefined, undefined, 2000);
  assert.ok(preparationCursor(first.next!)!.offset > 0);
  assert.throws(() => packPreparation({ ...authority, accessEpoch: 3 }, "old", rows, 1, first.next!), /GROUP_SCOPE_CONFLICT/);
  assert.throws(() => packPreparation(authority, "new roster", rows, 1, first.next!), /GROUP_SCOPE_CONFLICT/);
  assert.throws(() => packPreparation(authority, "old", [{ index: 0, value: { text: "new".repeat(9000) } }], 1, first.next!), /GROUP_PREPARATION_CONTENT_CHANGED/);
  const assembly = new PreparationAssembly(); assembly.accept(first);
  assert.throws(() => assembly.accept({ ...first, scope: "other" }), /scope changed/);
});
