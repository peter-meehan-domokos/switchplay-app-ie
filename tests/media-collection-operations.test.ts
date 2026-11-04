import assert from "node:assert/strict";
import { test } from "node:test";
import { GroupMediaUpload, mutateCollectionItem } from "../src/lib/mediaCollection/operations";
import type { MediaCollectionContext, MediaCollectionItem } from "../src/lib/mediaCollection/contracts";
const context: MediaCollectionContext = { kind: "owner", viewerUserId: "bob", cardTemplateId: "card" };
const item: MediaCollectionItem = { source: { kind: "group", experienceId: "origin", contributionId: "upload" }, authorUserId: "bob", mediaType: "image", description: "Video", uploadedAt: null, originName: "Galway U18", private: true, revision: 2 };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "X-Group-Viewer": "bob" } });
test("creator deletion uses original source from another context; hiding is a separate current-Group command", async t => {
  const calls: { url: string; method?: string; body: unknown }[] = [];
  t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => { calls.push({ url: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : null }); return json({ state: "deleted" }); });
  await mutateCollectionItem(context, item, "delete");
  assert.deepEqual(calls[0], { url: "/api/group-media/upload", method: "DELETE", body: { expectedRevision: 2 } });
  const group = { kind: "group" as const, viewerUserId: "bob", cardTemplateId: "card", experienceId: "origin", accessEpoch: 4, adoptionRevision: 1 };
  await mutateCollectionItem(group, item, "hide"); assert.equal(calls[1].method, "PATCH"); assert.deepEqual(calls[1].body, { accessEpoch: 4, expectedRevision: 2 });
  await assert.rejects(mutateCollectionItem({ ...context, viewerUserId: "alice" }, item, "delete"));
});
test("Group upload retry retains operation and original origin, and never re-transfers after successful upload", async t => {
  const calls: { url: string; body: unknown }[] = []; let commit = 0, transfers = 0;
  t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
    const url = String(input); calls.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    if (url === "https://upload.invalid/image") { transfers++; assert.equal((init?.headers as Record<string, string>)["If-None-Match"], "*"); return new Response(null, { status: 200 }); }
    if (url.endsWith("/commit")) { commit++; if (commit === 1) return json({ error: "Lost acknowledgement" }, 503); return json({ contributionId: "upload" }); }
    return json({ contributionId: "upload", revision: 1, state: "pending", proof: "bound-proof", uploadURL: "https://upload.invalid/image", headers: { "If-None-Match": "*", "Content-Type": "image/png" } });
  });
  const upload = new GroupMediaUpload({ viewerUserId: "bob", experienceId: "origin", cardTemplateId: "card", accessEpoch: 0, version: 1 }, new File(["image"], "clip.png", { type: "image/png" }), "stable-operation");
  await assert.rejects(upload.run(new AbortController().signal)); await upload.run(new AbortController().signal);
  assert.equal(transfers, 1); assert.equal(commit, 2);
  const allocations = calls.filter(c => c.url.endsWith("/media")); assert.ok(allocations.every(c => (c.body as { operationId: string }).operationId === "stable-operation"));
  assert.ok(calls.every(c => !c.url.includes("/personal")));
});
test("a lost transfer response is recovered through owner status without a second upload", async t => {
  let transfers = 0, statuses = 0;
  t.mock.method(globalThis, "fetch", async (input: unknown) => {
    const url = String(input);
    if (url === "https://upload.invalid/once") { transfers++; throw Error("Lost PUT response"); }
    if (url.includes("action=status")) { statuses++; return json({ status: "ready", revision: 1 }); }
    if (url.endsWith("/commit")) return json({ contributionId: "upload" });
    assert.ok(url.includes("/origin/"));
    return json({ contributionId: "upload", revision: 1, proof: "proof", state: "pending", uploadURL: "https://upload.invalid/once", headers: { "If-None-Match": "*" } });
  });
  const origin = { viewerUserId: "bob", experienceId: "origin", cardTemplateId: "card", accessEpoch: 0, version: 1 };
  const upload = new GroupMediaUpload(origin, new File(["image"], "clip.png", { type: "image/png" }), "same-operation"); origin.experienceId = "changed-perspective";
  await assert.rejects(upload.run(new AbortController().signal)); await upload.run(new AbortController().signal);
  assert.equal(transfers, 1); assert.equal(statuses, 1);
});

test("Group-context Remove rejects Personal and foreign origins and uses membership-checked creator deletion", async t => {
  const calls: { url: string; body: unknown }[] = [];
  t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => { calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null }); return json({ state: "deleted" }); });
  const group = { ...context, experienceId: "origin", accessEpoch: 4 };
  await assert.rejects(mutateCollectionItem({ ...group, experienceId: "different" }, item, "delete"));
  await assert.rejects(mutateCollectionItem(group, { ...item, source: { kind: "personal", cardTemplateId: "card", mediaItemId: "p" } }, "delete"));
  assert.equal(calls.length, 0);
  await mutateCollectionItem(group, item, "delete");
  assert.deepEqual(calls, [{ url: "/api/group-experiences/origin/media/upload", body: { expectedRevision: 2, accessEpoch: 4 } }]);
});
