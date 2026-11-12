import { immutable } from "../../core/immutable";
import { finiteNumber } from "../../core/math/realFactors";

/** The finite polynomial family approved for this activity, not a symbolic engine. */
export type IntegrationFunction = "flat" | "rising" | "square" | "lower" | "upper" | "parabola" | "axis";
export type ComparisonFunction = "flat" | "rising";
export type GrowthFunction = ComparisonFunction | "square";
export type DivisionFunction = "rising" | "square";
export type IntegrationStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type BoundaryId = "a" | "b";
export type Polynomial = readonly [constant: number, linear: number, quadratic: number];
export type IntegrationRegion = Readonly<{ top: IntegrationFunction; bottom: IntegrationFunction; a: number; b: number }>;
export type FormattedValue = Readonly<{ text: string; approximate: boolean }>;
export type CurveSelection = readonly [IntegrationFunction, IntegrationFunction];
export type RegionSelection = Readonly<{ curves: CurveSelection; a: number; b: number }>;
export type OrderedPiece = IntegrationRegion;
export type RegionAnalysis = Readonly<{
  selection: RegionSelection; pieces: readonly OrderedPiece[]; crossings: readonly number[];
  area: number; identical: boolean;
}>;

const polynomials: Readonly<Record<IntegrationFunction, Polynomial>> = immutable({
  flat: [2, 0, 0], rising: [0, 1, 0], square: [0, 0, 1], lower: [0, -3, 1],
  upper: [9, 2, 0], parabola: [0, 0, 3], axis: [0, 0, 0],
});

export const functionPolynomial = (id: IntegrationFunction): Polynomial => {
  const polynomial = polynomials[id];
  if (!polynomial) throw new RangeError("Unknown integration function.");
  return polynomial;
};

export const evaluateFunction = (id: IntegrationFunction, x: number): number => {
  const [constant, linear, quadratic] = functionPolynomial(id);
  const value = finiteNumber(x);
  return finiteNumber((quadratic * value + linear) * value + constant);
};

/** Analytic antiderivative with zero additive constant; floating-point evaluation only. */
export const primitive = (id: IntegrationFunction, x: number): number => {
  const [constant, linear, quadratic] = functionPolynomial(id);
  const value = finiteNumber(x);
  return finiteNumber(((quadratic * value / 3 + linear / 2) * value + constant) * value);
};

export const heightPolynomial = (top: IntegrationFunction, bottom: IntegrationFunction): Polynomial => {
  const upper = functionPolynomial(top);
  const lower = functionPolynomial(bottom);
  return immutable([upper[0] - lower[0], upper[1] - lower[1], upper[2] - lower[2]] as const);
};

/** Check the whole quadratic gap, including an interior minimum; never hide inversion with abs(). */
export const isOrderedRegion = (top: IntegrationFunction, bottom: IntegrationFunction, a: number, b: number): boolean => {
  finiteNumber(a); finiteNumber(b);
  if (a > b) return false;
  const [constant, linear, quadratic] = heightPolynomial(top, bottom);
  const gap = (x: number) => finiteNumber((quadratic * x + linear) * x + constant);
  const candidates = [gap(a), gap(b)];
  if (quadratic > 0) {
    const vertex = -linear / (2 * quadratic);
    if (vertex > a && vertex < b) candidates.push(gap(vertex));
  }
  return Math.min(...candidates) >= 0;
};

export const validateRegion = (region: IntegrationRegion): IntegrationRegion => {
  if (!isOrderedRegion(region.top, region.bottom, region.a, region.b)) {
    throw new RangeError("The top boundary must stay at or above the bottom boundary on an increasing interval.");
  }
  return region;
};

/** Exact polynomial integral identity. Difference-of-powers form avoids subtracting near-equal primitives. */
export const areaBetween = (top: IntegrationFunction, bottom: IntegrationFunction, a: number, b: number): number => {
  validateRegion({ top, bottom, a, b });
  const [constant, linear, quadratic] = heightPolynomial(top, bottom);
  return finiteNumber((b - a) * (constant + linear * (a + b) / 2 + quadratic * (a * a + a * b + b * b) / 3));
};

export const rightEndpointEstimate = (kind: ComparisonFunction, b: number, n: number): number => {
  finiteNumber(b);
  if (b < 0 || b > 4 || !Number.isInteger(n) || n < 1 || n > 128) {
    throw new RangeError("Rectangle estimates require 0 ≤ b ≤ 4 and 1–128 rectangles.");
  }
  if (kind !== "flat" && kind !== "rising") throw new RangeError("Rectangles compare the flat and rising lines only.");
  return kind === "flat" ? 2 * b : b * b * (n + 1) / (2 * n);
};

export const refinementCounts = immutable([1, 2, 4, 8, 16, 32, 64, 128] as const);

export const isStage6Region = (region: RegionSelection): boolean =>
  region.curves.every(id => ["rising", "axis", "lower"].includes(id)) &&
  region.a === 1 && Number.isFinite(region.b) && region.b >= 1 && region.b <= 4;

export const isStage7Region = (region: RegionSelection): boolean =>
  region.curves.every(id => ["upper", "parabola", "axis"].includes(id)) &&
  [[0, 1], [1, 2], [0, 2]].some(([a, b]) => region.a === a && region.b === b);

/** Order the selected functions over the entire interval, never abs() an inverted integral. */
export const orderedRegion = (first: IntegrationFunction, second: IntegrationFunction, a: number, b: number): IntegrationRegion => {
  if (isOrderedRegion(first, second, a, b)) return { top: first, bottom: second, a, b };
  if (isOrderedRegion(second, first, a, b)) return { top: second, bottom: first, a, b };
  throw new RangeError("Selected curves cross inside this interval.");
};

