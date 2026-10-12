import { expect, test } from "@playwright/test";
import { initialMath } from "../activities/roots-factors/model";
import { rootsFactorsLayout } from "../activities/roots-factors/rootsFactorsLayout";
import { immutable } from "../core/immutable";

test("diagnostic layout and deep-freeze timings (not a phone performance guarantee)", () => {
  const size = { width: 336, height: 224 };
  for (let index = 0; index < 100; index++) rootsFactorsLayout(initialMath, size);
  const scene = rootsFactorsLayout(initialMath, size);
  // Clone outside the timed region, so freeze timings include traversal but not JSON parsing.
  const copies = Array.from({ length: 200 }, () => JSON.parse(JSON.stringify(scene)));
  const freezeTimes = copies.map((copy) => {
    const start = performance.now();
    immutable(copy);
    return performance.now() - start;
  });
  const layoutTimes = copies.map(() => {
    const start = performance.now();
    rootsFactorsLayout(initialMath, size);
    return performance.now() - start;
  });
  const statistics = (times: number[]) => {
    const ordered = [...times].sort((a, b) => a - b);
    return { medianMs: Number(ordered[100].toFixed(3)), p95Ms: Number(ordered[190].toFixed(3)) };
  };
  expect(copies.every((copy) => Object.isFrozen(copy.graph.curve.samples[0]))).toBe(true);
  console.log(JSON.stringify({ environment: "Node diagnostic; 200 samples", fullLayout: statistics(layoutTimes), oneDeepFreezePass: statistics(freezeTimes) }));
});
