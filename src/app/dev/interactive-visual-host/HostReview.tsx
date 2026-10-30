"use client";

import { useLayoutEffect, useState } from "react";
import FocusedCardView from "@/components/decks/FocusedCardView";
import type { CanonicalCardPresentation } from "@/components/decks/presentation";
import InteractiveVisualHost from "@/components/interactiveVisuals/InteractiveVisualHost";
import { createDevelopmentVisualPersistence } from "@/lib/interactiveVisuals/developmentPersistence";
import type { HostedVisualProps } from "@/app/step-visuals/core/host";
import RootsInitialPreview from "@/app/step-visuals/activities/roots-factors/RootsInitialPreview";
import IntegrationInitialPreview from "@/app/step-visuals/activities/integration-area/IntegrationInitialPreview";
import styles from "./review.module.css";
import DatabaseReview from "./DatabaseReview";

const card: CanonicalCardPresentation = { surface: "canonical", id: "host-review-card", cardTemplateId: "host-review-card", version: 1, label: "Card 1",
  intro: { title: "Interactive Visual host review", description: null, mediaItem: null },
  steps: [
    { stepId: "explore", title: "Explore", description: "Explore roots and factors.", mediaItems: [{ id: "roots", label: "Explore", kind: "activity", activityId: "roots-and-factors" }] },
    { stepId: "two", title: "Integration", description: "Explore area.", mediaItems: [{ id: "integration", label: "Area", kind: "activity", activityId: "integration-area" }] },
    { stepId: "three", title: "Third step", description: "An ordinary step.", mediaItem: null },
  ] };

// Development-only responsive contract probe. Never registered as a curriculum visual.
function ResponsiveMock({ dimensions, onControls }: HostedVisualProps) {
  const [stage, setStage] = useState(1);
  useLayoutEffect(() => onControls({ stageId: String(stage), atStart: stage === 1, completed: false,
    next: { enabled: true, run: () => setStage((value) => value + 1) },
    previous: { enabled: stage > 1, run: () => setStage((value) => value - 1) } }), [onControls, stage]);
  return <div className={styles.mock} data-responsive-mock="" style={{ width: dimensions.width, height: dimensions.height }}>
    <p>Stage {stage}</p><p>{Math.round(dimensions.width)} × {Math.round(dimensions.height)}</p>
  </div>;
}
function FailingMock(): never { throw new Error("Development visual render failure"); }

export default function HostReview({ databaseReviewEnabled = false }: { databaseReviewEnabled?: boolean }) {
  const [persistence] = useState(createDevelopmentVisualPersistence);
  const [mode, setMode] = useState<"menu" | "card" | "preview" | "integration-preview" | "database">("menu");
  const [mockSource, setMockSource] = useState<HTMLElement | null>(null);
  const [failingSource, setFailingSource] = useState<HTMLElement | null>(null);
  return <main className={styles.review}>
    {mode === "menu" ? <nav className={styles.menu} aria-label="Development review">
      <h1>Interactive Visual host</h1><p>Development session storage only. Existing mathematical overflow is a separate backlog.</p>
      <button type="button" onClick={() => setMode("card")}>Open test card</button>
      <button type="button" onClick={(event) => setMockSource(event.currentTarget)}>Open responsive mock</button>
      <button type="button" onClick={(event) => setFailingSource(event.currentTarget)}>Open failing mock</button>
      <button type="button" onClick={() => setMode("preview")}>Render inert initial preview</button>
      <button type="button" onClick={() => setMode("integration-preview")}>Render inert Integration preview</button>
      {databaseReviewEnabled ? <button type="button" onClick={() => setMode("database")}>Open database review</button> : null}
    </nav> : null}
    {mode === "card" ? <FocusedCardView card={card} deckTemplateId="host-review-deck" cardIndex={0} totalCards={1} isDeckFlipped={false}
      onClose={() => setMode("menu")} onNext={() => {}} onPrevious={() => {}} traversalDirection="next" transition={{ duration: 0 }}
      interactiveVisualPersistence={persistence} /> : null}
    {mode === "preview" ? <div data-inert-preview="" className={styles.initialPreview}><RootsInitialPreview /></div> : null}
    {mode === "integration-preview" ? <div data-inert-preview="" className={styles.initialPreview}><IntegrationInitialPreview /></div> : null}
    {mode === "database" && databaseReviewEnabled ? <DatabaseReview /> : null}
    {mockSource ? <InteractiveVisualHost title="Development responsive mock" Visual={ResponsiveMock} persistence={persistence}
      opened={{ activityId: "development-only", attemptId: "mock", snapshot: null }} returnFocus={mockSource} onClose={() => setMockSource(null)} /> : null}
    {failingSource ? <InteractiveVisualHost title="Development failing mock" Visual={FailingMock} persistence={persistence}
      opened={{ activityId: "development-failure", attemptId: "failing-mock", snapshot: null }} returnFocus={failingSource} onClose={() => setFailingSource(null)} /> : null}
  </main>;
}
