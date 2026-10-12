import { immutable } from "../../core/immutable";
import { factorExpressionLayout, type FactorExpressionScene } from "../../core/expressions/factorExpressionLayout";
import { graphLayout } from "../../core/graph/graphLayout";
import type { Bounds, GraphScene, MarkerPresentation, Size } from "../../core/graph/types";
import { formatNumber } from "../../core/math/realFactors";
import { card1Factors, card1Vertex, evaluateCard1, type Card1Math } from "./model";

export const card1Domains: Readonly<{ x: Bounds; y: Bounds }> = immutable({ x: [-6, 6], y: [-10, 10] });
export type RootsFactorsScene = Readonly<{ expression: FactorExpressionScene; graph: GraphScene }>;
export type RootsFactorsDisplayPolicy = Readonly<{ maskMovingFactor: boolean; markerPresentation: MarkerPresentation }>;
export const staticDisplayPolicy: RootsFactorsDisplayPolicy = immutable({ maskMovingFactor: false, markerPresentation: "orientation" });

/** Static checkpoint composition. Named explicitly to avoid Next's reserved layout.ts convention. */
export const rootsFactorsLayout = (math: Card1Math, size: Size, policy: RootsFactorsDisplayPolicy = staticDisplayPolicy): RootsFactorsScene => {
  const factors = card1Factors(math);
  const vertex = card1Vertex(math);
  const expression = factorExpressionLayout(factors, policy.maskMovingFactor ? ["moving-root"] : []);
  return immutable({
    expression,
    graph: graphLayout({
      size, xDomain: card1Domains.x, yDomain: card1Domains.y,
      evaluate: (x) => evaluateCard1(math, x),
      landmarks: [...factors.map((factor) => factor.root), vertex.x], factors, markerPresentation: policy.markerPresentation,
      accessibleDescription: `${expression.accessibleDescription}. Upward-opening quadratic. Fixed root at x = 1; movable root at x = ${formatNumber(math.movingRoot)}. Vertex at (${formatNumber(vertex.x)}, ${formatNumber(vertex.y)}). Horizontal domain −6 to 6; vertical domain −10 to 10. Static preview; root adjustment is not yet available.`,
    }),
  });
};
