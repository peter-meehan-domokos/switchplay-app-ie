"use client";

import RootsFactorsController from "./RootsFactorsController";
import { initialMath } from "./model";
import { staticDisplayPolicy } from "./rootsFactorsLayout";
import { activityPromptLayout, rootAdjustmentLayout, type RootsFactorsPresentation } from "./presentationLayouts";
import { immutable } from "../../core/immutable";

export type RootsFactorsActivityProps = Readonly<{ onExit?: () => void }>;

const initialPresentation: RootsFactorsPresentation = immutable({
  policy: staticDisplayPolicy,
  prompt: activityPromptLayout({ kind: "orientation" }),
  adjustments: rootAdjustmentLayout(initialMath.movingRoot),
});

/** Root manipulation only. Later checkpoints supply the pedagogical reducer and learning actions. */
export default function RootsFactorsActivity({ onExit }: RootsFactorsActivityProps) {
  return <RootsFactorsController initialMath={initialMath} presentation={initialPresentation} contextKey="orientation" inputPolicy={{ enabled: true, bounds: [0, 5] }} onExit={onExit} />;
}
