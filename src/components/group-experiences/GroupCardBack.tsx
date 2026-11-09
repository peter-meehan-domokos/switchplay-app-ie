import ReflectionArea, { type ReflectionAreaContext } from "@/components/reflections/ReflectionArea";
import BackCardMediaCarousel from "@/components/decks/BackCardMediaCarousel";
import MediaCentreControl from "@/components/media/MediaCentreControl";
import { useMediaCollection } from "@/components/media/useMediaCollection";
import { collectionDisplayItem } from "@/lib/mediaCollection/presentation";
import type { MediaCollectionContext } from "@/lib/mediaCollection/contracts";
import type { OpenCardMedia } from "@/lib/cardMediaViewer";
import type { ExperienceCardPresentation } from "@/components/decks/presentation";
import { FocusedSignalRow, PassiveSignalRow } from "@/components/decks/BackCardFaceContent";
import CardSemanticAnchors from "@/components/decks/CardSemanticAnchors";
import StepProgressStrip from "@/components/cards/StepProgressStrip";
import AggregateValue from "./AggregateValue";
import { signalReadingToNormalized } from "@/lib/signals";
import type { PersonalLearningChange } from "@/lib/cards/learning";

// Media is loaded through its own scoped collection, never through scalar learning or a foreign personal working store.
export default function GroupCardBack({ reflectionInteractive = true, reflectionContext, onReflectionModalChange, readOnlyReason, card, focused = false, onChange, onSignalNavigateNext, onSignalNavigatePrevious, mediaContext = null, onOpenMedia, onEditMedia }: {
  reflectionInteractive?: boolean; reflectionContext?: ReflectionAreaContext | null; onReflectionModalChange?: (open: boolean) => void;
  readOnlyReason?: string;
  mediaContext?: MediaCollectionContext | null; onOpenMedia?: OpenCardMedia; onEditMedia?: (cardId: string) => void;
  card: ExperienceCardPresentation; focused?: boolean; onChange?: (change: PersonalLearningChange) => void;
  onSignalNavigateNext?: () => void; onSignalNavigatePrevious?: () => void;
}) {
  const collection = useMediaCollection(mediaContext, 5, "", undefined, true);
  const items = mediaContext && collection.page ? collection.page.items.map(i => collectionDisplayItem(i, mediaContext)) : [];
  return <div className={`focused-card-back-layout back-card-face-content ${focused ? "back-card-face-content--focused" : "back-card-face-content--preview"}`}>
    <CardSemanticAnchors card={card} dateLabel="" showProgress={false} variant="back" />
    <div className="focused-card-back-shell">
      {collection.page?.capabilities?.canManage && onEditMedia ? <MediaCentreControl total={collection.page.total} onOpen={focused ? () => onEditMedia(card.id) : undefined} /> : null}
      <BackCardMediaCarousel items={items} showPrivate={mediaContext?.kind === "owner" && Boolean(mediaContext.experienceId)} onOpen={focused && onOpenMedia ? (key, source) => onOpenMedia(card.id, key, source, undefined, collection.page ?? undefined) : undefined} />
      <section className={`focused-card-back-signals ${items.length ? "" : "focused-card-back-signals--no-media"} group-back-signals`} aria-label="Card progress and confidence">
      {card.steps.map((step, i) => {
        const reading = card.learning.signalReadings.find(row => row.stepId === step.stepId)?.reading ?? null;
        const aggregate = card.aggregates?.steps.find(row => row.stepId === step.stepId);
        const signal = { id: step.stepId, title: step.title ?? `Step ${i + 1}`, value: reading === null ? 0 : signalReadingToNormalized(reading), reading, rawReading: reading,
          variant: (["recovery", "movement", "load"] as const)[i % 3], unit: null, order: "increasing" as const };
        const heading = <span className="group-back-heading"><span>{signal.title}</span>
          {aggregate && aggregate.followers.eligibleTotal > 0 ? <span className="group-step-counts" aria-label={card.aggregatePending?.progressSteps?.includes(step.stepId) ? "Updating follower progress" : `${aggregate.followers.doing} doing, ${aggregate.followers.done} done`}><AggregateValue pending={card.aggregatePending?.progressSteps?.includes(step.stepId)}>{aggregate.followers.doing}</AggregateValue>{"\u00a0\u00a0"}<AggregateValue pending={card.aggregatePending?.progressSteps?.includes(step.stepId)}>{aggregate.followers.done}</AggregateValue></span> : null}
          <StepProgressStrip completionStatus={step.completionStatus} />
        </span>;
        // Keep the same SVG/row through perspective changes. Security identity
        // resets gesture preview independently; focused read-only rows own gestures but
        // never acquire learning mutation capabilities.
        return focused ? <FocusedSignalRow key={step.stepId} signal={signal} cardId={card.id} heading={heading}
          readOnly={!card.canWriteLearning || !onChange} readOnlyReason={!card.canWriteLearning ? readOnlyReason : undefined} interactionIdentity={card.dataIdentity}
          onCommitSignalReading={(_cardId, stepId, value) => { if (card.canWriteLearning) onChange?.({ kind: "signal", stepId, reading: value }); }}
          onSignalNavigateNext={onSignalNavigateNext} onSignalNavigatePrevious={onSignalNavigatePrevious} />
          : <PassiveSignalRow key={step.stepId} signal={signal} heading={heading} />;
      })}
    </section>
      {reflectionContext ? <ReflectionArea verticalOffset={items.length ? 0 : -10} context={reflectionContext} active={focused} interactive={focused && reflectionInteractive} onModalChange={onReflectionModalChange} /> : null}
    </div>
  </div>;
}
