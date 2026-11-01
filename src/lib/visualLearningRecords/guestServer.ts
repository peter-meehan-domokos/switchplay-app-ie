import { cookies } from "next/headers";
import { getDatabase, getMongoClient } from "../mongodb";
import { createVisualGuestApi } from "./guestApi";
import { authenticateVisualGuest, VISUAL_GUEST_DURATION_SECONDS } from "./guestCredentials";
import { createVisualRequestBudget } from "./requestBudget";
import { VisualLearningRecordRepository } from "./repository";
import { VisualRecordError } from "./contracts";
import { findVisualGuestLoginContext } from "./guestLoginContext";

export const visualGuestCookieName = () => process.env.NODE_ENV === "production" ? "__Host-switchplay_visual_guest" : "switchplay_visual_guest";
const issuanceBudget = createVisualRequestBudget(() => Date.now(), 30, 1), sessionBudget = createVisualRequestBudget();
const bootstrapBudget = createVisualRequestBudget(() => Date.now(), 180, 1), verificationBudget = createVisualRequestBudget(() => Date.now(), 2400, 1);
export async function readVisualGuestCookie() { return (await cookies()).get(visualGuestCookieName())?.value; }
export async function visualGuestLoginContext(accountId: string, claimId?: string) {
  try {
    const credential = await readVisualGuestCookie(); if (!credential && !claimId) return;
    return await findVisualGuestLoginContext(await getDatabase(), accountId, credential, claimId);
  } catch { /* Account login remains valid if progress discovery needs retry. */ }
}
export async function writeVisualGuestCookie(credential: string, maxAge = VISUAL_GUEST_DURATION_SECONDS) {
  (await cookies()).set(visualGuestCookieName(), credential, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", sameSite: "lax", maxAge });
}
export async function authenticateGuestRequest() {
  const credential = await readVisualGuestCookie();
  if (!credential) return null;
  if (!verificationBudget("guest-verification")) throw new VisualRecordError("VISUAL_RATE_LIMIT");
  const actor = await authenticateVisualGuest(await getDatabase(), credential);
  // Only route handlers call this adapter. Refreshing the browser credential
  // does not replace the transaction-level active/expiry check in the repository.
  if (actor) await writeVisualGuestCookie(credential);
  return actor;
}
export function visualGuestApi() {
  return createVisualGuestApi({ expectedOrigin: process.env.SWITCHPLAY_APP_ORIGIN,
    disabledIds: (process.env.SWITCHPLAY_DISABLED_INTERACTIVE_VISUAL_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean),
    database: async () => {
      const db = await getDatabase(); await new VisualLearningRecordRepository(db, await getMongoClient()).assertIndexesReady(); return db;
    },
    readCredential: readVisualGuestCookie, writeCredential: writeVisualGuestCookie,
    // Process-wide issuance ceiling avoids retaining IPs or trusting a spoofable
    // proxy header. Deployment-wide abuse controls remain a rollout prerequisite.
    consumeIssuanceBudget: () => issuanceBudget("guest-issuance"), consumeSessionBudget: sessionBudget,
    consumeRequestBudget: () => bootstrapBudget("guest-bootstrap"),
  });
}
