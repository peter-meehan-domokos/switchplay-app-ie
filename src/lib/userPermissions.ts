import { ObjectId, type ClientSession, type Db } from "mongodb";
import { requireCondition } from "./cards/domain";

/** Shared explicit grant; ordinary private capabilities remain governed by existing rules. */
export type UserPermissions = { publicPublishing: boolean };
export function newAccountPermissions(): UserPermissions { return { publicPublishing: false }; }
export function parseUserPermissions(value: unknown): UserPermissions {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || typeof (value as UserPermissions).publicPublishing !== "boolean"
    || Object.keys(value).some(key => key !== "publicPublishing")) throw new Error("INVALID_USER_PERMISSIONS");
  return { publicPublishing: (value as UserPermissions).publicPublishing };
}

/** Server publication boundary: the write serialises with direct Mongo grant/revoke updates.
 * A snapshot read alone could allow an old grant to commit after revocation. */
export async function requirePublicPublishing(db: Db, actor: string, session: ClientSession) {
  requireCondition(session.inTransaction(), "PUBLIC_PUBLISHING_TRANSACTION_REQUIRED");
  const _id = /^[a-f\d]{24}$/i.test(actor) ? new ObjectId(actor) : actor;
  const result = await db.collection<{ _id: ObjectId | string; publicPublishingRevision?: number }>("users").updateOne({
    _id, "permissions.publicPublishing": true,
    // Mongo dotted equality also matches arrays. Require the actual scalar boolean contract.
    $expr: { $and: [
      { $eq: [{ $type: "$permissions" }, "object"] },
      { $eq: [{ $type: "$permissions.publicPublishing" }, "bool"] },
    ] },
  }, { $inc: { publicPublishingRevision: 1 } }, { session });
  requireCondition(result.matchedCount === 1, "PUBLIC_PUBLISHING_FORBIDDEN");
}
