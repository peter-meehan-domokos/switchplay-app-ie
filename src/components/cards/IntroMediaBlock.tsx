import type { WeeklyCard } from "@/components/decks/types";
import { getMediaTitle } from "@/lib/media";

type IntroMediaBlockProps = {
  card: WeeklyCard;
};

export default function IntroMediaBlock({ card }: IntroMediaBlockProps) {
  const mediaItem = card.intro.mediaItem;
  const introTitle = card.intro.title ?? "";

  return (
    <div className={`active-card-identity${mediaItem ? "" : " active-card-identity--no-media"}`}>
      {mediaItem ? (
        <div className="intro-media-thumb" aria-label={getMediaTitle(mediaItem, introTitle)}>
          <span className="intro-media-play" aria-hidden="true" />
        </div>
      ) : null}
      <div className="active-card-title-block">
        <p>{introTitle}</p>
      </div>
    </div>
  );
}
