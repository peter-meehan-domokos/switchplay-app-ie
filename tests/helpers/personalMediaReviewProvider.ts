import { createCloudflareR2DirectUpload, createCloudflareR2UserCardImageDirectUpload } from "../../src/lib/cloudflareR2";
import { reviewMediaOrigin } from "./groupMediaReviewProvider";
export function imageUpload(options: Parameters<typeof createCloudflareR2DirectUpload>[0]) {
  reviewMediaOrigin(); return createCloudflareR2DirectUpload({ ...options, signedUrlImpl: async (_client, command) => `/__phase7-media/upload/personal?key=${encodeURIComponent((command.input as { Key?: string }).Key ?? "image")}` });
}
export function personalImageUpload(options: Parameters<typeof createCloudflareR2UserCardImageDirectUpload>[0]) {
  reviewMediaOrigin(); return createCloudflareR2UserCardImageDirectUpload({ ...options, signedUrlImpl: async (_client, command) => `/__phase7-media/upload/personal?key=${encodeURIComponent((command.input as { Key?: string }).Key ?? "image")}` });
}
export async function videoUpload() { reviewMediaOrigin(); throw Error("This disposable review uses images; live Stream upload is not enabled."); }
export async function videoStatus() { reviewMediaOrigin(); return { status: "processing" as const }; }
