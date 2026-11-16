/** Activity contract. The explanation below is a DRAFT: its wording must be reviewed and approved before public launch. */
export const GROUP_EXPERIENCE_SCOPE = {
  scopeId: "shared-group-experiences",
  sites: ["puckle", "switchplay", "strat17"],
  activity: "Equivalent Group Experiences across all three websites",
  includesLiveTuition: false,
} as const;
/** One common disclosure, in Puckle's name only. Versioned: a new text needs a new version, so past approvals keep the wording the parent actually read. */
export const GROUP_EXPERIENCE_EXPLANATION = {
  version: "shared-group-experiences-v2-draft",
  text: [
    "Puckle is a learning platform run by one team. Your child has a single Puckle account, which they use everywhere Puckle runs.",
    "Group Experiences are optional activities on Puckle where students learn together in a group, for example joining a private group, taking part in shared activities, and sharing their work, comments or views with the other members of that group. Other members of the group can see what your child chooses to share there. Your child's private learning stays private.",
    "Students under 16 need a parent or guardian's approval before taking part. This one approval covers equivalent Group Experiences anywhere in Puckle, so you will not be asked again each time Puckle adds a new site or app. It is not permission for live tuition, which is arranged separately with you.",
    "You can withdraw your approval at any time using the link we email you after you approve, or by contacting us. Withdrawing stops future participation; it does not delete your child's learning.",
  ].join("\n\n"),
} as const;
export const GUARDIAN_DECLARATION = {
  version: "guardian-declaration-v1",
  text: "I am this student's parent or legal guardian, and I have read the explanation above.",
} as const;
export type ApprovalStatus = "not-requested" | "pending" | "approved" | "declined" | "withdrawn";
export type ApprovalExplanation = { version: string; text: string };
export type ApprovalEvent = {
  kind: "requested" | "resent" | "approved" | "declined" | "withdrawn" | "revoked";
  actor: { kind: "student" | "guardian" | "operator"; reference: string };
  at: Date; reason?: string;
  scopeId: typeof GROUP_EXPERIENCE_SCOPE.scopeId;
  explanation: ApprovalExplanation;
  /** Evidence kept on the event so a later re-request never erases what was declared. */
  generation?: number; guardianEmail?: string; declarationVersion?: string;
  sourceSite?: (typeof GROUP_EXPERIENCE_SCOPE.sites)[number];
};
export type GroupExperienceApproval = {
  scopeId: typeof GROUP_EXPERIENCE_SCOPE.scopeId;
  status: ApprovalStatus;
  generation: number;
  explanation: ApprovalExplanation;
  sourceSite?: (typeof GROUP_EXPERIENCE_SCOPE.sites)[number];
  guardianEmail?: string;
  /** Optional, unverified, for personal follow-up only. */
  guardianPhone?: string;
  founderNotification?: { status: "pending" | "sent" | "failed" | "unknown"; attemptedAt?: Date; reference?: string };
  guardianDeclaration?: { textVersion: string; declaredAt: Date; emailConfirmedAt: Date };
  requestedAt?: Date; decidedAt?: Date; withdrawnAt?: Date;
  delivery?: { status: "pending" | "sent" | "failed" | "unknown"; attemptedAt?: Date; reference?: string };
  history: ApprovalEvent[];
};
