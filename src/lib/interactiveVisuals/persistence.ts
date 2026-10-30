import type { VisualHostEvent } from "../../app/step-visuals/core/host";

export type VisualOrigin = Readonly<{
  kind: "card" | "direct" | "framework";
  cardId?: string; cardVersion?: number; mode?: "working" | "canonical"; deckId?: string; deckVersion?: number;
  stepId?: string; attachmentId?: string; frameworkId?: string; frameworkItemId?: string;
}>;
export type OpenVisual = Readonly<{ activityId: string; attemptId: string; attemptNumber?: number; snapshot: unknown | null }>;
export type VisualPersistence = Readonly<{
  statusLabel: string;
  subscribe?: (attemptId: string, listener: (status: string) => void) => () => void;
  flush?: (attemptId: string) => Promise<void>;
  startNewAttempt?: (opened: OpenVisual) => Promise<OpenVisual>;
  canStartNewAttempt?: (attemptId: string) => boolean;
  open: (activityId: string, origin: VisualOrigin) => Promise<OpenVisual>;
  save: (opened: OpenVisual, snapshot: unknown, events: readonly VisualHostEvent[]) => Promise<void>;
}>;
