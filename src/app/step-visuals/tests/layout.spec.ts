import { expect, test } from "@playwright/test";
import { rootsFactorsLayout } from "../activities/roots-factors/rootsFactorsLayout";
import { card1Vertex, createCard1Math, evaluateCard1, initialMath } from "../activities/roots-factors/model";
import { coordinatePlaneLayout, projectPoint, unprojectPoint } from "../core/graph/coordinatePlaneLayout";
import { functionPlotLayout } from "../core/graph/functionPlotLayout";
import { factorExpressionLayout } from "../core/expressions/factorExpressionLayout";
import type { Size } from "../core/graph/types";

const sizes: readonly Size[] = [{ width: 288, height: 220 }, { width: 358, height: 320 }, { width: 704, height: 700 }];

for (let r = -5; r <= 5; r++) {
  test(`composed scenes, exact landmarks and subpixel quadratic accuracy at r = ${r}`, () => {
    const math = createCard1Math(r);
    const vertex = card1Vertex(math);
    for (const size of sizes) {
      const { graph, expression } = rootsFactorsLayout(math, size);
      const { projection } = graph.plane;
      expect(projection.xDomain).toEqual([-6, 6]);
      expect(projection.yDomain).toEqual([-10, 10]);
      expect(graph.curve.clip).toEqual(projection.plot);
      expect(graph.curve.path).not.toMatch(/NaN|Infinity/);
      expect(graph.curve.path).toMatch(/^M/);
      expect(graph.curve.samples.length).toBeGreaterThanOrEqual(201);
      const exact = (x: number) => graph.curve.samples.find((sample) => sample.math.x === x)!;
      for (const root of [1, r]) expect(exact(root).math.y).toBe(0);
      expect(exact(vertex.x).math.y).toBe(vertex.y);
      for (const point of [{ x: -6, y: -10 }, { x: 6, y: 10 }, vertex, { x: 0.25, y: 2.75 }]) {
        const roundTrip = unprojectPoint(projection, projectPoint(projection, point));
        expect(roundTrip.x).toBeCloseTo(point.x, 12);
        expect(roundTrip.y).toBeCloseTo(point.y, 12);
      }
      expect(graph.roots.markers.map((marker) => marker.center)).toEqual([projectPoint(projection, { x: 1, y: 0 }), projectPoint(projection, { x: r, y: 0 })]);
      expect(graph.roots.coincident).toBe(r === 1);
      expect(expression.factors[1].text).toBe(r === 0 ? "(x)" : `(x ${r < 0 ? "+" : "−"} ${Math.abs(r)})`);
      // Linear interpolation error of a monic quadratic is h² / 4; include path rounding.
      const samples = graph.curve.samples;
      for (let index = 1; index < samples.length; index++) {
        const h = samples[index].math.x - samples[index - 1].math.x;
        const projectedError = h * h / 4 * projection.plot.height / 20;
        expect(projectedError + 0.000001).toBeLessThan(0.1);
        const midpoint = (samples[index].math.x + samples[index - 1].math.x) / 2;
        const actual = projectPoint(projection, { x: midpoint, y: evaluateCard1(math, midpoint) });
        const interpolatedY = (samples[index].position!.y + samples[index - 1].position!.y) / 2;
        expect(Math.abs(interpolatedY - actual.y)).toBeCloseTo(projectedError, 9);
      }
      expect(graph.curve.samples.some((sample) => sample.position!.y < projection.plot.y)).toBe(true);
      expect(graph.plane.tickLabels.some((label) => label.text === "−3")).toBe(true);
      expect(graph.plane.tickLabels.some((label) => label.text === "−4")).toBe(true);
    }
  });
}

test("scenes are deterministic, deeply frozen, serializable and do not freeze or mutate inputs", () => {
  const input = { movingRoot: 3 as const };
  const size = { width: 320, height: 280 };
  const scene = rootsFactorsLayout(input, size);
  expect(scene).toEqual(rootsFactorsLayout(input, size));
  expect(JSON.parse(JSON.stringify(scene))).toEqual(scene);
  expect(Object.isFrozen(scene.graph.curve.samples[0].position)).toBe(true);
  expect(Object.isFrozen(scene.graph.plane.projection.xDomain)).toBe(true);
  expect(Object.isFrozen(scene.expression.factors[0])).toBe(true);
  expect(Object.isFrozen(input)).toBe(false);
  expect(Object.isFrozen(size)).toBe(false);
  expect(input).toEqual({ movingRoot: 3 });
  expect(size).toEqual({ width: 320, height: 280 });
});

test("nonfinite evaluations break the path rather than connecting across a gap", () => {
  const plane = coordinatePlaneLayout({ width: 320, height: 280 }, [-6, 6], [-10, 10]);
  const scene = functionPlotLayout(plane.projection, (x) => x === 0 ? NaN : x * x, [0], 12);
  expect(scene.path.match(/M/g)).toHaveLength(2);
  expect(scene.path).not.toMatch(/NaN|Infinity/);
  expect(scene.samples.find((sample) => sample.math.x === 0)?.position).toBeNull();
  expect(scene.samples.find((sample) => sample.math.x === 0)?.math.y).toBeNull();
  expect(JSON.parse(JSON.stringify(scene))).toEqual(scene);
  const empty = functionPlotLayout(plane.projection, () => Infinity, [], 12);
  expect(empty.path).toBe("");
});

test("coincident roots use a fixed ring and movable centre with separate labels", () => {
  const { graph, expression } = rootsFactorsLayout(createCard1Math(1), sizes[0]);
  const [fixed, moving] = graph.roots.markers;
  expect(fixed.center).toEqual(moving.center);
  expect(fixed.visibleRadius).toBeGreaterThan(moving.visibleRadius);
  expect(fixed.positionLabel.position.y).toBeGreaterThan(moving.positionLabel.position.y);
  expect(expression.factors.map((factor) => factor.id)).toEqual(["fixed-root", "moving-root"]);
});

test("invalid dimensions, domains and sampling inputs fail explicitly", () => {
  for (const size of [{ width: 0, height: 220 }, { width: 320, height: NaN }, { width: Infinity, height: 220 }, { width: 320, height: 100 }]) {
    expect(() => rootsFactorsLayout(initialMath, size)).toThrow(RangeError);
  }
  for (const domain of [[0, 0], [6, -6], [NaN, 6], [1, 6]] as const) {
    expect(() => coordinatePlaneLayout(sizes[0], domain, [-10, 10])).toThrow(RangeError);
  }
  const { projection } = coordinatePlaneLayout(sizes[0], [-6, 6], [-10, 10]);
  for (const count of [1, NaN, 2.5, 100_001]) expect(() => functionPlotLayout(projection, (x) => x, [], count)).toThrow(RangeError);
  expect(() => functionPlotLayout(projection, (x) => x, [NaN])).toThrow(RangeError);
});

test("factor-expression layout is independent of the activity and preserves stable identities", () => {
  expect(factorExpressionLayout([{ id: "a", root: 0 }, { id: "b", root: -4 }])).toEqual({
    prefix: "f(x) =", factors: [{ id: "a", text: "(x)", role: "fixed-root" }, { id: "b", text: "(x + 4)", role: "moving-root" }],
    accessibleDescription: "f of x equals (x) times (x + 4)",
  });
});
