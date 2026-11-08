"use client";
import { useState } from "react";
import type { CardLayout } from "@/components/cards/cardLayout";
import FocusedCardView, { type FocusedCardViewProps } from "./FocusedCardView";
import { dateOnlyToUtcDate } from "@/lib/dateOnly";
import BackCardFaceContent from "./BackCardFaceContent";
import ReflectionArea from "@/components/reflections/ReflectionArea";
type WorkingFocusedCardViewProps = Omit<FocusedCardViewProps, "card" | "backFace" | "overlays" | "interactionLocked"> & {
  card: CardLayout;
  assessmentOpen?: boolean;
  backAssessment?: import("react").ReactNode;
  canMutate: boolean;
  onCommitSignalReading: (cardId: string, signalId: string, reading: number) => void;
  onCommitReflection?: (cardId: string, reflection: string) => Promise<void>;
  onOpenMediaCentre?: (cardId: string) => void; mediaCentreOpen?: boolean;
};
export default function WorkingFocusedCardView({ card, deckTemplateId, canMutate, assessmentOpen = false, backAssessment, onCommitSignalReading,
  onCommitReflection, onOpenMediaCentre, mediaCentreOpen, ...navigation }: WorkingFocusedCardViewProps) {
  const [reflectionOpen, setReflectionOpen] = useState(false);
  void onCommitReflection;
  const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(dateOnlyToUtcDate(card.targetDate));
  return <FocusedCardView {...navigation} card={card} deckTemplateId={deckTemplateId}
    interactionLocked={assessmentOpen || reflectionOpen || Boolean(mediaCentreOpen)}
    backFace={<BackCardFaceContent
      assessment={backAssessment}
      card={card} deckTemplateId={deckTemplateId} dateLabel={dateLabel} variant="focused" canMutate={canMutate}
      onCommitSignalReading={onCommitSignalReading}
      onEditMedia={onOpenMediaCentre}
      reflectionArea={card.dataOwnerUserId ? offset => <ReflectionArea interactive={canMutate} verticalOffset={offset} context={{ viewerUserId: card.dataOwnerUserId!, cardTemplateId: card.id, deckTemplateId, view: { kind: "personal" } }} onModalChange={setReflectionOpen} /> : undefined}
      />}
    />;
}
