import type { WeeklyCard } from "@/components/decks/types";
import { getMediaTitle } from "@/lib/media";

type IntroMediaBlockProps = {
  card: WeeklyCard;
};

export default function IntroMediaBlock({ card }: IntroMediaBlockProps) {
  const mediaItem = card.intro?.mediaItem;
  const mediaTitle = getMediaTitle(mediaItem, card.subtitle);

  return (
    <div className="active-card-identity">
      <div className="intro-media-thumb" aria-label={mediaTitle}>
        <span className="intro-media-play" aria-hidden="true" />
      </div>
      <div className="active-card-title-block">
        <p>{card.subtitle}</p>
      </div>
    </div>
  );
}
