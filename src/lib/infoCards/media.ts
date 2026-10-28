import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { ClientSession } from "mongodb";
import { requireCondition } from "../cards/domain";
import { createCloudflareR2InfoCardUpload, verifyCloudflareR2InfoCardObject } from "../cloudflareR2";
import { createCloudflareStreamDirectUpload } from "../cloudflareStream";
import { readProtectedImage, streamPlaybackGrant } from "../cards/protectedMedia";
import type { InfoCardRepository } from "./repository";
import type { InfoMedia, InfoRoot, MediaContext } from "./model";
import { infoId, revision } from "./domain";
import { INFO_MEDIA_COLLECTION, type InfoMediaAllocation } from "./mediaRegistry";

export interface InfoMediaSecurity { assertReady(actor: string, root: InfoRoot, media: InfoMedia): Promise<void> }
export function assertInfoMediaConfigured() {
  // Explicitly accepted small-scale trial: application ACLs still apply, but
  // R2 images may be read by direct URL. This is not storage verification.
  // Stream provenance/readiness/signed-URL checks below remain mandatory.
  requireCondition(process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === "1"
    && (process.env.INFO_CARDS_PRIVATE_MEDIA_VERIFIED === "1"
      || process.env.INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL === "1"), "INFO_MEDIA_PROVIDER_VERIFICATION_REQUIRED");
}
function secret() {
  requireCondition(!!process.env.SESSION_SECRET, "INFO_MEDIA_SIGNING_UNAVAILABLE");
  return createHmac("sha256", process.env.SESSION_SECRET!).update("switchplay:info-card-upload:v1").digest();
}
function sameAsset(a: InfoMedia | null | undefined, b: InfoMedia) {
  return !!a && a.provider === b.provider && a.assetId === b.assetId && a.src === b.src && a.mediaType === b.mediaType;
}
// Only called after an owner-authorised provider allocation. Never an HTTP signing oracle.
export async function signInfoUpload(root: InfoRoot, media: InfoMedia) {
  return new SignJWT({ purpose: "info-upload", actor: root.ownerUserId, infoCardId: root.infoCardId,
    createdAt: root.createdAt.toISOString(), provider: media.provider, assetId: media.assetId, src: media.src })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30m").sign(secret());
}
export async function assertMediaAttachment(repo: InfoCardRepository, actor: string, root: InfoRoot,
  media: InfoMedia | null, proof: string | undefined, session: ClientSession) {
  if (!media || sameAsset(root.draft?.mediaItem, media)) return;
  const historical = await repo.versions().findOne({ infoCardId: root.infoCardId,
    "content.mediaItem.provider": media.provider, "content.mediaItem.assetId": media.assetId,
    "content.mediaItem.src": media.src, "content.mediaItem.mediaType": media.mediaType }, { session, projection: { _id: 1 } });
  if (historical) return;
  requireCondition(typeof proof === "string" && proof.length < 8192, "INFO_MEDIA_FORBIDDEN");
  let payload;
  try { payload = (await jwtVerify(proof, secret(), { algorithms: ["HS256"] })).payload; }
  catch { requireCondition(false, "INFO_MEDIA_FORBIDDEN"); }
  requireCondition(payload.purpose === "info-upload" && payload.actor === actor && payload.infoCardId === root.infoCardId
    && payload.createdAt === root.createdAt.toISOString() && payload.provider === media.provider
    && payload.assetId === media.assetId && payload.src === media.src, "INFO_MEDIA_FORBIDDEN");
}

export const productionMediaSecurity: InfoMediaSecurity = {
  async assertReady(actor, root, media) {
    assertInfoMediaConfigured();
    if (media.provider === "cloudflare-r2") {
      await verifyCloudflareR2InfoCardObject(actor, root.infoCardId, media); return;
    }
    requireCondition(/^[a-zA-Z0-9_-]+$/.test(media.assetId) && !!process.env.CLOUDFLARE_ACCOUNT_ID && !!process.env.CLOUDFLARE_STREAM_API_TOKEN, "INFO_MEDIA_CONFIGURATION_REQUIRED");
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID!)}/stream/${encodeURIComponent(media.assetId)}`, {
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}` }, cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    const value = await response.json();
    requireCondition(response.ok && value.success && value.result?.creator === actor
      && value.result?.requireSignedURLs === true && value.result?.readyToStream === true, "INFO_MEDIA_NOT_READY_OR_UNPROTECTED");
  },
};

