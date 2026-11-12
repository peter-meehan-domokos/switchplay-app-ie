"use client";

import { useReducer } from "react";
import { useSurfaceActive } from "../../platform/web/SurfaceLifecycle";
import type { RootInputPolicy } from "../../core/interaction/rootInteraction";
import { initialManipulation, manipulationReducer, effectiveMath, type ManipulationAction, type ManipulationState } from "./manipulation";
import RootsFactorsView from "./RootsFactorsView";
import type { Card1Math } from "./model";
import type { RootsFactorsPresentation } from "./presentationLayouts";

/** Reusable manipulation owner. A context change resets input data, never advances a lesson. */
export default function RootsFactorsController({ initialMath, contextKey, presentation, inputPolicy, onExit }: {
  initialMath: Card1Math; contextKey: string; presentation: RootsFactorsPresentation; inputPolicy: RootInputPolicy; onExit?: () => void;
}) {
  const active = useSurfaceActive();
  const policy = { ...inputPolicy, enabled: inputPolicy.enabled && active };
  const [state, dispatch] = useReducer((previous: ManipulationState, action: ManipulationAction) => manipulationReducer(previous, action, policy), initialManipulation(initialMath, contextKey));
  // React's guarded own-component render adjustment preserves the measured view and its DOM IDs.
  // No effect derives maths, and no remount flashes a fallback coordinate system on preview selection.
  if (state.contextKey !== contextKey) dispatch({ type: "reset", contextKey, math: initialMath });
  return <RootsFactorsView math={effectiveMath(state)} presentation={presentation} manipulation={{ state, policy, dispatch }} onExit={onExit} />;
}
