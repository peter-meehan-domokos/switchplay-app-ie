import { unprojectPoint } from "../graph/coordinatePlaneLayout";
import type { Bounds, Point, ProjectionSpec, Size } from "../graph/types";
import { immutable } from "../immutable";

export type Affine2D = Readonly<{ a: number; b: number; c: number; d: number; e: number; f: number }>;
export type RootInputPolicy = Readonly<{ enabled: boolean; bounds: Bounds }>;

/** Three measured basis points describe the actual rendered affine mapping. */
export const affineFromCalibration = (origin: Point, horizontal: Point, vertical: Point, span: Size): Affine2D | null => {
  if (![origin.x, origin.y, horizontal.x, horizontal.y, vertical.x, vertical.y, span.width, span.height].every(Number.isFinite) || span.width <= 0 || span.height <= 0) return null;
  return immutable({ a: (horizontal.x - origin.x) / span.width, b: (horizontal.y - origin.y) / span.width,
    c: (vertical.x - origin.x) / span.height, d: (vertical.y - origin.y) / span.height, e: origin.x, f: origin.y });
};

/** Standard SVG affine coefficients. Singular, missing and nonfinite input is harmless. */
export const screenToGraph = (point: Point, matrix: Affine2D | null): Point | null => {
  if (!matrix || ![point.x, point.y, ...Object.values(matrix)].every(Number.isFinite)) return null;
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null;
  const x = point.x - matrix.e;
  const y = point.y - matrix.f;
  const result = { x: (matrix.d * x - matrix.c * y) / determinant, y: (-matrix.b * x + matrix.a * y) / determinant };
  return Number.isFinite(result.x + result.y) ? immutable(result) : null;
};

export const screenToMath = (point: Point, matrix: Affine2D | null, projection: ProjectionSpec): Point | null => {
  const local = screenToGraph(point, matrix);
  if (!local || ![...projection.xDomain, ...projection.yDomain, ...projection.xRange, ...projection.yRange, projection.plot.width, projection.plot.height].every(Number.isFinite) || projection.xDomain[0] >= projection.xDomain[1] || projection.yDomain[0] >= projection.yDomain[1] || projection.plot.width <= 0 || projection.plot.height <= 0 || projection.xRange[0] === projection.xRange[1] || projection.yRange[0] === projection.yRange[1]) return null;
  const result = unprojectPoint(projection, local);
  return Number.isFinite(result.x + result.y) ? result : null;
};

export const snapRoot = (value: number, bounds: Bounds): number | null => {
  if (![value, ...bounds].every(Number.isFinite) || !bounds.every(Number.isInteger) || bounds[0] > bounds[1]) return null;
  const rounded = Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
  const result = Math.max(bounds[0], Math.min(bounds[1], rounded));
  return result === 0 ? 0 : result;
};

export const pointerCandidate = (point: Point, matrix: Affine2D | null, projection: ProjectionSpec, grabOffset: number, bounds: Bounds): number | null => {
  const math = screenToMath(point, matrix, projection);
  if (!math || ![grabOffset, ...bounds].every(Number.isFinite) || bounds[0] > bounds[1]) return null;
  const root = math.x + grabOffset;
  if (!Number.isFinite(root)) return null;
  const bounded = Math.max(bounds[0], Math.min(bounds[1], root));
  return bounded === 0 ? 0 : bounded;
};

export const adjustedRoot = (root: number, direction: -1 | 1, bounds: Bounds) => snapRoot(root + direction, bounds);
export const keyboardRoot = (root: number, key: string, bounds: Bounds): number | null => {
  if (key === "ArrowLeft" || key === "ArrowDown") return adjustedRoot(root, -1, bounds);
  if (key === "ArrowRight" || key === "ArrowUp") return adjustedRoot(root, 1, bounds);
  if (key === "Home") return snapRoot(bounds[0], bounds);
  if (key === "End") return snapRoot(bounds[1], bounds);
  return null;
};
