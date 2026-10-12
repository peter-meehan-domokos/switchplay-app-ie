import { immutable } from "../immutable";
import { formatFactor, type LinearFactor } from "../math/realFactors";

export type FactorExpressionScene = Readonly<{
  prefix: string;
  factors: readonly Readonly<{ id: string; text: string; role: "fixed-root" | "moving-root" }>[];
  accessibleDescription: string;
}>;

export const factorExpressionLayout = (factors: readonly LinearFactor[], maskedIds: readonly string[] = []): FactorExpressionScene => {
  const groups = factors.map((factor, index) => ({
    id: factor.id, text: maskedIds.includes(factor.id) ? "( ? )" : formatFactor(factor), role: index === 0 ? "fixed-root" as const : "moving-root" as const,
  }));
  return immutable({ prefix: "f(x) =", factors: groups, accessibleDescription: `f of x equals ${groups.map((group) => group.text === "( ? )" ? "a hidden factor" : group.text).join(" times ")}` });
};
