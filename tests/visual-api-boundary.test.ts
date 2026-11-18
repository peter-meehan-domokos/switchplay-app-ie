import assert from "node:assert/strict";
import test from "node:test";
import { createVisualApi, readVisualJson } from "../src/lib/visualLearningRecords/api";
import { createVisualRequestBudget } from "../src/lib/visualLearningRecords/requestBudget";

test("streamed bodies are bounded even without a Content-Length header", async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('"' + 'x'.repeat(3000) + '"')); controller.close(); } });
  const request = new Request("https://app.example/api", { method: "POST", headers: { "Content-Type": "application/json" }, body, duplex: "half" } as RequestInit);
  await assert.rejects(readVisualJson(request, 1000), /VISUAL_PAYLOAD_LIMIT/);
});
test("process-local request budget has bounded identity storage and recovers after expiry", () => {
  let time = 0; const budget = createVisualRequestBudget(() => time, 2, 2);
  assert.equal(budget("one"), true); assert.equal(budget("one"), true); assert.equal(budget("one"), false);
  assert.equal(budget("two"), true); assert.equal(budget("three"), false);
  time = 60000; assert.equal(budget("three"), true); assert.equal(budget("one"), true);
});
test("unauthenticated and throttled APIs do not call repositories", async () => {
  let reads = 0;
  const dependencies = { authenticate: async () => { reads++; return { kind: "account" as const, id: "one" }; },
    repository: async (): Promise<never> => { throw new Error("Repository must not run"); }, authorizeSource: async (): Promise<never> => { throw new Error("Source must not run"); } };
  const request = () => new Request("https://app.example/api", { method: "POST", headers: { Origin: "https://app.example", "X-Visual-Learner": "account:one" } });
  assert.equal((await createVisualApi({ ...dependencies, authenticate: async () => null }).open(request())).status, 401);
  assert.equal(reads, 0);
  const throttled = await createVisualApi({ ...dependencies, consumeBudget: () => false }).open(request());
  assert.equal(throttled.status, 429); assert.equal(throttled.headers.get("Retry-After"), "60");
});

test("origin checks use the browser Host through Next internal hostname normalization and reject forwarding spoofing", async () => {
  const deps = { authenticate: async () => null, repository: async (): Promise<never> => { throw new Error("Must not connect"); },
    authorizeSource: async (): Promise<never> => { throw new Error("Must not connect"); } };
  const request = (origin: string, extra: Record<string, string> = {}) => new Request("http://localhost:3171/api/visual-sessions/open", {
    method: "POST", headers: { Host: "127.0.0.1:3171", Origin: origin, ...extra } });
  assert.equal((await createVisualApi(deps).open(request("http://127.0.0.1:3171"))).status, 401);
  assert.equal((await createVisualApi(deps).open(request("https://elsewhere.example", { "X-Forwarded-Host": "elsewhere.example" }))).status, 403);
  assert.equal((await createVisualApi({ ...deps, expectedOrigin: "https://app.example" }).open(request("http://127.0.0.1:3171"))).status, 403);
});
