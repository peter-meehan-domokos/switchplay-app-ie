import { timingSafeEqual } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { validateCommunicationPreferences, type PreferencesAudience, type StoredPreferences } from "@/app/sites/puckle/lib/communicationPreferences";
import { normaliseMobile } from "@/app/sites/puckle/lib/membershipRegistration";
import { getCurrentUser } from "./auth";
import { securityError, securityJson, securityRequest } from "./accountSecurityHttp";
import { protectedDigest } from "./emailActionTokens";
import type { InterestContact, PuckleMembership } from "./puckleMemberships";
import { getDatabase } from "./mongodb";
import { getCurrentSite } from "./sites/getCurrentSite";

/**
 * Changing communication preferences after sign-up: signed-in students and teachers (Settings), and interested parties who gave an
 * email address, through a signed management link (no account). Both use the one authoritative validator.
 */
export type EditableState = { audience: PreferencesAudience; stored: StoredPreferences | null; hasMobile: boolean };

type Body = Record<string, unknown>;
const KEYS = ["communicationPreferences", "mobile", "phoneCountryCode"];
function body(value: unknown): Body {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !KEYS.includes(key))) throw new Error("PREFERENCES_INVALID");
  return value as Body;
}
/** A mobile number may be added while saving (Text needs one). An existing number is never replaced here. */
function mobileToAdd(input: Body, existing: string | null): string | null {
  if (existing || typeof input.mobile !== "string" || !input.mobile.trim()) return null;
  const countryCode = typeof input.phoneCountryCode === "string" ? input.phoneCountryCode : "IE";
  return normaliseMobile(input.mobile.slice(0, 30), countryCode.slice(0, 5)) || null;
}
function validated(input: Body, audience: PreferencesAudience, email: string | null, existingMobile: string | null, source: string, now: Date) {
  const added = mobileToAdd(input, existingMobile);
  const stored = validateCommunicationPreferences(input.communicationPreferences, audience, { email, mobile: existingMobile ?? added }, source, now);
  return { stored, added };
}

// ---- signed-in students and teachers ------------------------------------------------------------
const memberships = (db: Db) => db.collection<PuckleMembership & { _id: ObjectId }>("puckleMemberships");
export async function loadMemberPreferences(db: Db, userId: ObjectId): Promise<EditableState | null> {
  const membership = await memberships(db).findOne({ userId }, { projection: { registrationCategory: 1, mobile: 1, communicationPreferences: 1 } });
  if (!membership) return null;
  return { audience: membership.registrationCategory, stored: membership.communicationPreferences ?? null, hasMobile: !!membership.mobile };
}
/** Only the account's own membership can be changed; the email address is the account's verified one. */
export async function saveMemberPreferences(db: Db, userId: ObjectId, value: unknown, now = new Date()): Promise<StoredPreferences> {
  const input = body(value);
  const [membership, user] = await Promise.all([
    memberships(db).findOne({ userId }),
    db.collection<{ _id: ObjectId; email?: string }>("users").findOne({ _id: userId }, { projection: { email: 1 } }),
  ]);
  if (!membership || !user) throw new Error("NO_MEMBERSHIP");
  const { stored, added } = validated(input, membership.registrationCategory, user.email ?? null, membership.mobile, "account-settings", now);
  await memberships(db).updateOne({ _id: membership._id }, { $set: { communicationPreferences: stored, updatedAt: now, ...(added ? { mobile: added } : {}) } });
  return stored;
}

