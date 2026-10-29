import { expect, test } from "@playwright/test";
import { analyseRegion, areaBetween, curveLabel, divisionCounts, evaluateFunction, formatValue, functionExpression, heightExpression, isOrderedRegion, isStage6Region, isStage7Region, polynomialZeros, primitive, primitiveExpression, quadraticEstimates, refinementCounts, rightEndpointEstimate, type RegionSelection } from "../activities/integration-area/model";
import { calculationDomains, explorationDomains, integrationGraphLayout, integrationPlaneLayout } from "../activities/integration-area/graph-layout";
import { projectPoint, unprojectPoint } from "../core/graph/coordinatePlaneLayout";

const size = { width: 366, height: 300 };
test("analytic evaluation and primitives cover every polynomial and continuous boundary", () => {
  for (const b of [0, .125, 1, 1.75, 2, 3.14159, 4]) {
    expect(areaBetween("flat", "axis", 0, b)).toBe(2 * b);
    expect(areaBetween("rising", "axis", 0, b)).toBe(b * b / 2);
    expect(areaBetween("square", "axis", 0, b)).toBeCloseTo(b ** 3 / 3, 12);
  }
  for (const [id, ratio] of [["flat", 2], ["rising", 4], ["square", 8]] as const) expect(areaBetween(id, "axis", 0, 4) / areaBetween(id, "axis", 0, 2)).toBe(ratio);
  for (const id of ["flat", "rising", "square", "lower", "upper", "parabola", "axis"] as const) for (const x of [-1, 0, .38, 1, 2, 4]) {
    const h = .0001;
    expect((primitive(id, x + h) - primitive(id, x - h)) / (2 * h)).toBeCloseTo(evaluateFunction(id, x), 6);
  }
  expect(evaluateFunction("square", 4)).toBe(16); expect(evaluateFunction("parabola", 2)).toBe(12);
});

test("Stage 2 right-endpoint estimates preserve all integer counts and exact constant sums", () => {
  expect(refinementCounts).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
  for (const b of [0, .23, 1, 2, 4]) for (const n of [1, 3, 7, 16, 53, 128]) {
    expect(rightEndpointEstimate("flat", b, n)).toBe(2 * b);
    const dx = b / n, independent = Array.from({ length: n }, (_, i) => (i + 1) * dx ** 2).reduce((a, b) => a + b, 0);
    expect(rightEndpointEstimate("rising", b, n)).toBeCloseTo(independent, 11);
    expect(rightEndpointEstimate("rising", b, n) - b * b / 2).toBeCloseTo(b * b / (2 * n), 12);
  }
});

test("all six lower/upper quadratic sums match independent rectangles and converge towards 9", () => {
  const expected = [[5.90625, 12.65625], [7.3828125, 10.7578125], [8.173828125, 9.861328125], [8.58251953125, 9.42626953125], [8.7901611328125, 9.2120361328125], [8.894805908203125, 9.105743408203125]];
  let previousLower = -Infinity, previousUpper = Infinity;
  for (const [index, n] of divisionCounts.entries()) {
    const sums = quadraticEstimates(3, n), dx = 3 / n;
    const independent = (offset: number) => Array.from({ length: n }, (_, i) => ((i + offset) * dx) ** 2 * dx).reduce((a, b) => a + b, 0);
    expect(sums.lower).toBeCloseTo(expected[index][0], 12); expect(sums.upper).toBeCloseTo(expected[index][1], 12);
    expect(sums.lower).toBeCloseTo(independent(0), 12); expect(sums.upper).toBeCloseTo(independent(1), 12);
    expect(sums.lower).toBeGreaterThan(previousLower); expect(sums.upper).toBeLessThan(previousUpper);
    expect(sums.lower).toBeLessThan(9); expect(sums.upper).toBeGreaterThan(9);
    expect(sums.upper - sums.lower).toBeCloseTo(27 / n, 12);
    previousLower = sums.lower; previousUpper = sums.upper;
  }
  expect(quadraticEstimates(3, 4).lower.toFixed(1)).toBe("5.9"); expect(quadraticEstimates(3, 4).upper.toFixed(1)).toBe("12.7");
  expect(quadraticEstimates(3, 128).lower.toFixed(1)).toBe("8.9"); expect(quadraticEstimates(3, 128).upper.toFixed(1)).toBe("9.1");
});

