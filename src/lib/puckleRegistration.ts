import { prelaunchAccessFor } from "./prelaunch";
import { readSessionToken } from "./sessionToken";
import { ObjectId, type Db, type MongoClient } from "mongodb";
import { after } from "next/server";
import { dublinToday } from "./age";
import { accountConflict, insertAccount, prepareAccountCredentials, writePreparedSessionCookie } from "./auth";
import { consumeEmailProof, hasVerifiedEmailProof } from "./accountEmailChallenges";
import { securityError, securityJson, securityRequest } from "./accountSecurityHttp";
import { limitRequesterAction } from "./emailRequestLimits";
import { notifyFounder } from "./founderNotifications";
import { getDatabase, getMongoClient, withMongoTransaction } from "./mongodb";
import { saveInterestContact, saveNoEmailJoinContact } from "./puckleJoinContacts";
import type { MembershipCategory, PuckleMembership } from "./puckleMemberships";
import { getCurrentSite } from "./sites/getCurrentSite";
import { newSelfDeclaredSafeguarding } from "./userSafeguarding";
import { founderStudentRegistrationEmail, founderTeacherRegistrationEmail } from "@/app/sites/puckle/lib/memberEmailTemplates";
import { validateRegistrationDetails, type RegistrationDetails } from "@/app/sites/puckle/lib/membershipRegistration";

/** Explicit Puckle orchestration: shared account helpers + Puckle profile, in one transaction. */
export type RegistrationInput = {
  details: unknown; username: unknown; password: unknown; challengeId: unknown; flowToken: unknown; proof: unknown;
};
export type RegisterOutcome =
  | { kind: "created"; userId: ObjectId; membershipId: ObjectId; category: MembershipCategory; sessionToken: string; notify?: () => Promise<void> }
  | { kind: "invalid"; code: string }
  | { kind: "proof" }
  | { kind: "conflict"; field: "username" | "email" };

const VALIDATION_CODE = /^[A-Z0-9_]{3,40}$/;
const CREDENTIAL_CODES = new Set(["INVALID_USERNAME", "INVALID_EMAIL", "INVALID_NEW_PASSWORD"]);
const codeOf = (error: unknown) => error instanceof Error && VALIDATION_CODE.test(error.message) ? error.message : null;

export async function registerPuckleMember(
  db: Db, client: MongoClient, input: RegistrationInput,
  options: { now?: Date; prepare?: typeof prepareAccountCredentials } = {},
): Promise<RegisterOutcome> {
  const now = options.now ?? new Date();
  let details: RegistrationDetails;
  try { details = validateRegistrationDetails(input.details, "email", dublinToday(now), now); }
  catch (error) { return { kind: "invalid", code: codeOf(error) ?? "INVALID_SUBMISSION" }; }
  if (!await hasVerifiedEmailProof(db, { challengeId: input.challengeId as string, flowToken: input.flowToken as string, proof: input.proof, email: details.email }, now)) return { kind: "proof" };
  // Session signing and hashing happen before the transaction. A failure here creates nothing.
  const prepared = await (options.prepare ?? prepareAccountCredentials)({ username: input.username, email: details.email, password: input.password }, now)
    .catch((error: unknown) => { const code = codeOf(error); if (code && CREDENTIAL_CODES.has(code)) return code; throw error; });
  if (typeof prepared === "string") return { kind: "invalid", code: prepared };
  const membershipId = new ObjectId();
  const isStudent = details.registrationCategory === "student";
  const membership: PuckleMembership = {
    userId: prepared.document._id, name: details.name, registrationCategory: details.registrationCategory, mobile: details.mobile,
    ...(details.education ? { education: details.education } : {}),
    ...(details.teacherIntroduction ? { teacherIntroduction: details.teacherIntroduction } : {}),
    initialRegistrationSource: "join", welcome: { eligible: isStudent }, communicationPreferences: details.communicationPreferences, createdAt: now, updatedAt: now,
    founderNotification: { status: "pending" as const }, // every registration alerts the founder; neither needs approval
  };
  const account = isStudent && details.dateOfBirth
    ? { ...prepared, document: { ...prepared.document, safeguarding: newSelfDeclaredSafeguarding(details.dateOfBirth, now) } }
    : prepared;
  try {
    await withMongoTransaction(client, async (session) => {
      // Proof, account and profile commit together; any failure (including a duplicate key) leaves the proof reusable.
      const verifiedAt = await consumeEmailProof(db, session, {
        challengeId: input.challengeId as string, flowToken: input.flowToken as string, proof: input.proof as string, email: details.email,
      }, new Date());
      await insertAccount(db, session, account, verifiedAt);
      await db.collection<PuckleMembership & { _id: ObjectId }>("puckleMemberships").insertOne({ _id: membershipId, ...membership }, { session });
    });
  } catch (error) {
    const conflict = accountConflict(error);
    if (conflict) return { kind: "conflict", field: conflict };
    if (error instanceof Error && error.message === "INVALID_EMAIL_PROOF") return { kind: "proof" };
    throw error;
  }
  return {
    kind: "created", userId: prepared.document._id, membershipId, category: details.registrationCategory, sessionToken: prepared.sessionToken,
    notify: () => notifyFounder(db, { collection: "puckleMemberships", id: membershipId }, isStudent
      ? founderStudentRegistrationEmail({ id: membershipId.toHexString(), name: details.name, username: prepared.document.username, email: details.email!, mobile: details.mobile, education: details.education, registeredAt: now, preferences: details.communicationPreferences })
      : founderTeacherRegistrationEmail({ id: membershipId.toHexString(), name: details.name, email: details.email!, mobile: details.mobile, introduction: details.teacherIntroduction ?? "", preferences: details.communicationPreferences })),
  };
}

