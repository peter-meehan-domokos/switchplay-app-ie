import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireCondition } from "../../cards/domain";
import { streamPlaybackGrant } from "../../cards/protectedMedia";
import { getCardMediaDownload } from "../../cardMediaDownloads";
import { STREAM_DIRECT_UPLOAD_MAX_DURATION_SECONDS, type StreamDownload } from "../../cloudflareStream";
import { getFileExtensionForImageUploadContentType, isSupportedImageUploadContentType } from "../../imageUploadContentTypes";
import type { GroupMediaProvider, GroupMediaRecord } from "./model";

type Env = Record<string, string | undefined>;
export function groupMediaConfiguration(kind: "image" | "video", env: Env = process.env) {
  requireCondition(env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === "1", "GROUP_MEDIA_CONFIGURATION_REQUIRED");
  requireCondition(Boolean(env.CLOUDFLARE_ACCOUNT_ID), "GROUP_MEDIA_CONFIGURATION_REQUIRED");
  const bucket = env.CLOUDFLARE_R2_USER_DATA_BUCKET_NAME;
  if (kind === "image") requireCondition(Boolean(bucket && env.CLOUDFLARE_R2_ACCESS_KEY_ID && env.CLOUDFLARE_R2_SECRET_ACCESS_KEY), "GROUP_MEDIA_CONFIGURATION_REQUIRED");
  else requireCondition(Boolean(env.CLOUDFLARE_STREAM_API_TOKEN), "GROUP_MEDIA_CONFIGURATION_REQUIRED");
  return { bucket, account: env.CLOUDFLARE_ACCOUNT_ID! };
}
function metadata(row: GroupMediaRecord) { return { creator: row.authorUserId, "contribution-id": row.contributionId,
  "experience-id": row.experienceId, "card-template-id": row.cardTemplateId }; }
