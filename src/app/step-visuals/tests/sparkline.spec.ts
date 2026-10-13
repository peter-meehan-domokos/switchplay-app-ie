import { expect, test } from "@playwright/test";
import { card1SparklineLayout, sparklineGraphLayout } from "../core/sparklines/card1SparklineLayout";
import { card1Vertex, evaluateCard1 } from "../activities/roots-factors/model";
import { projectPoint } from "../core/graph/coordinatePlaneLayout";

test("compact windows fit roots, vertex and origin with equal unit scales across sizes and the full root range", () => {
  for (const width of [128, 160, 240, 320]) for (const height of [80, 112, 148]) {
    for (let root = -5; root <= 5; root += 0.25) {
      const scene = sparklineGraphLayout(root, { width, height });
      const { projection, roots } = scene;
      const [x0, x1] = projection.xDomain;
      const [y0, y1] = projection.yDomain;
      expect(projection.plot.width / (x1 - x0)).toBeCloseTo(projection.plot.height / (y1 - y0), 10);
      for (const point of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: root, y: 0 }, card1Vertex({ movingRoot: root })]) {
        const pixel = projectPoint(projection, point);
        expect(pixel.x).toBeGreaterThan(projection.plot.x);
        expect(pixel.x).toBeLessThan(projection.plot.x + projection.plot.width);
        expect(pixel.y).toBeGreaterThan(projection.plot.y);
        expect(pixel.y).toBeLessThan(projection.plot.y + projection.plot.height);
      }
      expect(roots[0].center).toEqual(projectPoint(projection, { x: 1, y: 0 }));
      expect(roots[1].center).toEqual(projectPoint(projection, { x: root, y: 0 }));
      expect(scene.curve.path).not.toMatch(/NaN|Infinity/);
    }
  }
});

test("curves use the actual quadratic, exact landmarks and offscreen samples rather than clamping", () => {
  for (const root of [-5, -4, -3, 0, 1, 3, 5]) {
    const scene = sparklineGraphLayout(root, { width: 160, height: 112 });
    const vertex = card1Vertex({ movingRoot: root });
    for (const landmark of [1, root, vertex.x]) expect(scene.curve.samples.some((sample) => sample.math.x === landmark)).toBe(true);
    for (const sample of scene.curve.samples) {
      expect(sample.math.y).toBe(evaluateCard1({ movingRoot: root }, sample.math.x));
      expect(sample.position).toEqual(projectPoint(scene.projection, { x: sample.math.x, y: sample.math.y! }));
    }
    expect(scene.curve.clip).toEqual(scene.projection.plot);
    expect(scene.curve.samples.some((sample) => sample.position!.y < scene.curve.clip.y)).toBe(true);
  }
  const initial = sparklineGraphLayout(3, { width: 160, height: 112 });
  const vertexPixel = projectPoint(initial.projection, { x: 2, y: -1 });
  expect(vertexPixel.y - initial.roots[0].center.y).toBeGreaterThan(10);
  const coincident = sparklineGraphLayout(1, { width: 160, height: 112 });
  expect(coincident.roots[0].center).toEqual(coincident.roots[1].center);
  expect(coincident.roots[0].radius).toBeGreaterThan(coincident.roots[1].radius);
});

test("variants share exact graph geometry and notation while omitting unused content", () => {
  for (const root of [-5, 1, 3, 5]) {
    const size = { width: 160, height: 112 };
    const complete = card1SparklineLayout(root, size, "complete");
    const graphics = card1SparklineLayout(root, size, "graphics-only");
    const notation = card1SparklineLayout(root, size, "notation-only");
    expect(complete.graph).toEqual(graphics.graph);
    expect(complete.expression).toEqual(notation.expression);
    expect(graphics.expression).toBeNull();
    expect(notation.graph).toBeNull();
    expect(Object.isFrozen(complete.graph!.projection.xDomain)).toBe(true);
    expect(Object.isFrozen(size)).toBe(false);
    expect(JSON.parse(JSON.stringify(complete))).toEqual(complete);
  }
});

test("numerical labels stay directly below exact roots, with one label for coincident roots", () => {
  for (const width of [128, 134, 160, 240, 320]) for (let root = -5; root <= 5; root++) {
    const scene = sparklineGraphLayout(root, { width, height: 112 });
    expect(scene.rootLabels.map((label) => label.text)).toEqual(root === 1 ? ["1"] : ["1", String(root).replace("-", "−")]);
    for (const label of scene.rootLabels) {
      const marker = scene.roots.find((candidate) => candidate.center.x === label.position.x)!;
      expect(label.position.y).toBe(marker.center.y + 17);
      expect(label.anchor).toBe("middle");
      expect(label.position.y).toBeLessThan(scene.size.height);
    }
  }
});

test("invalid root values and graph dimensions fail explicitly", () => {
  for (const root of [NaN, Infinity, -5.1, 5.1]) expect(() => sparklineGraphLayout(root, { width: 160, height: 112 })).toThrow(RangeError);
  for (const size of [{ width: 47, height: 112 }, { width: 160, height: 47 }, { width: Infinity, height: 112 }]) {
    expect(() => sparklineGraphLayout(3, size)).toThrow(RangeError);
  }
});
