"use client";

import RootsFactorsView from "./RootsFactorsView";
import { initialLearning, learningInputPolicy } from "./learning";
import { guidedPresentation } from "./presentationLayouts";

const initial = initialLearning();
const presentation = guidedPresentation(initial.lesson, false, false, false);
const policy = learningInputPolicy(initial.lesson, false);
const inertInput = () => {};
/** Tooling-only render of the initial view. No attempt constructor, records or persistence. */
export default function RootsInitialPreview() {
  return <RootsFactorsView math={initial.manipulation.math} presentation={presentation}
    manipulation={{ state: initial.manipulation, policy, dispatch: inertInput }} stageKey="orientation" />;
}
