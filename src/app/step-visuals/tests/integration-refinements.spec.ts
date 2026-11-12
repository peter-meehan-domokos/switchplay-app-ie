import { expect, test } from "@playwright/test";
import { stageOneReadout } from "../activities/integration-area/display-policy";
import { initialIntegration, integrationReducer, type IntegrationAction, type IntegrationState } from "../activities/integration-area/learning";
import { integrationPresentation } from "../activities/integration-area/presentation";
import { integrationGraphLayout } from "../activities/integration-area/graph-layout";
import { tooltipLayout } from "../core/presentation/tooltip-layout";

type WithoutContext<T> = T extends { revision: number } ? Omit<T, "revision"> : T;
const act = (state: IntegrationState, action: WithoutContext<IntegrationAction>) => integrationReducer(state, { ...action, revision: state.revision } as IntegrationAction);
const next = (state: IntegrationState) => act(state, { type: "next" });
const previous = (state: IntegrationState) => act(state, { type: "previous" });
const panel = ({ stage, part, region, function: comparison, rectangles, prediction, draft, feedback, helpOpen }: IntegrationState) => ({ stage, part, region, function: comparison, rectangles, prediction, draft, feedback, helpOpen });

test("Stage 1 readouts multiply the rounded tenth, never the continuous candidate", () => {
  for (const [position, boundaryText, areaText] of [[0, "0", "0"], [1, "1", "2"], [2.34, "2.3", "4.6"], [2.35, "2.4", "4.8"], [3.999, "4", "8"]] as const) {
    expect(stageOneReadout(position)).toMatchObject({ boundaryText, areaText });
    const state = act(initialIntegration("rounding"), { type: "place", boundary: "b", value: position, input: "value" });
    expect(state.region.b).toBe(position);
    expect(integrationPresentation(state).areaFeedback?.calculation).toBe(`A = 2b = 2 × ${boundaryText} = ${areaText}`);
  }
  const scene = integrationGraphLayout({ size: { width: 366, height: 320 }, stage: 1, a: 0, b: 2.34, curves: ["flat", "axis"] });
  expect(scene.handles[0]).toMatchObject({ value: 2.34, label: { text: "b = 2.3" } });
  const { projection } = scene.plane;
  expect(scene.handles[0].center.x).toBeCloseTo(projection.xRange[0] + (2.34 - projection.xDomain[0]) / (projection.xDomain[1] - projection.xDomain[0]) * (projection.xRange[1] - projection.xRange[0]), 8);
  expect(scene.description).not.toContain("2.34");
});

test("Stage 2 starts constant; estimates distinguish approximation from an exact constant area", () => {
  let state = next(initialIntegration("estimates"));
  expect(state.function).toBe("flat");
  for (const count of [1, 2, 4, 8, 16, 128]) {
    state = act(state, { type: "refine", rectangles: count });
    expect(integrationPresentation(state).lines[0].text).toBe("Estimated area = 6 square units");
  }
  state = act(state, { type: "function", function: "rising" });
  for (const [count, value] of [[1, "9"], [2, "6.75"], [4, "5.63"], [8, "5.06"], [16, "4.78"], [128, "4.54"]] as const) {
    state = act(state, { type: "refine", rectangles: count });
    expect(integrationPresentation(state).lines.map(({ text }) => text)).toEqual([`Estimated area ≈ ${value} square units`, "Actual area = 4.5 square units"]);
  }
});

