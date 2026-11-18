import { createHash } from "node:crypto";
import { ObjectId, type ClientSession, type Db, type Document, type Filter, type MongoClient } from "mongodb";
import { ageOn, dublinToday, parseDateOfBirth } from "./age";
import { withMongoTransaction } from "./mongodb";
import { parseAgeAssurance, type AgeAssurance } from "./userSafeguarding";
import { normaliseMobile, validateEducation } from "@/app/sites/puckle/lib/membershipRegistration";
import type { Education, MembershipCategory } from "./puckleMemberships";

/**
 * One-time, reviewed preparation of EXISTING shared accounts (engineering plan, phase 7).
 * Read-only by default. It never creates users, never touches credentials, sessions, learning data,
 * ownership or publication records, never resets publicPublishingRevision and never infers trust:
 * every existing account must be given an explicit, individually reviewed permission disposition.
 * This is a receipt-bearing one-time script, not a migration framework or an onboarding tool.
 */
export type PermissionState = "missing" | boolean | "malformed";
export type ManifestEntry = {
  userId?: string; email?: string; username?: string;
  publicPublishing: boolean;                       // reviewed disposition (required for EVERY existing account)
  currentPublicPublishing: "missing" | boolean;    // expected current state: a precondition, not a suggestion
  /** Optional reviewed users.isAdmin disposition (the existing field; no new role fields). Needs its expected current state. */
  isAdmin?: boolean; currentIsAdmin?: "missing" | boolean;
  safeguarding?: {
    dateOfBirth: string; expectedDateOfBirth?: string | null;
    dobSource?: "operator-entered" | "self-declared"; selfDeclarationProvenance?: string;
    ageAssurance?: { verification: "independent"; method: string; verifiedAt: string; evidenceReference: string };
    correction?: { actor: string; reason: string };
  };
  puckle?: { name: string; registrationCategory: MembershipCategory; mobile?: string; phoneCountryCode?: string; education?: unknown; teacherIntroduction?: string };
};
export type Manifest = { manifestId: string; reviewedBy: string; reviewedAt: string; accounts: ManifestEntry[] };
type Problem = string;

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const only = (value: Record<string, unknown>, keys: string[], where: string): Problem[] => Object.keys(value).filter(key => !keys.includes(key)).map(key => `${where}: unexpected field "${key}"`);
const text = (value: unknown, where: string, max = 200): Problem[] => typeof value === "string" && value.trim() && value.length <= max ? [] : [`${where}: required text`];