/** Stable roots for the finite polynomial family; endpoint ownership stays with the interval. */
export const polynomialZeros = ([constant, linear, quadratic]: Polynomial): readonly number[] => {
  if (quadratic === 0) return linear === 0 ? [] : [-constant / linear];
  const discriminant = linear * linear - 4 * quadratic * constant;
  const tolerance = 1e-12 * Math.max(1, linear * linear, Math.abs(4 * quadratic * constant));
  if (discriminant < -tolerance) return [];
  if (Math.abs(discriminant) <= tolerance) return [-linear / (2 * quadratic)];
  const q = -0.5 * (linear + (linear < 0 ? -1 : 1) * Math.sqrt(discriminant));
  return [q / quadratic, constant / q].sort((a, b) => a - b);
};

/** Geometric area: order on each side of every crossing, then add positive pieces. */
export const analyseRegion = ({ curves, a, b }: RegionSelection): RegionAnalysis => {
  finiteNumber(a); finiteNumber(b);
  curves.forEach(functionPolynomial);
  if (a > b) throw new RangeError("Area intervals must increase.");
  const selection: RegionSelection = { curves: [...curves], a, b };
  const gap = heightPolynomial(curves[0], curves[1]);
  const identical = gap.every((coefficient) => coefficient === 0);
  if (identical || a === b) return immutable({ selection, pieces: [], crossings: [], area: 0, identical });
  const tolerance = 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
  const crossings = polynomialZeros(gap).filter((root, index, roots) => root > a && root < b && (index === 0 || Math.abs(root - roots[index - 1]) > tolerance));
  const limits = [a, ...crossings, b];
  const pieces = limits.slice(1).map((right, index) => {
    const left = limits[index], midpoint = left + (right - left) / 2;
    const firstHigher = evaluateFunction(curves[0], midpoint) >= evaluateFunction(curves[1], midpoint);
    return validateRegion({ top: curves[firstHigher ? 0 : 1], bottom: curves[firstHigher ? 1 : 0], a: left, b: right });
  });
  const area = finiteNumber(pieces.reduce((sum, piece) => sum + areaBetween(piece.top, piece.bottom, piece.a, piece.b), 0));
  if (area < 0) throw new RangeError("Geometric area cannot be negative.");
  return immutable({ selection, pieces, crossings, area: area === 0 ? 0 : area, identical });
};

export const divisionCounts = immutable([4, 8, 16, 32, 64, 128] as const);
export const quadraticEstimates = (b: number, n: number): Readonly<{ lower: number; upper: number; exact: number }> => {
  finiteNumber(b);
  if (b < 0 || b > 4 || !Number.isInteger(n) || n < 1 || n > 128) throw new RangeError("Invalid quadratic partition.");
  return immutable({ lower: b ** 3 * (n - 1) * (2 * n - 1) / (6 * n * n), upper: b ** 3 * (n + 1) * (2 * n + 1) / (6 * n * n), exact: b ** 3 / 3 });
};

export const stageId = (stage: IntegrationStage) => (["constant-area", "rectangle-estimates", "area-growth", "division", "fixed-exclusion", "between-curves", "calculate-area"] as const)[stage - 1];

export const functionExpression = (id: IntegrationFunction): string => {
  functionPolynomial(id);
  return { flat: "2", rising: "x", square: "x²", lower: "x² − 3x", upper: "9 + 2x", parabola: "3x²", axis: "0" }[id];
};

export const curveLabel = (id: IntegrationFunction): string => id === "axis" ? "x-axis" : `y = ${functionExpression(id)}`;

const expressionFromTerms = (terms: readonly Readonly<{ coefficient: number; body: string }>[]): string => {
  const nonzero = terms.filter(({ coefficient }) => coefficient !== 0);
  if (!nonzero.length) return "0";
  return nonzero.map(({ coefficient, body }, index) => {
    const sign = coefficient < 0 ? (index === 0 ? "−" : " − ") : (index === 0 ? "" : " + ");
    return `${sign}${body}`;
  }).join("");
};

export const heightExpression = (top: IntegrationFunction, bottom: IntegrationFunction): string => {
  const polynomial = heightPolynomial(top, bottom);
  // Ascending powers keeps the familiar 9 + 2x − 3x² form of the final task.
  return expressionFromTerms(polynomial.map((coefficient, power) => ({
    coefficient,
    body: power === 0 ? String(Math.abs(coefficient)) : `${Math.abs(coefficient) === 1 ? "" : Math.abs(coefficient)}${power === 1 ? "x" : "x²"}`,
  })));
};

export const polyHeightExpression = heightExpression;

export const primitiveExpression = (top: IntegrationFunction, bottom: IntegrationFunction): string => {
  const polynomial = heightPolynomial(top, bottom);
  return expressionFromTerms(polynomial.map((coefficient, index) => {
    const power = index + 1;
    const absolute = Math.abs(coefficient);
    const common = power === 1 || absolute % power === 0 ? power : 1;
    const numerator = absolute / common;
    const denominator = power / common;
    const symbol = power === 1 ? "x" : power === 2 ? "x²" : "x³";
    return { coefficient, body: `${numerator === 1 ? "" : numerator}${symbol}${denominator === 1 ? "" : `/${denominator}`}` };
  }));
};

/** Rounding is a display policy only. Callers use ≈ when approximate is true. */
export const formatValue = (value: number, digits = 2): FormattedValue => {
  finiteNumber(value);
  if (!Number.isInteger(digits) || digits < 0 || digits > 8) throw new RangeError("Invalid display precision.");
  const rounded = Number(value.toFixed(digits));
  return immutable({
    text: String(rounded === 0 ? 0 : rounded).replace("-", "−"),
    approximate: Math.abs(rounded - value) > Number.EPSILON * 8 * Math.max(1, Math.abs(value)),
  });
};
