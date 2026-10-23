import assert from "node:assert/strict";
import { test } from "node:test";
import { productionMediaSecurity } from "../src/lib/infoCards/media";
import { createCloudflareR2InfoCardUpload } from "../src/lib/cloudflareR2";
import type { InfoRoot, InfoMedia } from "../src/lib/infoCards/model";

test("provider readiness requires matching Stream creator, signed URLs and actual readiness", async t => {
  const config = { NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "1", INFO_CARDS_PRIVATE_MEDIA_VERIFIED: "1", CLOUDFLARE_ACCOUNT_ID: "fixture", CLOUDFLARE_STREAM_API_TOKEN: "fixture" };
  const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]])); Object.assign(process.env, config);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  let result = { creator: "alice", requireSignedURLs: true, readyToStream: true };
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, result }));
  const root = { infoCardId: "a" } as InfoRoot;
  const media: InfoMedia = { id: "video", mediaType: "video", provider: "cloudflare-stream", assetId: "video", src: "https://iframe.videodelivery.net/video", description: "Video" };
  await productionMediaSecurity.assertReady("alice", root, media);
  for (const changed of [{ creator: "bob" }, { requireSignedURLs: false }, { readyToStream: false }]) {
    result = { creator: "alice", requireSignedURLs: true, readyToStream: true, ...changed };
    await assert.rejects(productionMediaSecurity.assertReady("alice", root, media), { code: "INFO_MEDIA_NOT_READY_OR_UNPROTECTED" });
  }
});

test("R2 upload is scoped to owner/card and signs conditional create to prevent overwriting published media", async t => {
  const config = { CLOUDFLARE_ACCOUNT_ID: "fixture", CLOUDFLARE_R2_ACCESS_KEY_ID: "fixture", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "fixture",
    CLOUDFLARE_R2_BUCKET_NAME: "private-fixture", CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://private.invalid" };
  const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]])); Object.assign(process.env, config);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const upload = await createCloudflareR2InfoCardUpload({ creator: "alice", infoCardId: "a", contentType: "image/png" });
  assert.match(upload.assetId, /^info-cards\/alice\/a\/[a-f\d-]+\.png$/);
  const url = new URL(upload.uploadURL);
  assert(url.searchParams.get("X-Amz-SignedHeaders")?.includes("if-none-match"));
  assert(url.searchParams.get("X-Amz-SignedHeaders")?.includes("content-type"));
  assert.equal(url.searchParams.get("x-amz-meta-creator"), "alice");
  assert.equal(url.searchParams.get("x-amz-meta-info-card-id"), "a");
  await assert.rejects(createCloudflareR2InfoCardUpload({ creator: "../bob", infoCardId: "a", contentType: "image/png" }));
  await assert.rejects(createCloudflareR2InfoCardUpload({ creator: "alice", infoCardId: "a", contentType: "image/svg+xml" }));
});
