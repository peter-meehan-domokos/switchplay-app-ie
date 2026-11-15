import { ObjectId, type Db } from "mongodb";
import { ageOn, dublinToday } from "./age";
import { getCurrentUser, getUserForSessionToken, sessionTokenFromCookieHeader, type AuthUser } from "./auth";
import { getDatabase } from "./mongodb";
import { getCurrentSite } from "./sites/getCurrentSite";
import { notifyFounder } from "./founderNotifications";
import type { PuckleMembership } from "./puckleMemberships";
import { founderTuitionEnquiryEmail } from "@/app/sites/puckle/lib/memberEmailTemplates";
import { validateTuitionEnquiry, type EnquiryFieldErrors, type EnquiryRequestData, type EnquirerType, type MathsCourse, type ValidatedEnquiryData } from "@/app/sites/puckle/lib/publicTuitionEnquiry";

/**
 * Tuition enquiries stay independent of membership: nothing here creates or changes an account,
 * profile, credential, date of birth or permission. A signed-in student with a known DOB only
 * (a) gets the right age path derived server-side and (b) has the enquiry linked to their own account.
 */
export type TuitionContext =
  | { mode: "unknown" }
  | { mode: "student-under-18"; studentName: string; mathsCourse: MathsCourse | null }
  | { mode: "student-adult"; name: string; mathsCourse: MathsCourse | null; email: string; phone: string | null };
type Resolved = { context: TuitionContext; link: { userId: ObjectId; membershipId: ObjectId } | null };
const UNKNOWN: Resolved = { context: { mode: "unknown" }, link: null };

// Registration course -> existing enquiry course. "Don't know" stays unanswered; Other maps to Other.
const COURSE_MAP: Readonly<Record<string, MathsCourse | undefined>> = {
  "leaving-cert": "leaving-cert", "junior-cycle": "junior-cycle", gcse: "gcse", "a-level": "a-level", other: "other",
};

export async function resolveTuitionContext(db: Db, user: AuthUser | null, today = dublinToday()): Promise<Resolved> {
  if (!user) return UNKNOWN;
  const userId = new ObjectId(user.id);
  const [account, membership] = await Promise.all([
    db.collection<{ safeguarding?: { dateOfBirth?: string } }>("users").findOne({ _id: userId }, { projection: { "safeguarding.dateOfBirth": 1 } }),
    db.collection<PuckleMembership & { _id: ObjectId }>("puckleMemberships").findOne({ userId }),
  ]);
  const dob = account?.safeguarding?.dateOfBirth;
  // Unknown DOB or no Puckle student profile: the original selection flow, never an assumption of adulthood.
  if (!dob || !membership || membership.registrationCategory !== "student") return UNKNOWN;
  const mathsCourse = (membership.education && COURSE_MAP[membership.education.course]) || null;
  const link = { userId, membershipId: membership._id };
  return ageOn(dob, today) < 18
    ? { context: { mode: "student-under-18", studentName: membership.name, mathsCourse }, link }
    // Under-18 guardian fields are never filled from the student's own contact details.
    : { context: { mode: "student-adult", name: membership.name, mathsCourse, email: user.email, phone: membership.mobile }, link };
}

export async function userFromRequest(request: Request): Promise<AuthUser | null> {
  return getUserForSessionToken(sessionTokenFromCookieHeader(request.headers.get("cookie")));
}

type TuitionEnquiryDocument = ValidatedEnquiryData & {
  source: "public-homepage"; createdAt: Date; founderNotification: { status: "pending" };
  userId?: ObjectId; membershipId?: ObjectId;
};
export type SaveResult =
  | { ok: true; id: ObjectId; notify: () => Promise<void> }
  | { ok: false; fieldErrors: EnquiryFieldErrors };

/** The server, not the client's claimed type, decides the age path for a signed-in student with a known DOB. */
export async function saveTuitionEnquiry(db: Db, body: EnquiryRequestData, user: AuthUser | null, now = new Date(), collection = "puckleTuitionEnquiries"): Promise<SaveResult> {
  const { context, link } = await resolveTuitionContext(db, user, dublinToday(now));
  const own = body.enquirerType === "student-adult" || body.enquirerType === "student-under-18";
  const input = context.mode !== "unknown" && own ? { ...body, enquirerType: context.mode as EnquirerType } : body;
  const validation = validateTuitionEnquiry(input);
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors };
  const linked = link && validation.data.enquirerType !== "parent-guardian" ? link : null;
  const document: TuitionEnquiryDocument = { ...validation.data, source: "public-homepage", createdAt: now, founderNotification: { status: "pending" }, ...(linked ?? {}) };
  const _id = new ObjectId();
  await db.collection<TuitionEnquiryDocument & { _id: ObjectId }>(collection).insertOne({ _id, ...document });
  return { ok: true, id: _id, notify: () => notifyFounder(db, { collection, id: _id }, founderTuitionEnquiryEmail({ id: _id.toHexString(), data: validation.data, linkedAccount: !!linked })) };
}

const CONTEXT_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };
/** Own-account only. Reveals the derived age path and editable prefill; never the date of birth itself. */
export async function tuitionContextResponse(): Promise<Response> {
  if ((await getCurrentSite()) !== "puckle") return Response.json({ error: "Not found." }, { status: 404, headers: CONTEXT_HEADERS });
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ mode: "unknown" }, { headers: CONTEXT_HEADERS });
    return Response.json((await resolveTuitionContext(await getDatabase(), user)).context, { headers: CONTEXT_HEADERS });
  } catch {
    return Response.json({ error: "Unable to load your details." }, { status: 503, headers: CONTEXT_HEADERS });
  }
}
