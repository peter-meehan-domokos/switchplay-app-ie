import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createVisualGuestBootstrap, VisualGuestSessionError } from "../src/lib/visualLearningRecords/guestClient";

test("guest bootstrap coalesces only in-flight issuance across activities and never caches an expired identity", async () => {
  let calls = 0, finish!: (response: Response) => void;
  const bootstrap = createVisualGuestBootstrap(async (_url, options) => {
    calls++; assert.equal(options?.credentials, "same-origin"); assert.equal(options?.cache, "no-store");
    return new Promise<Response>(resolve => { finish = resolve; });
  });
  const first = bootstrap("roots-and-factors"), second = bootstrap("integration-area"); assert.equal(first, second); assert.equal(calls, 1);
  const learner = `guest:${randomUUID()}`; finish(Response.json({ learner })); assert.equal(await first, learner);
  const expired = bootstrap("roots-and-factors"); assert.equal(calls, 2); finish(Response.json({ code: "VISUAL_GUEST_SESSION_EXPIRED" }, { status: 401 }));
  await assert.rejects(expired, (error: unknown) => error instanceof VisualGuestSessionError && error.status === 401);
  const retry = bootstrap("roots-and-factors"); finish(Response.json({ learner: "account:forged" })); await assert.rejects(retry, /VISUAL_SESSION_CONFLICT/);
});
