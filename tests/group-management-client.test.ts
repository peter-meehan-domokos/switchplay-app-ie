import assert from "node:assert/strict";
import { test } from "node:test";
import { createUserDirectory } from "../src/components/group-experiences/userDirectory";
import { promoteCreatedGroup, loadGroupSettings } from "../src/components/group-experiences/groupManagementClient";
test("directory coalesces loads, sorts identities and reuses minimal actor-scoped data", async () => {
  let reads = 0;
  const request = (async (url: string) => Response.json(url === "/api/users" ? (reads++, { users: [{ id: "b", name: "Zebra", private: "ignored" }, { id: "a", name: "alice" }] }) : { user: { id: "owner" } })) as typeof fetch;
  const directory = createUserDirectory(request);
  const one = directory.ensure("owner"), two = directory.ensure("owner"); assert.equal(one, two);
  assert.deepEqual(await one, [{ id: "a", name: "alice" }, { id: "b", name: "Zebra" }]);
  await directory.ensure("owner"); assert.equal(reads, 1);
  await assert.rejects(directory.ensure("other"), /sign-in changed/);
  assert.equal(directory.snapshot("other").users, undefined);
});
test("directory rejects account changes during fetch and supports explicit retry", async () => {
  let fail = true, checks = 0;
  const directory = createUserDirectory((async (url: string) => {
    if (url === "/api/users") return Response.json({ users: [{ id: "a", name: "Alice" }] });
    checks++; return Response.json({ user: { id: fail && checks > 1 ? "other" : "owner" } });
  }) as typeof fetch);
  await assert.rejects(directory.ensure("owner"), /sign-in changed/); assert.equal(directory.snapshot("owner").users, undefined);
  fail = false; assert.equal((await directory.ensure("owner")).length, 1);
});
test("new Group promotion preserves every other entry and ignores unassigned IDs", () => {
  const entries = [{ id: "personal-latest" }, { id: "personal-old" }, { id: "old-group" }, { id: "new-group" }];
  assert.deepEqual(promoteCreatedGroup(entries, "new-group").map(row => row.id), ["new-group", "personal-latest", "personal-old", "old-group"]);
  assert.deepEqual(promoteCreatedGroup(entries, "unknown"), entries);
});
test("settings loader reads all roster pages and rejects mixed revisions", async t => {
  let conflict = false;
  const seen: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    seen.push(input);
    const body = input.includes("members") ? { structureRevision: conflict ? 2 : 1,
      members: [{ userId: input.includes("after=") ? "second" : "first", isAdmin: !input.includes("after="), followerStatus: "active" }], nextCursor: input.includes("after=") ? null : "first" }
      : { structureRevision: 1, name: "Team", isAdmin: true, allowFollowerInspection: false };
    return Response.json({ viewerUserId: "owner", ...body }, { headers: { "X-Group-Viewer": "owner" } });
  });
  const result = await loadGroupSettings("owner", "group");
  assert.deepEqual(result.adminIds, ["first"]); assert.deepEqual(result.followerIds, ["first", "second"]); assert.equal(seen.length, 4);
  conflict = true; await assert.rejects(loadGroupSettings("owner", "group"), /membership changed/);
});
