import { immutable } from "../../core/immutable";
import type { RootInputPolicy } from "../../core/interaction/rootInteraction";
import { evaluateFactor } from "../../core/math/realFactors";
import { initialMath, retrievalTarget, type RootInteger } from "./model";
import { initialManipulation, manipulationReducer, type ManipulationAction, type ManipulationState } from "./manipulation";

export type PredictionChoice = "minus" | "plus";
export type RetrievalEvidence = Readonly<{ checkAttempts: number; incorrectChecks: number; assistanceViewed: boolean }>;
export type SuccessMode = "independent" | "assisted";
export type RetrievalFeedback = Readonly<{ checkedRoot: RootInteger; attempt: number }>;
export type Lesson =
  | Readonly<{ stage: "orientation" }>
  | Readonly<{ stage: "prediction" }>
  | Readonly<{ stage: "reveal-position" | "reveal-explanation"; prediction: PredictionChoice }>
  | Readonly<{ stage: "retrieval"; prediction: PredictionChoice; panel: "challenge" | "explanation"; evidence: RetrievalEvidence; feedback: RetrievalFeedback | null }>
  | Readonly<{ stage: "completed"; prediction: PredictionChoice; evidence: RetrievalEvidence; successMode: SuccessMode }>;
export type LearningState = Readonly<{ manipulation: ManipulationState; lesson: Lesson }>;
export type LearningAction =
  | Readonly<{ type: "root"; action: ManipulationAction }>
  | Readonly<{ type: "ready" | "continue" | "check" | "explanation" | "start-again"; revision: number }>
  | Readonly<{ type: "predict"; revision: number; choice: PredictionChoice }>
  | Readonly<{ type: "suspend" }>;

const positiveBounds = immutable([0, 5] as const);
const fullBounds = immutable([-5, 5] as const);
export const initialLearning = (): LearningState => immutable({
  manipulation: initialManipulation(initialMath, "guided"), lesson: { stage: "orientation" },
});
export const learningInputPolicy = (lesson: Lesson, active = true): RootInputPolicy => immutable({
  enabled: active && ["orientation", "reveal-position", "retrieval"].includes(lesson.stage),
  bounds: lesson.stage === "orientation" || lesson.stage === "prediction" ? positiveBounds : fullBounds,
});
const transition = (state: LearningState, lesson: Lesson): LearningState => immutable({
  manipulation: { ...state.manipulation, edit: null, revision: state.manipulation.revision + 1 }, lesson,
});

/** One state owner; compose the existing input kernel before inspecting accepted settled placements. */
export const learningReducer = (state: LearningState, action: LearningAction, active = true): LearningState => {
  if (action.type === "suspend") return immutable({ ...state, manipulation: { ...state.manipulation, edit: null, revision: state.manipulation.revision + 1 } });
  if (action.type === "root") {
    // Reset is a preview-controller operation, never an activity/lesson transition.
    if (action.action.type === "reset") return state;
    const manipulation = manipulationReducer(state.manipulation, action.action, learningInputPolicy(state.lesson, active));
    if (manipulation === state.manipulation) return state;
    const next = immutable({ ...state, manipulation });
    if (state.lesson.stage === "reveal-position" &&
        (action.action.type === "commit" || action.action.type === "place") &&
        !manipulation.edit && manipulation.math.movingRoot === -3) {
      return transition(next, { stage: "reveal-explanation", prediction: state.lesson.prediction });
    }
    if (state.lesson.stage === "retrieval" && state.lesson.feedback &&
        (action.action.type === "commit" || action.action.type === "place") &&
        !manipulation.edit && manipulation.math.movingRoot !== state.manipulation.math.movingRoot) {
      return immutable({ ...next, lesson: { ...state.lesson, feedback: null } });
    }
    return next;
  }
  if (!active || action.revision !== state.manipulation.revision || state.manipulation.edit) return state;
  switch (action.type) {
    case "ready": return state.lesson.stage === "orientation" && state.manipulation.hasChangedPlacement
      ? transition(state, { stage: "prediction" }) : state;
    case "predict": return state.lesson.stage === "prediction" && (action.choice === "minus" || action.choice === "plus")
      ? transition(state, { stage: "reveal-position", prediction: action.choice }) : state;
    case "continue": return state.lesson.stage === "reveal-explanation"
      ? transition(state, { stage: "retrieval", prediction: state.lesson.prediction, panel: "challenge", evidence: { checkAttempts: 0, incorrectChecks: 0, assistanceViewed: false }, feedback: null }) : state;
    case "check": {
      if (state.lesson.stage !== "retrieval") return state;
      const root = state.manipulation.math.movingRoot;
      // Assess the target linear factor, not f(root): every movable root zeros f.
      const correct = evaluateFactor(retrievalTarget, root) === 0;
      const evidence = { ...state.lesson.evidence, checkAttempts: state.lesson.evidence.checkAttempts + 1,
        incorrectChecks: state.lesson.evidence.incorrectChecks + (correct ? 0 : 1) };
      return correct
        ? transition(state, { stage: "completed", prediction: state.lesson.prediction, evidence, successMode: evidence.assistanceViewed ? "assisted" : "independent" })
        : transition(state, { ...state.lesson, panel: "challenge", evidence, feedback: { checkedRoot: root, attempt: evidence.checkAttempts } });
    }
    case "explanation": return state.lesson.stage === "retrieval" && state.lesson.panel === "challenge" && state.lesson.evidence.incorrectChecks > 0
      ? transition(state, { ...state.lesson, panel: "explanation", evidence: { ...state.lesson.evidence, assistanceViewed: true } }) : state;
    case "start-again": {
      if (state.lesson.stage !== "completed") return state;
      const fresh = initialLearning();
      // Restart the lesson, not the input clock: old sessions must remain invalid.
      return immutable({ ...fresh, manipulation: { ...fresh.manipulation, revision: state.manipulation.revision + 1, lastSessionId: state.manipulation.lastSessionId } });
    }
  }
};
