import { range } from "d3-array";
import { scaleLinear } from "d3-scale";
import { area, curveLinear } from "d3-shape";
import { immutable } from "../../core/immutable";
import { coordinatePlaneLayout, projectPoint } from "../../core/graph/coordinatePlaneLayout";
import { functionPlotLayout } from "../../core/graph/functionPlotLayout";
import type { Bounds, CoordinatePlaneScene, FunctionPlotScene, Point, PositionedLabel, ProjectionSpec, Rect, Segment, Size } from "../../core/graph/types";
import { analyseRegion, curveLabel, evaluateFunction, formatValue, functionPolynomial, polynomialZeros, validateRegion } from "./model";
import type { BoundaryId, GrowthFunction, IntegrationFunction, IntegrationRegion, IntegrationStage, RegionSelection, RegionAnalysis } from "./model";
import { stageOneReadout } from "./display-policy";

export const explorationDomains = immutable({ x: [-0.5, 4.5] as Bounds, y: [-3, 5] as Bounds });
export const calculationDomains = immutable({ x: [-0.2, 2.3] as Bounds, y: [-1, 14] as Bounds });
export type FrameProfile = "intro" | "growth" | "growth-square" | "division-line" | "division-square" | "later" | "calculation";
export const frameProfile = (stage: IntegrationStage, comparison: GrowthFunction = "rising"): FrameProfile =>
  stage <= 2 ? "intro" : stage === 3 ? comparison === "square" ? "growth-square" : "growth" : stage === 4 ? comparison === "square" ? "division-square" : "division-line" : stage === 7 ? "calculation" : "later";
const domainsFor = (profile: FrameProfile): Readonly<{ x: Bounds; y: Bounds }> =>
  profile === "calculation" ? calculationDomains : profile === "growth-square" ? { x: explorationDomains.x, y: [-3, 18] }
    : profile.startsWith("division") ? { x: [-0.2, 3.3], y: profile === "division-line" ? [-0.3, 3.3] : [-0.9, 9.9] } : explorationDomains;
export type IntegrationCurveScene = Readonly<{ id: IntegrationFunction; plot: FunctionPlotScene; label: PositionedLabel; selected: boolean }>;
export type IntegrationAreaScene = Readonly<{ path: string; clip: Rect }>;
export type IntegrationRectangleScene = Readonly<{ rect: Rect; left: number; right: number; height: number; role: "estimate" | "lower" | "upper" }>;
export type IntegrationBoundaryScene = Readonly<{ id: BoundaryId; value: number; center: Point; line: Segment; hitRegion: Rect; label: PositionedLabel; labelBackground: Rect; enabled: boolean }>;
export type IntegrationStripScene = Readonly<{ x: number; height: number; line: Segment; arrowheads: readonly Segment[]; label: PositionedLabel }>;
export type RegionAnnotation = Readonly<{ label: PositionedLabel; line: Segment; arrow: readonly Segment[] }>;
export type IntegrationGraphScene = Readonly<{
  size: Size; plane: CoordinatePlaneScene; profile: FrameProfile; curves: readonly IntegrationCurveScene[];
  region: IntegrationAreaScene; regions: readonly IntegrationAreaScene[]; excluded: IntegrationAreaScene | null;
  reference: IntegrationAreaScene | null; enclosing: Rect | null;
  rectangles: readonly IntegrationRectangleScene[]; strip: IntegrationStripScene | null;
  handles: readonly IntegrationBoundaryScene[]; annotations: readonly RegionAnnotation[]; description: string;
}>;
export type IntegrationGraphInput = Readonly<RegionSelection & {
  size: Size; stage: IntegrationStage; comparison?: GrowthFunction; rectangleCount?: number;
  showExcluded?: boolean; showReference?: boolean; showStrip?: boolean;
  interactive?: readonly BoundaryId[]; plane?: CoordinatePlaneScene;
}>;