export function parseManifest(raw: unknown): { manifest: Manifest; problems: Problem[] } {
  const problems: Problem[] = [];
  if (!isObject(raw) || !Array.isArray(raw.accounts)) return { manifest: { manifestId: "", reviewedBy: "", reviewedAt: "", accounts: [] }, problems: ["manifest: an object with an accounts array is required"] };
  problems.push(...only(raw, ["manifestId", "reviewedBy", "reviewedAt", "accounts"], "manifest"), ...text(raw.manifestId, "manifestId", 80), ...text(raw.reviewedBy, "reviewedBy"));
  if (typeof raw.reviewedAt !== "string" || Number.isNaN(Date.parse(raw.reviewedAt))) problems.push("reviewedAt: an ISO date is required");
  const seen = new Set<string>();
  raw.accounts.forEach((entry, index) => {
    const where = `accounts[${index}]`;
    if (!isObject(entry)) return void problems.push(`${where}: object required`);
    problems.push(...only(entry, ["userId", "email", "username", "publicPublishing", "currentPublicPublishing", "isAdmin", "currentIsAdmin", "safeguarding", "puckle"], where));
    if (entry.isAdmin !== undefined && typeof entry.isAdmin !== "boolean") problems.push(`${where}: isAdmin must be true or false when given`);
    if (entry.isAdmin !== undefined && entry.currentIsAdmin !== "missing" && typeof entry.currentIsAdmin !== "boolean") problems.push(`${where}: isAdmin needs currentIsAdmin ("missing", true or false) as its precondition`);
    if (entry.isAdmin === undefined && entry.currentIsAdmin !== undefined) problems.push(`${where}: currentIsAdmin without an isAdmin disposition`);
    if (entry.userId === undefined && entry.email === undefined && entry.username === undefined) problems.push(`${where}: identify the account`);
    if (entry.userId !== undefined && !(typeof entry.userId === "string" && /^[a-f\d]{24}$/i.test(entry.userId))) problems.push(`${where}: userId must be a 24-character id`);
    if (typeof entry.userId === "string") { if (seen.has(entry.userId)) problems.push(`${where}: duplicate userId`); seen.add(entry.userId); }
    if (typeof entry.publicPublishing !== "boolean") problems.push(`${where}: publicPublishing must be explicitly true or false (never inferred)`);
    if (entry.currentPublicPublishing !== "missing" && typeof entry.currentPublicPublishing !== "boolean") problems.push(`${where}: currentPublicPublishing must be "missing", true or false`);
    if (entry.safeguarding !== undefined) problems.push(...parseSafeguarding(entry.safeguarding, `${where}.safeguarding`));
    if (entry.puckle !== undefined) problems.push(...parsePuckle(entry.puckle, `${where}.puckle`));
  });
  return { manifest: raw as unknown as Manifest, problems };
}
function parseSafeguarding(value: unknown, where: string): Problem[] {
  if (!isObject(value)) return [`${where}: object required`];
  const problems = only(value, ["dateOfBirth", "expectedDateOfBirth", "dobSource", "selfDeclarationProvenance", "ageAssurance", "correction"], where);
  try { const dob = parseDateOfBirth(value.dateOfBirth); ageOn(dob, dublinToday()); } catch { problems.push(`${where}.dateOfBirth: a real, past YYYY-MM-DD date is required`); }
  if (value.expectedDateOfBirth !== undefined && value.expectedDateOfBirth !== null) { try { parseDateOfBirth(value.expectedDateOfBirth); } catch { problems.push(`${where}.expectedDateOfBirth: invalid`); } }
  if (value.dobSource !== undefined && value.dobSource !== "operator-entered" && value.dobSource !== "self-declared") problems.push(`${where}.dobSource: operator-entered or self-declared`);
  if (value.dobSource === "self-declared") problems.push(...text(value.selfDeclarationProvenance, `${where}.selfDeclarationProvenance (genuine provenance is required to call a date self-declared)`));
  if (value.ageAssurance !== undefined) {
    const a = value.ageAssurance;
    try { if (!isObject(a)) throw new Error("x"); parseAgeAssurance({ ...a, verifiedAt: new Date(String(a.verifiedAt)) }); if (a.verification !== "independent") throw new Error("x"); }
    catch { problems.push(`${where}.ageAssurance: independent evidence needs method, verifiedAt and evidenceReference`); }
  }
  if (value.correction !== undefined) {
    if (!isObject(value.correction)) problems.push(`${where}.correction: object required`);
    else problems.push(...only(value.correction, ["actor", "reason"], `${where}.correction`), ...text(value.correction.actor, `${where}.correction.actor`), ...text(value.correction.reason, `${where}.correction.reason`, 500));
    if (value.ageAssurance !== undefined) problems.push(`${where}: a correction invalidates assurance; supply new evidence in a later reviewed entry`);
  }
  return problems;
}
function parsePuckle(value: unknown, where: string): Problem[] {
  if (!isObject(value)) return [`${where}: object required`];
  const problems = [...only(value, ["name", "registrationCategory", "mobile", "phoneCountryCode", "education", "teacherIntroduction"], where), ...text(value.name, `${where}.name`, 100)];
  if (value.registrationCategory !== "student" && value.registrationCategory !== "teacher") problems.push(`${where}.registrationCategory: student or teacher`);
  if (value.registrationCategory === "teacher" && value.education !== undefined) problems.push(`${where}: a teacher has no maths course/level`);
  if (value.registrationCategory === "student" && value.teacherIntroduction !== undefined) problems.push(`${where}: only teachers have an introduction`);
  if (value.education !== undefined) { try { validateEducation(value.education); } catch (error) { problems.push(`${where}.education: ${error instanceof Error ? error.message : "invalid"}`); } }
  if (typeof value.mobile === "string" && value.mobile.trim()) { try { normaliseMobile(value.mobile, typeof value.phoneCountryCode === "string" ? value.phoneCountryCode : "IE"); } catch { problems.push(`${where}.mobile: invalid`); } }
  return problems;
}

const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : isObject(value)
  ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value ?? null);
export const entryDigest = (entry: ManifestEntry) => createHash("sha256").update(canonical(entry)).digest("hex");

