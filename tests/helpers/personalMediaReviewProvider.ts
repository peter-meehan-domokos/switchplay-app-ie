import { createCloudflareR2DirectUpload, createCloudflareR2UserCardImageDirectUpload } from "../../src/lib/cloudflareR2";
import { reviewMediaOrigin } from "./groupMediaReviewProvider";
/* eslint-disable @typescript-eslint/no-require-imports */
// The resource query avoids the exact bundler replacement. Canonical instructional
// images keep the real provider (including its disposable-fixture boundary and
// key/ownership verification); only Group and personal media are substituted here.
const actual = require("../../src/lib/cards/mediaProviders?actual") as typeof import("../../src/lib/cards/mediaProviders");
export const instructionalImageUpload = actual.instructionalImageUpload;
export const instructionalImageBytes = actual.instructionalImageBytes;
export const instructionalImageReady = actual.instructionalImageReady;
export function imageUpload(options: Parameters<typeof createCloudflareR2DirectUpload>[0]) {
  reviewMediaOrigin(); return createCloudflareR2DirectUpload({ ...options, signedUrlImpl: async (_client, command) => `/__phase7-media/upload/personal?key=${encodeURIComponent((command.input as { Key?: string }).Key ?? "image")}` });
}
export function personalImageUpload(options: Parameters<typeof createCloudflareR2UserCardImageDirectUpload>[0]) {
  reviewMediaOrigin(); return createCloudflareR2UserCardImageDirectUpload({ ...options, signedUrlImpl: async (_client, command) => `/__phase7-media/upload/personal?key=${encodeURIComponent((command.input as { Key?: string }).Key ?? "image")}` });
}
export async function videoUpload() { reviewMediaOrigin(); throw Error("This disposable review uses images; live Stream upload is not enabled."); }
export async function videoStatus() { reviewMediaOrigin(); return { status: "processing" as const }; }