export const integrationPlaneLayout = (size: Size, stage: IntegrationStage, comparison: GrowthFunction = "rising"): CoordinatePlaneScene => {
  if (size.height < 200) throw new RangeError("Integration graphs need at least 200 pixels in height.");
  const profile = frameProfile(stage, comparison);
  const domains = domainsFor(profile);
  const base = coordinatePlaneLayout(size, domains.x, domains.y);
  const later = profile === "later" || profile === "calculation";
  const plot = later ? { ...base.projection.plot, height: size.height - 76 } : base.projection.plot;
  const projection: ProjectionSpec = later ? { ...base.projection, plot, yRange: [plot.y + plot.height, plot.y] } : base.projection;
  const x = scaleLinear(projection.xDomain, projection.xRange), y = scaleLinear(projection.yDomain, projection.yRange);
  const xTicks = stage === 7 ? [0, 1, 2] : stage === 4 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  const yTicks = profile === "growth-square" ? [0, 4, 8, 12, 16] : profile === "division-line" ? [0, 1, 2, 3] : profile === "division-square" ? [0, 3, 6, 9] : y.ticks(Math.max(2, Math.floor(plot.height / 55)));
  return immutable({
    size: { ...size }, projection,
    axes: [{ start: { x: plot.x, y: y(0) }, end: { x: plot.x + plot.width, y: y(0) } }, { start: { x: x(0), y: plot.y }, end: { x: x(0), y: plot.y + plot.height } }],
    grid: [...xTicks.filter(v => v !== 0).map(v => ({ start: { x: x(v), y: plot.y }, end: { x: x(v), y: plot.y + plot.height } })),
      ...yTicks.filter(v => v !== 0).map(v => ({ start: { x: plot.x, y: y(v) }, end: { x: plot.x + plot.width, y: y(v) } }))],
    ticks: xTicks.map(v => ({ start: { x: x(v), y: y(0) - 3 }, end: { x: x(v), y: y(0) + 3 } })),
    tickLabels: [...xTicks.map(v => ({ position: { x: x(v), y: y(0) + 19 }, text: String(v), anchor: "middle" as const })),
      ...yTicks.filter(v => v !== 0).map(v => ({ position: { x: plot.x - 8, y: y(v) + 4 }, text: formatValue(v).text, anchor: "end" as const }))],
    axisLabels: [{ position: { x: plot.x + plot.width, y: y(0) - 10 }, text: "x", anchor: "end" }, { position: { x: x(0) + 10, y: plot.y - 8 }, text: "y", anchor: "start" }],
  });
};
const landmarkXs = (id: IntegrationFunction): readonly number[] => {
  const polynomial = functionPolynomial(id);
  return [0, ...polynomialZeros(polynomial), ...(polynomial[2] ? [-polynomial[1] / (2 * polynomial[2])] : [])];
};
const regionLayout = (projection: ProjectionSpec, region: IntegrationRegion): IntegrationAreaScene => {
  validateRegion(region);
  if (region.a === region.b || region.top === region.bottom) return { path: "", clip: { ...projection.plot } };
  const x = scaleLinear(projection.xDomain, projection.xRange), y = scaleLinear(projection.yDomain, projection.yRange);
  const positions = [...new Set([...range(201).map(i => region.a + (region.b - region.a) * i / 200),
    ...[region.top, region.bottom].flatMap(landmarkXs).filter(v => v >= region.a && v <= region.b)])].sort((a, b) => a - b);
  return { path: area<number>().x(v => x(v)).y0(v => y(evaluateFunction(region.bottom, v))).y1(v => y(evaluateFunction(region.top, v))).curve(curveLinear).digits(6)(positions) ?? "", clip: { ...projection.plot } };
};
const curveLabelLayout = (projection: ProjectionSpec, id: IntegrationFunction, stage: IntegrationStage): PositionedLabel => {
  if (stage === 6 && id === "lower") return { position: projectPoint(projection, { x: 3.7, y: -2.65 }), text: curveLabel(id), anchor: "end" };
  const mathX = stage === 7 ? id === "upper" ? 0.6 : 1.15 : stage === 4 ? 2.7 : 3.75;
  const point = projectPoint(projection, { x: mathX, y: evaluateFunction(id, mathX) });
  return { position: { x: Math.min(projection.plot.x + projection.plot.width - 6, point.x), y: stage <= 3 && id !== "square" || stage === 5 || stage === 6 && id === "rising" ? point.y + 22 : Math.max(projection.plot.y + 15, point.y - 10) }, text: curveLabel(id), anchor: "end" };
};
const boundaryLayout = (input: IntegrationGraphInput, projection: ProjectionSpec, id: BoundaryId): IntegrationBoundaryScene => {
  const value = input[id], axis = projectPoint(projection, { x: value, y: 0 });
  const ys = input.curves.map(curve => projectPoint(projection, { x: value, y: evaluateFunction(curve, value) }).y);
  const center = { x: axis.x, y: input.stage <= 5 ? ys[0] : Math.min(...ys) };
  const display = formatValue(value);
  const text = input.stage === 1 ? "b = " + stageOneReadout(value).boundaryText : id + (display.approximate ? " ≈ " : " = ") + display.text;
  const labelWidth = Math.max(52, text.length * 7 + 14);
  const labelX = Math.min(input.size.width - labelWidth / 2 - 2, Math.max(labelWidth / 2 + 2, center.x));
  const labelY = input.stage >= 5 ? Math.min(input.size.height - 7, axis.y + (id === "a" ? 62 : 37)) : input.stage === 4 ? Math.max(16, center.y - 15) : center.y - 29;
  return { id, value, center, line: { start: { x: axis.x, y: Math.min(...ys, axis.y) }, end: { x: axis.x, y: Math.max(...ys, axis.y) } },
    hitRegion: { x: center.x - 24, y: center.y - 24, width: 48, height: 48 },
    label: { position: { x: labelX, y: labelY }, text, anchor: "middle" },
    labelBackground: { x: labelX - labelWidth / 2, y: labelY - 14, width: labelWidth, height: 22 },
    enabled: input.interactive?.includes(id) ?? false };
};
const rectangleLayout = (input: IntegrationGraphInput, projection: ProjectionSpec): readonly IntegrationRectangleScene[] => {
  if (input.rectangleCount === undefined) return [];
  const count = input.rectangleCount, id = input.comparison ?? input.curves[0];
  if (!Number.isInteger(count) || count < 1 || count > 128 || !["flat", "rising", "square"].includes(id) || input.a !== 0) throw new RangeError("Invalid rectangle construction.");
  const dx = input.b / count;
  const rectangle = (index: number, endpoint: "left" | "right", role: IntegrationRectangleScene["role"]) => {
    const left = index * dx, right = (index + 1) * dx, height = evaluateFunction(id, endpoint === "left" ? left : right);
    const origin = projectPoint(projection, { x: left, y: height }), end = projectPoint(projection, { x: right, y: 0 });
    return { left, right, height, role, rect: { x: origin.x, y: origin.y, width: end.x - origin.x, height: end.y - origin.y } };
  };
  return input.stage === 4 ? [...range(count).map(i => rectangle(i, "right", "upper")), ...range(count).map(i => rectangle(i, "left", "lower"))] : range(count).map(i => rectangle(i, "right", "estimate"));
};
const stripLayout = (input: IntegrationGraphInput, projection: ProjectionSpec, analysis: RegionAnalysis, labels: readonly PositionedLabel[]): IntegrationStripScene | null => {
  if (!input.showStrip || !analysis.pieces.length) return null;
  const candidates = analysis.pieces.flatMap(piece => range(1, 20).map(i => {
    const x = piece.a + (piece.b - piece.a) * i / 20;
    const start = projectPoint(projection, { x, y: evaluateFunction(piece.top, x) }), end = projectPoint(projection, { x, y: evaluateFunction(piece.bottom, x) });
    const clearance = Math.min(...labels.map(label => Math.hypot(start.x - label.position.x, (start.y + end.y) / 2 - label.position.y)));
    return { x, start, end, height: evaluateFunction(piece.top, x) - evaluateFunction(piece.bottom, x), score: Math.min(80, end.y - start.y) + Math.min(70, clearance) - Math.abs(x - (input.a + input.b) / 2) * 10 };
  })).filter(c => c.end.y - c.start.y >= 12).sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) return null;
  const inset = 3, head = Math.min(3, (best.end.y - best.start.y - 2 * inset) / 3);
  const start = { x: best.start.x, y: best.start.y + inset }, end = { x: best.end.x, y: best.end.y - inset };
  return { x: best.x, height: best.height, line: { start, end },
    arrowheads: [-1, 1].flatMap(direction => [
      { start, end: { x: start.x + direction * head, y: start.y + head } },
      { start: end, end: { x: end.x + direction * head, y: end.y - head } },
    ]),
    label: { position: { x: start.x + 8, y: (start.y + end.y) / 2 + 4 }, text: "h(x)", anchor: "start" } };
};
const regionAnnotations = (input: IntegrationGraphInput, projection: ProjectionSpec): readonly RegionAnnotation[] => {
  if (input.stage !== 5) return [];
  const axis = projectPoint(projection, { x: 1, y: 0 });
  const item = (text: string, position: Point, target: Point, zero = false): RegionAnnotation => {
    const end = zero ? { x: target.x, y: target.y - 3 } : target;
    return { label: { text, position, anchor: "start" }, line: { start: { x: position.x + 8, y: position.y + 5 }, end },
      arrow: zero ? [-1, 1].map(direction => ({ start: end, end: { x: end.x + direction * 3, y: end.y - 5 } })) : [] };
  };
  return [
    item("Area left out", { x: projection.plot.x + 2, y: projection.plot.y + 17 }, projectPoint(projection, { x: 2 / 3, y: 1 / 3 })),
    input.b === 1 ? item("Area we want = 0", { x: axis.x + 22, y: axis.y - 25 }, axis, true)
      : item("Area we want", { x: projection.plot.x + projection.plot.width * 0.48, y: projection.plot.y + 17 }, projectPoint(projection, { x: (1 + input.b) / 2, y: (1 + input.b) / 4 })),
  ];
};
export const integrationGraphLayout = (input: IntegrationGraphInput): IntegrationGraphScene => {
  const analysis = analyseRegion(input), profile = frameProfile(input.stage, input.comparison);
  const plane = input.plane ?? integrationPlaneLayout(input.size, input.stage, input.comparison);
  const expected = domainsFor(profile);
  if (plane.size.width !== input.size.width || plane.size.height !== input.size.height || plane.projection.xDomain.some((v, i) => v !== expected.x[i]) || plane.projection.yDomain.some((v, i) => v !== expected.y[i])) throw new RangeError("Prepared plane must match the stable frame.");
  const { projection } = plane;
  const ids: readonly IntegrationFunction[] = input.stage === 7 ? ["upper", "parabola"] : input.stage === 6 ? ["rising", "lower"] : [input.comparison ?? input.curves[0]];
  const curves = ids.map(id => {
    const plot = functionPlotLayout(projection, x => evaluateFunction(id, x), [...landmarkXs(id), input.a, input.b, ...analysis.crossings]);
    const extent = input.stage === 7 ? [0, 2] : null;
    const start = extent ? projectPoint(projection, { x: extent[0], y: 0 }).x : projection.plot.x;
    const end = extent ? projectPoint(projection, { x: extent[1], y: 0 }).x : projection.plot.x + projection.plot.width;
    return { id, plot: { ...plot, clip: { ...plot.clip, x: start, width: end - start } }, label: curveLabelLayout(projection, id, input.stage), selected: input.curves.includes(id) };
  });
  const regions = analysis.pieces.map(piece => regionLayout(projection, piece));
  const boundaryIds: BoundaryId[] = input.stage >= 5 ? ["a", "b"] : ["b"];
  const corner = projectPoint(projection, { x: 3, y: evaluateFunction(input.comparison ?? "rising", 3) }), origin = projectPoint(projection, { x: 0, y: 0 });
  return immutable({
    size: { ...input.size }, plane, profile, curves, regions, region: { path: regions.map(r => r.path).join(""), clip: { ...projection.plot } },
    excluded: input.showExcluded ? regionLayout(projection, { a: 0, b: 1, top: "rising", bottom: "axis" }) : null,
    reference: input.showReference ? regionLayout(projection, { a: 0, b: 2, top: input.comparison ?? input.curves[0], bottom: "axis" }) : null,
    enclosing: input.stage === 4 ? { x: origin.x, y: corner.y, width: corner.x - origin.x, height: origin.y - corner.y } : null,
    rectangles: rectangleLayout(input, projection), strip: stripLayout(input, projection, analysis, curves.map(c => c.label)),
    handles: boundaryIds.map(id => boundaryLayout(input, projection, id)), annotations: regionAnnotations(input, projection),
    description: input.stage === 1 ? "y = 2. Shaded rectangle from zero to b = " + stageOneReadout(input.b).boundaryText + ". Boundary and area readouts use the boundary rounded to one decimal place; the graph position is continuous."
      : curves.map(c => curveLabel(c.id)).join(" and ") + ". The shaded region is between " + input.curves.map(curveLabel).join(" and ") + ", from the left boundary x " + formatValue(input.a).text + " to the right boundary x " + formatValue(input.b).text + ".",
  });
};
