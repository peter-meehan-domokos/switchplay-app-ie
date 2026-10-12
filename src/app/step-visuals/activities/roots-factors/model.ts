import { immutable } from "../../core/immutable";
import { finiteNumber, type LinearFactor } from "../../core/math/realFactors";
import type { Point } from "../../core/graph/types";

export type RootInteger = -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5;
export type Card1Math = Readonly<{ movingRoot: RootInteger }>;
/** Continuous geometry during an edit; settled state still uses Card1Math. */
export type Card1GraphMath = Readonly<{ movingRoot: number }>;
export const initialMath: Card1Math = immutable({ movingRoot: 3 });

export const createCard1Math = (movingRoot: number): Card1Math => {
  const root = finiteNumber(movingRoot);
  if (!Number.isInteger(root) || root < -5 || root > 5) throw new RangeError("Card 1 root must be an integer from −5 to 5.");
  return immutable({ movingRoot: root as RootInteger });
};

export const createCard1GraphMath = (movingRoot: number): Card1GraphMath => {
  const root = finiteNumber(movingRoot);
  if (root < -5 || root > 5) throw new RangeError("Card 1 graphical root must be from −5 to 5.");
  return immutable({ movingRoot: root });
};

export const card1Factors = (math: Card1GraphMath): readonly LinearFactor[] => {
  const { movingRoot } = createCard1GraphMath(math.movingRoot);
  return immutable([{ id: "fixed-root", root: 1 }, { id: "moving-root", root: movingRoot }]);
};

/** Validate once for repeated sampling; no factor-object allocation per sample. */
export const card1Evaluator = (math: Card1GraphMath): ((x: number) => number) => {
  const { movingRoot } = createCard1GraphMath(math.movingRoot);
  return (x) => {
    const input = finiteNumber(x);
    return finiteNumber((input - 1) * (input - movingRoot));
  };
};
export const evaluateCard1 = (math: Card1GraphMath, x: number): number => card1Evaluator(math)(x);

export const card1Vertex = (math: Card1GraphMath): Point => {
  const { movingRoot: r } = createCard1GraphMath(math.movingRoot);
  return immutable({ x: (1 + r) / 2, y: r === 1 ? 0 : -((r - 1) ** 2) / 4 });
};