// ---- state inspection and planning -------------------------------------------------------------
type Account = { _id: ObjectId; username?: string; email?: string; permissions?: unknown; isAdmin?: unknown; safeguarding?: { dateOfBirth?: string; dobSource?: string; ageAssurance?: AgeAssurance; dateOfBirthHistory?: unknown[] }; membershipBackfill?: { manifestId: string; entryDigest: string; appliedAt: Date } };
type Profile = { _id: ObjectId; name?: string; registrationCategory?: string; mobile?: string | null; education?: Education; teacherIntroduction?: string };
export function permissionState(permissions: unknown): PermissionState {
  if (permissions === undefined) return "missing";
  if (isObject(permissions)) {
    const keys = Object.keys(permissions);
    if (keys.length === 0 || (keys.length === 1 && keys[0] === "publicPublishing" && permissions.publicPublishing === undefined)) return "missing";
    if (keys.length === 1 && keys[0] === "publicPublishing" && typeof permissions.publicPublishing === "boolean") return permissions.publicPublishing;
  }
  return "malformed"; // null, arrays, extra keys, non-boolean values: a person must decide
}
export type PlanItem = {
  userId: string; username: string | null; status: "apply" | "already-applied" | "conflict" | "unresolved";
  actions: string[]; conflicts: string[]; digest: string; writes?: Writes;
};
type Writes = { set: Record<string, unknown>; push?: Record<string, unknown>; insertProfile?: Document; filter: Filter<Account> };

