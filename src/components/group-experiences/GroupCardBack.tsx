import type { ExperienceCardPresentation } from "@/components/decks/presentation";
import { FocusedSignalRow, PassiveSignalRow } from "@/components/decks/BackCardFaceContent";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import StepProgressStrip from "@/components/cards/StepProgressStrip";
import { signalReadingToNormalized } from "@/lib/signals";
import ConfidencePair from "./ConfidencePair";
import type { PersonalLearningChange } from "@/lib/cards/learning";

// Deliberately learning-only. Private reflection/media/Info sources and group
// contributions are different identities, with later-phase loaders. A blank
// group back is never permission to mount a private editor or show test counts.
export default function GroupCardBack({ card, focused = false, onChange, onSignalNavigateNext, onSignalNavigatePrevious }: {
  card: ExperienceCardPresentation; focused?: boolean; onChange?: (change: PersonalLearningChange) => void;
  onSignalNavigateNext?: () => void; onSignalNavigatePrevious?: () => void;
}) {
  return <div className={`focused-card-back-layout back-card-face-content ${focused ? "back-card-face-content--focused" : "back-card-face-content--preview"}`}>
    <CardSemanticAnchors card={card} dateLabel="" showProgress={false} variant="back" />
    <div className="focused-card-back-shell"><section className="focused-card-back-signals focused-card-back-signals--no-media group-back-signals" aria-label="Card progress and confidence">
      {card.steps.map((step, i) => {
        const reading = card.learning.signalReadings.find(row => row.stepId === step.stepId)?.reading ?? null;
        const aggregate = card.aggregates?.steps.find(row => row.stepId === step.stepId);
        const signal = { id: step.stepId, title: step.title ?? `Step ${i + 1}`, value: reading === null ? 0 : signalReadingToNormalized(reading), reading, rawReading: reading,
          variant: (["recovery", "movement", "load"] as const)[i % 3], unit: null, order: "increasing" as const };
        const heading = <span className="group-back-heading"><span>{signal.title}</span><StepProgressStrip completionStatus={step.completionStatus} />
          {aggregate && aggregate.followers.eligibleTotal > 0 ? <span className="group-step-counts" aria-label={`${aggregate.followers.doing} doing, ${aggregate.followers.done} done`}>{aggregate.followers.doing} · {aggregate.followers.done}</span> : null}
          <span className="group-back-confidence">{aggregate ? <ConfidencePair group={reading === null ? null : Math.round(reading)} follower={aggregate.followers.confidence} activeTotal={aggregate.followers.activeTotal} /> : reading === null ? "—" : Math.round(reading)}</span>
        </span>;
        // Keep the same SVG/row through perspective changes. Security identity
        // resets gesture preview independently; foreign rows have no handlers,
        // button role or focus target, and never acquire personal capabilities.
        return focused ? <FocusedSignalRow key={step.stepId} signal={signal} cardId={card.id} heading={heading}
          readOnly={!card.canWriteLearning || !onChange} interactionIdentity={card.dataIdentity}
          onCommitSignalReading={(_cardId, stepId, value) => { if (card.canWriteLearning) onChange?.({ kind: "signal", stepId, reading: value }); }}
          onSignalNavigateNext={onSignalNavigateNext} onSignalNavigatePrevious={onSignalNavigatePrevious} />
          : <PassiveSignalRow key={step.stepId} signal={signal} heading={heading} />;
      })}
    </section></div>
  </div>;
}
