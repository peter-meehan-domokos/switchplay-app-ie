import { motion } from "motion/react";
import type { RefCallback } from "react";
import type { DeckLayout } from "@/components/decks/deckLayout";
import { getPlayableDeckIntroductionVideo, type DeckIntroPlaybackStatus } from "@/components/decks/deckIntroPreview";
import { getDeckIntroductionPosterImage } from "@/components/decks/deckIntroductionPoster";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";

type DeckTileProps = {
  deck: DeckLayout;
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
  deck,
  isDisabled = false,
  isIntroActive = false,
  introPlaybackStatus = "idle",
  isPreparing = false,
  onFrontCardAction,
  onIntroAnchorChange,
  onSelect,
  transition,
}: DeckTileProps) {
  const roundedProgressPercentage = Math.round(deck.progressPercentage);
  const progressMetaLabel = roundedProgressPercentage === 100 ? "Completed" : `${roundedProgressPercentage}%`;
  const introPosterImage = getDeckIntroductionPosterImage(deck);
  const introVideo = getPlayableDeckIntroductionVideo(deck);
  const posterSrc = introPosterImage?.src ?? (introVideo ? getCloudflareStreamThumbnailUrl(introVideo) : null);
  const hasIntroPoster = posterSrc !== null;
  const isIntroPlaying = isIntroActive && introPlaybackStatus === "playing";
  const frontCardLabel = introVideo
    ? `${isIntroPlaying ? "Pause" : "Play"} introduction for ${deck.title}`
    : `Open ${deck.title}`;

  return (
    <motion.article
      className={`deck-tile${isPreparing ? " deck-tile--preparing" : ""}`}
      aria-busy={isPreparing}
      layout
      layoutId={`deck-${deck.id}`}
      transition={transition}
    >
      {deck.category ? <span className="category-chip">{deck.category}</span> : null}
      {deck.showOwnerTag ? <span className="deck-owner-tag">{deck.ownerUsername}</span> : null}

      <motion.div className="tile-card-stack" layout ref={onIntroAnchorChange}>
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
                  src={posterSrc}
                  alt=""
                  aria-hidden="true"
                />
                <span className="tile-mini-card-poster-overlay" aria-hidden="true" />
              </>
            ) : index === 0 && deck.streams?.length ? (
              <div className="deck-preview-streams" aria-hidden="true">
                {deck.streams.slice(0, 3).map((stream) => (
                  <div key={stream.id} className="deck-preview-stream-title">
                    {stream.title}
                  </div>
                ))}
              </div>
            ) : null}
            {index === 0 ? (
              <>
                {introVideo && !isIntroActive ? <span className="tile-mini-card-play-affordance" aria-hidden="true" /> : null}
                <button
                  className="tile-mini-card-action"
                  disabled={isDisabled}
                  onClick={onFrontCardAction}
                  type="button"
                  aria-label={frontCardLabel}
                />
              </>
            ) : null}
          </span>
        ))}
      </motion.div>

      <span className="deck-tile-title">{deck.title}</span>
      <span className="deck-tile-meta">{isPreparing ? "Preparing deck..." : `${deck.cards.length} weeks · ${progressMetaLabel}`}</span>
      <button className="deck-tile-open-action" disabled={isDisabled} onClick={onSelect} type="button" aria-label={`Open ${deck.title}`} />
    </motion.article>
  );
}