// ---- interested parties with an email address: signed management link ---------------------------
const COLLECTION = "puckleInterestContacts";
const TOKEN = /^([0-9a-f]{24})\.([0-9a-f]{64})$/;
const digestFor = (id: string) => protectedDigest("puckle-preferences-link-v1", COLLECTION, id);
/** An unguessable link for one interest record. It only ever reaches that record's communication choices. */
export function manageToken(id: ObjectId): string { const hex = id.toHexString(); return `${hex}.${digestFor(hex)}`; }
export const manageLink = (id: ObjectId) => `/preferences/manage#${manageToken(id)}`;
export function idFromManageToken(token: unknown): ObjectId | null {
  const match = typeof token === "string" ? TOKEN.exec(token) : null;
  if (!match) return null;
  const expected = Buffer.from(digestFor(match[1])), given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? new ObjectId(match[1]) : null;
}
const contacts = (db: Db) => db.collection<InterestContact & { _id: ObjectId }>(COLLECTION);
async function recordFor(db: Db, token: unknown) {
  const id = idFromManageToken(token);
  // Only email sign-ups have a link; a mobile-only request is managed by texting Puckle.
  return id ? contacts(db).findOne({ _id: id, email: { $ne: null } }) : null;
}
export async function loadInterestPreferences(db: Db, token: unknown): Promise<EditableState | null> {
  const record = await recordFor(db, token);
  return record ? { audience: "interest", stored: record.communicationPreferences ?? null, hasMobile: !!record.mobile } : null;
}
export async function saveInterestPreferences(db: Db, token: unknown, value: unknown, now = new Date()): Promise<StoredPreferences> {
  const input = body(value), record = await recordFor(db, token);
  if (!record) throw new Error("INVALID_LINK");
  const { stored, added } = validated(input, "interest", record.email, record.mobile, "preferences-link", now);
  await contacts(db).updateOne({ _id: record._id }, { $set: { communicationPreferences: stored, ...(added ? { mobile: added } : {}) } });
  return stored;
}

// ---- HTTP boundaries -------------------------------------------------------------------------------
const VALIDATION_CODE = /^[A-Z0-9_]{3,40}$/;
const ACCEPTED = new Set(["PREFERENCES_INVALID", "PREFERENCES_INCOMPLETE", "CHANNELS_WITHOUT_CONSENT", "CHANNEL_REQUIRED", "EMAIL_CHANNEL_NEEDS_EMAIL", "SMS_CHANNEL_NEEDS_MOBILE", "INVALID_MOBILE"]);
const refuse = (status: number, code: string) => securityJson({ ok: false, code }, status);
const outcome = (error: unknown) => {
  const code = error instanceof Error && VALIDATION_CODE.test(error.message) ? error.message : null;
  return code && ACCEPTED.has(code) ? refuse(400, code) : securityError(error);
};
const view = (stored: StoredPreferences) => ({ answers: stored.answers, channels: stored.channels });

/** Settings: the signed-in student or teacher edits their own choices. */
export async function memberPreferencesResponse(request: Request) {
  try {
    if ((await getCurrentSite()) !== "puckle") return refuse(404, "NOT_FOUND");
    const { body: input } = await securityRequest(request);
    const user = await getCurrentUser();
    if (!user) return refuse(401, "SIGN_IN_REQUIRED");
    return securityJson({ ok: true, preferences: view(await saveMemberPreferences(await getDatabase(), new ObjectId(user.id), input)) });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_MEMBERSHIP") return refuse(404, "NO_MEMBERSHIP");
    return outcome(error);
  }
}
/** Management link: load or save the choices of the interest record the token belongs to. */
export async function managePreferencesResponse(request: Request) {
  try {
    if ((await getCurrentSite()) !== "puckle") return refuse(404, "NOT_FOUND");
    const { body: input } = await securityRequest(request);
    const { action, token, ...rest } = input as Body;
    const db = await getDatabase();
    if (action === "load") {
      const state = await loadInterestPreferences(db, token);
      return state ? securityJson({ ok: true, hasMobile: state.hasMobile, preferences: state.stored ? view(state.stored) : null }) : refuse(404, "INVALID_LINK");
    }
    if (action === "save") return securityJson({ ok: true, preferences: view(await saveInterestPreferences(db, token, rest)) });
    return refuse(400, "INVALID_SUBMISSION");
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_LINK") return refuse(404, "INVALID_LINK");
    return outcome(error);
  }
}
