import { immutable } from "../core/immutable";
import { createCard1Math, initialMath } from "../activities/roots-factors/model";
import { activityPromptLayout, rootAdjustmentLayout, type RootsFactorsPresentation } from "../activities/roots-factors/presentationLayouts";
import type { Card1Math } from "../activities/roots-factors/model";
import type { RootInputPolicy } from "../core/interaction/rootInteraction";

export type LayoutPreviewMode = "orientation" | "prediction" | "incorrect-reveal" | "retrieval" | "assistance";
export const layoutPreviewOptions = immutable([
  { id: "orientation", label: "A · Explore", description: "Orientation" }, { id: "prediction", label: "B · Predict", description: "Prediction" },
  { id: "incorrect-reveal", label: "C · Reveal", description: "Incorrect-prediction reveal" }, { id: "retrieval", label: "D · Retrieve", description: "Retrieval" },
  { id: "assistance", label: "E · Help", description: "Expanded retrieval explanation" },
] as const);
type LayoutFixture = Readonly<{ math: Card1Math; presentation: RootsFactorsPresentation }>;
export const previewInputPolicies: Readonly<Record<LayoutPreviewMode, RootInputPolicy>> = immutable({
  orientation: { enabled: true, bounds: [0, 5] }, prediction: { enabled: false, bounds: [0, 5] },
  "incorrect-reveal": { enabled: false, bounds: [-5, 5] }, retrieval: { enabled: true, bounds: [-5, 5] }, assistance: { enabled: false, bounds: [-5, 5] },
});
const demonstratedMath = createCard1Math(-3);
const target = { id: "target", root: -4 };
/** Temporary lab fixtures only: selecting a fixture is not a learning transition. */
export const layoutPreviewFixtures: Readonly<Record<LayoutPreviewMode, LayoutFixture>> = immutable({
  orientation: { math: initialMath, presentation: { policy: { maskMovingFactor: false, markerPresentation: "orientation" }, prompt: activityPromptLayout({ kind: "orientation" }), adjustments: rootAdjustmentLayout(3) } },
  prediction: { math: initialMath, presentation: { policy: { maskMovingFactor: false, markerPresentation: "locked" }, prompt: activityPromptLayout({ kind: "prediction" }), adjustments: null } },
  "incorrect-reveal": { math: demonstratedMath, presentation: { policy: { maskMovingFactor: false, markerPresentation: "locked" }, prompt: activityPromptLayout({ kind: "incorrect-reveal", root: -3, predicted: { id: "predicted", root: 3 }, actual: { id: "actual", root: -3 } }), adjustments: null } },
  retrieval: { math: demonstratedMath, presentation: { policy: { maskMovingFactor: true, markerPresentation: "available" }, prompt: activityPromptLayout({ kind: "retrieval", target, incorrectFeedback: true }), adjustments: rootAdjustmentLayout(-3) } },
  assistance: { math: demonstratedMath, presentation: { policy: { maskMovingFactor: true, markerPresentation: "locked" }, prompt: activityPromptLayout({ kind: "assistance", target }), adjustments: null } },
});
