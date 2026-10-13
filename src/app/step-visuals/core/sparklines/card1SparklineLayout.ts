import { scaleLinear } from "d3-scale";
import { card1Evaluator, card1Factors, card1Vertex, createCard1GraphMath, createCard1Math } from "../../activities/roots-factors/model";
import { factorExpressionLayout, type FactorExpressionScene } from "../expressions/factorExpressionLayout";
import { functionPlotLayout } from "../graph/functionPlotLayout";
import type { Bounds, FunctionPlotScene, Point, PositionedLabel, ProjectionSpec, Segment, Size } from "../graph/types";
import { immutable } from "../immutable";
import { formatNumber } from "../math/realFactors";

export type SparklineVariant = "complete" | "graphics-only" | "notation-only";
export type SparklineGraphScene = Readonly<{
  size: Size;
  projection: ProjectionSpec;
  axes: readonly Segment[];
  curve: FunctionPlotScene;
  roots: readonly Readonly<{ id: string; center: Point; role: "fixed-root" | "moving-root"; radius: number }>[];
  rootLabels: readonly PositionedLabel[];
  accessibleDescription: string;
}>;
export type Card1SparklineScene = Readonly<{
  variant: SparklineVariant;
  graph: SparklineGraphScene | null;
  expression: FactorExpressionScene | null;
}>;

/** Fit required mathematical landmarks, then expand the bounds to keep equal unit scales. */
export const sparklineGraphLayout = (movingRoot: number, size: Size): SparklineGraphScene => {
  const math = createCard1GraphMath(movingRoot);
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 48 || size.height < 48) {
    throw new RangeError("Sparkline graph dimensions must be finite and at least 48 pixels.");
  }
  const factors = card1Factors(math);
  const vertex = card1Vertex(math);
  const plot = { x: 10, y: 10, width: size.width - 20, height: size.height - 20 };
  const xMinimum = Math.min(0, 1, movingRoot);
  const xMaximum = Math.max(0, 1, movingRoot);
  const xPadding = Math.max(0.75, (xMaximum - xMinimum) * 0.2);
  const depth = -vertex.y;
  const requiredX: Bounds = [xMinimum - xPadding, xMaximum + xPadding];
  const requiredY: Bounds = [vertex.y - Math.max(0.5, depth * 0.15), Math.max(1, depth * 0.3)];
  const unitScale = Math.min(plot.width / (requiredX[1] - requiredX[0]), plot.height / (requiredY[1] - requiredY[0]));
  const fitDomain = (required: Bounds, extent: number): Bounds => {
    const middle = (required[0] + required[1]) / 2;
    return [middle - extent / unitScale / 2, middle + extent / unitScale / 2];
  };
  const projection: ProjectionSpec = {
    xDomain: fitDomain(requiredX, plot.width), yDomain: fitDomain(requiredY, plot.height),
    xRange: [plot.x, plot.x + plot.width], yRange: [plot.y + plot.height, plot.y], plot,
  };
  const x = scaleLinear(projection.xDomain, projection.xRange);
  const y = scaleLinear(projection.yDomain, projection.yRange);
  const expression = factorExpressionLayout(factors);
  return immutable({
    size: { ...size }, projection,
    axes: [
      { start: { x: plot.x, y: y(0) }, end: { x: plot.x + plot.width, y: y(0) } },
      { start: { x: x(0), y: plot.y }, end: { x: x(0), y: plot.y + plot.height } },
    ],
    curve: functionPlotLayout(projection, card1Evaluator(math), [1, movingRoot, vertex.x]),
    roots: factors.map((factor, index) => ({
      id: factor.id, center: { x: x(factor.root), y: y(0) },
      role: index === 0 ? "fixed-root" as const : "moving-root" as const,
      radius: index === 0 && movingRoot === 1 ? 4 : 2.5,
    })),
    rootLabels: [...new Set(factors.map((factor) => factor.root))].map((root) => ({
      position: { x: x(root), y: y(0) + 17 }, text: formatNumber(root), anchor: "middle" as const,
    })),
    accessibleDescription: `${expression.accessibleDescription}. Upward-opening quadratic. Roots at x = 1 and x = ${formatNumber(movingRoot)}; vertex at (${formatNumber(vertex.x)}, ${formatNumber(vertex.y)}). Horizontal and vertical units have equal scale.`,
  });
};

export const card1SparklineLayout = (movingRoot: number, size: Size, variant: SparklineVariant): Card1SparklineScene => {
  const math = createCard1Math(movingRoot);
  if (!["complete", "graphics-only", "notation-only"].includes(variant)) throw new RangeError("Unknown sparkline variant.");
  return immutable({
    variant,
    graph: variant === "notation-only" ? null : sparklineGraphLayout(math.movingRoot, size),
    expression: variant === "graphics-only" ? null : factorExpressionLayout(card1Factors(math)),
  });
};
