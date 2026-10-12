import { immutable } from "../../core/immutable";
import { evaluateFactor, finiteNumber, type LinearFactor } from "../../core/math/realFactors";
import type { Point } from "../../core/graph/types";

export type RootInteger = -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5;
export type Card1Math = Readonly<{ movingRoot: RootInteger }>;
export const initialMath: Card1Math = immutable({ movingRoot: 3 });

export const createCard1Math = (movingRoot: number): Card1Math => {
  const root = finiteNumber(movingRoot);
  if (!Number.isInteger(root) || root < -5 || root > 5) throw new RangeError("Card 1 root must be an integer from −5 to 5.");
  return immutable({ movingRoot: root as RootInteger });
};

export const card1Factors = (math: Card1Math): readonly LinearFactor[] => {
  const { movingRoot } = createCard1Math(math.movingRoot);
  return immutable([{ id: "fixed-root", root: 1 }, { id: "moving-root", root: movingRoot }]);
};

export const evaluateCard1 = (math: Card1Math, x: number): number => {
  const factors = card1Factors(math);
  return finiteNumber(evaluateFactor(factors[0], x) * evaluateFactor(factors[1], x));
};

export const card1Vertex = (math: Card1Math): Point => {
  const { movingRoot: r } = createCard1Math(math.movingRoot);
  return immutable({ x: (1 + r) / 2, y: r === 1 ? 0 : -((r - 1) ** 2) / 4 });
};
