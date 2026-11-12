import { expect, test } from "@playwright/test";
import { coordinatePlaneLayout, projectPoint } from "../core/graph/coordinatePlaneLayout";
import { affineFromCalibration, adjustedRoot, keyboardRoot, pointerCandidate, screenToGraph, screenToMath, snapRoot, type Affine2D } from "../core/interaction/rootInteraction";

const projection = coordinatePlaneLayout({ width: 366, height: 400 }, [-6, 6], [-10, 10]).projection;
const identity: Affine2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

test("screen inversion handles offset, unequal scale, rotation and skew", () => {
  for (const matrix of [identity, { a: 2, b: 0, c: 0, d: 0.5, e: 127, f: 73 }, { a: 0, b: 2, c: -1, d: 0, e: 80, f: 32 }, { a: 1, b: 0.2, c: 0.3, d: 1, e: -10, f: 51 }]) {
    const local = projectPoint(projection, { x: 3, y: -1 });
    const point = { x: matrix.a * local.x + matrix.c * local.y + matrix.e, y: matrix.b * local.x + matrix.d * local.y + matrix.f };
    expect(screenToGraph(point, matrix)?.x).toBeCloseTo(local.x, 10);
    expect(screenToMath(point, matrix, projection)?.x).toBeCloseTo(3, 10);
    expect(screenToMath(point, matrix, projection)?.y).toBeCloseTo(-1, 10);
  }
});

test("measured calibration produces an accurate affine basis and rejects invalid spans", () => {
  expect(affineFromCalibration({ x: 10, y: 20 }, { x: 210, y: 40 }, { x: 40, y: 220 }, { width: 100, height: 100 })).toEqual({ a: 2, b: 0.2, c: 0.3, d: 2, e: 10, f: 20 });
  expect(affineFromCalibration({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { width: 0, height: 1 })).toBeNull();
});

test("grab offset preserves the root on press and uses absolute final coordinates", () => {
  const press = projectPoint(projection, { x: 3.7, y: 0 });
  const offset = 3 - screenToMath(press, identity, projection)!.x;
  expect(pointerCandidate(press, identity, projection, offset, [0, 5])).toBe(3);
  expect(pointerCandidate(projectPoint(projection, { x: 4.7, y: 4 }), identity, projection, offset, [0, 5])).toBeCloseTo(4, 12);
  expect(pointerCandidate(projectPoint(projection, { x: 5.7, y: -4 }), identity, projection, offset, [0, 5])).toBeCloseTo(5, 12);
  expect(pointerCandidate(projectPoint(projection, { x: 4.05, y: 4 }), identity, projection, offset, [0, 5])).toBeCloseTo(3.35, 12);
});

test("snapping is symmetric at half steps, normalises zero and clamps bounds", () => {
  for (const [value, result] of [[-1.5, -2], [-0.5, -1], [-0.49, 0], [0.49, 0], [0.5, 1], [1.5, 2], [-99, -5], [99, 5]]) expect(snapRoot(value, [-5, 5])).toBe(result);
  expect(Object.is(snapRoot(-0.01, [-5, 5]), -0)).toBe(false);
  expect(snapRoot(-3, [0, 5])).toBe(0);
});

test("invalid transforms, coordinates, projections and bounds fail safely", () => {
  expect(screenToGraph({ x: 0, y: 0 }, null)).toBeNull();
  expect(screenToGraph({ x: 0, y: 0 }, { ...identity, a: 0 })).toBeNull();
  expect(screenToGraph({ x: NaN, y: 0 }, identity)).toBeNull();
  expect(screenToGraph({ x: 0, y: 0 }, { ...identity, e: Infinity })).toBeNull();
  expect(screenToMath({ x: 0, y: 0 }, identity, { ...projection, xRange: [0, 0] })).toBeNull();
  expect(screenToMath({ x: 0, y: 0 }, identity, { ...projection, plot: { ...projection.plot, width: 0 } })).toBeNull();
  for (const bounds of [[5, -5], [0.5, 5], [0, Infinity]] as const) expect(snapRoot(1, bounds)).toBeNull();
  expect(snapRoot(NaN, [-5, 5])).toBeNull();
  expect(pointerCandidate({ x: 0, y: 0 }, identity, projection, NaN, [-5, 5])).toBeNull();
});

test("keyboard and button preparation share the same bounds and integer changes", () => {
  expect(adjustedRoot(3, -1, [0, 5])).toBe(2);
  expect(adjustedRoot(5, 1, [0, 5])).toBe(5);
  expect(keyboardRoot(3, "ArrowLeft", [0, 5])).toBe(2);
  expect(keyboardRoot(-3, "ArrowRight", [-5, 5])).toBe(-2);
  expect(keyboardRoot(3, "Home", [-5, 5])).toBe(-5);
  expect(keyboardRoot(3, "End", [-5, 5])).toBe(5);
  expect(keyboardRoot(3, "Enter", [-5, 5])).toBeNull();
});
