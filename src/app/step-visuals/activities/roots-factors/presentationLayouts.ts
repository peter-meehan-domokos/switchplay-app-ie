import { immutable } from "../../core/immutable";
import { evaluateFactor, formatFactor, formatNumber, type LinearFactor } from "../../core/math/realFactors";
import type { RootsFactorsDisplayPolicy } from "./rootsFactorsLayout";
import type { Bounds } from "../../core/graph/types";
import type { Lesson } from "./learning";

export type PresentationAction = Readonly<{ id: string; label: string; enabled: boolean; appearance: "primary" | "secondary" }>;
export type ComparisonRow = Readonly<{ label: string; factor: string; substitution: string }>;
export type ActivityPromptScene = Readonly<{
  title: string; instruction: string; target: string | null;
  comparison: readonly ComparisonRow[]; working: readonly string[];
  feedback: string | null; actions: readonly PresentationAction[];
  navigation: PresentationAction | null;
}>;
export type PromptInput =
  | Readonly<{ kind: "orientation" }>
  | Readonly<{ kind: "prediction" }>
  | Readonly<{ kind: "reveal-position"; predicted: LinearFactor }>
  | Readonly<{ kind: "correct-reveal"; root: number; actual: LinearFactor }>
  | Readonly<{ kind: "retrieval-entry"; target: LinearFactor }>
  | Readonly<{ kind: "incorrect-reveal"; root: number; predicted: LinearFactor; actual: LinearFactor }>
  | Readonly<{ kind: "retrieval"; target: LinearFactor; incorrectFeedback: boolean }>
  | Readonly<{ kind: "assistance"; target: LinearFactor }>;

const action = (id: string, label: string, appearance: "primary" | "secondary" = "primary"): PresentationAction =>
  ({ id, label, appearance, enabled: false });

/** Default inactive for lab fixtures; real controllers supply explicit permitted action IDs. */
export const activityPromptLayout = (input: PromptInput, enabledActions: readonly string[] = []): ActivityPromptScene => {
  const base = { target: null, comparison: [], working: [], feedback: null, navigation: null };
  const permittedAction = (id: string, label: string, appearance: "primary" | "secondary" = "primary") => ({ ...action(id, label, appearance), enabled: enabledActions.includes(id) });
  switch (input.kind) {
    case "orientation": return immutable({ ...base, title: "Explore", instruction: "Drag the green root and see how the graph and factor change.", actions: [], navigation: permittedAction("ready", "Next", "secondary") });
    case "prediction": return immutable({ ...base, title: "Predict", instruction: "If the movable root becomes x = −3, which factor will it produce?", actions: [permittedAction("predict-minus", "(x − 3)"), permittedAction("predict-plus", "(x + 3)")] });
    case "reveal-position": return immutable({ ...base, title: "Test", instruction: "Move the root to x = −3 to test your prediction.", comparison: [{ label: "Your prediction", factor: formatFactor(input.predicted), substitution: "" }], actions: [] });
    case "correct-reveal": return immutable({ ...base, title: "Explain", instruction: "Your prediction matches. At a root, its corresponding linear factor must equal zero.", comparison: [{ label: "Your matching choice", factor: formatFactor(input.actual), substitution: `${formatNumber(input.root)} + ${formatNumber(Math.abs(input.actual.root))} = ${formatNumber(evaluateFactor(input.actual, input.root))}` }], actions: [], navigation: permittedAction("continue", "Continue", "secondary") });
    case "retrieval-entry": return immutable({ ...base, title: "Try", instruction: "Find the root for this factor.", target: formatFactor(input.target), actions: [] });
    case "incorrect-reveal": {
      const row = (label: string, factor: LinearFactor): ComparisonRow => ({
        label, factor: formatFactor(factor),
        substitution: `${formatNumber(input.root)} ${factor.root < 0 ? "+" : "−"} ${formatNumber(Math.abs(factor.root))} = ${formatNumber(evaluateFactor(factor, input.root))}`,
      });
      return immutable({ ...base, title: "Explain", instruction: "At a root, its corresponding linear factor must equal zero.", comparison: [row("Your choice", input.predicted), row("Matching factor", input.actual)], actions: [], navigation: permittedAction("continue", "Continue", "secondary") });
    }
    case "retrieval": return immutable({ ...base, title: "Try", instruction: "Place the root for this factor, then press Check.", target: formatFactor(input.target), feedback: input.incorrectFeedback ? "Not yet. Try another position." : null, actions: [action("check", "Check"), ...(input.incorrectFeedback ? [action("explanation", "Show explanation", "secondary")] : [])] });
    case "assistance": return immutable({ ...base, title: "Explain", instruction: "The factor must equal zero. Try again at your current position when you are ready.", working: [`${formatFactor(input.target)} = 0`, `x = ${formatNumber(input.target.root)}`, `${formatNumber(input.target.root)} + ${formatNumber(Math.abs(input.target.root))} = 0`], actions: [], navigation: action("try-again", "Try again", "secondary") });
  }
};

