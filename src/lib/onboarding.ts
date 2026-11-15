// Server-only. Minimal own-account status and one-time welcome acknowledgement for the isolated onboarding host.
import { ObjectId, type Db } from "mongodb";
import { getCurrentUser } from "./auth";
import { securityJson, securityRequest } from "./accountSecurityHttp";
import { getDatabase } from "./mongodb";
import { approvalSummary } from "./parentalApproval";
import type { PuckleMembership } from "./puckleMemberships";
import { getCurrentSite } from "./sites/getCurrentSite";

const HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });

export async function onboardingStatus(db: Db, userId: ObjectId, site: string) {
  // Switchplay and Strat17 have no onboarding content yet but share the same accounts and approval facts.
  if (site !== "puckle") return { actorId: userId.toHexString(), show: false as const };
  const [approval, membership] = await Promise.all([
    approvalSummary(db, userId),
    db.collection<PuckleMembership>("puckleMemberships").findOne({ userId }, { projection: { registrationCategory: 1, welcome: 1 } }),
  ]);
  return {
    actorId: userId.toHexString(), show: true as const,
    student: membership?.registrationCategory === "student",
    // Server-owned: eligible and not yet acknowledged. Never a client hint.
    welcomePending: !!membership?.welcome?.eligible && !membership.welcome.seenAt,
    approval,
  };
}
/** Idempotent. Only a profile that is welcome-eligible and unseen changes. */
export async function acknowledgeWelcome(db: Db, userId: ObjectId, now = new Date()) {
  await db.collection<PuckleMembership>("puckleMemberships").updateOne({ userId, "welcome.eligible": true, "welcome.seenAt": { $exists: false } }, { $set: { "welcome.seenAt": now } });
}

export async function onboardingStatusResponse() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Please sign in." }, 401);
    return json(await onboardingStatus(await getDatabase(), new ObjectId(user.id), await getCurrentSite()));
  } catch { return json({ error: "Unavailable." }, 503); }
}
export async function onboardingAcknowledgeResponse(request: Request) {
  try {
    const { body } = await securityRequest(request);
    const user = await getCurrentUser();
    if (!user) return json({ error: "Please sign in." }, 401);
    if (body.action !== "acknowledge" || body.expectedUserId !== user.id) return securityJson({ error: "Invalid request." }, 409);
    await acknowledgeWelcome(await getDatabase(), new ObjectId(user.id));
    return json({ ok: true });
  } catch { return json({ error: "Unavailable." }, 503); }
}