function imageKey(row: GroupMediaRecord) {
  requireCondition(/^[a-f0-9-]{36}$/.test(row.contributionId) && isSupportedImageUploadContentType(row.contentType), "GROUP_MEDIA_ASSET_FORBIDDEN");
  return `group-media/${row.contributionId}.${getFileExtensionForImageUploadContentType(row.contentType)}`;
}
export function createGroupMediaProvider(deps: { env?: Env; fetch?: typeof fetch; s3?: S3Client; sign?: typeof getSignedUrl } = {}): GroupMediaProvider {
  const env = deps.env ?? process.env, fetcher = deps.fetch ?? fetch;
  const grantFetch: typeof fetch = (input, init) => fetcher(input, { ...init, signal: AbortSignal.timeout(10000) });
  const config = (kind: "image" | "video") => groupMediaConfiguration(kind, env);
  const s3 = () => deps.s3 ?? new S3Client({ region: "auto", endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID!, secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY! }, maxAttempts: 1 });
  const stream = (suffix: string, init: RequestInit = {}) => fetcher(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config("video").account)}/stream/${suffix}`, {
    ...init, headers: { Authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`, "Content-Type": "application/json", ...init.headers }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  function asset(row: GroupMediaRecord) {
    requireCondition(row.asset && (row.kind === "image" ? row.asset.provider === "r2" && row.asset.assetId === imageKey(row)
      && row.asset.bucket === config("image").bucket : row.asset.provider === "stream" && /^[a-f0-9]{32}$/.test(row.asset.assetId)), "GROUP_MEDIA_ASSET_FORBIDDEN");
    return row.asset;
  }
  async function video(row: GroupMediaRecord, allowMissing = false) {
    const locator = asset(row), response = await stream(encodeURIComponent(locator.assetId));
    if (allowMissing && response.status === 404) return null;
    const value = await response.json();
    requireCondition(response.ok && value.success && value.result?.creator === row.authorUserId && value.result?.requireSignedURLs === true
      && value.result?.meta?.groupContributionId === row.contributionId && value.result?.meta?.experienceId === row.experienceId
      && value.result?.meta?.cardTemplateId === row.cardTemplateId, "GROUP_MEDIA_PROVIDER_FORBIDDEN");
    return value.result;
  }
  const provider: GroupMediaProvider = {
    checkConfiguration: kind => { config(kind); },
    async allocate(row) {
      config(row.kind);
      if (row.kind === "image") {
        const key = imageKey(row), bucket = config("image").bucket!, headers: Record<string, string> = { "Content-Type": row.contentType, "If-None-Match": "*" };
        for (const [key, value] of Object.entries(metadata(row))) headers[`x-amz-meta-${key}`] = value;
        const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: row.contentType, ContentLength: row.size,
          IfNoneMatch: "*", Metadata: metadata(row) });
        const uploadURL = await (deps.sign ?? getSignedUrl)(s3(), command, { expiresIn: 300,
          signableHeaders: new Set([...Object.keys(headers).map(k => k.toLowerCase()), "content-length"]),
          unhoistableHeaders: new Set(Object.keys(headers).filter(k => k.startsWith("x-amz-meta-"))) });
        return { asset: { provider: "r2", assetId: key, bucket }, uploadURL, headers, expiresAt: new Date(Date.now() + 300000) };
      }
      const expiresAt = new Date(Date.now() + 1800000);
      const response = await stream("direct_upload", { method: "POST", headers: { "Upload-Creator": row.authorUserId }, body: JSON.stringify({
        maxDurationSeconds: STREAM_DIRECT_UPLOAD_MAX_DURATION_SECONDS, requireSignedURLs: true, expiry: expiresAt.toISOString(),
        meta: { groupContributionId: row.contributionId, experienceId: row.experienceId, cardTemplateId: row.cardTemplateId },
      }) });
      const value = await response.json();
      requireCondition(response.ok && value.success && /^[a-fA-F0-9]{32}$/.test(value.result?.uid)
        && typeof value.result?.uploadURL === "string" && value.result.uploadURL.startsWith("https://"), "GROUP_MEDIA_ALLOCATION_UNCERTAIN");
      return { asset: { provider: "stream", assetId: value.result.uid.toLowerCase() }, uploadURL: value.result.uploadURL, headers: {}, expiresAt };
    },
    async status(row) {
      config(row.kind); const locator = asset(row);
      if (locator.provider === "r2") {
        let object;
        try { object = await s3().send(new HeadObjectCommand({ Bucket: locator.bucket, Key: locator.assetId }), { abortSignal: AbortSignal.timeout(10000) }); }
        catch (error) { if ((error as { name?: string }).name === "NotFound") return { status: "processing" }; throw error; }
        requireCondition(object.ContentType === row.contentType && object.ContentLength === row.size
          && Object.entries(metadata(row)).every(([key, value]) => object.Metadata?.[key] === value), "GROUP_MEDIA_PROVIDER_FORBIDDEN");
        return { status: "ready" };
      }
      const value = await video(row);
      requireCondition(value.duration === undefined || value.duration <= STREAM_DIRECT_UPLOAD_MAX_DURATION_SECONDS, "GROUP_MEDIA_PROVIDER_FORBIDDEN");
      return { status: value.readyToStream === true ? "ready" : value.status?.state === "error" ? "failed" : "processing" };
    },
    async remove(row) {
      requireCondition(row.state === "deleted", "GROUP_MEDIA_ASSET_FORBIDDEN");
      config(row.kind); const locator = asset(row);
      if (locator.provider === "r2") {
        try {
          const object = await s3().send(new HeadObjectCommand({ Bucket: locator.bucket, Key: locator.assetId }), { abortSignal: AbortSignal.timeout(10000) });
          requireCondition(Object.entries(metadata(row)).every(([key, value]) => object.Metadata?.[key] === value), "GROUP_MEDIA_ASSET_FORBIDDEN");
        } catch (error) { if (["NotFound", "NoSuchKey"].includes((error as { name?: string }).name ?? "")) return; throw error; }
        await s3().send(new DeleteObjectCommand({ Bucket: locator.bucket, Key: locator.assetId }), { abortSignal: AbortSignal.timeout(10000) }); return;
      }
      if (!await video(row, true)) return;
      const response = await stream(encodeURIComponent(locator.assetId), { method: "DELETE" });
      if (response.status === 204 || response.status === 404) return;
      requireCondition(response.ok, "GROUP_MEDIA_CLEANUP_FAILED");
      const body = await response.text();
      // Stream can acknowledge deletion with an empty 200 response.
      if (response.status === 200 && body.trim() === "") return;
      const value = JSON.parse(body); requireCondition(value.success === true, "GROUP_MEDIA_CLEANUP_FAILED");
    },
    async deliver(row, action, signal) {
      config(row.kind); const locator = asset(row);
      requireCondition(row.state === "attached", "GROUP_MEDIA_FORBIDDEN");
      requireCondition((await provider.status(row)).status === "ready", "GROUP_MEDIA_NOT_READY");
      if (locator.provider === "r2") {
        const object = await s3().send(new GetObjectCommand({ Bucket: locator.bucket, Key: locator.assetId }), { abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
        requireCondition(object.Body && object.ContentType === row.contentType, "GROUP_MEDIA_PROVIDER_FORBIDDEN");
        return new Response(object.Body.transformToWebStream(), { headers: { "Content-Type": row.contentType, "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store", Vary: "Cookie", ...(action !== "playback" ? { "Content-Disposition": `attachment; filename="card-media.${getFileExtensionForImageUploadContentType(row.contentType as "image/jpeg")}"` } : {}) } });
      }
      // Existing download preparation/filename and signed-grant semantics; the
      // contextual src is never fetched or treated as a public provider URL.
      if (action !== "playback") return Response.json(await getCardMediaDownload({ id: row.contributionId, assetId: locator.assetId,
        mediaType: "video", provider: "cloudflare-stream", src: `/api/group-media/${row.contributionId}`, description: "Card video" }, action === "prepare-download", {
          videoStatus: async () => provider.status(row),
          download: async (_id, method) => {
            const response = await stream(`${locator.assetId}/downloads`, { method });
            if (method === "GET" && response.status === 404) return null;
            const body = await response.json();
            requireCondition(response.ok && body.success, "GROUP_MEDIA_DOWNLOAD_UNAVAILABLE");
            const download = body.result?.default;
            requireCondition(!download || ["ready", "inprogress", "error"].includes(download.status), "GROUP_MEDIA_DOWNLOAD_UNAVAILABLE");
            return (download ?? null) as StreamDownload | null;
          },
          grant: id => streamPlaybackGrant(id, grantFetch, true),
        }));
      return Response.json({ status: "ready", grant: await streamPlaybackGrant(locator.assetId, grantFetch) });
    },
  };
  return provider;
}
export const productionGroupMediaProvider = createGroupMediaProvider();