test("geometric areas split crossings instead of taking an absolute signed total", () => {
  const table = [["rising", "lower", 22 / 3, 9], ["rising", "axis", 4, 15 / 2], ["lower", "axis", 10 / 3, 31 / 6]] as const;
  for (const [first, second, at3, at4] of table) for (const [b, answer] of [[3, at3], [4, at4]]) {
    for (const curves of [[first, second], [second, first]] as const) {
      const region = analyseRegion({ curves, a: 1, b });
      expect(region.area).toBeCloseTo(answer, 12);
      expect(region.pieces.reduce((sum, p) => sum + areaBetween(p.top, p.bottom, p.a, p.b), 0)).toBeCloseTo(answer, 12);
      for (const piece of region.pieces) expect(isOrderedRegion(piece.top, piece.bottom, piece.a, piece.b)).toBe(true);
    }
  }
  const crossing = analyseRegion({ curves: ["lower", "axis"], a: 1, b: 4 });
  expect(crossing.crossings).toEqual([3]); expect(crossing.pieces).toMatchObject([{ top: "axis", bottom: "lower", a: 1, b: 3 }, { top: "lower", bottom: "axis", a: 3, b: 4 }]);
  expect(crossing.area).not.toBe(1.5);
  for (const b of [3 - 1e-7, 3, 3 + 1e-7, 3.01, 4]) {
    const r = analyseRegion({ curves: ["axis", "lower"], a: 1, b });
    expect(r.crossings.length).toBe(b > 3 ? 1 : 0);
    expect(r.pieces).toHaveLength(b > 3 ? 2 : 1);
  }
  for (const id of ["rising", "lower", "axis"] as const) expect(analyseRegion({ curves: [id, id], a: 1, b: 4 })).toMatchObject({ area: 0, pieces: [], identical: true });
  expect(analyseRegion({ curves: ["rising", "lower"], a: 1, b: 1 })).toMatchObject({ area: 0, pieces: [] });
});

test("strict ordered integration rejects inversion and invalid/non-finite inputs", () => {
  expect(isOrderedRegion("lower", "axis", -1, 4)).toBe(false);
  for (const [top, bottom, a, b] of [["lower", "axis", -1, 4], ["axis", "rising", 1, 3], ["rising", "axis", 3, 1], ["upper", "parabola", 0, 3]] as const) expect(() => areaBetween(top, bottom, a, b)).toThrow();
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(() => evaluateFunction("rising", value)).toThrow(); expect(() => primitive("flat", value)).toThrow();
    expect(() => analyseRegion({ curves: ["rising", "axis"], a: 0, b: value })).toThrow(); expect(() => formatValue(value)).toThrow();
  }
  expect(() => evaluateFunction("parabola", Number.MAX_VALUE)).toThrow();
  for (const count of [0, 1.5, 129, NaN]) expect(() => rightEndpointEstimate("rising", 2, count)).toThrow();
  expect(polynomialZeros([1, -2, 1])).toEqual([1]); expect(polynomialZeros([0, -3, 1])).toEqual([0, 3]);
  expect(polynomialZeros([1, 0, 1])).toEqual([]); expect(polynomialZeros([0, 0, 0])).toEqual([]);
});

test("per-stage selections validate their domain without imposing selector order", () => {
  expect(isStage6Region({ curves: ["lower", "axis"], a: 1, b: 4 })).toBe(true);
  expect(isStage6Region({ curves: ["rising", "rising"], a: 1, b: 1 })).toBe(true);
  expect(isStage6Region({ curves: ["upper", "axis"], a: 1, b: 3 })).toBe(false);
  expect(isStage7Region({ curves: ["axis", "upper"], a: 0, b: 2 })).toBe(true);
  expect(isStage7Region({ curves: ["upper", "axis"], a: .5, b: 2 })).toBe(false);
  expect(isStage7Region({ curves: ["upper", "axis"], a: 1, b: 3 })).toBe(false);
});

