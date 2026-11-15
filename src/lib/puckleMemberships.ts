import type { ObjectId } from "mongodb";
export type MembershipCategory = "student" | "teacher";
export type MathsCourse = "leaving-cert" | "junior-cycle" | "gcse" | "a-level" | "other" | "dont-know";
export type MathsLevel = "higher" | "ordinary" | "foundation" | "higher-tier" | "foundation-tier" | "other" | "dont-know";
export type Education = { course: MathsCourse; courseOther: string | null; level: MathsLevel | null; levelOther: string | null };
export type FounderNotification = { status: "pending" | "sent" | "failed" | "unknown"; attemptedAt?: Date; reference?: string };
export type PuckleMembership = {
  userId: ObjectId; name: string; registrationCategory: MembershipCategory; mobile: string | null;
  education?: Education; teacherIntroduction?: string;
  initialRegistrationSource: "join" | "admin-script" | "invitation" | "unknown";
  provisioning?: { method: "known-account-backfill"; recordedAt: Date; recordedBy: string };
  welcome: { eligible: boolean; seenAt?: Date };
  createdAt: Date; updatedAt: Date; founderNotification?: FounderNotification;
};
export type NoEmailJoinContact = {
  kind: "no-email-join-request"; noEmailReason: "no-email-address";
  registrationCategory: MembershipCategory; name: string; mobile: string;
  submittedDateOfBirth?: string; education?: Education; teacherIntroduction?: string;
  createdAt: Date; founderNotification: FounderNotification;
};
export type InterestContact = {
  name: string; email: string | null; mobile: string | null; reason: string; message: string;
  communication: { emailUpdates: boolean; source: string; wordingVersion: string; recordedAt: Date };
  createdAt: Date; founderNotification: FounderNotification;
};
/** Transient contracts only; no verification/token workflow in Phase 1. */
export type AccountEmailChallenge = {
  challengeId: string; flowBindingDigest: string; email: string; codeDigest: string;
  expiresAt: Date; cleanupAt: Date; attempts: number; generation: number; usedAt?: Date;
  delivery: FounderNotification;
};
export type AccountEmailAction = {
  purpose: "password-reset" | "parent-request" | "parent-management";
  userId: ObjectId; scopeId?: "shared-group-experiences"; tokenDigest: string;
  generation: number; recipient: string; expiresAt: Date; cleanupAt: Date; usedAt?: Date;
  /** A newer link of the same purpose superseded this one; it may only renew, never decide. */
  replacedAt?: Date; sourceSite?: "puckle" | "switchplay" | "strat17";
  delivery: FounderNotification;
};
export type EmailRequestLimit = { _id: string; count: number; expiresAt: Date };
