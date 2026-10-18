import { useState } from "react";
import { createRoot } from "react-dom/client";
import DeckScene from "../../src/components/decks/DeckScene";
import DeckGrid from "../../src/components/decks/DeckGrid";
import type { CanonicalDeckPresentation } from "../../src/components/decks/presentation";

// Browser-only fixture, injected by Playwright. This is not an application route.
const transition = { type: "spring", stiffness: 260, damping: 30 };
function Harness({ deck, collection }: { deck: CanonicalDeckPresentation; collection: boolean }) {
  const [open, setOpen] = useState(!collection);
  return <main className={`app-shell${open ? " app-shell--deck" : ""}`}>
    {open ? <>
      <DeckScene key={`${deck.id}:${deck.version}`} deck={deck} onBack={() => setOpen(false)} transition={transition} />
    </> : <>
      <header className="overview-header"><p className="eyebrow">phase2</p><h1>My decks</h1></header>
      <DeckGrid decks={[deck]} instantiatingDeckTemplateId={null} isInteractionLocked={false}
        onSelectDeck={() => setOpen(true)} transition={transition} />
    </>}
  </main>;
}

const root = createRoot(document.getElementById("fixture")!);
Object.assign(window, { renderPresentationFixture: (deck: CanonicalDeckPresentation, collection: boolean) => root.render(<Harness deck={deck} collection={collection} />) });