test("notation and display rounding do not become computational inputs", () => {
  expect(heightExpression("rising", "lower")).toBe("4x − x²"); expect(heightExpression("upper", "parabola")).toBe("9 + 2x − 3x²");
  expect(primitiveExpression("rising", "axis")).toBe("x²/2"); expect(primitiveExpression("rising", "lower")).toBe("2x² − x³/3"); expect(primitiveExpression("upper", "parabola")).toBe("9x + x² − x³");
  expect(functionExpression("lower")).toBe("x² − 3x"); expect(curveLabel("axis")).toBe("x-axis");
  expect(formatValue(22 / 3)).toEqual({ text: "7.33", approximate: true }); expect(formatValue(-0)).toEqual({ text: "0", approximate: false });
  expect(formatValue(.1 + .2)).toEqual({ text: "0.3", approximate: false }); expect(formatValue(-.125, 3)).toEqual({ text: "−0.125", approximate: false });
});

test("introductory frames remain unchanged and new profiles are stable and explicitly scaled", () => {
  const intro = integrationPlaneLayout(size, 1);
  expect(integrationPlaneLayout(size, 2)).toEqual(intro); expect(integrationPlaneLayout(size, 3)).toEqual(intro);
  expect(intro.projection.xDomain).toEqual(explorationDomains.x); expect(intro.projection.yDomain).toEqual(explorationDomains.y);
  const square = integrationPlaneLayout(size, 3, "square"); expect(square.projection.yDomain).toEqual([-3, 18]);
  expect(square.tickLabels.some(label => label.text === "16")).toBe(true);
  const linear = integrationPlaneLayout(size, 4, "rising"), quadratic = integrationPlaneLayout(size, 4, "square");
  expect(linear.projection.xRange).toEqual(quadratic.projection.xRange);
  expect(projectPoint(linear.projection, { x: 0, y: 0 })).toEqual(projectPoint(quadratic.projection, { x: 0, y: 0 }));
  expect(integrationPlaneLayout(size, 7).projection.xDomain).toEqual(calculationDomains.x);
  for (const b of [0, .217, 1, 2.135, 4]) {
    const scene = integrationGraphLayout({ size, stage: 1, a: 0, b, curves: ["flat", "axis"], interactive: ["b"], plane: intro });
    expect(scene.plane).toBe(intro); expect(unprojectPoint(intro.projection, scene.handles[0].center).x).toBeCloseTo(b, 12);
  }
  expect(() => integrationGraphLayout({ size, stage: 7, a: 1, b: 2, curves: ["upper", "parabola"], plane: intro })).toThrow();
});

test("paired rectangle geometry matches both sums and the exact enclosing rectangle", () => {
  for (const n of divisionCounts) {
    const scene = integrationGraphLayout({ size, stage: 4, comparison: "square", curves: ["square", "axis"], a: 0, b: 3, rectangleCount: n });
    expect(scene.rectangles).toHaveLength(2 * n);
    for (const role of ["lower", "upper"] as const) {
      const rectangles = scene.rectangles.filter(r => r.role === role);
      const total = rectangles.reduce((sum, r) => sum + (r.right - r.left) * r.height, 0);
      expect(total).toBeCloseTo(quadraticEstimates(3, n)[role], 11);
      expect(rectangles[0].left).toBe(0); expect(rectangles.at(-1)!.right).toBe(3);
    }
    const topRight = projectPoint(scene.plane.projection, { x: 3, y: 9 });
    expect(scene.enclosing!.y).toBe(topRight.y);
    expect(scene.handles[0].labelBackground.y).toBeGreaterThanOrEqual(0);
  }
  for (const kind of ["flat", "rising"] as const) for (const n of refinementCounts) {
    const scene = integrationGraphLayout({ size, stage: 2, comparison: kind, curves: [kind, "axis"], a: 0, b: 2.375, rectangleCount: n });
    expect(scene.rectangles).toHaveLength(n);
    expect(scene.rectangles.reduce((sum, r) => sum + (r.right - r.left) * r.height, 0)).toBeCloseTo(rightEndpointEstimate(kind, 2.375, n), 11);
  }
});

