import { expect, test } from "@playwright/test";
import { integrationGraphLayout, integrationPlaneLayout } from "../activities/integration-area/graph-layout";
import { effectiveRegion } from "../activities/integration-area/learning";
import { act, atStage } from "./integration-test-helpers";

test("continuous preparation bypasses historical arrays and reports local timing distributions", () => {
  const statistics: Record<string, { medianMs: number; p95Ms: number; maxMs: number }> = {};
  for (const stage of [5, 6] as const) {
    const initial = atStage(stage);
    const guardedRecords = { ...initial.records };
    for (const key of ["events", "completedAttempts", "partialAttempts"] as const) Object.defineProperty(guardedRecords, key, { get() { throw new Error("Preview traversed " + key); } });
    let state = act({ ...initial, records: guardedRecords }, { type: "begin", id: 1, boundary: "b" });
    const size = { width: 366, height: 240 }, plane = integrationPlaneLayout(size, stage);
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      state = act(state, { type: "preview", id: 1, value: 1 + i / 33 });
      const scene = integrationGraphLayout({ ...effectiveRegion(state), size, stage, showExcluded: stage === 5, showStrip: stage === 6, plane });
      times.push(performance.now() - start);
      expect(scene.plane).toBe(plane); expect(state.records).toBe(guardedRecords);
    }
    times.sort((a, b) => a - b); statistics["stage-" + stage] = { medianMs: times[50], p95Ms: times[95], maxMs: times[99] };
  }
  const size = { width: 366, height: 240 }, plane = integrationPlaneLayout(size, 4, "square"), times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    const scene = integrationGraphLayout({ size, stage: 4, comparison: "square", curves: ["square", "axis"], a: 0, b: 3, rectangleCount: 128, plane });
    times.push(performance.now() - start); expect(scene.rectangles).toHaveLength(256);
  }
  times.sort((a, b) => a - b); statistics["stage-4-128"] = { medianMs: times[50], p95Ms: times[95], maxMs: times[99] };
  console.log("INTEGRATION_LAYOUT_TIMING", JSON.stringify({ runtime: process.version, platform: process.platform, ...statistics }));
});
