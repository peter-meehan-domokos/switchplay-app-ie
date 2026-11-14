/** Activity contract only; final disclosure must be approved before Phase 5 sends requests. */
export const GROUP_EXPERIENCE_SCOPE = {
  scopeId: "shared-group-experiences",
  sites: ["puckle", "switchplay", "strat17"],
  activity: "Equivalent Group Experiences across all three websites",
  includesLiveTuition: false,
} as const;
export type ApprovalStatus = "not-requested" | "pending" | "approved" | "declined" | "withdrawn";
export type ApprovalExplanation = { version: string; text: string };
export type ApprovalEvent = {
  kind: "requested" | "resent" | "approved" | "declined" | "withdrawn" | "revoked";
  actor: { kind: "student" | "guardian" | "operator"; reference: string };
  at: Date; reason?: string;
  scopeId: typeof GROUP_EXPERIENCE_SCOPE.scopeId;
  explanation: ApprovalExplanation;
};
export type GroupExperienceApproval = {
  scopeId: typeof GROUP_EXPERIENCE_SCOPE.scopeId;
  status: ApprovalStatus;
  generation: number;
  explanation: ApprovalExplanation;
  sourceSite?: (typeof GROUP_EXPERIENCE_SCOPE.sites)[number];
  guardianEmail?: string;
  guardianDeclaration?: { textVersion: string; declaredAt: Date; emailConfirmedAt: Date };
  requestedAt?: Date; decidedAt?: Date; withdrawnAt?: Date;
  delivery?: { status: "pending" | "sent" | "failed" | "unknown"; attemptedAt?: Date; reference?: string };
  history: ApprovalEvent[];
};
