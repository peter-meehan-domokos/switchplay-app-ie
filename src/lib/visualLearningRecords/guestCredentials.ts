import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ClientSession, Db } from "mongodb";
import { requireVisual } from "./contracts";
import type { LearnerPrincipal } from "./model";

export const VISUAL_GUEST_COLLECTION = "visualGuests";
export const VISUAL_GUEST_DURATION_SECONDS = 90 * 24 * 60 * 60;
export const VISUAL_GUEST_INDEXES = [
  { collection: VISUAL_GUEST_COLLECTION, key: { guestId: 1 }, name: "visual_guest_id", unique: true },
  { collection: VISUAL_GUEST_COLLECTION, key: { credentialHash: 1 }, name: "visual_guest_credential", unique: true },
  // No TTL: deleting only the credential would orphan attempts/history. Retention
  // needs the separately reviewed coordinated traversal and claim protection.
  { collection: VISUAL_GUEST_COLLECTION, key: { status: 1, expiresAt: 1 }, name: "visual_guest_retention", unique: false },
] as const;
export type VisualGuest = {
  guestId: string; credentialHash: string; status: "active" | "claiming" | "claimed";
  createdAt: Date; lastActiveAt: Date; expiresAt: Date; useCount: number;
};
const credentialPattern = /^([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.([A-Za-z0-9_-]{43})$/;
export function parseVisualGuestCredential(value: string | undefined) {
  const match = value && value.length === 80 ? value.match(credentialPattern) : null;
  return match ? { guestId: match[1], credentialHash: createHash("sha256").update(match[2]).digest("hex") } : null;
}
export function visualGuestExpiry(now: Date) { return new Date(now.getTime() + VISUAL_GUEST_DURATION_SECONDS * 1000); }
export async function issueVisualGuest(db: Db, now = new Date()) {
  const guestId = randomUUID(), secret = randomBytes(32).toString("base64url"), credential = `${guestId}.${secret}`;
  const parsed = parseVisualGuestCredential(credential)!;
  const guest: VisualGuest = { ...parsed, status: "active", createdAt: now, lastActiveAt: now, expiresAt: visualGuestExpiry(now), useCount: 0 };
  await db.collection<VisualGuest>(VISUAL_GUEST_COLLECTION).insertOne(guest);
  return { credential, principal: { kind: "guest", id: guestId } as const, expiresAt: guest.expiresAt };
}
export async function authenticateVisualGuest(db: Db, credential: string | undefined, now = new Date()): Promise<LearnerPrincipal | null> {
  const parsed = parseVisualGuestCredential(credential); if (!parsed) return null;
  const guest = await db.collection<VisualGuest>(VISUAL_GUEST_COLLECTION).findOne({ ...parsed, status: "active", expiresAt: { $gt: now } });
  return guest ? { kind: "guest", id: guest.guestId } : null;
}
/** Recheck inside the learning-record transaction. A write on the credential
 * document serializes it with expiry/claim; no writer leases or epochs exist. */
export async function touchVisualGuest(db: Db, actor: LearnerPrincipal, session?: ClientSession, now = new Date()) {
  if (actor.kind !== "guest") return;
  const touched = await db.collection<VisualGuest>(VISUAL_GUEST_COLLECTION).updateOne({ guestId: actor.id, status: "active", expiresAt: { $gt: now } },
    { $set: { lastActiveAt: now, expiresAt: visualGuestExpiry(now) }, $inc: { useCount: 1 } }, { session });
  requireVisual(touched.matchedCount === 1, "VISUAL_GUEST_FORBIDDEN");
}
