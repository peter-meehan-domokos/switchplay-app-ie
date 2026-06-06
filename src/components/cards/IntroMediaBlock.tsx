import type { WeeklyCard } from "@/components/decks/types";
import { getMediaTitle } from "@/lib/media";

type IntroMediaBlockProps = {
  card: WeeklyCard;
};

export default function IntroMediaBlock({ card }: IntroMediaBlockProps) {
  const mediaItem = card.intro.mediaItem;

  return (
    <div className="active-card-identity">
      {mediaItem ? (
        <div className="intro-media-thumb" aria-label={getMediaTitle(mediaItem, card.subtitle)}>
          <span className="intro-media-play" aria-hidden="true" />
        </div>
      ) : null}
      <div className="active-card-title-block">
        <p>{card.subtitle}</p>
      </div>
    </div>
  );
}
