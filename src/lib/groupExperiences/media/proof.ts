import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { requireCondition } from "../../cards/domain";
import { hash } from "../contracts";
import type { GroupMediaRecord } from "./model";
function secret() {
  requireCondition(Boolean(process.env.SESSION_SECRET), "GROUP_MEDIA_SIGNING_UNAVAILABLE");
  return createHmac("sha256", process.env.SESSION_SECRET!).update("switchplay:group-contribution-upload:v1").digest();
}
function binding(row: GroupMediaRecord) {
  return hash({ actor: row.authorUserId, experienceId: row.experienceId, cardTemplateId: row.cardTemplateId,
    contributionId: row.contributionId, asset: row.asset, accessEpoch: row.accessEpoch, version: row.version,
    adoptionRevision: row.adoptionRevision, kind: row.kind, size: row.size, contentType: row.contentType });
}
export async function signGroupUpload(row: GroupMediaRecord) {
  return new SignJWT({ purpose: "group-media-upload", binding: binding(row) }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("30m").sign(secret());
}
export async function verifyGroupUpload(row: GroupMediaRecord, proof: string) {
  try {
    const { payload } = await jwtVerify(proof, secret(), { algorithms: ["HS256"] });
    requireCondition(payload.purpose === "group-media-upload" && payload.binding === binding(row), "GROUP_MEDIA_PROOF_FORBIDDEN");
  } catch { requireCondition(false, "GROUP_MEDIA_PROOF_FORBIDDEN"); }
}
