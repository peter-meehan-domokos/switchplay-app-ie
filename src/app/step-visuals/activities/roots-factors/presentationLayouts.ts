import { immutable } from "../../core/immutable";
import { evaluateFactor, formatFactor, formatNumber, type LinearFactor } from "../../core/math/realFactors";
import type { RootsFactorsDisplayPolicy } from "./rootsFactorsLayout";

export type PresentationAction = Readonly<{ id: string; label: string; enabled: boolean; appearance: "primary" | "secondary" }>;
export type ComparisonRow = Readonly<{ label: string; factor: string; substitution: string }>;
export type ActivityPromptScene = Readonly<{
  title: string; instruction: string; target: string | null;
  comparison: readonly ComparisonRow[]; working: readonly string[];
  feedback: string | null; actions: readonly PresentationAction[];
}>;
export type PromptInput =
  | Readonly<{ kind: "orientation" }>
  | Readonly<{ kind: "prediction" }>
  | Readonly<{ kind: "incorrect-reveal"; root: number; predicted: LinearFactor; actual: LinearFactor }>
  | Readonly<{ kind: "retrieval"; target: LinearFactor; incorrectFeedback: boolean }>
  | Readonly<{ kind: "assistance"; target: LinearFactor }>;

const action = (id: string, label: string, appearance: "primary" | "secondary" = "primary"): PresentationAction =>
  ({ id, label, appearance, enabled: false });

/** Prepare authored presentation, not a lesson reducer or answer assessor. Actions stay inactive. */
export const activityPromptLayout = (input: PromptInput): ActivityPromptScene => {
  const base = { target: null, comparison: [], working: [], feedback: null };
  switch (input.kind) {
    case "orientation": return immutable({ ...base, title: "Explore the roots", instruction: "Move the root from 0 to 5. Watch its factor change.", actions: [action("ready", "Ready to predict")] });
    case "prediction": return immutable({ ...base, title: "Make a prediction", instruction: "What factor will match a root at x = −3? The root is locked while you choose.", actions: [action("predict-minus", "(x − 3)"), action("predict-plus", "(x + 3)")] });
    case "incorrect-reveal": {
      const row = (label: string, factor: LinearFactor): ComparisonRow => ({
        label, factor: formatFactor(factor),
        substitution: `${formatNumber(input.root)} ${factor.root < 0 ? "+" : "−"} ${formatNumber(Math.abs(factor.root))} = ${formatNumber(evaluateFactor(factor, input.root))}`,
      });
      return immutable({ ...base, title: "Compare your prediction", instruction: "At a root, its matching factor must equal zero.", comparison: [row("Your choice", input.predicted), row("Matching factor", input.actual)], actions: [action("continue", "Continue")] });
    }
    case "retrieval": return immutable({ ...base, title: "Find the root", instruction: "Place the root for this factor, then press Check.", target: formatFactor(input.target), feedback: input.incorrectFeedback ? "Not yet. Try another position." : null, actions: [action("check", "Check"), ...(input.incorrectFeedback ? [action("explanation", "Show explanation", "secondary")] : [])] });
    case "assistance": return immutable({ ...base, title: "Why this root?", instruction: "The factor must equal zero. Try again at your current position when you are ready.", working: [`${formatFactor(input.target)} = 0`, `x = ${formatNumber(input.target.root)}`, `${formatNumber(input.target.root)} + ${formatNumber(Math.abs(input.target.root))} = 0`], actions: [action("try-again", "Try again")] });
  }
};

export type RootAdjustmentScene = Readonly<{ positionText: string; actions: readonly PresentationAction[] }>;
export type RootsFactorsPresentation = Readonly<{ policy: RootsFactorsDisplayPolicy; prompt: ActivityPromptScene; adjustments: RootAdjustmentScene | null }>;
export const rootAdjustmentLayout = (root: number): RootAdjustmentScene => immutable({
  positionText: `x = ${formatNumber(root)}`,
  actions: [action("root-left", "Move root left", "secondary"), action("root-right", "Move root right", "secondary")],
});
