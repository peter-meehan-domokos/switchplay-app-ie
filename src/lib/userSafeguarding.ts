// Server-side persistence helper: never import into public account DTOs or client components.
import { ObjectId, type Db } from "mongodb";
import { ageOn, dublinToday, parseDateOfBirth } from "./age";
import { GROUP_EXPERIENCE_SCOPE, type GroupExperienceApproval } from "./parentalApprovalScope";
export type DobSource = "self-declared" | "operator-entered";
export type AgeAssurance = { verification: "none" } | {
  verification: "independent"; method: string; verifiedAt: Date; evidenceReference: string;
};
export function parseAgeAssurance(value: unknown): AgeAssurance {
  if (!value || typeof value !== "object") throw new Error("INVALID_AGE_ASSURANCE");
  const data = value as Record<string, unknown>;
  if (data.verification === "none" && Object.keys(data).length === 1) return { verification: "none" };
  if (data.verification === "independent" && typeof data.method === "string" && data.method.trim()
    && typeof data.evidenceReference === "string" && data.evidenceReference.trim()
    && data.verifiedAt instanceof Date && Number.isFinite(data.verifiedAt.getTime())
    && Object.keys(data).every(key => ["verification", "method", "verifiedAt", "evidenceReference"].includes(key))) {
    return { verification: "independent", method: data.method, verifiedAt: data.verifiedAt, evidenceReference: data.evidenceReference };
  }
  throw new Error("INVALID_AGE_ASSURANCE");
}
export type DobCorrection = {
  previous: string | null; next: string; previousSource?: DobSource; source: DobSource;
  actor: string; reason: string; at: Date; invalidatedAssurance: AgeAssurance;
};
export type UserSafeguarding = {
  dateOfBirth?: string; dobSource?: DobSource; dobRecordedAt?: Date;
  ageAssurance?: AgeAssurance; dateOfBirthHistory?: DobCorrection[];
  groupExperienceApproval?: GroupExperienceApproval;
};
export async function getSafeguardingFacts(db: Db, userId: ObjectId, today = dublinToday()) {
  const user = await db.collection<{ safeguarding?: UserSafeguarding }>("users").findOne({ _id: userId }, { projection: { safeguarding: 1 } });
  if (!user) throw new Error("ACCOUNT_NOT_FOUND");
  const data = user.safeguarding;
  return {
    dateOfBirth: data?.dateOfBirth ?? null,
    age: data?.dateOfBirth ? ageOn(data.dateOfBirth, today) : null,
    dobSource: data?.dobSource ?? null,
    ageAssurance: data?.ageAssurance ? parseAgeAssurance(data.ageAssurance) : { verification: "none" as const },
    groupExperienceApproval: data?.groupExperienceApproval ?? null,
    approvalScopeId: GROUP_EXPERIENCE_SCOPE.scopeId,
    approvalStatus: data?.groupExperienceApproval?.status ?? "not-requested",
  };
}
/** Trusted operator process only; no HTTP entry, account creation or approval decision. */
export async function correctDateOfBirth(db: Db, userId: ObjectId, correction: {
  expected: string | null; next: string; source: DobSource; actor: string; reason: string; at: Date;
}) {
  parseDateOfBirth(correction.next); ageOn(correction.next, dublinToday(correction.at));
  if (!correction.actor.trim() || !correction.reason.trim() || !["self-declared", "operator-entered"].includes(correction.source)) throw new Error("REVIEW_DETAILS_REQUIRED");
  const users = db.collection<{ safeguarding?: UserSafeguarding }>("users");
  const user = await users.findOne({ _id: userId }, { projection: { safeguarding: 1 } });
  if (!user || (user.safeguarding?.dateOfBirth ?? null) !== correction.expected) throw new Error("DOB_CORRECTION_CONFLICT");
  if (correction.next === correction.expected) return;
  const previousAssurance = user.safeguarding?.ageAssurance;
  const event: DobCorrection = { previous: correction.expected, next: correction.next,
    ...(user.safeguarding?.dobSource ? { previousSource: user.safeguarding.dobSource } : {}),
    source: correction.source, actor: correction.actor, reason: correction.reason, at: correction.at,
    invalidatedAssurance: previousAssurance ? parseAgeAssurance(previousAssurance) : { verification: "none" } };
  const result = await users.updateOne({ _id: userId,
    "safeguarding.dateOfBirth": correction.expected ?? { $exists: false },
    "safeguarding.ageAssurance": previousAssurance ?? { $exists: false },
  }, { $set: { "safeguarding.dateOfBirth": correction.next, "safeguarding.dobSource": correction.source,
    "safeguarding.dobRecordedAt": correction.at, "safeguarding.ageAssurance": { verification: "none" } },
    $push: { "safeguarding.dateOfBirthHistory": event } });
  if (result.matchedCount !== 1) throw new Error("DOB_CORRECTION_CONFLICT");
}
