import { motion } from "motion/react";
import type { DeckLayout } from "@/components/decks/deckLayout";

const DANIEL_INTRO_POSTER_DECK_TEMPLATE_ID = "daniel-build-your-first-muscle-up-001";

type DeckTileProps = {
  deck: DeckLayout;
  isDisabled?: boolean;
  isPreparing?: boolean;
  onSelect: () => void;
  transition: object;
};

export default function DeckTile({ deck, isDisabled = false, isPreparing = false, onSelect, transition }: DeckTileProps) {
  const roundedProgressPercentage = Math.round(deck.progressPercentage);
  const progressMetaLabel = roundedProgressPercentage === 100 ? "Completed" : `${roundedProgressPercentage}%`;
  const hasIntroPoster = deck.deckTemplateId === DANIEL_INTRO_POSTER_DECK_TEMPLATE_ID;

  return (
    <motion.button
      type="button"
      className={`deck-tile${isPreparing ? " deck-tile--preparing" : ""}`}
      disabled={isDisabled}
      aria-busy={isPreparing}
      layout
      layoutId={`deck-${deck.id}`}
      onClick={onSelect}
      transition={transition}
      whileTap={{ scale: 0.98 }}
    >
      {deck.category ? <span className="category-chip">{deck.category}</span> : null}
      {deck.showOwnerTag ? <span className="deck-owner-tag">{deck.ownerUsername}</span> : null}

      <motion.div className="tile-card-stack" layout>
        {deck.cards.slice(0, 3).map((card, index) => (
          <span
            className={`tile-mini-card${hasIntroPoster && index === 0 ? " tile-mini-card--intro-poster" : ""}`}
            key={card.id}
            style={{
              transform: `translate(${index * 8}px, ${index * -6}px) rotate(${index * 2 - 2}deg)`,
              zIndex: 3 - index,
            }}
          >
            {hasIntroPoster && index === 0 ? (
              <>
                <img
                  className="tile-mini-card-poster"
                  src="/images/daniel-intro-still1.png"
                  alt=""
                  aria-hidden="true"
                />
                <span className="tile-mini-card-poster-overlay" aria-hidden="true" />
                <span className="tile-mini-card-play-affordance" aria-hidden="true" />
              </>
            ) : index === 0 && deck.streams?.length ? (
              // Temporarily hidden only for Daniel's intro-poster prototype.
              <div className="deck-preview-streams" aria-hidden="true">
                {deck.streams.slice(0, 3).map((stream) => (
                  <div key={stream.id} className="deck-preview-stream-title">
                    {stream.title}
                  </div>
                ))}
              </div>
            ) : null}
          </span>
        ))}
      </motion.div>

      <span className="deck-tile-title">{deck.title}</span>
      <span className="deck-tile-meta">{isPreparing ? "Preparing deck..." : `${deck.cards.length} weeks · ${progressMetaLabel}`}</span>
    </motion.button>
  );
}
