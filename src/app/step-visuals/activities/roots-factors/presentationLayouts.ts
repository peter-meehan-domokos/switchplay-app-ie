import { immutable } from "../../core/immutable";
import { evaluateFactor, formatFactor, formatNumber, type LinearFactor } from "../../core/math/realFactors";
import type { RootsFactorsDisplayPolicy } from "./rootsFactorsLayout";
import type { Bounds } from "../../core/graph/types";
import type { Lesson } from "./learning";
import { retrievalTarget } from "./model";
import { rootTaskLayout, type RootTaskScene } from "../../core/expressions/rootTaskLayout";

export type PresentationAction = Readonly<{ id: string; label: string; enabled: boolean; appearance: "primary" | "secondary"; directionCue?: boolean; unavailableReason?: string }>;
export type ComparisonRow = Readonly<{ label: string; factor: string; substitution: string }>;
export type ActivityPromptScene = Readonly<{
  title: string; instruction: string; target: string | null;
  comparison: readonly ComparisonRow[]; working: readonly string[];
  feedback: string | null; actions: readonly PresentationAction[];
  navigation: PresentationAction | null;
  announcement: Readonly<{ id: string; text: string }> | null;
  summary: readonly string[];
}>;
export type PromptInput =
  | Readonly<{ kind: "orientation" }>
  | Readonly<{ kind: "prediction" }>
  | Readonly<{ kind: "reveal-position"; predicted: LinearFactor }>
  | Readonly<{ kind: "correct-reveal"; root: number; actual: LinearFactor }>
  | Readonly<{ kind: "incorrect-reveal"; root: number; predicted: LinearFactor; actual: LinearFactor }>
  | Readonly<{ kind: "retrieval"; target: LinearFactor; incorrectFeedback: boolean; helpAvailable?: boolean; feedbackAttempt?: number }>
  | Readonly<{ kind: "assistance" | "completed"; target: LinearFactor }>;

const action = (id: string, label: string, appearance: "primary" | "secondary" = "primary"): PresentationAction =>
  ({ id, label, appearance, enabled: false });

/** Default inactive for lab fixtures; real controllers supply explicit permitted action IDs. */
export const activityPromptLayout = (input: PromptInput, enabledActions: readonly string[] = []): ActivityPromptScene => {
  const base = { target: null, comparison: [], working: [], feedback: null, navigation: null, announcement: null, summary: [] };
  const permittedAction = (id: string, label: string, appearance: "primary" | "secondary" = "primary") => ({ ...action(id, label, appearance), enabled: enabledActions.includes(id) });
  switch (input.kind) {
    case "orientation": return immutable({ ...base, title: "Explore", instruction: "Drag the green root between 0 and 5 and see how the graph and factor change.", actions: [], navigation: permittedAction("ready", "Next", "secondary") });
    case "prediction": return immutable({ ...base, title: "Predict", instruction: "If the green root moves to x = −3, which factor will it give? Choose one.", actions: [permittedAction("predict-minus", "(x − 3)"), permittedAction("predict-plus", "(x + 3)")] });
    case "reveal-position": return immutable({ ...base, title: "Test", instruction: "Drag the green root to x = −3 to test your prediction.", comparison: [{ label: "Your prediction", factor: formatFactor(input.predicted), substitution: "" }], actions: [] });
    case "correct-reveal": return immutable({ ...base, title: "Explain", instruction: "You chose the correct factor. The factor equals zero at the root.", comparison: [{ label: "Your choice", factor: formatFactor(input.actual), substitution: `${formatNumber(input.root)} + ${formatNumber(Math.abs(input.actual.root))} = ${formatNumber(evaluateFactor(input.actual, input.root))}` }], actions: [], navigation: permittedAction("continue", "Next", "secondary") });
    case "incorrect-reveal": {
      const row = (label: string, factor: LinearFactor): ComparisonRow => ({
        label, factor: formatFactor(factor),
        substitution: `${formatNumber(input.root)} ${factor.root < 0 ? "+" : "−"} ${formatNumber(Math.abs(factor.root))} = ${formatNumber(evaluateFactor(factor, input.root))}`,
      });
      return immutable({ ...base, title: "Explain", instruction: "The factor equals zero at the root.", comparison: [row("Your choice", input.predicted), row("Correct factor", input.actual)], actions: [], navigation: permittedAction("continue", "Next", "secondary") });
    }
    case "retrieval": return immutable({ ...base, title: "Try", instruction: `Drag the green root to the correct position for ${formatFactor(input.target)}.`, feedback: input.incorrectFeedback ? "Not quite. Move the green root and try again." : null,
      actions: (input.helpAvailable ?? input.incorrectFeedback) ? [permittedAction("explanation", "Show explanation", "secondary")] : [],
      navigation: { ...permittedAction("check", "Check", "secondary"), directionCue: false },
      announcement: input.incorrectFeedback && input.feedbackAttempt !== undefined ? { id: `retrieval-check-${input.feedbackAttempt}`, text: "Not quite. Move the green root and try again. Show explanation is available." } : null });
    case "assistance": return immutable({ ...base, title: "Explain", instruction: `Drag the green root to x = ${formatNumber(input.target.root)}, then press Check.`, working: [`${formatFactor(input.target)} = 0`, `x = ${formatNumber(input.target.root)}`], actions: [], navigation: { ...permittedAction("check", "Check", "secondary"), directionCue: false } });
    case "completed": return immutable({ ...base, title: "Finished", summary: ["You found the correct root!", `The factor is ${formatFactor(input.target)}, so the root is x = ${formatNumber(input.target.root)}.`], instruction: "The factor equals zero at the root.", working: [`${formatNumber(input.target.root)} + ${formatNumber(Math.abs(input.target.root))} = ${formatNumber(evaluateFactor(input.target, input.target.root))}`], actions: [], navigation: { ...permittedAction("start-again", "Start again", "secondary"), directionCue: false } });
  }
};

