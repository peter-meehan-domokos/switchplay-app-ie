import { motion } from "motion/react";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import type { WeeklyCard } from "@/components/decks/types";
import { CARD_ASPECT_RATIO, FOCUSED_CARD_WIDTH } from "@/constants/cardStack";

type FocusedCardViewProps = {
  card: WeeklyCard;
  onClose: () => void;
  transition: object;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function FocusedCardView({ card, onClose, transition }: FocusedCardViewProps) {
  return (
    <motion.div
      className="focused-card-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.button type="button" className="focused-card-scrim" onClick={onClose} aria-label="Close focused card" />
      <motion.article
        className="physical-card focused-card"
        layout
        layoutId={`week-card-${card.id}`}
        style={{ width: FOCUSED_CARD_WIDTH, aspectRatio: CARD_ASPECT_RATIO }}
        transition={transition}
      >
        <div className="focused-card-topbar">
          <CardSemanticAnchors card={card} dateLabel={dateFormatter.format(new Date(card.targetDate))} />
          <motion.button type="button" className="focused-close-button" onClick={onClose} whileTap={{ scale: 0.94 }}>
            Close
          </motion.button>
        </div>

        <header className="focused-card-header">
          <p>{card.subtitle}</p>
        </header>

        <div className="focused-card-body">
          <section className="focused-section">
            <h3>Week focus</h3>
            <p>{card.intro.description}</p>
          </section>

          <section className="focused-section">
            <h3>Preview actions</h3>
            <div className="focused-action-list">
              {card.items.slice(0, 3).map((item) => (
                <p key={item.id}>{item.description}</p>
              ))}
            </div>
          </section>
        </div>
      </motion.article>
    </motion.div>
  );
}
