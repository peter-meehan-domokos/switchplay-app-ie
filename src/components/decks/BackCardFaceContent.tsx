import type { CardLayout } from "@/components/cards/cardLayout";
import BackCardExternalComment from "@/components/decks/BackCardExternalComment";
import BackCardMediaTrace from "@/components/decks/BackCardMediaTrace";
import BackCardReflectionFragment from "@/components/decks/BackCardReflectionFragment";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import PulseFieldSignal from "@/components/decks/PulseFieldSignal";

type BackCardFaceContentProps = {
  card: CardLayout;
  dateLabel: string;
  variant?: "focused" | "deck" | "preview";
};

export default function BackCardFaceContent({ card, dateLabel, variant = "focused" }: BackCardFaceContentProps) {
  const hasBackMediaTrace = Boolean(card.backMediaTrace);
  const layoutClassName = ["focused-card-back-layout", "back-card-face-content", `back-card-face-content--${variant}`].join(" ");
  const backSignalsClassName = [
    "focused-card-back-signals",
    !hasBackMediaTrace ? "focused-card-back-signals--no-media" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const externalCommentClassName =
    !hasBackMediaTrace && card.externalComment ? "focused-card-back-external-comment--no-media" : undefined;

  return (
    <div className={layoutClassName}>
      <CardSemanticAnchors card={card} dateLabel={dateLabel} showProgress={false} variant="back" />
      <div className="focused-card-back-shell">
        <BackCardMediaTrace trace={card.backMediaTrace} />
        <section className={backSignalsClassName} aria-label="Reflective card signals">
          {card.signals.map((signal) => (
            <div className="focused-card-signal-slot" key={signal.id}>
              <p>{signal.title}</p>
              <PulseFieldSignal value={signal.value} variant={signal.variant} className="focused-card-signal-trace" />
              <span className={`focused-card-signal-value focused-card-signal-value--${signal.variant}`}>
                {signal.reading}
              </span>
            </div>
          ))}
        </section>
        <BackCardExternalComment comment={card.externalComment} className={externalCommentClassName} />
        <BackCardReflectionFragment reflectionVerticalOffset={card.reflectionVerticalOffset} text={card.reflection} />
      </div>
    </div>
  );
}
