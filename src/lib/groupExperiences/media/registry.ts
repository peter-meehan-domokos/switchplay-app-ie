import type { ClientSession, Db } from "mongodb";
import { isRecord, requireCondition } from "../../cards/domain";
import { GROUP_MEDIA_COLLECTION } from "./indexes";
// This reservation survives deletion. Generic personal/public/Info paths must
// not treat ownership of a different stored reference as a Group-media grant.
export async function assertNotGroupMedia(db: Db, provider: "r2" | "stream", identity: string, session?: ClientSession) {
  if (provider === "stream") {
    requireCondition(/^[a-zA-Z0-9_-]{1,200}$/.test(identity), "MEDIA_FORBIDDEN");
    if (/^[a-fA-F0-9]{32}$/.test(identity)) identity = identity.toLowerCase();
  } else {
    let path: string;
    try { path = decodeURIComponent(new URL(identity).pathname); } catch { try { path = decodeURIComponent(identity); } catch { requireCondition(false, "MEDIA_FORBIDDEN"); } }
    requireCondition(!/(?:^|\/)group-media\//.test(path) && !/(?:^|\/)api\/group-media(?:\/|$)/.test(path), "MEDIA_FORBIDDEN");
    // Private Group images have no public URL. Namespace denial includes origin
    // aliases/encoded keys; stream identity needs the persistent registry below.
    return;
  }
  requireCondition(!await db.collection(GROUP_MEDIA_COLLECTION).findOne({ "asset.provider": provider, "asset.assetId": identity },
    { session, projection: { _id: 1 } }), "MEDIA_FORBIDDEN");
}
export async function assertNoGroupMediaReferences(db: Db, value: unknown, session?: ClientSession): Promise<void> {
  if (Array.isArray(value)) { for (const item of value) await assertNoGroupMediaReferences(db, item, session); return; }
  if (!isRecord(value)) return;
  if (value.provider === "cloudflare-stream" && typeof value.assetId === "string") await assertNotGroupMedia(db, "stream", value.assetId, session);
  if (value.mediaType === "image") {
    for (const key of ["src", "assetId"] as const) if (typeof value[key] === "string") await assertNotGroupMedia(db, "r2", value[key], session);
  }
  for (const child of Object.values(value)) if (child && typeof child === "object") await assertNoGroupMediaReferences(db, child, session);
}
