// Server-only. One shared Group Experience approval per account, covering Puckle everywhere it runs.
// Records facts only: no group permission decision, no live-tuition permission, no age verification.
import { ObjectId, type ClientSession, type Db, type MongoClient } from "mongodb";
import { ageOn, dublinToday } from "./age";
import { normaliseAccountEmail } from "./accountCredentials";
import { parentApprovalRequestEmail } from "./accountEmailTemplates";
import { randomEmailToken, requireEmailToken, tokenDigest } from "./emailActionTokens";
import { limitEmailRequest, limitRequesterAction } from "./emailRequestLimits";
import { notifyFounder } from "./founderNotifications";
import { withMongoTransaction } from "./mongodb";
import {
  GROUP_EXPERIENCE_EXPLANATION, GROUP_EXPERIENCE_SCOPE, GUARDIAN_DECLARATION,
  type ApprovalEvent, type ApprovalStatus, type GroupExperienceApproval,
} from "./parentalApprovalScope";
import type { AccountEmailAction } from "./puckleMemberships";
import { deliverEmail, type EmailSender } from "./siteEmail";
import { founderParentApprovalRequestEmail, founderParentContactRequestEmail, founderParentDecisionEmail } from "@/app/sites/puckle/lib/memberEmailTemplates";
import { normaliseMobile } from "@/app/sites/puckle/lib/membershipRegistration";
import type { SiteId } from "./sites/siteResolver";
import type { UserSafeguarding } from "./userSafeguarding";

export const PARENT_LINK_MS = 7 * 86_400_000;
/** Expired/replaced parent links are kept this long only so they can request a replacement email. */
export const PARENT_RENEWAL_WINDOW_MS = 30 * 86_400_000;
export const APPROVAL_AGE_LIMIT = 16;
const SCOPE = GROUP_EXPERIENCE_SCOPE.scopeId;
const PATH = "safeguarding.groupExperienceApproval";

type Mail = { send: EmailSender; name: string; origin: string };
type Account = { _id: ObjectId; email: string; username: string; safeguarding?: UserSafeguarding };
type ParentPurpose = "parent-request";
type Action = AccountEmailAction & { _id: ObjectId };
const users = (db: Db) => db.collection<Account>("users");
const actions = (db: Db) => db.collection<AccountEmailAction>("accountEmailActions");

