/** Shared presentation contract; action meaning and progression stay with each activity. */
export type PresentationAction = Readonly<{
  id: string;
  label: string;
  enabled: boolean;
  appearance: "primary" | "secondary";
  directionCue?: boolean;
  unavailableReason?: string;
}>;
