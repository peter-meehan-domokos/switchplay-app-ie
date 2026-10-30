/** Platform-neutral boundary. Only the visual decides whether a transition is legal. */
export type VisualContentDimensions = Readonly<{ width: number; height: number }>;
export type VisualHostControls = Readonly<{
  stageId: string; atStart: boolean; completed: boolean;
  canStartNewAttempt?: boolean;
  previous?: Readonly<{ enabled: boolean; run: () => void }>;
  next?: Readonly<{ enabled: boolean; run: () => void; label?: "Next" | "Finish" }>;
  backToStart?: () => void;
  startNewAttempt?: () => void;
}>;
export type VisualHostEvent = Readonly<{ eventId: string; sequence: number; type: string }>;
export type HostedVisualProps = Readonly<{
  attemptId: string;
  attemptNumber?: number;
  initialSnapshot: unknown | null;
  dimensions: VisualContentDimensions;
  onControls: (controls: VisualHostControls) => void;
  /** Resolves after local queue acceptance. It must be idempotent for repeated effects. */
  onChange: (snapshot: unknown, events: readonly VisualHostEvent[]) => Promise<void>;
}>;