test("curves retain exact landmarks, true offscreen values, clipping and bounded interpolation error", () => {
  for (const [stage, comparison, curves, a, b] of [[3, "square", ["square", "axis"], 0, 4], [6, "rising", ["rising", "lower"], 1, 4], [7, "rising", ["upper", "parabola"], 1, 2]] as const) {
    const scene = integrationGraphLayout({ size: { width: 900, height: 600 }, stage, comparison, curves, a, b, showStrip: true });
    for (const curve of scene.curves) {
      for (let i = 1; i < curve.plot.samples.length; i++) {
        const left = curve.plot.samples[i - 1], right = curve.plot.samples[i], mid = (left.math.x + right.math.x) / 2;
        const actual = projectPoint(scene.plane.projection, { x: mid, y: evaluateFunction(curve.id, mid) });
        expect(Math.abs(actual.y - (left.position!.y + right.position!.y) / 2)).toBeLessThan(.25);
      }
      expect(curve.plot.path).not.toMatch(/NaN|Infinity/);
    }
  }
  const final = integrationGraphLayout({ size, stage: 7, curves: ["upper", "parabola"], a: 1, b: 2, showStrip: true });
  expect(final.curves.find(c => c.id === "parabola")!.plot.samples.some(s => s.math.y! > 14)).toBe(true);
  expect(final.curves[0].plot.clip.x).toBe(projectPoint(final.plane.projection, { x: 0, y: 0 }).x);
});

test("thin arrows stay inside true gaps and disappear for zero-width or identical selections", () => {
  for (const curves of [["rising", "lower"], ["lower", "axis"], ["upper", "parabola"]] as const) {
    const stage = curves[0] === "upper" ? 7 : 6, b = stage === 7 ? 2 : 4;
    const scene = integrationGraphLayout({ size, stage, curves, a: 1, b, showStrip: true });
    const arrow = scene.strip!;
    const piece = analyseRegion({ curves, a: 1, b }).pieces.find(p => p.a < arrow.x && p.b > arrow.x)!;
    expect(arrow.height).toBe(evaluateFunction(piece.top, arrow.x) - evaluateFunction(piece.bottom, arrow.x));
    expect(arrow.line.start.y).toBeGreaterThan(projectPoint(scene.plane.projection, { x: arrow.x, y: evaluateFunction(piece.top, arrow.x) }).y);
    expect(arrow.line.end.y).toBeLessThan(projectPoint(scene.plane.projection, { x: arrow.x, y: evaluateFunction(piece.bottom, arrow.x) }).y);
    expect(arrow.arrowheads).toHaveLength(4);
  }
  for (const region of [{ curves: ["axis", "axis"], a: 1, b: 4 }, { curves: ["rising", "lower"], a: 1, b: 1 }] satisfies RegionSelection[]) {
    const scene = integrationGraphLayout({ ...region, size, stage: 6, showStrip: true });
    expect(scene.strip).toBeNull(); expect(scene.regions).toEqual([]);
  }
});

test("Stage 5 zero-area annotation replaces the absent region and keeps both boundary identities", () => {
  for (const size of [{ width: 320, height: 200 }, { width: 366, height: 220 }, { width: 620, height: 450 }]) {
    const zero = integrationGraphLayout({ size, stage: 5, curves: ["rising", "axis"], a: 1, b: 1, showExcluded: true });
    expect(zero.regions).toEqual([]); expect(zero.annotations.map(x => x.label.text)).toEqual(["Area left out", "Area we want = 0"]);
    expect(zero.annotations[1].arrow).toHaveLength(2);
    expect(zero.handles.map(h => h.label.text)).toEqual(["a = 1", "b = 1"]);
    expect(zero.handles[0].labelBackground.y).toBeGreaterThanOrEqual(zero.handles[1].labelBackground.y + 22);
    for (const h of zero.handles) expect(h.labelBackground.y + h.labelBackground.height).toBeLessThanOrEqual(size.height + 1);
    const positive = integrationGraphLayout({ size, stage: 5, curves: ["rising", "axis"], a: 1, b: 1.00001 });
    expect(positive.annotations.map(x => x.label.text)).toContain("Area we want");
  }
});

test("scene contracts are immutable portable data without freezing caller-owned selections", () => {
  const input = { size: { ...size }, stage: 6 as const, a: 1, b: 4, curves: ["lower", "axis"] as const, showStrip: true };
  const scene = integrationGraphLayout(input);
  expect(Object.isFrozen(input)).toBe(false); expect(Object.isFrozen(input.size)).toBe(false); expect(Object.isFrozen(input.curves)).toBe(false);
  expect(Object.isFrozen(scene)).toBe(true); expect(Object.isFrozen(scene.curves[0].plot.samples)).toBe(true);
  expect(JSON.parse(JSON.stringify(scene))).toEqual(scene); expect(scene.regions).toHaveLength(2);
  expect(scene.description).not.toContain("square units");
});
