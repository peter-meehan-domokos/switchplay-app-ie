import type { ClientSession, Db } from "mongodb";
import { requireCondition } from "../cards/domain";
import type { InfoMedia } from "./model";

export const INFO_MEDIA_COLLECTION = "infoCardMediaAssets";
export type InfoMediaAllocation = {
  provider: InfoMedia["provider"]; assetId: string; src: string;
  infoCardId: string; ownerUserId: string; createdAt: Date;
};

// Older media APIs trust main/personal stored references. Never let a forged
// reference there turn an info-card asset ID into a grant. Records survive card
// deletion; provider garbage collection is deliberately deferred.
export async function assertNotInfoMedia(db: Db, provider: "r2" | "stream", identity: string, session?: ClientSession) {
  if (provider === "stream") {
    requireCondition(identity.length > 0 && identity.length <= 200 && !/[^a-zA-Z0-9_-]/.test(identity), "MEDIA_FORBIDDEN");
    // Cloudflare UIDs are hex; prevent alternate casing or URL-normalised input
    // reaching a provider identity different from the one checked in Mongo.
    if (/^[a-fA-F0-9]{32}$/.test(identity)) identity = identity.toLowerCase();
  }
  if (provider === "r2") {
    let path: string;
    try { path = decodeURIComponent(new URL(identity).pathname); } catch { path = identity; }
    requireCondition(!/(?:^|\/)info-cards\//.test(path), "MEDIA_FORBIDDEN");
  }
  const allocation = await db.collection<InfoMediaAllocation>(INFO_MEDIA_COLLECTION).findOne(provider === "stream"
    ? { provider: "cloudflare-stream", assetId: identity } : { provider: "cloudflare-r2", src: identity }, { session, projection: { _id: 1 } });
  requireCondition(!allocation, "MEDIA_FORBIDDEN");
}
