import { assertDisposableDatabase } from "./localDatabase";
import { createCloudflareR2DirectUpload, createCloudflareR2UserCardImageDirectUpload } from "../cloudflareR2";
import { createCloudflareStreamDirectUpload, getCloudflareStreamVideoStatus } from "../cloudflareStream";

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
