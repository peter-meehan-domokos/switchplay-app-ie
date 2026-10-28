import assert from "node:assert/strict";
import { test } from "node:test";
import { assertInfoMediaConfigured, productionMediaSecurity } from "../src/lib/infoCards/media";
import { createCloudflareR2InfoCardUpload } from "../src/lib/cloudflareR2";
import type { InfoRoot, InfoMedia } from "../src/lib/infoCards/model";

test("public-image trial is explicit, never asserts verification and still requires protected application delivery", t => {
  const keys = ["NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA", "INFO_CARDS_PRIVATE_MEDIA_VERIFIED", "INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL"];
  const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  delete process.env.INFO_CARDS_PRIVATE_MEDIA_VERIFIED;
  process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA = "1";
  for (const value of [undefined, "0", "true"]) {
    if (value === undefined) delete process.env.INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL; else process.env.INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL = value;
    assert.throws(assertInfoMediaConfigured, { code: "INFO_MEDIA_PROVIDER_VERIFICATION_REQUIRED" });
  }
  process.env.INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL = "1";
  assert.doesNotThrow(assertInfoMediaConfigured);
  assert.equal(process.env.INFO_CARDS_PRIVATE_MEDIA_VERIFIED, undefined);
  process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA = "0";
  assert.throws(assertInfoMediaConfigured, { code: "INFO_MEDIA_PROVIDER_VERIFICATION_REQUIRED" });
});

test("provider readiness requires matching Stream creator, signed URLs and actual readiness", async t => {
  const config = { NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "1", INFO_CARDS_PRIVATE_MEDIA_VERIFIED: "0", INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL: "1", CLOUDFLARE_ACCOUNT_ID: "fixture", CLOUDFLARE_STREAM_API_TOKEN: "fixture" };
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
  assert(url.searchParams.get("X-Amz-SignedHeaders")?.includes("x-amz-meta-creator"));
  assert(url.searchParams.get("X-Amz-SignedHeaders")?.includes("x-amz-meta-info-card-id"));
  assert.equal(url.searchParams.get("x-amz-meta-creator"), null);
  assert.equal(url.searchParams.get("x-amz-meta-info-card-id"), null);
  assert.deepEqual(upload.headers, { "Content-Type": "image/png", "If-None-Match": "*", "x-amz-meta-creator": "alice", "x-amz-meta-info-card-id": "a" });
  await assert.rejects(createCloudflareR2InfoCardUpload({ creator: "../bob", infoCardId: "a", contentType: "image/png" }));
  await assert.rejects(createCloudflareR2InfoCardUpload({ creator: "alice", infoCardId: "a", contentType: "image/svg+xml" }));
});