function planAccount(entry: ManifestEntry, manifest: Manifest, account: Account, profile: Profile | null, now: Date): PlanItem {
  const digest = entryDigest(entry);
  const item = { userId: account._id.toHexString(), username: account.username ?? null, digest };
  const current = permissionState(account.permissions);
  const conflicts: string[] = [], actions: string[] = [];
  const receipt = account.membershipBackfill;
  const valuesMatch = () => current === entry.publicPublishing
    && (entry.isAdmin === undefined || account.isAdmin === entry.isAdmin)
    && (!entry.safeguarding || account.safeguarding?.dateOfBirth === entry.safeguarding.dateOfBirth)
    && (!entry.puckle || (!!profile && profile.name === entry.puckle.name && profile.registrationCategory === entry.puckle.registrationCategory));
  if (receipt) {
    if (receipt.manifestId !== manifest.manifestId || receipt.entryDigest !== digest) return { ...item, status: "conflict", actions, conflicts: ["a different reviewed backfill was already applied to this account; new instructions need a new review"] };
    // An applied entry is a no-op only while the reviewed values still hold; later founder changes are never overwritten.
    return valuesMatch() ? { ...item, status: "already-applied", actions: ["already applied; no change"], conflicts }
      : { ...item, status: "conflict", actions, conflicts: ["drift: values changed since this entry was applied (for example a later direct grant or revocation); refusing to reapply over them"] };
  }
  if (current === "malformed") conflicts.push("existing permissions record is malformed; needs an individual decision");
  else if (current !== entry.currentPublicPublishing) conflicts.push(`current permission is ${String(current)} but the manifest expects ${String(entry.currentPublicPublishing)}`);
  const set: Record<string, unknown> = {}, filter: Filter<Account> = { _id: account._id, membershipBackfill: { $exists: false } } as Filter<Account>;
  const clauses: Filter<Account>[] = [];
  if (current === "missing") clauses.push({ $or: [{ permissions: { $exists: false } }, { permissions: {} }] } as Filter<Account>);
  else if (typeof current === "boolean") clauses.push({ permissions: { publicPublishing: current } } as Filter<Account>);
  if (current !== entry.publicPublishing) { set["permissions.publicPublishing"] = entry.publicPublishing; actions.push(`permissions.publicPublishing: ${String(current)} -> ${String(entry.publicPublishing)}`); }
  else actions.push(`permissions.publicPublishing already ${String(current)} (explicit disposition recorded)`);
  if (entry.isAdmin !== undefined) {
    const admin = account.isAdmin === undefined ? "missing" : typeof account.isAdmin === "boolean" ? account.isAdmin : "malformed";
    if (admin === "malformed") conflicts.push("existing isAdmin value is not a boolean; needs an individual decision");
    else if (admin !== entry.currentIsAdmin) conflicts.push(`current isAdmin is ${String(admin)} but the manifest expects ${String(entry.currentIsAdmin)}`);
    else {
      clauses.push((admin === "missing" ? { isAdmin: { $exists: false } } : { isAdmin: admin }) as Filter<Account>);
      if (admin !== entry.isAdmin) { set.isAdmin = entry.isAdmin; actions.push(`isAdmin: ${String(admin)} -> ${String(entry.isAdmin)}`); }
      else actions.push(`isAdmin already ${String(admin)}; unchanged`);
    }
  }
  let push: Record<string, unknown> | undefined;
  if (entry.safeguarding) {
    const sg = entry.safeguarding, existing = account.safeguarding?.dateOfBirth;
    clauses.push(existing === undefined ? { "safeguarding.dateOfBirth": { $exists: false } } as Filter<Account> : { "safeguarding.dateOfBirth": existing } as Filter<Account>);
    const assurance = sg.ageAssurance ? parseAgeAssurance({ ...sg.ageAssurance, verifiedAt: new Date(sg.ageAssurance.verifiedAt) }) : null;
    const source = sg.dobSource ?? "operator-entered";
    if (existing === undefined) {
      if (sg.expectedDateOfBirth !== undefined && sg.expectedDateOfBirth !== null) conflicts.push("manifest expects an existing date of birth but none is recorded");
      else if (sg.correction) conflicts.push("a correction was supplied but there is no date of birth to correct");
      else {
        Object.assign(set, { "safeguarding.dateOfBirth": sg.dateOfBirth, "safeguarding.dobSource": source, "safeguarding.dobRecordedAt": now, "safeguarding.ageAssurance": assurance ?? { verification: "none" } });
        actions.push(`safeguarding: record date of birth ${sg.dateOfBirth} (source ${source}), age assurance ${assurance ? `independent (method "${assurance.verification === "independent" ? assurance.method : ""}", evidence "${assurance.verification === "independent" ? assurance.evidenceReference : ""}")` : "none"}`);
      }
    } else if (existing === sg.dateOfBirth) {
      const existingAssurance = account.safeguarding?.ageAssurance;
      if (assurance && (!existingAssurance || existingAssurance.verification === "none")) { set["safeguarding.ageAssurance"] = assurance; actions.push("safeguarding: add independent assurance evidence to the existing date of birth"); }
      else if (assurance && canonical(existingAssurance) !== canonical(assurance)) conflicts.push("a different independent assurance is already recorded");
      else actions.push("safeguarding: date of birth already matches; unchanged");
    } else if (!sg.correction) conflicts.push("a different date of birth is already recorded; overwriting needs an explicit reviewed correction");
    else if (sg.expectedDateOfBirth !== existing) conflicts.push("correction does not name the recorded date of birth it replaces");
    else {
      const event = { previous: existing, next: sg.dateOfBirth, ...(account.safeguarding?.dobSource ? { previousSource: account.safeguarding.dobSource } : {}), source, actor: sg.correction.actor, reason: sg.correction.reason, at: now,
        invalidatedAssurance: account.safeguarding?.ageAssurance ?? { verification: "none" } };
      Object.assign(set, { "safeguarding.dateOfBirth": sg.dateOfBirth, "safeguarding.dobSource": source, "safeguarding.dobRecordedAt": now, "safeguarding.ageAssurance": { verification: "none" } });
      push = { "safeguarding.dateOfBirthHistory": event };
      actions.push("safeguarding: reviewed date-of-birth correction with history; previous assurance invalidated");
    }
  }
  let insertProfile: Document | undefined;
  if (entry.puckle) {
    const p = entry.puckle, education = p.education === undefined ? undefined : validateEducation(p.education);
    const mobile = p.mobile?.trim() ? normaliseMobile(p.mobile, p.phoneCountryCode ?? "IE") : null;
    if (profile) {
      const same = profile.name === p.name && profile.registrationCategory === p.registrationCategory && (profile.mobile ?? null) === mobile
        && canonical(profile.education ?? null) === canonical(education ?? null) && (profile.teacherIntroduction ?? "") === (p.teacherIntroduction?.trim() ?? "");
      if (same) actions.push("Puckle profile already matches; unchanged"); else conflicts.push("a different Puckle profile already exists; it will not be overwritten");
    } else {
      insertProfile = { userId: account._id, name: p.name.trim(), registrationCategory: p.registrationCategory, mobile,
        ...(education ? { education } : {}), ...(p.teacherIntroduction?.trim() ? { teacherIntroduction: p.teacherIntroduction.trim() } : {}),
        // Provenance stays honest: the original source is unknown, the welcome never fires for a long-standing account.
        initialRegistrationSource: "unknown", provisioning: { method: "known-account-backfill", recordedAt: now, recordedBy: manifest.reviewedBy },
        welcome: { eligible: false }, createdAt: now, updatedAt: now };
      actions.push(`create Puckle ${p.registrationCategory} profile: name "${p.name.trim()}", course ${education ? education.course : "none"}, level ${education ? String(education.level) : "none"}, mobile ${mobile ? "set" : "none"}, introduction ${p.teacherIntroduction?.trim() ? "set" : "none"} (source unknown, provisioned by known-account-backfill, welcome ineligible)`);
    }
  }
  set.membershipBackfill = { manifestId: manifest.manifestId, entryDigest: digest, appliedAt: now };
  if (conflicts.length) return { ...item, status: "conflict", actions, conflicts };
  return { ...item, status: "apply", actions, conflicts, writes: { set, ...(push ? { push } : {}), ...(insertProfile ? { insertProfile } : {}), filter: { ...filter, $and: clauses } as Filter<Account> } };
}

