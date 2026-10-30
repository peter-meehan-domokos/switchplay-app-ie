import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeIntegrationEvents, createIntegrationHostedState, integrationHostNavigation, integrationSnapshot, isIntegrationSnapshot, reduceIntegrationHostedState, restoreIntegrationHostedState, type IntegrationHostedState } from "../src/app/step-visuals/activities/integration-area/hostState";
import type { IntegrationAction } from "../src/app/step-visuals/activities/integration-area/learning";
import { analyseRegion } from "../src/app/step-visuals/activities/integration-area/model";
import { integrationPresentation } from "../src/app/step-visuals/activities/integration-area/presentation";
import { isHostedIntegrationEvent } from "../src/app/step-visuals/activities/integration-area/eventValidation";

type Action = IntegrationAction extends infer A ? A extends { revision: number } ? Omit<A, "revision"> : A : never;
function act(s: IntegrationHostedState, a: Action): IntegrationHostedState { return reduceIntegrationHostedState(s, { ...a, revision: s.state.revision } as IntegrationAction); }
function roundtrip(s: IntegrationHostedState) {
  for (const event of s.state.records.events) assert.ok(isHostedIntegrationEvent(event), `Event rejected: ${event.type}`);
  const snapshot = integrationSnapshot(s);
  assert.ok(isIntegrationSnapshot(snapshot), `Invalid stage ${s.state.stage} ${s.state.part}`);
  const restored = restoreIntegrationHostedState(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(integrationSnapshot(restored), snapshot);
  assert.deepEqual(restored.state.records.events, []);
  assert.deepEqual(restored.state.records.completedAttempts, []);
  assert.equal(restored.state.edit, null);
  assert.doesNotThrow(() => integrationPresentation(restored.state));
  return restored;
}
function stage7() {
  let s = createIntegrationHostedState("integration-test");
  for (let i = 1; i < 7; i++) {
    if (s.state.stage === 3) { s = act(s, { type: "demonstrate", progress: 1 }); s = act(s, { type: "predict", multiplier: 2 }); }
    s = act(roundtrip(s), { type: "next" });
  }
  return roundtrip(s);
}

test("all seven stages, functions, subsections and previous panels round trip without notifications", () => {
  let s = act(createIntegrationHostedState("all-stages"), { type: "place", boundary: "b", value: 3.2, input: "keyboard" });
  s = act(roundtrip(s), { type: "next" });
  for (const kind of ["rising", "flat"] as const) s = roundtrip(act(s, { type: "function", function: kind }));
  s = roundtrip(act(s, { type: "refine", rectangles: 127 }));
  s = act(s, { type: "next" });
  for (const kind of ["flat", "rising", "square", "flat"] as const) {
    s = act(s, { type: "function", function: kind }); s = act(s, { type: "demonstrate", progress: 1 });
    s = roundtrip(act(s, { type: "predict", multiplier: 2 }));
  }
  s = act(s, { type: "next" });
  for (const subsection of ["square", "rule", "rising"] as const) s = roundtrip(act(s, { type: "division-subsection", subsection }));
  s = act(s, { type: "next" }); s = roundtrip(act(s, { type: "place", boundary: "b", value: 2.7, input: "value" }));
  s = act(s, { type: "next" });
  for (const value of ["axis", "lower", "rising"] as const) s = roundtrip(act(s, { type: "select", boundary: "top", value }));
  s = roundtrip(act(s, { type: "next" }));
  for (let i = 0; i < 6; i++) s = roundtrip(act(s, { type: "previous" }));
  for (let i = 0; i < 6; i++) s = roundtrip(act(s, { type: "next" }));
  assert.equal(s.state.stage, 7);
});

test("unfinished animation and pointer candidates do not fabricate semantic completion", () => {
  let s = act(act(createIntegrationHostedState("animation"), { type: "next" }), { type: "next" });
  s = act(s, { type: "demonstrate", progress: .6 });
  const sequence = s.sequence;
  s = roundtrip(s); assert.equal(s.state.demonstration, 0); assert.equal(s.sequence, sequence);
  s = act(s, { type: "demonstrate", progress: 1 });
  assert.equal(s.state.records.events.filter(e => e.type === "comparison-demonstrated").length, 1);
  s = act(s, { type: "predict", multiplier: 4 });
  s = act(s, { type: "function", function: "rising" }); s = act(s, { type: "function", function: "flat" });
  assert.equal(roundtrip(s).state.demonstration, 1); // Already demonstrated earlier, not a fabricated event.
  let p = createIntegrationHostedState("pointer");
  p = act(p, { type: "begin", boundary: "b", id: 1 }); p = act(p, { type: "preview", id: 1, value: 3.9 });
  assert.equal(roundtrip(p).state.region.b, 1);
});

test("drafts, empty and invalid checks, hints and correct or incorrect Finish preserve assessment rules", () => {
  for (const correct of [false, true]) {
    let s = stage7();
    const seq = s.sequence;
    s = roundtrip(act(s, { type: "check" })); assert.equal(s.state.feedback, "empty");
    s = roundtrip(act(s, { type: "draft", value: "unfinished" }));
    s = roundtrip(act(s, { type: "check" })); assert.equal(s.state.feedback, "invalid"); assert.equal(s.sequence, seq);
    s = roundtrip(act(s, { type: "draft", value: "0" })); s = roundtrip(act(s, { type: "check" }));
    assert.equal(s.state.feedback, "incorrect"); s = roundtrip(act(s, { type: "help" }));
    if (correct) {
      s = act(s, { type: "draft", value: String(analyseRegion(s.state.region).area) }); s = roundtrip(act(s, { type: "check" }));
      assert.equal(s.state.checked?.number, 2);
    }
    assert.equal(integrationHostNavigation(s).next?.enabled, true); // A valid incorrect answer can Finish today.
    s = act(s, { type: "finish" });
    assert.equal(s.state.records.current.successMode, correct ? "assisted" : null);
    assert.equal(s.state.records.events.at(-1)?.type, "attempt-completed");
    roundtrip(s);
  }
});

test("restored events and check numbers stay monotonic and pending events survive rapid actions", () => {
  let s = act(stage7(), { type: "draft", value: "1" });
  for (let i = 0; i < 8; i++) s = act(s, { type: "check" });
  const seq = s.sequence; s = roundtrip(s); s = act(s, { type: "check" }); s = act(s, { type: "check" });
  assert.equal(s.state.checked?.number, 10);
  assert.equal(s.state.records.events.length, 2);
  assert.deepEqual(s.state.records.events.map(e => e.sequence), [seq + 1, seq + 2]);
  assert.ok(s.state.records.events.every(e => e.type !== "attempt-started"));
  s = acknowledgeIntegrationEvents(s, seq + 1); assert.equal(s.state.records.events.length, 1);
  assert.equal(integrationSnapshot(s).evidence.lastCheck?.number, 10);
});

test("corrupt snapshots and unsafe cross-field feedback are rejected before rendering", () => {
  const valid = integrationSnapshot(stage7());
  const variants = [ { ...valid, snapshotSchema: 2 }, { ...valid, sequence: -1 }, { ...valid, previousPanels: [] },
    { ...valid, panel: { ...valid.panel, feedback: "correct" } }, { ...valid, panel: { ...valid.panel, part: "finished" } },
    { ...valid, panel: { ...valid.panel, region: { curves: ["unknown", "axis"], a: 0, b: 1 } } },
    { ...valid, panel: { ...valid.panel, draft: "x".repeat(4097) } }, { ...valid, panel: { ...valid.panel, helpOpen: true } } ];
  for (const v of variants) { assert.equal(isIntegrationSnapshot(v), false); assert.throws(() => restoreIntegrationHostedState(v), /Invalid Integration/); }
});
