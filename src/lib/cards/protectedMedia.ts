import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { MediaItem } from "../media";
import { isMediaItem } from "../media";
import type { CardRepository } from "./repository";
import { requireCondition, isRecord } from "./domain";
import { assertCardVersionAccess } from "./versionAccess";
import type { CardPlaybackContext } from "../cardPlaybackGrants";

// Match trusted stored references; an arbitrary URL/key supplied by a browser is
// never used for fetching. Ancestry does not grant another actor's personal media.
function contentMedia(value: unknown): MediaItem[] {
  if (Array.isArray(value)) return value.flatMap(contentMedia);
  if (!isRecord(value)) return [];
  if (isMediaItem(value)) return [value];
  return Object.values(value).flatMap(contentMedia);
}
export async function authorizeProtectedMedia(repo: CardRepository, actor: string, provider: "r2" | "stream", identity: string) {
  requireCondition(identity.length > 0 && identity.length <= 2048, "INVALID_MEDIA_IDENTITY");
  const matches = (item: MediaItem) => provider === "stream"
    ? item.mediaType === "video" && item.provider === "cloudflare-stream" && item.assetId === identity
    : item.mediaType === "image" && item.src === identity && (!("provider" in item) || item.provider === "cloudflare-r2");
  return repo.transaction(async (session) => {
    const user = await repo.getPersonalUser(actor, session);
    requireCondition(user, "MEDIA_FORBIDDEN");
    // Includes retained/archived/source records, always scoped to this actor.
    for (const card of user.cardsData ?? []) for (const item of contentMedia(card.mediaItems)) if (matches(item)) return item;
    for (const [rootsCollection, versionsCollection, idField] of [
      [repo.cards(), repo.cardVersions(), "cardTemplateId"],
      [repo.decks(), repo.deckVersions(), "deckTemplateId"],
    ] as const) {
      const roots = await rootsCollection.find({ $or: [{ ownerUserId: actor }, { visibility: "public" }] }, { session }).toArray();
      for (const root of roots) if (root.ownerUserId === actor) {
        const item = contentMedia(root.draft).find(matches); if (item) return item;
      }
      // Immutable visibility matters: public roots do not expose private-era versions.
      const clauses = roots.map((root) => ({ [idField]: root[idField as keyof typeof root], ...(root.ownerUserId === actor ? {} : { visibility: "public" as const }) }));
      if (!clauses.length) continue;
      for (let offset = 0; offset < clauses.length; offset += 100) {
        const versions = await versionsCollection.find({ $or: clauses.slice(offset, offset + 100) }, { session }).toArray();
        for (const version of versions) { const item = contentMedia(version.content).find(matches); if (item) return item; }
      }
    }
    requireCondition(false, "MEDIA_FORBIDDEN");
  });
}
// Exact immutable Card lookup for instructional playback; never scan other Cards.
export async function authorizeCardPlayback(repo: CardRepository, actor: string, context: Omit<CardPlaybackContext, "viewerUserId">, assetId: string) {
  requireCondition(typeof context.cardTemplateId === "string" && context.cardTemplateId.length > 0 && context.cardTemplateId.length <= 200
    && Number.isSafeInteger(context.version) && context.version >= 1
    && ["working", "canonical"].includes(context.mode) && assetId.length <= 2048 && /^[a-zA-Z0-9_-]+$/.test(assetId), "INVALID_PLAYBACK_CONTEXT");
  return repo.transaction(async (session) => {
    const user = await repo.getPersonalUser(actor, session);
    requireCondition(user, "MEDIA_FORBIDDEN");
    if (context.mode === "working") requireCondition(user.cardsData?.some(card => card.cardTemplateId === context.cardTemplateId
      && card.cardTemplateVersion === context.version), "MEDIA_FORBIDDEN");
    const root = await repo.cards().findOne({ cardTemplateId: context.cardTemplateId }, { session });
    const version = await repo.cardVersions().findOne({ cardTemplateId: context.cardTemplateId, version: context.version }, { session });
    requireCondition(root && version && root.latestVersion >= context.version, "MEDIA_FORBIDDEN");
    assertCardVersionAccess(actor, root, version);
    if (context.mode === "canonical") requireCondition(root.visibility === "public" && version.visibility === "public", "MEDIA_FORBIDDEN");
    requireCondition(contentMedia(version.content).some(item => item.mediaType === "video"
      && item.provider === "cloudflare-stream" && item.assetId === assetId), "MEDIA_FORBIDDEN");
  });
}
export function r2Location(item: MediaItem, env: Record<string, string | undefined> = process.env) {
  requireCondition(item.mediaType === "image", "INVALID_IMAGE");
  const aliases = env.CLOUDFLARE_R2_LEGACY_ORIGINS ? JSON.parse(env.CLOUDFLARE_R2_LEGACY_ORIGINS) : {};
  requireCondition(isRecord(aliases) && Object.values(aliases).every((value) => value === "canonical" || value === "personal"), "INVALID_LEGACY_ORIGIN_CONFIG");
  for (const [base, bucket] of [
    [env.CLOUDFLARE_R2_USER_DATA_PUBLIC_BASE_URL, env.CLOUDFLARE_R2_USER_DATA_BUCKET_NAME],
    [env.CLOUDFLARE_R2_PUBLIC_BASE_URL, env.CLOUDFLARE_R2_BUCKET_NAME],
    ...Object.entries(aliases).map(([base, kind]) => [base, kind === "personal" ? env.CLOUDFLARE_R2_USER_DATA_BUCKET_NAME : env.CLOUDFLARE_R2_BUCKET_NAME]),
  ]) {
    if (!base || !bucket || !item.src.startsWith(base.replace(/\/+$/, "") + "/")) continue;
    const urlKey = decodeURIComponent(item.src.slice(base.replace(/\/+$/, "").length + 1));
    requireCondition(urlKey.length > 0 && !/[?#]/.test(urlKey) && !urlKey.split("/").includes(".."), "INVALID_R2_REFERENCE");
    const key = "assetId" in item ? item.assetId : urlKey;
    requireCondition(key === urlKey, "INVALID_R2_REFERENCE");
    return { bucket, key };
  }
  // Providerless external images need an explicit mapping, never arbitrary HTTP fetch.
  requireCondition(false, "UNSUPPORTED_LEGACY_IMAGE_ORIGIN");
}
export async function readProtectedImage(item: MediaItem) {
  const { bucket, key } = r2Location(item);
  requireCondition(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, "R2_CONFIGURATION_REQUIRED");
  const client = new S3Client({ region: "auto", endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY } });
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  requireCondition(object.Body && /^image\/(avif|gif|jpeg|png|webp)$/.test(object.ContentType ?? ""), "INVALID_IMAGE_RESPONSE");
  return new Response(object.Body.transformToWebStream(), { headers: { "Content-Type": object.ContentType!,
    "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" } });
}
export async function streamPlaybackGrant(assetId: string, fetchImpl: typeof fetch = fetch) {
  const issuedAt = Date.now();
  const expiresAt = (Math.floor(issuedAt / 1000) + 3600) * 1000;
  requireCondition(/^[a-zA-Z0-9_-]+$/.test(assetId), "INVALID_STREAM_ID");
  requireCondition(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_STREAM_API_TOKEN, "STREAM_CONFIGURATION_REQUIRED");
  const response = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID!)}/stream/${assetId}/token`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`, "Content-Type": "application/json" },
    // One hour covers the current upload limit. Bearer URLs can be
    // copied until expiry; this is the explicitly approved delivery trade-off.
    body: JSON.stringify({ exp: expiresAt / 1000 }), cache: "no-store" });
  const body = await response.json();
  requireCondition(response.ok && body.success && typeof body.result?.token === "string" && /^[a-zA-Z0-9_.-]+$/.test(body.result.token), "STREAM_TOKEN_FAILED");
  const token = encodeURIComponent(body.result.token);
  return { assetId, manifestUrl: `https://videodelivery.net/${token}/manifest/video.m3u8`,
    thumbnailUrl: `https://videodelivery.net/${token}/thumbnails/thumbnail.jpg`,
    expiresAt, reuseUntil: Math.min(issuedAt + 300_000, expiresAt - 30_000) };
}
export async function streamTokenUrl(assetId: string, format: "manifest" | "thumbnail" | "iframe", fetchImpl: typeof fetch = fetch) {
  const grant = await streamPlaybackGrant(assetId, fetchImpl);
  return format === "manifest" ? grant.manifestUrl : format === "thumbnail" ? grant.thumbnailUrl
    : grant.manifestUrl.replace("https://videodelivery.net/", "https://iframe.videodelivery.net/").replace("/manifest/video.m3u8", "");
}
