import { immutable } from "../../core/immutable";
import { factorExpressionLayout, type FactorExpressionScene } from "../../core/expressions/factorExpressionLayout";
import { graphLayout } from "../../core/graph/graphLayout";
import { coordinatePlaneLayout } from "../../core/graph/coordinatePlaneLayout";
import type { Bounds, CoordinatePlaneScene, GraphScene, MarkerPresentation, Size } from "../../core/graph/types";
import { formatNumber } from "../../core/math/realFactors";
import { card1Factors, card1Vertex, card1Evaluator, createCard1Math, type Card1GraphMath, type RootInteger } from "./model";
import { snapRoot, type RootInputPolicy } from "../../core/interaction/rootInteraction";

export const card1Domains: Readonly<{ x: Bounds; y: Bounds }> = immutable({ x: [-6, 6], y: [-10, 10] });
export type RootsFactorsScene = Readonly<{ expression: FactorExpressionScene; graph: GraphScene; graphicalRoot: number; displayRoot: RootInteger; expressionIsRounded: boolean }>;
export type RootsFactorsDisplayPolicy = Readonly<{ maskMovingFactor: boolean; markerPresentation: MarkerPresentation }>;
export const staticDisplayPolicy: RootsFactorsDisplayPolicy = immutable({ maskMovingFactor: false, markerPresentation: "orientation" });
export const rootsFactorsPlaneLayout = (size: Size): CoordinatePlaneScene => coordinatePlaneLayout(size, card1Domains.x, card1Domains.y);

/** Static checkpoint composition. Named explicitly to avoid Next's reserved layout.ts convention. */
export const rootsFactorsLayout = (math: Card1GraphMath, size: Size, policy: RootsFactorsDisplayPolicy = staticDisplayPolicy, inputPolicy?: RootInputPolicy, plane?: CoordinatePlaneScene): RootsFactorsScene => {
  const factors = card1Factors(math);
  const vertex = card1Vertex(math);
  const displayRoot = createCard1Math(snapRoot(math.movingRoot, [-5, 5])!).movingRoot;
  const expressionIsRounded = displayRoot !== math.movingRoot;
  const expression = factorExpressionLayout(card1Factors({ movingRoot: displayRoot }), policy.maskMovingFactor ? ["moving-root"] : []);
  return immutable({
    expression, graphicalRoot: math.movingRoot, displayRoot, expressionIsRounded,
    graph: graphLayout({
      size, plane, xDomain: card1Domains.x, yDomain: card1Domains.y,
      evaluate: card1Evaluator(math), displayRoots: { "moving-root": displayRoot },
      landmarks: [...factors.map((factor) => factor.root), vertex.x], factors, markerPresentation: policy.markerPresentation, inputPolicy,
      accessibleDescription: `${expression.accessibleDescription}. Upward-opening quadratic. Fixed root at x = 1; movable root ${expressionIsRounded ? "label" : "at"} x = ${formatNumber(displayRoot)}. ${expressionIsRounded ? "The curve follows the continuous drag position; root labels and factor notation are rounded." : `Vertex at (${formatNumber(vertex.x)}, ${formatNumber(vertex.y)}).`} Horizontal domain −6 to 6; vertical domain −10 to 10. ${inputPolicy?.enabled ? "Drag the movable root or use its arrow keys, Home and End." : "Root adjustment is locked."}`,
    }),
  });
};
