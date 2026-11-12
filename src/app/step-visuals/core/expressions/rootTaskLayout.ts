import { immutable } from "../immutable";
import { formatFactor, type LinearFactor } from "../math/realFactors";

/** A given factor and an unknown root, never an equation for the current curve. */
export type RootTaskScene = Readonly<{ label: string; factor: string; question: string; accessibleDescription: string }>;
export const rootTaskLayout = (target: LinearFactor): RootTaskScene => immutable({
  label: "Factor:", factor: formatFactor(target), question: "Root = ?", accessibleDescription: `Factor: ${formatFactor(target)}. Root = ?`,
});
export const rootTaskSizingLayout = (): RootTaskScene => immutable({ label: "0000000", factor: "0000000", question: "0000 0 0", accessibleDescription: "" });