export type RootAdjustmentScene = Readonly<{ positionText: string; actions: readonly PresentationAction[] }>;
export type RootsFactorsPresentation = Readonly<{ policy: RootsFactorsDisplayPolicy; prompt: ActivityPromptScene; task?: RootTaskScene }>;
export const rootAdjustmentLayout = (root: number, enabled = false, bounds: Bounds = [-5, 5]): RootAdjustmentScene => immutable({
  positionText: `x = ${formatNumber(root)}`,
  actions: [{ ...action("root-left", "Move root left", "secondary"), enabled: enabled && root > bounds[0] }, { ...action("root-right", "Move root right", "secondary"), enabled: enabled && root < bounds[1] }],
});
export const activityNavigationSizingLayout = (): PresentationAction => immutable(action("navigation-sizer", "00000000", "secondary"));

/** Shared normal-content sizing samples, not a lesson state machine or lab fixture dependency. */
export const normalPromptScenes: readonly ActivityPromptScene[] = immutable([
  activityPromptLayout({ kind: "orientation" }), activityPromptLayout({ kind: "prediction" }),
  activityPromptLayout({ kind: "incorrect-reveal", root: -3, predicted: { id: "prediction", root: 3 }, actual: { id: "actual", root: -3 } }),
  activityPromptLayout({ kind: "retrieval", target: retrievalTarget, incorrectFeedback: true }),
  activityPromptLayout({ kind: "assistance", target: retrievalTarget }),
  activityPromptLayout({ kind: "completed", target: retrievalTarget }),
]);

// Preserve digit widths in inaccessible sizing content without retaining answer-bearing factors.
const sizingText = (text: string) => text.replace(/\S/g, "0");
export const promptSizingScenes: readonly ActivityPromptScene[] = immutable(normalPromptScenes.map((scene) => ({
  ...scene, title: sizingText(scene.title), instruction: sizingText(scene.instruction), target: scene.target ? sizingText(scene.target) : null,
  feedback: scene.feedback ? sizingText(scene.feedback) : null,
  comparison: scene.comparison.map((row) => ({ label: sizingText(row.label), factor: sizingText(row.factor), substitution: sizingText(row.substitution) })),
  working: scene.working.map(sizingText), actions: scene.actions.map((item) => ({ ...item, label: sizingText(item.label) })),
  summary: scene.summary.map(sizingText),
  navigation: scene.navigation ? { ...scene.navigation, label: sizingText(scene.navigation.label) } : null,
  announcement: null,
})));

/** Card 1 learning policy only; no input ownership, rendering or lab navigation. */
export const guidedPresentation = (lesson: Lesson, eligible: boolean, editing: boolean, active: boolean): RootsFactorsPresentation => {
  const enabled = active && !editing;
  const stage = lesson.stage;
  let input: PromptInput;
  let enabledActions: string[] = [];
  if (stage === "orientation") { input = { kind: "orientation" }; if (enabled && eligible) enabledActions = ["ready"]; }
  else if (stage === "prediction") { input = { kind: "prediction" }; if (enabled) enabledActions = ["predict-minus", "predict-plus"]; }
  else if (lesson.stage === "retrieval") {
    input = lesson.panel === "explanation" ? { kind: "assistance", target: retrievalTarget }
      : { kind: "retrieval", target: retrievalTarget, incorrectFeedback: lesson.feedback !== null, helpAvailable: lesson.evidence.incorrectChecks > 0, feedbackAttempt: lesson.feedback?.attempt };
    if (enabled) enabledActions = ["check", ...(lesson.panel === "challenge" && lesson.evidence.incorrectChecks > 0 ? ["explanation"] : [])];
  }
  else if (stage === "completed") { input = { kind: "completed", target: retrievalTarget }; if (enabled) enabledActions = ["start-again"]; }
  else {
    const predicted = { id: "prediction", root: lesson.prediction === "minus" ? 3 : -3 };
    const actual = { id: "actual", root: -3 };
    input = stage === "reveal-position" ? { kind: "reveal-position", predicted }
      : lesson.prediction === "plus" ? { kind: "correct-reveal", root: -3, actual }
      : { kind: "incorrect-reveal", root: -3, predicted, actual };
    if (stage === "reveal-explanation" && enabled) enabledActions = ["continue"];
  }
  const adjustable = ["orientation", "reveal-position", "retrieval"].includes(stage);
  const prompt = activityPromptLayout(input, enabledActions);
  return immutable({
    policy: { maskMovingFactor: !["orientation", "reveal-explanation", "completed"].includes(stage), markerPresentation: stage === "orientation" ? "orientation" : adjustable ? "available" : "locked" },
    prompt: stage === "orientation" && !eligible && enabled ? { ...prompt, navigation: { ...prompt.navigation!, unavailableReason: "Drag the green root to a new position first." } } : prompt,
    ...(stage === "retrieval" ? { task: rootTaskLayout(retrievalTarget) } : {}),
  });
};
