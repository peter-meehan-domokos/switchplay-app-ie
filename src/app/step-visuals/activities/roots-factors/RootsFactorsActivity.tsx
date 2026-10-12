"use client";

import RootsFactorsView from "./RootsFactorsView";
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

/** Static checkpoint entry. Later checkpoints supply real activity state and semantic dispatch. */
export default function RootsFactorsActivity({ onExit }: RootsFactorsActivityProps) {
  return <RootsFactorsView math={initialMath} presentation={initialPresentation} onExit={onExit} />;
}