export type RootAdjustmentScene = Readonly<{ positionText: string; actions: readonly PresentationAction[] }>;
export type RootsFactorsPresentation = Readonly<{ policy: RootsFactorsDisplayPolicy; prompt: ActivityPromptScene }>;
export const rootAdjustmentLayout = (root: number, enabled = false, bounds: Bounds = [-5, 5]): RootAdjustmentScene => immutable({
  positionText: `x = ${formatNumber(root)}`,
  actions: [{ ...action("root-left", "Move root left", "secondary"), enabled: enabled && root > bounds[0] }, { ...action("root-right", "Move root right", "secondary"), enabled: enabled && root < bounds[1] }],
});
export const activityNavigationSizingLayout = (): PresentationAction => immutable(action("navigation-sizer", "00000000", "secondary"));

/** Shared normal-content sizing samples, not a lesson state machine or lab fixture dependency. */
export const normalPromptScenes: readonly ActivityPromptScene[] = immutable([
  activityPromptLayout({ kind: "orientation" }), activityPromptLayout({ kind: "prediction" }),
  activityPromptLayout({ kind: "incorrect-reveal", root: -3, predicted: { id: "prediction", root: 3 }, actual: { id: "actual", root: -3 } }),
  activityPromptLayout({ kind: "retrieval", target: { id: "target", root: -4 }, incorrectFeedback: true }),
  activityPromptLayout({ kind: "assistance", target: { id: "target", root: -4 } }),
]);

// Preserve digit widths in inaccessible sizing content without retaining answer-bearing factors.
const sizingText = (text: string) => text.replace(/\S/g, "0");
export const promptSizingScenes: readonly ActivityPromptScene[] = immutable(normalPromptScenes.map((scene) => ({
  ...scene, title: sizingText(scene.title), instruction: sizingText(scene.instruction), target: scene.target ? sizingText(scene.target) : null,
  feedback: scene.feedback ? sizingText(scene.feedback) : null,
  comparison: scene.comparison.map((row) => ({ label: sizingText(row.label), factor: sizingText(row.factor), substitution: sizingText(row.substitution) })),
  working: scene.working.map(sizingText), actions: scene.actions.map((item) => ({ ...item, label: sizingText(item.label) })),
  navigation: scene.navigation ? { ...scene.navigation, label: sizingText(scene.navigation.label) } : null,
})));

/** Card 1 learning policy only; no input ownership, rendering or lab navigation. */
export const guidedPresentation = (lesson: Lesson, eligible: boolean, editing: boolean, active: boolean): RootsFactorsPresentation => {
  const enabled = active && !editing;
  const stage = lesson.stage;
  let input: PromptInput;
  let enabledActions: string[] = [];
  if (stage === "orientation") { input = { kind: "orientation" }; if (enabled && eligible) enabledActions = ["ready"]; }
  else if (stage === "prediction") { input = { kind: "prediction" }; if (enabled) enabledActions = ["predict-minus", "predict-plus"]; }
  else if (stage === "retrieval-entry") input = { kind: "retrieval-entry", target: { id: "target", root: -4 } };
  else {
    const predicted = { id: "prediction", root: lesson.prediction === "minus" ? 3 : -3 };
    const actual = { id: "actual", root: -3 };
    input = stage === "reveal-position" ? { kind: "reveal-position", predicted }
      : lesson.prediction === "plus" ? { kind: "correct-reveal", root: -3, actual }
      : { kind: "incorrect-reveal", root: -3, predicted, actual };
    if (stage === "reveal-explanation" && enabled) enabledActions = ["continue"];
  }
  const adjustable = ["orientation", "reveal-position", "retrieval-entry"].includes(stage);
  return immutable({
    policy: { maskMovingFactor: stage !== "orientation" && stage !== "reveal-explanation", markerPresentation: stage === "orientation" ? "orientation" : adjustable ? "available" : "locked" },
    prompt: activityPromptLayout(input, enabledActions),
  });
};
