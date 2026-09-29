import { createRoot } from "react-dom/client";
import { useState } from "react";
import DeckDetail from "@/components/decks/DeckDetail";
import { buildDeckLayout } from "@/components/decks/deckLayout";
import type { Deck } from "@/components/decks/types";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";
import "@/app/globals.css";

const owner = "507f1f77bcf86cd799439011";
const media: ModernUserCardMediaItem[] = Array.from({ length: 8 }, (_, index) => [1, 2, 5].includes(index) ? {
  id: `stream-${index}`, assetId: `video-${index}`, mediaType: "video", provider: "cloudflare-stream", src: `https://iframe.videodelivery.net/video-${index}`, description: `Practice ${index + 1}`,
} : {
  id: `image-${index}`, assetId: `user-decks/${owner}/deck-1/cards/card-1/${index}.png`, mediaType: "image", provider: "cloudflare-r2", src: `/image-${index}.svg`, description: `Written work ${index + 1}`,
});
const options = new URLSearchParams(location.search);
const items = options.has("single") ? [media[0]] : media;
const deck: Deck = { id: `${owner}:deck-1`, deckTemplateId: "deck-1", hasUserDeckData: true, createdAt: null, updatedAt: null, canMutate: true, isOwnedByCurrentUser: true, ownerUserId: owner, ownerUsername: "Fixture", showOwnerTag: false, activeCardId: "card-1", title: "Media viewer test", category: null,
  introduction: { image: null, video: { ...media[1], mediaType: "video", provider: "cloudflare-stream" } },
  cards: [{ id: "card-1", label: "Practice card", targetDate: "2026-09-27", intro: { title: "Card introduction", description: "Practice", mediaItem: media[1] },
    steps: [{ stepId: "step-1", title: "Practice step", description: "Practice the phrase", completionStatus: "todo", mediaItem: media[2] }], signals: [], mediaItems: items, chats: [], reflection: "My work" }],
};
function Fixture() {
  const [flipped, setFlipped] = useState(!options.has("front"));
  const [open, setOpen] = useState(true);
  return <main className="app-shell app-shell--deck">
    {open ? <DeckDetail deck={buildDeckLayout(deck, { currentUserId: owner, users: [] })} isDeckFlipped={flipped} deckFlipRotationY={flipped ? 180 : 0} onToggleDeckFlip={() => setFlipped((value) => !value)} onBack={() => setOpen(false)} transition={{ duration: 0 }} /> : <button onClick={() => setOpen(true)}>Reopen deck</button>}
  </main>;
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
