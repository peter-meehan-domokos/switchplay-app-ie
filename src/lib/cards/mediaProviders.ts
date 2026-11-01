import { assertDisposableDatabase } from "./localDatabase";
import { createCloudflareR2DirectUpload, createCloudflareR2UserCardImageDirectUpload, createInstructionalImageUpload, verifyInstructionalImageObject } from "../cloudflareR2";
import { createCloudflareStreamDirectUpload, getCloudflareStreamVideoStatus } from "../cloudflareStream";
import { readProtectedImage, r2Location } from "./protectedMedia";
import type { ImageMediaItem } from "../media";

// An explicit, loopback-only provider boundary for the real browser integration suite.
// Authentication, context authorization, object-key generation and metadata validation stay real.
function fixtureOrigin() {
  const origin = process.env.PHASE2_MEDIA_FIXTURE_ORIGIN;
  if (!origin) return null;
  assertDisposableDatabase();
  if (!/^switchplay_phase2_browser_/.test(process.env.MONGODB_DB ?? "") || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error("Invalid local media fixture configuration");
  return origin;
}
export function imageUpload(options: Parameters<typeof createCloudflareR2DirectUpload>[0]) {
  const origin = fixtureOrigin();
  return createCloudflareR2DirectUpload({ ...options, ...(origin ? { signedUrlImpl: async () => `${origin}/upload` } : {}) });
}
export function personalImageUpload(options: Parameters<typeof createCloudflareR2UserCardImageDirectUpload>[0]) {
  const origin = fixtureOrigin();
  return createCloudflareR2UserCardImageDirectUpload({ ...options, ...(origin ? { signedUrlImpl: async () => `${origin}/upload` } : {}) });
}
export async function videoUpload(options: Parameters<typeof createCloudflareStreamDirectUpload>[0]) {
  const origin = fixtureOrigin();
  if (!origin) return createCloudflareStreamDirectUpload(options);
  const response = await fetch(`${origin}/stream`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(options) });
  if (!response.ok) throw new Error("Local media fixture failed");
  return response.json() as ReturnType<typeof createCloudflareStreamDirectUpload>;
}
export async function videoStatus(assetId: string) {
  const origin = fixtureOrigin();
  if (!origin) return getCloudflareStreamVideoStatus(assetId);
  const response = await fetch(`${origin}/status/${encodeURIComponent(assetId)}`);
  if (!response.ok) throw new Error("Local media fixture failed");
  return response.json() as ReturnType<typeof getCloudflareStreamVideoStatus>;
}
/** The same explicit disposable boundary used by upload tests, never a live URL override. */
export async function instructionalImageBytes(item: ImageMediaItem, signal: AbortSignal) {
  const origin = fixtureOrigin();
  if (!origin) return readProtectedImage(item, signal);
  const { key } = r2Location(item);
  return fetch(`${origin}/assets/${key.split("/").map(encodeURIComponent).join("/")}`, { signal, cache: "no-store" });
}

export function instructionalImageUpload(options: Parameters<typeof createInstructionalImageUpload>[0]) {
  const origin = fixtureOrigin();
  return createInstructionalImageUpload({ ...options, ...(origin ? { signedUrlImpl: async (_client, command) =>
    `${origin}/upload?key=${encodeURIComponent((command.input as { Key: string }).Key)}` } : {}) });
}
export async function instructionalImageReady(allocation: Parameters<typeof verifyInstructionalImageObject>[0]) {
  const origin = fixtureOrigin();
  if (!origin) return verifyInstructionalImageObject(allocation);
  const response = await fetch(`${origin}/assets/${allocation.assetId.split("/").map(encodeURIComponent).join("/")}`, { method: "HEAD", cache: "no-store" });
  if (!response.ok || response.headers.get("x-amz-meta-creator") !== allocation.ownerUserId) throw new Error("Fixture image is not ready");
}
