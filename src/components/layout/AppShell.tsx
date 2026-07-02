"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import DeckDetail from "@/components/decks/DeckDetail";
import DeckGrid from "@/components/decks/DeckGrid";
import type { Deck } from "@/components/decks/types";
import { buildDeckLayout } from "@/components/decks/deckLayout";
import type { LayoutUser } from "@/components/cards/cardLayout";
import OverviewMenu from "@/components/layout/OverviewMenu";

type AppShellProps = {
  currentUserId: string;
  decks: Deck[];
  userName: string;
  users: LayoutUser[];
};

type DeckFlipState = {
  isFlipped: boolean;
  rotationY: number;
};

const springTransition = {
  type: "spring",
  stiffness: 340,
  damping: 34,
  mass: 0.9,
} as const;

const OVERVIEW_REFRESH_AFTER_CLOSE_MS = 350;

export default function AppShell({ currentUserId, decks, userName, users }: AppShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deckLayouts = decks.map((deck) => buildDeckLayout(deck, { currentUserId, users }));
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [pendingDeckOpenId, setPendingDeckOpenId] = useState<string | null>(null);
  const [instantiatingDeckTemplateId, setInstantiatingDeckTemplateId] = useState<string | null>(null);
  const [deckInstantiationError, setDeckInstantiationError] = useState<string | null>(null);
  const [deckFlipStateById, setDeckFlipStateById] = useState<Record<string, DeckFlipState>>({});
  const overviewRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHandledOpenDeckParamRef = useRef(false);
  const selectedDeck = deckLayouts.find((deck) => deck.id === selectedDeckId) ?? null;
  const isDeckInteractionLocked = Boolean(instantiatingDeckTemplateId) || Boolean(pendingDeckOpenId);
  const selectedDeckFlipState = selectedDeck ? deckFlipStateById[selectedDeck.id] : null;
  const isSelectedDeckFlipped = selectedDeckFlipState?.isFlipped ?? false;
  const selectedDeckFlipRotationY = selectedDeckFlipState?.rotationY ?? 0;

  //console.log("Rendering AppShell", {
    //decks
  //});

  useEffect(() => {
    if (!pendingDeckOpenId) {
      return;
    }

    const pendingDeck = deckLayouts.find((deck) => deck.id === pendingDeckOpenId);

    if (pendingDeck && pendingDeck.hasUserDeckData) {
      setSelectedDeckId(pendingDeckOpenId);
      setPendingDeckOpenId(null);
      setInstantiatingDeckTemplateId(null);
      setDeckInstantiationError(null);
    }
  }, [deckLayouts, pendingDeckOpenId]);

  useEffect(() => {
    if (hasHandledOpenDeckParamRef.current) {
      return;
    }

    const requestedDeckId = searchParams.get("openDeck")?.trim();

    if (!requestedDeckId) {
      hasHandledOpenDeckParamRef.current = true;
      return;
    }

    const requestedDeck = deckLayouts.find((deck) => deck.id === requestedDeckId);

    if (!requestedDeck) {
      hasHandledOpenDeckParamRef.current = true;
      return;
    }

    if (isDeckInteractionLocked) {
      return;
    }

    hasHandledOpenDeckParamRef.current = true;
    void handleSelectDeck(requestedDeck.id);
  }, [deckLayouts, isDeckInteractionLocked, searchParams]);

  useEffect(() => {
    return () => {
      if (overviewRefreshTimeoutRef.current) {
        clearTimeout(overviewRefreshTimeoutRef.current);
      }
    };
  }, []);

  async function instantiateDeckData(deckTemplateId: string) {
    const response = await fetch("/api/decks-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ deckTemplateId }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Unable to prepare deck data.");
    }
  }

  async function handleSelectDeck(deckId: string) {
    if (isDeckInteractionLocked) {
      return;
    }

    const deck = deckLayouts.find((candidateDeck) => candidateDeck.id === deckId);

    if (!deck) {
      return;
    }

    if (deck.hasUserDeckData) {
      setDeckInstantiationError(null);
      setSelectedDeckId(deckId);
      return;
    }

    setDeckInstantiationError(null);
    setInstantiatingDeckTemplateId(deck.deckTemplateId);

    try {
      await instantiateDeckData(deck.deckTemplateId);
      setPendingDeckOpenId(deckId);
      router.refresh();
    } catch (error) {
      setInstantiatingDeckTemplateId(null);
      setPendingDeckOpenId(null);
      setDeckInstantiationError(error instanceof Error ? error.message : "Unable to prepare deck data.");
    }
  }

  const toggleSelectedDeckFlip = (deckId: string, rotationDelta = 180) => {
    setDeckFlipStateById((current) => ({
      ...current,
      [deckId]: {
        isFlipped: !(current[deckId]?.isFlipped ?? false),
        rotationY: (current[deckId]?.rotationY ?? 0) + rotationDelta,
      },
    }));
  };

  const handleCloseDeckDetail = () => {
    setSelectedDeckId(null);

    if (overviewRefreshTimeoutRef.current) {
      clearTimeout(overviewRefreshTimeoutRef.current);
    }

    overviewRefreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
      overviewRefreshTimeoutRef.current = null;
    }, OVERVIEW_REFRESH_AFTER_CLOSE_MS);
  };

  return (
    <LayoutGroup>
      <main className={`app-shell${selectedDeck ? " app-shell--deck" : ""}`}>
      {selectedDeckId === null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 1.5,
            duration: 0.8,
            ease: "easeOut",
          }}
        >
          <OverviewMenu username={userName} />
        </motion.div>
      )}
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
              {deckInstantiationError ? <p className="auth-error">{deckInstantiationError}</p> : null}
            </motion.header>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="popLayout" initial={false}>
          {selectedDeck ? (
            <DeckDetail
              key={`deck-detail-${selectedDeck.id}`}
              deck={selectedDeck}
              isDeckFlipped={isSelectedDeckFlipped}
              deckFlipRotationY={selectedDeckFlipRotationY}
              onBack={handleCloseDeckDetail}
              onToggleDeckFlip={(rotationDelta) => toggleSelectedDeckFlip(selectedDeck.id, rotationDelta)}
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
              <DeckGrid
                decks={deckLayouts}
                instantiatingDeckTemplateId={instantiatingDeckTemplateId}
                isInteractionLocked={isDeckInteractionLocked}
                onSelectDeck={handleSelectDeck}
                transition={springTransition}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </LayoutGroup>
  );
}