test("Previous/Next restores every visited panel without rewinding evidence or edit identities", () => {
  let state = act(initialIntegration("navigation"), { type: "place", boundary: "b", value: 2.34, input: "value" });
  expect(previous(state)).toBe(state);
  const visited = [panel(state)];
  state = act(act(next(state), { type: "function", function: "rising" }), { type: "refine", rectangles: 8 }); visited.push(panel(state));
  state = act(act(next(state), { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 4 }); visited.push(panel(state));
  state = act(next(state), { type: "place", boundary: "b", value: 2, input: "value" }); visited.push(panel(state));
  state = act(next(state), { type: "select", boundary: "bottom", value: "lower" }); visited.push(panel(state));
  state = next(state); visited.push(panel(state));
  state = next(state); visited.push(panel(state));
  const predictions = state.records.current.predictions;
  for (let index = visited.length - 2; index >= 0; index--) {
    state = previous(state);
    expect(panel(state)).toEqual(visited[index]);
    expect(state.records.current.predictions).toBe(predictions);
  }
  for (let index = 1; index < visited.length; index++) { state = next(state); expect(panel(state)).toEqual(visited[index]); }
  expect(state.records.current.predictions).toHaveLength(1);
  expect(state.records.events.filter((event) => event.type === "prediction-submitted")).toHaveLength(1);
  const editing = act(initialIntegration("edit-navigation"), { type: "begin", id: 1, boundary: "b" });
  expect(previous(editing)).toBe(editing);
  expect(integrationReducer(state, { type: "previous", revision: state.revision - 1 })).toBe(state);
});

test("returning to Stage 3 preserves its independent graph comparison despite Stage 2 function changes", () => {
  let state = next(next(initialIntegration("prediction-review")));
  state = act(act(state, { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 2 });
  state = previous(state);
  state = act(state, { type: "function", function: "rising" });
  state = next(state);
  expect(state).toMatchObject({ stage: 3, function: "flat", prediction: { multiplier: 2 }, demonstration: 1, region: { b: 4 } });
  expect(state.records.current.predictions).toHaveLength(1);
  expect(next(state).stage).toBe(4);
});

test("Stage 7 outer navigation preserves setup; changed problems invalidate answers, not assistance", () => {
  let state = next(next(initialIntegration("setup-review")));
  state = act(act(state, { type: "demonstrate", progress: 1 }), { type: "predict", multiplier: 2 });
  for (let index = 0; index < 4; index++) state = next(state);
  state = act(act(state, { type: "draft", value: "0" }), { type: "check" });
  state = act(state, { type: "help" });
  const original = panel(state);
  state = next(previous(state)); expect(panel(state)).toEqual(original);
  state = act(state, { type: "interval", a: 0, b: 2 });
  expect(state).toMatchObject({ part: "calculate", region: { a: 0, b: 2 }, draft: "", feedback: null, helpOpen: false });
  expect(state.records.current.assistanceRequested).toBe(true);
  state = act(act(state, { type: "draft", value: "14" }), { type: "check" });
  state = act(state, { type: "finish" });
  expect(state.part).toBe("finished");
  expect(previous(state)).toBe(state);
  expect(state.records.completedAttempts).toHaveLength(1);
});

test("Tooltip layout chooses above/below and clamps both axes to the visible viewport", () => {
  const viewport = { x: 0, y: 0, width: 390, height: 844 };
  const popup = { width: 288, height: 110 };
  expect(tooltipLayout({ x: 120, y: 600, width: 70, height: 24 }, popup, viewport)).toMatchObject({ side: "above", top: 482 });
  expect(tooltipLayout({ x: 120, y: 60, width: 70, height: 24 }, popup, viewport)).toMatchObject({ side: "below", top: 92 });
  for (const x of [0, 190, 370]) {
    const result = tooltipLayout({ x, y: 810, width: 70, height: 24 }, popup, viewport);
    expect(result.left).toBeGreaterThanOrEqual(8); expect(result.left + popup.width).toBeLessThanOrEqual(382);
    expect(result.top).toBeGreaterThanOrEqual(8); expect(result.top + popup.height).toBeLessThanOrEqual(836);
  }
  const offset = tooltipLayout({ x: 100, y: 100, width: 70, height: 24 }, { width: 500, height: 700 }, { x: 40, y: 30, width: 200, height: 300 });
  expect(offset).toMatchObject({ left: 48, top: 38, maxWidth: 184, maxHeight: 284 });
});
