import { immutable } from "../../core/immutable";
import type { RootInputPolicy } from "../../core/interaction/rootInteraction";
import { initialMath } from "./model";
import { initialManipulation, manipulationReducer, type ManipulationAction, type ManipulationState } from "./manipulation";

export type PredictionChoice = "minus" | "plus";
export type Lesson =
  | Readonly<{ stage: "orientation" }>
  | Readonly<{ stage: "prediction" }>
  | Readonly<{ stage: "reveal-position" | "reveal-explanation" | "retrieval-entry"; prediction: PredictionChoice }>;
export type LearningState = Readonly<{ manipulation: ManipulationState; lesson: Lesson }>;
export type LearningAction =
  | Readonly<{ type: "root"; action: ManipulationAction }>
  | Readonly<{ type: "ready" | "continue"; revision: number }>
  | Readonly<{ type: "predict"; revision: number; choice: PredictionChoice }>
  | Readonly<{ type: "suspend" }>;

const positiveBounds = immutable([0, 5] as const);
const fullBounds = immutable([-5, 5] as const);
export const initialLearning = (): LearningState => immutable({
  manipulation: initialManipulation(initialMath, "guided"), lesson: { stage: "orientation" },
});
export const learningInputPolicy = (lesson: Lesson, active = true): RootInputPolicy => immutable({
  enabled: active && ["orientation", "reveal-position", "retrieval-entry"].includes(lesson.stage),
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
    return next;
  }
  if (!active || action.revision !== state.manipulation.revision || state.manipulation.edit) return state;
  switch (action.type) {
    case "ready": return state.lesson.stage === "orientation" && state.manipulation.hasChangedPlacement
      ? transition(state, { stage: "prediction" }) : state;
    case "predict": return state.lesson.stage === "prediction" && (action.choice === "minus" || action.choice === "plus")
      ? transition(state, { stage: "reveal-position", prediction: action.choice }) : state;
    case "continue": return state.lesson.stage === "reveal-explanation"
      ? transition(state, { stage: "retrieval-entry", prediction: state.lesson.prediction }) : state;
  }
};
