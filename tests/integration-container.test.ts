import assert from "node:assert/strict";
import test from "node:test";
import { integrationContainerStyle } from "../src/app/step-visuals/activities/integration-area/container-layout";
import { integrationGraphLayout, integrationPlaneLayout } from "../src/app/step-visuals/activities/integration-area/graph-layout";

test("Integration consumes the complete supplied rectangle without overlay deductions", () => {
  assert.deepEqual(integrationContainerStyle({ width: 366, height: 555, reservedCorners: {
    topRight: { x: 220, y: 0, width: 140, height: 44 }, bottomRight: { x: 220, y: 500, width: 140, height: 55 },
  } }), { width: 366, height: 555 });
  assert.deepEqual(integrationContainerStyle({ width: 366, height: 488 }), { width: 366, height: 488 });
});

test("short Integration projections retain mathematical domains and finite geometry", () => {
  for (const stage of [1, 2, 3, 4, 5, 6, 7] as const) {
    const normal = integrationPlaneLayout({ width: 296, height: 280 }, stage);
    for (const height of [120, 140, 160, 199, 200]) {
      const plane = integrationPlaneLayout({ width: 296, height }, stage);
      assert.deepEqual(plane.projection.xDomain, normal.projection.xDomain);
      assert.deepEqual(plane.projection.yDomain, normal.projection.yDomain);
      assert.equal(plane.size.height, height); assert.ok(plane.projection.plot.height > 0);
      assert.ok(plane.projection.yRange.every(Number.isFinite));
      const scene = integrationGraphLayout({ size: { width: 296, height }, stage, curves: ["rising", "axis"], a: 1, b: 3, showStrip: stage >= 6 });
      assert.ok(!JSON.stringify(scene).includes("NaN"));
    }
  }
  assert.throws(() => integrationPlaneLayout({ width: 296, height: 119 }, 2), RangeError);
});
