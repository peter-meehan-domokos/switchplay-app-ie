import type { CardContent, DeckContent } from "@/lib/cards/model";
import { createDefaultCardContent, createDefaultDeckContent, DEFAULT_CREATOR_CARD_TITLE, DEFAULT_CREATOR_DECK_TITLE } from "@/lib/cards/creatorDefaults";
import { cardPublicationIssue, deckPublicationIssue, sameContent, hasVisibilityChange, type PublicationVisibility } from "@/lib/cards/publicationRules";

type Lane<C> = {
  desired: C;
  desiredVisibility?: import("@/lib/cards/model").Visibility;
  ack: { root: { latestVersion: number; draft: C | null } & Partial<PublicationVisibility>; content: C; publishedContent: C | null } | null;
  dirty: boolean;
  running: unknown;
  error: { kind: string } | null;
  publishing: boolean;
  creationPending: boolean;
  pendingOperations: number;
  tasks: unknown[];
  uncertainSaves: unknown[];
  uncertainPublication: unknown;
};
export type PublicationPresentation = {
  visible: boolean;
  outstanding: boolean;
  cleanPublished: boolean;
  publishing: boolean;
  busy: boolean;
  eligible: boolean;
  blockedReason: string | null;
};

function presentation<C>(lane: Lane<C>, defaults: C, issue: string | null): PublicationPresentation {
  const baseline = lane.ack?.publishedContent ?? defaults;
  const outstanding = !sameContent(lane.desired, baseline) || !!lane.ack && (!sameContent(lane.ack.content, baseline)
    || hasVisibilityChange(lane.ack.root.visibility ? lane.ack.root as PublicationVisibility : undefined))
    || lane.desiredVisibility !== undefined && lane.desiredVisibility !== (lane.ack?.root.visibility ?? "private");
  const busy = !!lane.running || lane.creationPending || lane.pendingOperations > 0 || lane.tasks.length > 0;
  const uncertain = lane.uncertainSaves.length > 0 || !!lane.uncertainPublication;
  const reason = lane.error ? lane.error.kind === "conflict" || lane.error.kind === "recovery"
    ? "Resolve the save conflict before publishing. Your local edits have been retained."
    : "These changes could not be saved. Retry the affected save before publishing."
    : issue === "CARD_FIRST_PUBLICATION_TITLE_REQUIRED" ? `Give this Card a nonblank title different from ${DEFAULT_CREATOR_CARD_TITLE} before its first publication.`
    : issue === "DECK_FIRST_PUBLICATION_TITLE_REQUIRED" ? `Give this Deck a nonblank title different from ${DEFAULT_CREATOR_DECK_TITLE} before its first publication.`
    : issue === "UNPUBLISHED_CARDS_BLOCK_DECK" ? "Every Card referenced by this Deck must be published at least once before the Deck can be published. Newer Card drafts do not need to be published."
    : issue === "PRIVATE_CARDS_BLOCK_PUBLIC_DECK" ? "Every Card in a public Deck must already be published publicly. Publish private Cards publicly before publishing this Deck."
    : issue && issue !== "NO_UNPUBLISHED_CHANGES" ? "The saved publication references could not be resolved. Reload only after saving your local work."
    : null;
  return {
    visible: (lane.ack?.root.latestVersion ?? 0) >= 1 || outstanding,
    outstanding,
    cleanPublished: !!lane.ack && lane.ack.root.latestVersion >= 1 && lane.ack.publishedContent !== null && !outstanding && !lane.dirty && !busy && !uncertain && !lane.error && !lane.publishing,
    publishing: lane.publishing, busy,
    eligible: !!lane.ack && issue === null && !lane.error && !lane.publishing && !busy && !uncertain,
    blockedReason: outstanding && !busy && !lane.publishing ? reason : null,
  };
}

export function cardPublicationPresentation(lane: Lane<CardContent>): PublicationPresentation {
  const saved = lane.ack;
  return presentation(lane, createDefaultCardContent(lane.desired.steps.map((step) => step.stepId)),
    saved ? cardPublicationIssue(saved.root.latestVersion, saved.root.draft, saved.publishedContent, saved.root.visibility ? saved.root as PublicationVisibility : undefined) : null);
}
export function deckPublicationPresentation(lane: Lane<DeckContent>, cards: readonly { cardTemplateId: string; latestVersion: number; visibility?: import("@/lib/cards/model").Visibility }[]): PublicationPresentation {
  const saved = lane.ack;
  return presentation(lane, createDefaultDeckContent(lane.desired.themes.map((theme) => theme.id)),
    saved ? deckPublicationIssue(saved.root.latestVersion, saved.root.draft, saved.publishedContent, cards, saved.root.visibility ? saved.root as PublicationVisibility : undefined) : null);
}