// ---- HTTP boundary -------------------------------------------------------------------------
const JOIN_MAX_BYTES = 16_384;
type Handled = { response: Response; notify?: () => Promise<void> };
const refuse = (status: number, code: string, extra: Record<string, unknown> = {}) => ({ response: securityJson({ ok: false, code, ...extra }, status) });
function strict(body: unknown, keys: string[]): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) return null;
  return body as Record<string, unknown>;
}
async function closedToThisRequest() { return (await getCurrentSite()) !== "puckle"; }

export async function handleMembershipRegistration(request: Request): Promise<Handled> {
  try {
    if (await closedToThisRequest()) return refuse(404, "NOT_FOUND");
    const { body } = await securityRequest(request, JOIN_MAX_BYTES);
    const input = strict(body, ["details", "username", "password", "challengeId", "flowToken", "proof"]);
    if (!input) return refuse(400, "INVALID_SUBMISSION");
    const outcome = await registerPuckleMember(await getDatabase(), await getMongoClient(), input as RegistrationInput);
    if (outcome.kind === "invalid") return refuse(400, outcome.code);
    if (outcome.kind === "proof") return refuse(400, "INVALID_EMAIL_PROOF");
    if (outcome.kind === "conflict") return outcome.field === "username" ? refuse(409, "USERNAME_TAKEN", { field: "username" }) : refuse(409, "ACCOUNT_UNAVAILABLE");
    // The account is committed. Cookie failure must never be retried as a second registration.
    const signedIn = await writePreparedSessionCookie(outcome.sessionToken).then(() => true, () => false);
    // In pre-launch mode a non-exempt member lands on the pre-launch welcome (at /decks) instead of the timed registration welcome.
    const prelaunch = prelaunchAccessFor({ site: "puckle", email: (await readSessionToken(outcome.sessionToken))?.email }) === "prelaunch";
    return { response: securityJson({ ok: true, signedIn, category: outcome.category, destination: "/decks", prelaunch }, 201), notify: outcome.notify };
  } catch (error) { return { response: securityError(error) }; }
}

async function handleContact(request: Request, save: (db: Db, body: Record<string, unknown>) => Promise<{ notify: () => Promise<void>; manage?: string }>, keys: string[]): Promise<Handled> {
  try {
    if (await closedToThisRequest()) return refuse(404, "NOT_FOUND");
    const { body, requester } = await securityRequest(request, JOIN_MAX_BYTES);
    const input = strict(body, [...keys, "companyWebsite"]);
    if (!input) return refuse(400, "INVALID_SUBMISSION");
    // Honeypot: pretend success without storing or notifying.
    if (typeof input.companyWebsite === "string" && input.companyWebsite.trim()) return { response: securityJson({ ok: true }, 201) };
    const db = await getDatabase();
    await limitRequesterAction(db, "join-contact", requester, 10, 3600, new Date());
    try { const saved = await save(db, input); return { response: securityJson({ ok: true, ...(saved.manage ? { manage: saved.manage } : {}) }, 201), notify: saved.notify }; }
    catch (error) {
      const code = codeOf(error);
      // Only validator codes are reported. Anything else (including database failure) is a sanitised 503.
      if (code && !["EMAIL_RATE_LIMITED", "EMAIL_CONFIGURATION_REQUIRED", "EMAIL_CONFIGURATION_INVALID"].includes(code)) return refuse(400, code);
      throw error;
    }
  } catch (error) { return { response: securityError(error) }; }
}
export const handleNoEmailContact = (request: Request) => handleContact(request, (db, input) => saveNoEmailJoinContact(db, input.details), ["details"]);
export const handleInterestContact = (request: Request) => handleContact(request, (db, input) => saveInterestContact(db, input.details), ["details"]);
/** Route-handler helper: schedule the founder alert after the response, never awaiting it. */
export function respondAndNotify({ response, notify }: Handled) { if (notify) after(notify); return response; }