async function loadAccount(db: Db, id: ObjectId, session?: ClientSession) {
  // Sequential: operations inside one transaction must not run in parallel.
  const account = await db.collection<Account>("users").findOne({ _id: id }, { session, projection: { username: 1, permissions: 1, isAdmin: 1, safeguarding: 1, membershipBackfill: 1 } });
  const profile = await db.collection<Profile>("puckleMemberships").findOne({ userId: id } as Filter<Profile>, { session });
  return { account, profile };
}
export async function resolveIdentity(db: Db, entry: ManifestEntry): Promise<{ id: ObjectId | null; note: string | null }> {
  const users = db.collection<Account>("users"), project = { projection: { _id: 1, email: 1, username: 1 } };
  if (entry.userId) {
    const found = await users.findOne({ _id: new ObjectId(entry.userId) }, project);
    if (!found) return { id: null, note: "no account has this id" };
    if ((entry.email && found.email !== entry.email.trim().toLowerCase()) || (entry.username && found.username !== entry.username)) return { id: null, note: "id does not match the stated email/username" };
    return { id: found._id, note: null };
  }
  const query = entry.email ? { email: entry.email.trim().toLowerCase() } : { username: entry.username };
  const matches = await users.find(query as Filter<Account>, project).limit(2).toArray();
  return matches.length === 1 ? { id: matches[0]._id, note: "resolved by email/username; put the id in the manifest to apply" } : { id: null, note: matches.length ? "ambiguous" : "no account matches" };
}

export type Plan = { manifestId: string; items: PlanItem[]; unlisted: { userId: string; username: string | null }[]; blockers: string[]; summary: Record<string, number> };
/** Strictly read-only. */
export async function planBackfill(db: Db, manifest: Manifest, now = new Date(), requireIds = false): Promise<Plan> {
  const items: PlanItem[] = [], listed = new Set<string>(), blockers: string[] = [];
  for (const entry of manifest.accounts) {
    const resolved = await resolveIdentity(db, entry);
    if (!resolved.id) { items.push({ userId: entry.userId ?? "", username: entry.username ?? null, status: "unresolved", actions: [], conflicts: [resolved.note ?? "unresolved"], digest: entryDigest(entry) }); continue; }
    if (requireIds && !entry.userId) { items.push({ userId: resolved.id.toHexString(), username: entry.username ?? null, status: "unresolved", actions: [], conflicts: ["apply requires an explicit userId; review the resolution reported by a dry run"], digest: entryDigest(entry) }); continue; }
    listed.add(resolved.id.toHexString());
    const { account, profile } = await loadAccount(db, resolved.id);
    items.push(planAccount(entry, manifest, account!, profile, now));
  }
  const duplicates = [...listed].length !== items.filter(item => item.status !== "unresolved").length;
  if (duplicates) blockers.push("the same account appears more than once");
  const everyone = await db.collection<Account>("users").find({}, { projection: { username: 1 } }).toArray();
  const unlisted = everyone.filter(user => !listed.has(user._id.toHexString())).map(user => ({ userId: user._id.toHexString(), username: user.username ?? null }));
  if (unlisted.length) blockers.push(`${unlisted.length} existing account(s) have no reviewed permission disposition`);
  for (const item of items) if (item.status === "conflict" || item.status === "unresolved") blockers.push(`${item.username ?? item.userId}: ${item.conflicts.join("; ")}`);
  const summary = items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.status]: (counts[item.status] ?? 0) + 1 }), { accounts: everyone.length, unlisted: unlisted.length });
  return { manifestId: manifest.manifestId, items, unlisted, blockers, summary };
}