export type Eligibility = "eligible" | "not-required" | "age-unknown";
/** Under-16 Group Experience participation needs approval; unknown DOB is never treated as 16 or over. */
export function approvalEligibility(dateOfBirth: string | null | undefined, today = dublinToday()): Eligibility {
  if (!dateOfBirth) return "age-unknown";
  return ageOn(dateOfBirth, today) < APPROVAL_AGE_LIMIT ? "eligible" : "not-required";
}
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"•".repeat(Math.max(1, Math.min(local.length - 1, 6)))}@${domain}`;
}
const statusOf = (approval: GroupExperienceApproval | undefined): ApprovalStatus => approval?.status ?? "not-requested";

async function childDisplayName(db: Db, account: Account) {
  // The Puckle profile name if one exists; shared facts never require a Puckle profile.
  const profile = await db.collection<{ userId: ObjectId; name?: string }>("puckleMemberships").findOne({ userId: account._id }, { projection: { name: 1 } });
  return profile?.name?.trim() || account.username;
}
function event(kind: ApprovalEvent["kind"], actor: ApprovalEvent["actor"], at: Date, extra: Partial<ApprovalEvent> = {}): ApprovalEvent {
  return { kind, actor, at, scopeId: SCOPE, explanation: { version: GROUP_EXPERIENCE_EXPLANATION.version, text: GROUP_EXPERIENCE_EXPLANATION.text }, ...extra };
}

// ---- the student's own status and request ----------------------------------------------------
export async function approvalSummary(db: Db, userId: ObjectId, today = dublinToday()) {
  const account = await users(db).findOne({ _id: userId }, { projection: { "safeguarding.dateOfBirth": 1, [PATH]: 1 } });
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");
  const approval = account.safeguarding?.groupExperienceApproval;
  const eligibility = approvalEligibility(account.safeguarding?.dateOfBirth, today);
  const status = statusOf(approval);
  return {
    scopeId: SCOPE, eligibility, status,
    canRequest: eligibility === "eligible" && status !== "approved",
    guardianEmail: approval?.guardianEmail ? maskEmail(approval.guardianEmail) : null,
    requestedAt: approval?.requestedAt ?? null, decidedAt: approval?.decidedAt ?? null, withdrawnAt: approval?.withdrawnAt ?? null,
    delivery: status === "pending" ? approval?.delivery?.status ?? "pending" : null,
  };
}

async function issueLink(db: Db, input: { userId: ObjectId; purpose: ParentPurpose; generation: number; recipient: string; sourceSite: SiteId }, now: Date) {
  const token = randomEmailToken();
  // Only the newest link of a purpose can act; older ones may only ask for a replacement.
  await actions(db).updateMany({ userId: input.userId, purpose: input.purpose, usedAt: { $exists: false }, replacedAt: { $exists: false } }, { $set: { replacedAt: now } });
  const action: AccountEmailAction = { purpose: input.purpose, userId: input.userId, scopeId: SCOPE, tokenDigest: tokenDigest(token), generation: input.generation,
    recipient: input.recipient, sourceSite: input.sourceSite, expiresAt: new Date(now.getTime() + PARENT_LINK_MS),
    cleanupAt: new Date(now.getTime() + PARENT_LINK_MS + PARENT_RENEWAL_WINDOW_MS), delivery: { status: "pending" } };
  await actions(db).insertOne(action);
  return { token, digest: action.tokenDigest };
}
async function sendLink(db: Db, account: Account, link: { token: string; digest: string }, purpose: ParentPurpose, recipient: string, generation: number, mail: Mail) {
  const child = await childDisplayName(db, account);
  const template = parentApprovalRequestEmail; // the only email a parent receives from the approval flow
  const delivery = await deliverEmail(mail.send, { to: recipient, ...template(mail.name, mail.origin, link.token, child) });
  await actions(db).updateOne({ tokenDigest: link.digest }, { $set: { delivery } });
  // The approval's delivery field describes the request email only; it is never evidence of a decision.
  if (purpose === "parent-request") await users(db).updateOne({ _id: account._id, [`${PATH}.generation`]: generation, [`${PATH}.status`]: "pending" }, { $set: { [`${PATH}.delivery`]: delivery } });
  return delivery;
}

/** Optional unverified parent/guardian mobile: stored for personal follow-up only (no SMS, no login, never a decision channel). */
function guardianMobile(value: unknown, country: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try { return normaliseMobile(value.trim(), typeof country === "string" && country ? country : "IE") || null; } catch { throw new Error("INVALID_MOBILE"); }
}
const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
async function eligibleChild(db: Db, userId: ObjectId, now: Date) {
  const account = await users(db).findOne({ _id: userId }, { projection: { email: 1, username: 1, "safeguarding.dateOfBirth": 1, [PATH]: 1 } });
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");
  const eligibility = approvalEligibility(account.safeguarding?.dateOfBirth, dublinToday(now));
  if (eligibility === "not-required") throw new Error("APPROVAL_NOT_REQUIRED");
  if (eligibility === "age-unknown") throw new Error("APPROVAL_AGE_UNKNOWN");
  // Replacing an approved guardian silently would rewrite evidence: that needs reviewed support instead.
  if (statusOf(account.safeguarding?.groupExperienceApproval) === "approved") throw new Error("APPROVAL_ALREADY_GRANTED");
  return account;
}
export type ApprovalRequestResult =
  | { status: "pending"; resent: boolean; delivery: string; notify?: () => Promise<void> }
  | { status: "contact-requested"; notify: () => Promise<void> };

/**
 * Student-initiated request or resend. Sending is automatic; there is no founder approval step.
 * With an email, the guardian gets the approval link (an optional mobile is stored for personal follow-up).
 * With ONLY a mobile, nothing can be sent: the founder is asked to contact the parent personally and no approval is recorded.
 */
export async function requestParentalApproval(db: Db, input: { userId: ObjectId; guardianEmail?: unknown; guardianPhone?: unknown; phoneCountryCode?: unknown; sourceSite: SiteId; requester: string }, mail: Mail, now = new Date()): Promise<ApprovalRequestResult> {
  const account = await eligibleChild(db, input.userId, now);
  const phone = guardianMobile(input.guardianPhone, input.phoneCountryCode);
  if (!hasText(input.guardianEmail)) {
    if (!phone) throw new Error("GUARDIAN_CONTACT_REQUIRED");
    await limitRequesterAction(db, "guardian-phone", input.requester, 5, 3600, now);
    const child = await childDisplayName(db, account), _id = new ObjectId();
    await db.collection("puckleJoinContactRequests").insertOne({ _id, kind: "guardian-approval-contact-request", studentUserId: input.userId, studentName: child, guardianMobile: phone,
      sourceSite: input.sourceSite, createdAt: now, founderNotification: { status: "pending" } });
    return { status: "contact-requested", notify: () => notifyFounder(db, { collection: "puckleJoinContactRequests", id: _id }, founderParentContactRequestEmail({ id: _id.toHexString(), childName: child, username: account.username, guardianPhone: phone })) };
  }
  const guardianEmail = normaliseAccountEmail(input.guardianEmail);
  if (guardianEmail === account.email) throw new Error("GUARDIAN_EMAIL_IS_ACCOUNT");
  const current = account.safeguarding?.groupExperienceApproval;
  const resend = current?.status === "pending" && current.guardianEmail === guardianEmail;
  await limitEmailRequest(db, guardianEmail, input.requester, now);
  const generation = resend ? current!.generation : (current?.generation ?? 0) + 1;
  const actor = { kind: "student" as const, reference: input.userId.toHexString() };
  const record = event(resend ? "resent" : "requested", actor, now, { generation, guardianEmail, sourceSite: input.sourceSite });
  const fields = { scopeId: SCOPE, status: "pending" as const, generation, explanation: record.explanation, sourceSite: input.sourceSite, guardianEmail, requestedAt: now, delivery: { status: "pending" as const },
    ...(phone ? { guardianPhone: phone } : {}), ...(resend ? {} : { founderNotification: { status: "pending" as const } }) };
  const result = current
    ? await users(db).updateOne({ _id: input.userId, [`${PATH}.generation`]: current.generation, [`${PATH}.status`]: current.status },
      { $set: Object.fromEntries(Object.entries(fields).map(([key, value]) => [`${PATH}.${key}`, value])),
        ...(resend ? {} : { $unset: { [`${PATH}.decidedAt`]: "", [`${PATH}.withdrawnAt`]: "", [`${PATH}.guardianDeclaration`]: "", ...(phone ? {} : { [`${PATH}.guardianPhone`]: "" }) } }),
        $push: { [`${PATH}.history`]: record } } as never)
    : await users(db).updateOne({ _id: input.userId, [PATH]: { $exists: false } }, { $set: { [PATH]: { ...fields, history: [record] } } });
  if (result.matchedCount !== 1) throw new Error("APPROVAL_STATE_CHANGED");
  const link = await issueLink(db, { userId: input.userId, purpose: "parent-request", generation, recipient: guardianEmail, sourceSite: input.sourceSite }, now);
  const delivery = await sendLink(db, account, link, "parent-request", guardianEmail, generation, mail);
  const child = await childDisplayName(db, account);
  // A founder alert only for a genuinely new request (not every resend). Outcome is kept beside the approval record.
  const notify = resend ? undefined : () => notifyFounder(db, { collection: "users", id: input.userId }, founderParentApprovalRequestEmail({ id: input.userId.toHexString(), childName: child, username: account.username,
    guardianEmail, guardianPhone: phone, delivery: delivery.status, sourceSite: input.sourceSite }), undefined, `${PATH}.founderNotification`);
  return { status: "pending", resent: resend, delivery: delivery.status, ...(notify ? { notify } : {}) };
}

// ---- parent links -----------------------------------------------------------------------------
type LinkState = "valid" | "expired" | "replaced" | "decided";
async function loadParentLink(db: Db, token: unknown, now: Date, session?: ClientSession) {
  const action = await actions(db).findOne({ tokenDigest: tokenDigest(requireEmailToken(token)), purpose: "parent-request" }, { session }) as Action | null;
  if (!action || action.scopeId !== SCOPE) throw new Error("INVALID_EMAIL_PROOF");
  const account = await users(db).findOne({ _id: action.userId }, { session, projection: { email: 1, username: 1, [PATH]: 1 } });
  if (!account) throw new Error("INVALID_EMAIL_PROOF");
  const approval = account.safeguarding?.groupExperienceApproval;
  const expectedStatus = "pending";
  // The target and its state come from the persisted capability, never from who is signed in or another tab.
  const current = !!approval && approval.scopeId === SCOPE && approval.generation === action.generation && approval.guardianEmail === action.recipient;
  const state: LinkState = !current || approval!.status !== expectedStatus || action.usedAt ? "decided"
    : action.replacedAt ? "replaced" : action.expiresAt <= now ? "expired" : "valid";
  const renewable = (state === "expired" || state === "replaced") && action.cleanupAt > now;
  return { action, account, approval, state, renewable };
}

export async function parentLinkDetails(db: Db, token: unknown, now = new Date()) {
  const link = await loadParentLink(db, token, now);
  if (link.state !== "valid") return { purpose: link.action.purpose, state: link.state, renewable: link.renewable };
  return {
    purpose: link.action.purpose, state: link.state, renewable: false,
    child: await childDisplayName(db, link.account),
    explanation: { version: link.approval!.explanation.version, text: link.approval!.explanation.text },
    declaration: GUARDIAN_DECLARATION,
  };
}

/** Explicit guardian decision on a request link. Opening or reading the link never decides anything. */
export async function decideParentalApproval(db: Db, client: MongoClient, input: { token: unknown; decision: unknown; declaration: unknown }, mail: Mail, clock: () => Date = () => new Date()) {
  if (input.decision !== "approve" && input.decision !== "decline") throw new Error("INVALID_DECISION");
  if (input.declaration !== true) throw new Error("DECLARATION_REQUIRED");
  const decision = input.decision;
  const outcome = await withMongoTransaction(client, async session => {
    const now = clock();
    const link = await loadParentLink(db, input.token, now, session);
    if (link.action.purpose !== "parent-request" || link.state !== "valid") throw new Error("LINK_NOT_USABLE");
    const used = await actions(db).updateOne({ _id: link.action._id, usedAt: { $exists: false }, replacedAt: { $exists: false } }, { $set: { usedAt: now } }, { session });
    if (used.matchedCount !== 1) throw new Error("LINK_NOT_USABLE");
    const status: "approved" | "declined" = decision === "approve" ? "approved" : "declined";
    const result = await users(db).updateOne({ _id: link.account._id, [`${PATH}.scopeId`]: SCOPE, [`${PATH}.status`]: "pending",
      [`${PATH}.generation`]: link.action.generation, [`${PATH}.guardianEmail`]: link.action.recipient }, {
      $set: { [`${PATH}.status`]: status, [`${PATH}.decidedAt`]: now,
        // Email ownership plus declaration, recorded as such: not independent verification of anyone's age or responsibility.
        [`${PATH}.guardianDeclaration`]: { textVersion: GUARDIAN_DECLARATION.version, declaredAt: now, emailConfirmedAt: now } },
      $push: { [`${PATH}.history`]: event(status, { kind: "guardian", reference: `email-action:${link.action._id.toHexString()}` }, now,
        { generation: link.action.generation, guardianEmail: link.action.recipient, declarationVersion: GUARDIAN_DECLARATION.version, sourceSite: link.action.sourceSite }) },
    } as never, { session });
    if (result.matchedCount !== 1) throw new Error("LINK_NOT_USABLE");
    return { status, account: link.account, recipient: link.action.recipient, guardianPhone: link.approval!.guardianPhone, decidedAt: now };
  });
  // Informational alert to the founder after the response; the decision itself is already committed.
  const child = await childDisplayName(db, outcome.account);
  const notify = () => notifyFounder(db, { collection: "users", id: outcome.account._id }, founderParentDecisionEmail({ id: outcome.account._id.toHexString(), childName: child, username: outcome.account.username,
    decision: outcome.status, guardianEmail: outcome.recipient, guardianPhone: outcome.guardianPhone ?? null, decidedAt: outcome.decidedAt }), undefined, `${PATH}.decisionFounderNotification`);
  return { status: outcome.status, notify };
}

async function endApproval(db: Db, session: ClientSession, userId: ObjectId, generation: number, now: Date, record: ApprovalEvent) {
  const result = await users(db).updateOne({ _id: userId, [`${PATH}.status`]: "approved", [`${PATH}.generation`]: generation },
    { $set: { [`${PATH}.status`]: "withdrawn", [`${PATH}.withdrawnAt`]: now }, $push: { [`${PATH}.history`]: record } } as never, { session });
  if (result.matchedCount !== 1) throw new Error("LINK_NOT_USABLE");
}
/** Trusted operator process only (no HTTP entry): a reviewed revocation, recorded distinctly from a guardian withdrawal. */
export async function revokeParentalApprovalAsOperator(db: Db, client: MongoClient, userId: ObjectId, review: { actor: string; reason: string }, now = new Date()) {
  if (!review.actor.trim() || !review.reason.trim()) throw new Error("REVIEW_DETAILS_REQUIRED");
  await withMongoTransaction(client, async session => {
    const account = await users(db).findOne({ _id: userId }, { session, projection: { [PATH]: 1 } });
    const approval = account?.safeguarding?.groupExperienceApproval;
    if (!approval || approval.status !== "approved") throw new Error("APPROVAL_STATE_CHANGED");
    await endApproval(db, session, userId, approval.generation, now,
      event("revoked", { kind: "operator", reference: review.actor }, now, { reason: review.reason, generation: approval.generation, guardianEmail: approval.guardianEmail }));
  });
}

/** An expired or replaced link may only ask for a fresh one, sent to the guardian already on record. Always neutral to the caller. */
export async function renewParentLink(db: Db, input: { token: unknown; requester: string }, mail: Mail, now = new Date()) {
  let link: Awaited<ReturnType<typeof loadParentLink>>;
  try { link = await loadParentLink(db, input.token, now); } catch { return; }
  if (!link.renewable || !link.approval?.guardianEmail) return;
  const recipient = link.approval.guardianEmail;
  try { await limitEmailRequest(db, recipient, input.requester, now); } catch { return; }
  const purpose: ParentPurpose = "parent-request";
  if (purpose === "parent-request") {
    await users(db).updateOne({ _id: link.account._id, [`${PATH}.status`]: "pending", [`${PATH}.generation`]: link.approval.generation },
      { $push: { [`${PATH}.history`]: event("resent", { kind: "guardian", reference: `renewal:${link.action._id.toHexString()}` }, now, { generation: link.approval.generation, guardianEmail: recipient }) } } as never);
  }
  const fresh = await issueLink(db, { userId: link.account._id, purpose, generation: link.approval.generation, recipient, sourceSite: link.action.sourceSite ?? "puckle" }, now);
  await sendLink(db, link.account, fresh, purpose, recipient, link.approval.generation, mail);
}
