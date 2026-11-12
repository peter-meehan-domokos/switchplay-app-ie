import { immutable } from "../../core/immutable";
import { snapRoot, type RootInputPolicy } from "../../core/interaction/rootInteraction";
import { createCard1Math, createCard1GraphMath, type Card1Math, type Card1GraphMath } from "./model";

export type RootEdit = Readonly<{ sessionId: number; candidateRoot: number }>;
export type ManipulationState = Readonly<{
  contextKey: string; revision: number; lastSessionId: number;
  math: Card1Math; edit: RootEdit | null; hasChangedPlacement: boolean;
}>;
export type ManipulationAction =
  | Readonly<{ type: "reset"; contextKey: string; math: Card1Math }>
  | Readonly<{ type: "start"; revision: number; sessionId: number }>
  | Readonly<{ type: "preview" | "commit"; revision: number; sessionId: number; root: number }>
  | Readonly<{ type: "cancel"; revision: number; sessionId: number }>
  | Readonly<{ type: "place"; revision: number; root: number }>;

export const initialManipulation = (math: Card1Math, contextKey: string): ManipulationState => immutable({
  contextKey, revision: 0, lastSessionId: 0, math: createCard1Math(math.movingRoot), edit: null, hasChangedPlacement: false,
});
export const effectiveMath = (state: ManipulationState): Card1GraphMath => state.edit ? createCard1GraphMath(state.edit.candidateRoot) : state.math;
const validRoot = (root: number, policy: RootInputPolicy): boolean =>
  Number.isFinite(root) && root >= -5 && root <= 5 && root >= policy.bounds[0] && root <= policy.bounds[1];

/** Root transactions only. No prediction, retrieval, navigation or completion transitions. */
export const manipulationReducer = (state: ManipulationState, action: ManipulationAction, policy: RootInputPolicy): ManipulationState => {
  if (action.type === "reset") return immutable({ ...initialManipulation(action.math, action.contextKey), revision: state.revision + 1, lastSessionId: state.lastSessionId });
  if (action.revision !== state.revision) return state;
  if (action.type === "cancel") return state.edit?.sessionId === action.sessionId ? immutable({ ...state, edit: null }) : state;
  if (!policy.enabled) return state;
  switch (action.type) {
    case "start":
      return !state.edit && Number.isSafeInteger(action.sessionId) && action.sessionId > state.lastSessionId
        ? immutable({ ...state, lastSessionId: action.sessionId, edit: { sessionId: action.sessionId, candidateRoot: state.math.movingRoot } }) : state;
    case "preview":
      return state.edit?.sessionId === action.sessionId && validRoot(action.root, policy)
        ? immutable({ ...state, edit: { sessionId: action.sessionId, candidateRoot: action.root } }) : state;
    case "commit": {
      if (state.edit?.sessionId !== action.sessionId || !validRoot(action.root, policy)) return state;
      const root = snapRoot(action.root, policy.bounds);
      return root === null ? state : immutable({ ...state, math: createCard1Math(root), edit: null, hasChangedPlacement: state.hasChangedPlacement || root !== state.math.movingRoot });
    }
    case "place":
      return !state.edit && Number.isInteger(action.root) && validRoot(action.root, policy)
        ? immutable({ ...state, math: createCard1Math(action.root), hasChangedPlacement: state.hasChangedPlacement || action.root !== state.math.movingRoot }) : state;
  }
};
