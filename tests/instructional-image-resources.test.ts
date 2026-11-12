import { test } from "node:test";
import assert from "node:assert/strict";
import { createInstructionalImageResources } from "../src/lib/instructionalImageResources";
import type { InstructionalImageContext } from "../src/lib/instructionalImageContext";

const context: InstructionalImageContext = { viewerUserId: "alice", cardTemplateId: "card", version: 1, mode: "working", deckTemplateId: "deck", deckVersion: 1, stepId: "intro", attachmentId: "image" };
const response = () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });

test("image leases reuse exact-context bytes, isolate actor/Card versions and revoke every owned URL", async () => {
  let calls = 0, serial = 0; const revoked: string[] = [];
  const resources = createInstructionalImageResources("alice", { owner: context, fetcher: async (url, init) => {
    assert.match(String(url), /^\/api\/media\/instructional-image\?/); assert.equal(init?.cache, "no-store"); assert.equal(init?.redirect, "error"); calls++; return response();
  }, createUrl: () => `blob:fixture-${++serial}`, revokeUrl: url => revoked.push(url) });
  const first = resources.acquire(context), shared = resources.acquire(context);
  assert.equal(await first.ready, await shared.ready); assert.equal(calls, 1); first.release(); shared.release();
  const returned = resources.acquire(context); assert.equal(await returned.ready, "blob:fixture-1"); returned.release(); assert.equal(calls, 1);
  assert.throws(() => resources.acquire({ ...context, viewerUserId: "bob" }), /actor mismatch/);
  assert.throws(() => resources.acquire({ ...context, version: 2 }), /Card mismatch/);
  for (const attachmentId of ["two", "three"]) { const lease = resources.acquire({ ...context, attachmentId }); await lease.ready; lease.release(); }
  assert.ok(revoked.includes("blob:fixture-1")); resources.clear(); assert.equal(revoked.length, 3);
  resources.clear(); assert.equal(revoked.length, 3);
});

test("failed, non-raster, oversized and cancelled responses never produce a reusable URL; retry remains possible", async () => {
  for (const invalid of [new Response("denied", { status: 403 }), new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
    new Response(new Uint8Array(10 * 1024 * 1024 + 1), { headers: { "Content-Type": "image/png", "Content-Length": "1" } }),
    new Response(new Uint8Array(0), { headers: { "Content-Type": "image/png" } })]) {
    let attempt = 0, created = 0;
    const resources = createInstructionalImageResources("alice", { fetcher: async () => ++attempt === 1 ? invalid : response(), createUrl: () => { created++; return "blob:retry"; }, revokeUrl: () => {} });
    const failed = resources.acquire(context); await assert.rejects(failed.ready); failed.release(); assert.equal(created, 0);
    const retry = resources.acquire(context); assert.equal(await retry.ready, "blob:retry"); retry.release(); resources.clear();
  }
  let signal: AbortSignal | undefined;
  const cancelled = createInstructionalImageResources("alice", { fetcher: async (_url, init) => {
    signal = init?.signal as AbortSignal; return new Promise<Response>((_resolve, reject) => signal!.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }));
  }, createUrl: () => { throw new Error("Must not allocate"); } });
  const pending = cancelled.acquire(context); pending.release(); assert.equal(signal?.aborted, true); await assert.rejects(pending.ready); cancelled.clear();
});
