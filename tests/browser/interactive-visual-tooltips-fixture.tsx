import { useState } from "react";
import { createRoot } from "react-dom/client";
import FocusedCardView from "../../src/components/decks/FocusedCardView";
import type { CanonicalCardPresentation } from "../../src/components/decks/presentation";
import IntegrationActivity from "../../src/app/step-visuals/activities/integration-area/integration-activity";
import { createDevelopmentVisualPersistence } from "../../src/lib/interactiveVisuals/developmentPersistence";

const card: CanonicalCardPresentation = {
  surface: "canonical", id: "tooltip-card", cardTemplateId: "tooltip-card", version: 1, label: "Card 1",
  intro: { title: "Tooltip regression", description: null, mediaItem: null },
  steps: [{ stepId: "area", title: "Integration", description: "Explore area.",
    mediaItems: [{ id: "integration", label: "Explore", kind: "activity", activityId: "integration-area" }] }],
};

declare global { interface Window { tooltipSaveCount: number } }
window.tooltipSaveCount = 0;

function App() {
  const [persistence] = useState(() => {
    const service = createDevelopmentVisualPersistence();
    return { ...service, save: (...args: Parameters<typeof service.save>) => {
      window.tooltipSaveCount++;
      return service.save(...args);
    } };
  });
  return new URLSearchParams(location.search).has("standalone") ? <IntegrationActivity /> :
    <FocusedCardView card={card} deckTemplateId="tooltip-deck" cardIndex={0} totalCards={1}
      isDeckFlipped={false} onClose={() => {}} onNext={() => {}} onPrevious={() => {}}
      traversalDirection="next" transition={{ duration: 0 }} interactiveVisualPersistence={persistence} />;
}

createRoot(document.getElementById("root")!).render(<App />);