/** All-or-nothing preflight (any blocker refuses the whole run), then one transaction per account that re-verifies its preconditions. */
export async function applyBackfill(db: Db, client: MongoClient, manifest: Manifest, now = new Date()) {
  const plan = await planBackfill(db, manifest, now, true);
  if (plan.blockers.length) throw Object.assign(new Error("BACKFILL_REFUSED"), { plan });
  let applied = 0;
  for (const item of plan.items.filter(candidate => candidate.status === "apply")) {
    const entry = manifest.accounts.find(candidate => entryDigest(candidate) === item.digest)!;
    await withMongoTransaction(client, async session => {
      const { account, profile } = await loadAccount(db, new ObjectId(item.userId), session);
      const fresh = planAccount(entry, manifest, account!, profile, now);
      if (fresh.status !== "apply" || !fresh.writes) throw Object.assign(new Error("BACKFILL_PRECONDITION_CHANGED"), { userId: item.userId });
      const { set, push, insertProfile, filter } = fresh.writes;
      const result = await db.collection<Account>("users").updateOne(filter, { $set: set, ...(push ? { $push: push } : {}) } as never, { session });
      if (result.matchedCount !== 1) throw Object.assign(new Error("BACKFILL_PRECONDITION_CHANGED"), { userId: item.userId });
      if (insertProfile) await db.collection("puckleMemberships").insertOne(insertProfile, { session });
    });
    applied += 1;
  }
  return { ...plan, applied };
}

// ---- read-only assessment: a draft manifest for the founder to complete -----------------------
export async function assessAccounts(db: Db) {
  const publicCounts = async (collection: string) => new Map((await db.collection(collection).aggregate<{ _id: string; n: number }>([
    { $match: { visibility: { $ne: "private" } } }, { $group: { _id: "$publishedByUserId", n: { $sum: 1 } } }]).toArray()).map(row => [String(row._id), row.n]));
  const [cards, decks, info] = await Promise.all([publicCounts("cardTemplateVersions"), publicCounts("deckTemplateVersions"), publicCounts("infoCardVersions")]);
  const profiles = new Set((await db.collection("puckleMemberships").find({}, { projection: { userId: 1 } }).toArray()).map(row => String(row.userId)));
  const users = await db.collection("users").find({}, { projection: { username: 1, isAdmin: 1, createdAt: 1, permissions: 1, safeguarding: 1, cardsData: 1, decksData: 1, sessionVersion: 1, membershipBackfill: 1 } }).sort({ createdAt: 1 }).toArray();
  return {
    note: "DRAFT for founder review. Nothing here grants anything. Replace each publicPublishing null with an explicit true or false; account age, teacher status and isAdmin are not evidence of trust.",
    manifestId: "TO-BE-SET", reviewedBy: "TO-BE-SET", reviewedAt: "TO-BE-SET",
    accounts: users.map(user => {
      const id = String(user._id), state = permissionState(user.permissions);
      return {
        userId: id, username: user.username ?? null, publicPublishing: null, currentPublicPublishing: state === "malformed" ? "MALFORMED: decide individually" : state,
        evidence: { isAdmin: user.isAdmin === true, createdAt: user.createdAt ?? null, publicVersionsPublished: { cards: cards.get(id) ?? 0, decks: decks.get(id) ?? 0, infoCards: info.get(id) ?? 0 },
          hasPuckleProfile: profiles.has(id), hasDateOfBirth: !!user.safeguarding?.dateOfBirth, hasApprovalRecord: !!user.safeguarding?.groupExperienceApproval,
          learning: { cards: Array.isArray(user.cardsData) ? user.cardsData.length : null, decks: Array.isArray(user.decksData) ? user.decksData.length : null }, alreadyBackfilled: !!user.membershipBackfill },
      };
    }),
  };
}

/** Writes need a disposable database, or production mode plus the exact manifest id typed as confirmation (after separate approval). */
export const liveApplyAllowed = (input: { disposable: boolean; mode: string | undefined; confirmation: string | undefined; manifestId: string }) =>
  input.disposable || (input.mode === "production" && !!input.manifestId && input.confirmation === input.manifestId);
