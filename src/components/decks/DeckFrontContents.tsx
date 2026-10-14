import { imageDeliveryUrl } from "@/lib/mediaDelivery";
import { motion } from "motion/react";
import type { RefCallback } from "react";
import type { DeckFrontPresentation } from "./deckFrontPresentation";

// Shared visual body. Playback/navigation is supplied by the existing tile only.
export default function DeckFrontContents({ front, animated = false, preparing = false, introActive = false, introPlaying = false,
  disabled = false, onIntroAction, introAnchor }: { front: DeckFrontPresentation; animated?: boolean; preparing?: boolean;
    introActive?: boolean; introPlaying?: boolean; disabled?: boolean; onIntroAction?: () => void; introAnchor?: RefCallback<HTMLDivElement> }) {
  const completion = front.context === "personal" ? front.completion : null;
  return <>
    {front.category ? <span className="category-chip">{front.category}</span> : null}
    {front.showOwnerTag ? <span className="deck-owner-tag">{front.ownerUsername}</span> : null}
    <motion.div className="tile-card-stack" layout={animated} ref={introAnchor}>
      {front.cardIds.map((id, index) => <span key={id} className={`tile-mini-card${front.posterSrc && index === 0 ? " tile-mini-card--intro-poster" : ""}`}
        style={{ transform: `translate(${index * 8}px, ${index * -6}px) rotate(${index * 2 - 2}deg)`, zIndex: 3 - index }}>
        {front.posterSrc && index === 0 ? <><img className="tile-mini-card-poster" src={imageDeliveryUrl(front.posterSrc)} alt="" aria-hidden="true" />
          <span className="tile-mini-card-poster-overlay" aria-hidden="true" /></>
          : index === 0 && front.themes.length ? <div className="deck-preview-streams" aria-hidden="true">
            {front.themes.map((theme) => <div key={theme.id} className="deck-preview-stream-title">{theme.title}</div>)}
          </div> : null}
        {index === 0 && onIntroAction ? <>
          {front.hasIntroVideo && !introActive ? <span className="tile-mini-card-play-affordance" aria-hidden="true" /> : null}
          <button className="tile-mini-card-action" disabled={disabled} onClick={onIntroAction} type="button"
            aria-label={front.hasIntroVideo ? `${introPlaying ? "Pause" : "Play"} introduction for ${front.title}` : `Open ${front.title}`} />
        </> : null}
      </span>)}
    </motion.div>
    <span className="deck-tile-title">{front.title} <span className="deck-tile-title-chevron" aria-hidden="true">›</span></span>
    <span className="deck-tile-meta">{preparing ? "Preparing deck..." : <>
      {front.cardCount} cards{completion !== null ? <> &middot; {Math.round(completion) === 100 ? "Completed" : `${Math.round(completion)}%`}</> : null}
      {front.context === "personal" && front.confidence !== null ? <span className="deck-tile-meta-confidence">{front.confidence}</span> : null}
    </>}</span>
  </>;
}
