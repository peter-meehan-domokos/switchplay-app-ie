import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import DeckScene from "../../src/components/decks/DeckScene";
import BackCardFaceContent from "../../src/components/decks/BackCardFaceContent";
import FocusedCardView from "../../src/components/decks/FocusedCardView";
import { buildDeckLayout } from "../../src/components/decks/deckLayout";
import { hasPersonalCard } from "../../src/components/decks/presentation";
import type { Deck } from "../../src/components/decks/types";

const source: Deck = {
  id: "placement", deckTemplateId: "placement", title: "Card continuity", category: null,
  adoptedVersion: 1, dataOwnerUserId: "fixture", ownerUserId: "fixture", ownerUsername: "Creator",
  showOwnerTag: false, activeCardId: "card-0", introduction: null,
  hasUserDeckData: true, createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z", canMutate: false, isOwnedByCurrentUser: true,
  cards: [0, 1, 2, 3].map(index => ({
    id: `card-${index}`, cardTemplateId: `card-${index}`, adoptedVersion: 1, dataOwnerUserId: "fixture",
    label: `Card ${index + 1}`, creator: { username: "Creator", immediateSourceUsername: null },
    targetDate: "2026-10-18", intro: { title: `Practice ${index + 1}`, description: "Available before navigation", mediaItem: null },
    steps: [0, 1, 2].map(step => ({ stepId: `card-${index}-step-${step}`, title: `Step ${step + 1}`,
      description: step ? "A longer instruction that must retain its line breaks while the Card moves." : "A short instruction.", completionStatus: "todo" })),
    signals: [0, 1, 2].map(signal => ({ id: `signal-${signal}`, title: `Reflective signal ${signal + 1}`,
      reading: signal ? null : 6, rawReading: signal ? null : 6, unit: null, order: "increasing" })),
    reflection: index === 1 ? "" : "Keep the proportions and position of this reflection while the Card moves.",
    mediaItems: Array.from({ length: index === 1 ? 0 : index === 2 ? 5 : 1 }, (_, image) => ({
      id: `image-${index}-${image}`, mediaType: "image" as const, src: `https://fixture.invalid/image-${index}-${image}.svg`, description: `Evidence ${image + 1}`,
    })), chats: [],
  })),
};
const deck = buildDeckLayout(source, { currentUserId: "fixture", users: [] });
function Harness() {
  const [rotation, setRotation] = useState(0);
  return <main className="app-shell app-shell--deck"><DeckScene deck={deck}
    isDeckFlipped={Math.abs(rotation % 360) === 180} deckFlipRotationY={rotation}
    onToggleDeckFlip={(delta = 180) => setRotation(value => value + delta)} onBack={() => {}}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    onOpenMedia={() => { document.body.dataset.mediaOpened = "true"; }}
    renderCardBackFace={(card, options) => hasPersonalCard(card) ? <BackCardFaceContent card={card} deckTemplateId={deck.id} {...options} /> : null}
    renderFocusedCard={props => <FocusedCardView {...props} backFace={hasPersonalCard(props.card)
      ? <BackCardFaceContent card={props.card} deckTemplateId={deck.id} dateLabel="18 Oct"
        onCommitSignalReading={(_card, _signal, reading) => { document.body.dataset.signalReading = String(reading); }} /> : undefined} />} />
  </main>;
}
createRoot(document.getElementById("fixture")!).render(location.search.includes("strict") ? <StrictMode><Harness /></StrictMode> : <Harness />);
