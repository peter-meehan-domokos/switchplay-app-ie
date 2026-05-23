"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import DeckDetail from "@/components/decks/DeckDetail";
import DeckGrid from "@/components/decks/DeckGrid";
import type { Deck } from "@/components/decks/types";
import { buildDeckLayout } from "@/components/decks/deckLayout";
import type { LayoutUser } from "@/components/cards/cardLayout";

type AppShellProps = {
  currentUserId: string;
  decks: Deck[];
  userName: string;
  users: LayoutUser[];
};

const springTransition = {
  type: "spring",
  stiffness: 340,
  damping: 34,
  mass: 0.9,
} as const;

export default function AppShell({ currentUserId, decks, userName, users }: AppShellProps) {
  const deckLayouts = decks.map((deck) => buildDeckLayout(deck, { currentUserId, users }));
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const selectedDeck = deckLayouts.find((deck) => deck.id === selectedDeckId) ?? null;

  return (
    <LayoutGroup>
      <main className={`app-shell${selectedDeck ? " app-shell--deck" : ""}`}>
        <AnimatePresence initial={false}>
          {!selectedDeck ? (
            <motion.header
              className="overview-header"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <p className="eyebrow">{userName}</p>
              <h1>Your decks</h1>
              <p className="overview-summary">{deckLayouts.length} active skill paths</p>
            </motion.header>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="popLayout" initial={false}>
          {selectedDeck ? (
            <DeckDetail
              key={`deck-detail-${selectedDeck.id}`}
              deck={selectedDeck}
              onBack={() => setSelectedDeckId(null)}
              transition={springTransition}
            />
          ) : (
            <motion.section
              key="deck-overview"
              className="overview-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <DeckGrid decks={deckLayouts} onSelectDeck={setSelectedDeckId} transition={springTransition} />
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </LayoutGroup>
  );
}