export async function createInfoUpload(repo: InfoCardRepository, actor: string, id: string,
  kind: "image" | "video", contentType?: string) {
  const root = await repo.owner(actor, id); assertInfoMediaConfigured();
  requireCondition(kind === "image" || kind === "video", "INVALID_INFO_MEDIA");
  let media: InfoMedia, uploadURL: string, headers: Record<string, string> | undefined;
  if (kind === "image") {
    const result = await createCloudflareR2InfoCardUpload({ creator: actor, infoCardId: id, contentType: contentType ?? "" });
    uploadURL = result.uploadURL;
    headers = result.headers;
    media = { id: result.assetId.split("/").at(-1)!, mediaType: "image", provider: "cloudflare-r2", assetId: result.assetId, src: result.deliveryUrl, description: "Image" };
  } else {
    const result = await createCloudflareStreamDirectUpload({ creator: actor, name: `info-card:${id}` });
    infoId(result.uid);
    const uid = /^[a-fA-F0-9]{32}$/.test(result.uid) ? result.uid.toLowerCase() : result.uid;
    uploadURL = result.uploadURL;
    media = { id: uid, mediaType: "video", provider: "cloudflare-stream", assetId: uid, src: `https://iframe.videodelivery.net/${uid}`, description: "Video" };
  }
  await repo.transaction(async session => {
    await repo.owner(actor, id, session);
    // Serialize with deletion; never return an upload proof for a retired ID.
    await repo.roots().updateOne({ infoCardId: id }, { $inc: { referenceRevision: 1 } }, { session });
    await repo.db.collection<InfoMediaAllocation>(INFO_MEDIA_COLLECTION).insertOne({ provider: media.provider, assetId: media.assetId,
      src: media.src, infoCardId: id, ownerUserId: actor, createdAt: new Date() }, { session });
  });
  return { uploadURL, media, proof: await signInfoUpload(root, media),
    ...(headers ? { headers } : {}) };
}

export async function authorizeInfoMedia(repo: InfoCardRepository, actor: string, context: MediaContext): Promise<InfoMedia> {
  infoId(actor); infoId(context.infoCardId);
  requireCondition(context.kind === "draft" || context.kind === "publication", "INVALID_INFO_MEDIA_CONTEXT");
  return repo.transaction(async session => {
    const root = await repo.roots().findOne({ infoCardId: context.infoCardId }, { session });
    requireCondition(root && !root.deletedAt, "INFO_MEDIA_FORBIDDEN");
    if (context.kind === "draft") {
      revision(context.revision);
      requireCondition(root.ownerUserId === actor && root.revision === context.revision && root.draft?.mediaItem, "INFO_MEDIA_FORBIDDEN");
      return root.draft.mediaItem;
    }
    revision(context.version); requireCondition(context.version > 0, "INVALID_INFO_MEDIA_CONTEXT");
    const published = await repo.versions().findOne({ infoCardId: context.infoCardId, version: context.version }, { session });
    requireCondition(published && context.version <= root.latestVersion && (root.ownerUserId === actor
      || (root.visibility === "public" && published.visibility === "public")) && published.content.mediaItem, "INFO_MEDIA_FORBIDDEN");
    return published.content.mediaItem;
  });
}
export async function deliverInfoMedia(repo: InfoCardRepository, actor: string, context: MediaContext, signal?: AbortSignal) {
  const media = await authorizeInfoMedia(repo, actor, context);
  assertInfoMediaConfigured();
  return media.mediaType === "image" ? readProtectedImage(media, signal)
    : Response.json(await streamPlaybackGrant(media.assetId), { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

// Owner draft only. An arbitrary provider UID never grants a processing read.
export async function infoDraftVideoStatus(repo: InfoCardRepository, actor: string, id: string, expected: number) {
  const media = await authorizeInfoMedia(repo, actor, { infoCardId: id, kind: "draft", revision: expected });
  assertInfoMediaConfigured();
  requireCondition(media.mediaType === "video", "INVALID_INFO_MEDIA_CONTEXT");
  requireCondition(!!process.env.CLOUDFLARE_ACCOUNT_ID && !!process.env.CLOUDFLARE_STREAM_API_TOKEN, "INFO_MEDIA_CONFIGURATION_REQUIRED");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID!)}/stream/${encodeURIComponent(media.assetId)}`, {
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}` }, cache: "no-store", signal: AbortSignal.timeout(20000),
  });
  const value = await response.json();
  requireCondition(response.ok && value.success && value.result?.creator === actor && value.result?.requireSignedURLs === true, "INFO_MEDIA_FORBIDDEN");
  const state = value.result.readyToStream === true ? "ready" : value.result.status?.state === "error" ? "failed" : "processing";
  const progress = value.result.status?.pctComplete;
  return { status: state, ...(state === "processing" && typeof progress === "number" && Number.isFinite(progress) ? { progress: Math.max(0, Math.min(100, progress)) } : {}) };
}
