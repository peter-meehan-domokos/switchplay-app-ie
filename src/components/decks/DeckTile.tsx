import { motion } from "motion/react";
import type { RefCallback } from "react";
import { deckPresentationIdentity, type PresentedDeck } from "./presentation";
import type { DeckIntroPlaybackStatus } from "./deckIntroPreview";
import { deckFrontPresentation } from "./deckFrontPresentation";
import DeckFrontContents from "./DeckFrontContents";

type DeckTileProps = {
  deck: PresentedDeck;
  isDisabled?: boolean;
  isIntroActive?: boolean;
  introPlaybackStatus?: DeckIntroPlaybackStatus;
  isPreparing?: boolean;
  onFrontCardAction: () => void;
  onIntroAnchorChange: RefCallback<HTMLDivElement>;
  onSelect: () => void;
  transition: object;
};

export default function DeckTile({
  deck, isDisabled = false, isIntroActive = false, introPlaybackStatus = "idle",
  isPreparing = false, onFrontCardAction, onIntroAnchorChange, onSelect, transition,
}: DeckTileProps) {
  return (
    <motion.article className={`deck-tile${isPreparing ? " deck-tile--preparing" : ""}`} data-collection-item-id={deck.id}
      aria-busy={isPreparing} layout layoutId={`deck-${deckPresentationIdentity(deck)}`} transition={transition}>
      <DeckFrontContents front={deckFrontPresentation(deck)} animated preparing={isPreparing}
        introActive={isIntroActive} introPlaying={isIntroActive && introPlaybackStatus === "playing"}
        disabled={isDisabled} onIntroAction={onFrontCardAction} introAnchor={onIntroAnchorChange} />
      <button className="deck-tile-open-action" disabled={isDisabled} onClick={onSelect}
        type="button" aria-label={`Open ${deck.title}`} />
    </motion.article>
  );
}
