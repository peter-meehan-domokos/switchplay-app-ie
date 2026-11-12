"use client";

import { useRef } from "react";
import type { IntegrationPanel, IntegrationState } from "./learning";
import { integrationPresentation } from "./presentation";
import IntroStages from "./intro-stages";
import { stageId } from "./model";

/** Inert render state, with no fresh-attempt constructor, notifications or persistence. */
const panel: IntegrationPanel = { stage: 1, part: "compare", region: { curves: ["flat", "axis"], a: 0, b: 1 }, function: "flat", rectangles: 4,
  divisionSubsection: "rising", prediction: null, comparisons: {}, demonstration: 0, comparisonRun: 0, draft: "", feedback: null, helpOpen: false, checked: null, problemRevision: 0, answerRevision: 0 };
const state: IntegrationState = { ...panel, edit: null, revision: 0, lastEditId: 0, previousPanels: [], nextPanels: [],
  records: { current: { schemaVersion: 2, activityVersion: 2, activityId: "integration-area", attemptId: "inert-preview", attemptNumber: 1,
    stage: 1, stageId: stageId(1), status: "in-progress", region: panel.region, predictions: [], checks: [], assistanceRequested: false, successMode: null },
  events: [], completedAttempts: [], partialAttempts: [], exited: false } };
export default function IntegrationInitialPreview() {
  const heading = useRef<HTMLHeadingElement>(null);
  return <IntroStages state={state} presentation={integrationPresentation(state)} active={false} dispatch={() => {}} headingRef={heading} hosted />;
}
