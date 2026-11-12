/* eslint-disable @typescript-eslint/no-require-imports */
// The resource query avoids the exact bundler replacement, retaining the actual
// authorisation functions. Image byte delivery is substituted by the disposable fixture media
// server, and Stream grant and token issuance is DISABLED (both throw), so protected video playback
// cannot be exercised through this provider.
const actual = require("../../src/lib/cards/protectedMedia?actual") as typeof import("../../src/lib/cards/protectedMedia");
import { reviewMediaOrigin } from "./groupMediaReviewProvider";
export const authorizeProtectedMedia = actual.authorizeProtectedMedia;
export const authorizeCardPlayback = actual.authorizeCardPlayback;
export const r2Location = actual.r2Location;
export async function readProtectedImage(item: import("../../src/lib/media").MediaItem, signal?: AbortSignal) {
  const origin = reviewMediaOrigin(), { key } = actual.r2Location(item);
  return fetch(`${origin}/assets/${key}`, { signal });
}
export async function streamPlaybackGrant() { reviewMediaOrigin(); throw Error("Live Stream grants are disabled in this disposable review"); }
export async function streamTokenUrl() { reviewMediaOrigin(); throw Error("Live Stream grants are disabled in this disposable review"); }
