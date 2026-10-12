import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { frameworkCataloguePlugin } from "./helpers/frameworkCataloguePlugin";
import { readAreaExpansion, readProgressMetadata, readProgressSummary, writeAreaExpansion } from "../src/lib/frameworks/progressClient";
import { frameworkFixtures } from "./fixtures/frameworks";

async function withResponse(body: unknown, run: () => Promise<void>, actor = "alice") {
  const previous = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.cache, "no-store"); assert.equal(new Headers(init?.headers).get("X-Personal-Viewer"), "alice");
    return Response.json(body, { headers: { "X-Personal-Viewer": actor } });
  };
  try { await run(); } finally { globalThis.fetch = previous; }
}
const empty = { state: "empty", completion: null, confidence: null, eligibleCardCount: 0, resolvedCardCount: 0, issues: [] };
const assessments = { state: "empty", count: 0, readableCount: 0, latestThree: [], issues: [] };
const summary = () => ({ id: "practice", title: "Practice", areas: [{ id: "skills", title: "Skills", progress: empty,
  items: [{ id: "practice-control", title: "Control", progress: empty, assessments }] }] });

test("Progress metadata retains configured ordering and supports an explicitly empty catalogue", async () => {
  const frameworks = frameworkFixtures().map(({ id, title, areas }) => ({ id, title, areas: areas.map(({ id, title, items }) => ({ id, title,
    items: items.map(({ id, title }) => ({ id, title })) })) }));
  await withResponse({ viewerUserId: "alice", frameworks }, async () => assert.deepEqual(await readProgressMetadata("alice"), frameworks));
  await withResponse({ viewerUserId: "alice", frameworks: [] }, async () => assert.deepEqual(await readProgressMetadata("alice"), []));
});
test("Progress reads reject another actor's header/payload or a different selected Framework", async () => {
  await withResponse({ viewerUserId: "bob", frameworks: [] }, async () => { await assert.rejects(readProgressMetadata("alice"), /session changed/); });
  await withResponse({ viewerUserId: "alice", frameworks: [] }, async () => { await assert.rejects(readProgressMetadata("alice"), /session changed/); }, "bob");
  await withResponse({ viewerUserId: "alice", framework: summary() }, async () => { await assert.rejects(readProgressSummary("alice", "other"), /unavailable/); });
});
test("Progress preserves null, zero and 100 scores and rejects numeric incomplete calculations or uncertain indicators", async () => {
  for (const completion of [null, 0, 100]) {
    const framework = summary();
    framework.areas[0].progress = { ...empty, state: completion === null ? "empty" : "complete", completion } as typeof empty;
    await withResponse({ viewerUserId: "alice", framework }, async () => assert.equal((await readProgressSummary("alice", "practice")).areas[0].progress.completion, completion));
  }
  const bad = summary();
  const badFramework = { ...bad, areas: [{ ...bad.areas[0], progress: { ...empty, state: "incomplete", completion: 0 } }] };
  await withResponse({ viewerUserId: "alice", framework: badFramework }, async () => { await assert.rejects(readProgressSummary("alice", "practice"), /unavailable/); });
  const partial = summary(); partial.areas[0].items[0].assessments = { ...assessments, state: "incomplete", latestThree: [{}] } as typeof assessments;
  await withResponse({ viewerUserId: "alice", framework: partial }, async () => { await assert.rejects(readProgressSummary("alice", "practice"), /unavailable/); });
});
test("Area expansion storage is actor/Framework scoped, validates entries and tolerates disabled or malformed storage", () => {
  const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  writeAreaExpansion(storage, "alice", "practice", { skills: false });
  assert.deepEqual(readAreaExpansion(storage, "alice", "practice"), { skills: false });
  assert.deepEqual(readAreaExpansion(storage, "bob", "practice"), {}); assert.deepEqual(readAreaExpansion(storage, "alice", "other"), {});
  assert.deepEqual(readAreaExpansion({ getItem: () => '{"skills":"yes","empty":true}' }, "alice", "practice"), { empty: true });
  assert.deepEqual(readAreaExpansion({ getItem: () => "broken" }, "alice", "practice"), {});
  assert.doesNotThrow(() => writeAreaExpansion({ setItem: () => { throw new Error("disabled"); } }, "alice", "practice", {}));
});
test("whole-module fixture substitution exercises real validation/access without replacing sample source text", async () => {
  for (const frameworks of [[], frameworkFixtures()]) {
    const bundled = await build({ stdin: { contents: 'export * from "@/lib/frameworks/configuration";', resolveDir: process.cwd(), loader: "ts" },
      bundle: true, platform: "node", format: "cjs", packages: "external", write: false, plugins: [frameworkCataloguePlugin(frameworks)] });
    const fixture = { exports: {} };
    new Function("require", "module", "exports", bundled.outputFiles[0].text)(createRequire(resolve(process.cwd(), "package.json")), fixture, fixture.exports);
    const access = fixture.exports as { getFrameworks: () => unknown; getFrameworkItem: (id: string) => unknown; assertFrameworkConfiguration: (value: unknown) => void };
    assert.deepEqual(access.getFrameworks(), frameworks);
    assert.equal(access.getFrameworkItem("unknown"), undefined);
    assert.throws(() => access.assertFrameworkConfiguration([...frameworkFixtures(), ...frameworkFixtures()]));
  }
});
