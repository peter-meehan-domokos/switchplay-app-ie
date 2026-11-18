/** Activity contract. The explanation below is a DRAFT: its wording must be reviewed and approved before public launch. */
export const GROUP_EXPERIENCE_SCOPE = {
  scopeId: "shared-group-experiences",
  sites: ["puckle", "switchplay", "strat17"],
  activity: "Equivalent group learning across all three websites",
  includesLiveTuition: false,
} as const;
/** Where parents and students get help with approval and account access. Replies to account emails also go here. */
export const SUPPORT_EMAIL = "support@puckleup.com";
/** One common disclosure, in Puckle's name only. Versioned: a new text needs a new version, so past approvals keep the wording the parent actually read. */
export const GROUP_EXPERIENCE_EXPLANATION = {
  // v5: reworded and given a contact list. Each approval stores the text its parent actually saw, so earlier approvals and pending links are unaffected.
  version: "shared-group-experiences-v5-draft",
  // Paragraphs are separated by a blank line. A paragraph whose lines all start with "- " is shown as a list; email addresses and phone numbers are shown as links.
  text: [
    "Puckle is a learning platform led by qualified and experienced secondary school maths teachers. Your child can study independently and take part in optional teacher-led activities.",
    "Group learning allows students to work through teacher-provided learning materials at their own pace, with the teacher overseeing their progress and participation. Students can share their ideas, reflections and ways of doing things to help others learn. Anything they share is visible to the entire group and supervised by the teacher. Students cannot comment on each other's work, and there is no private messaging or sharing between students. Your child's personal learning outside the group remains private.",
    "Students under 16 need a parent or guardian's approval to take part in group learning. This approval does not cover live tuition, which is arranged separately with you.",
    "To discuss group learning or withdraw your approval, you can:",
    `- Reply to the email we sent you.\n- Email ${SUPPORT_EMAIL}.\n- Call us on +353 85 207 6241 (Ireland) or +44 7547 196642 (UK).`,
    "Withdrawing approval stops future participation but does not delete your child's learning.",
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
  decisionFounderNotification?: { status: "pending" | "sent" | "failed" | "unknown"; attemptedAt?: Date; reference?: string };
  founderNotification?: { status: "pending" | "sent" | "failed" | "unknown"; attemptedAt?: Date; reference?: string };
  guardianDeclaration?: { textVersion: string; declaredAt: Date; emailConfirmedAt: Date };
  requestedAt?: Date; decidedAt?: Date; withdrawnAt?: Date;
  delivery?: { status: "pending" | "sent" | "failed" | "unknown"; attemptedAt?: Date; reference?: string };
  history: ApprovalEvent[];
};
