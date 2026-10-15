import assert from "node:assert/strict";
import { test } from "node:test";
import { imageDeliveryUrl, streamDeliveryUrl } from "../src/lib/mediaDelivery";
import { r2Location, streamTokenUrl, streamPlaybackGrant, readProtectedImage } from "../src/lib/cards/protectedMedia";
import { createCloudflareStreamDirectUpload } from "../src/lib/cloudflareStream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

test("protected presentation changes delivery URLs only; default local presentation stays unchanged", () => {
  const src = "https://assets.example.com/user-cards/alice/card/image.png";
  assert.equal(imageDeliveryUrl(src, false), src);
  assert.equal(new URL(imageDeliveryUrl(src, true), "http://local").searchParams.get("identity"), src);
  assert.equal(imageDeliveryUrl("/images/demo.png", true), "/images/demo.png");
  assert.equal(streamDeliveryUrl("video", "manifest", false), null);
  assert.equal(new URL(streamDeliveryUrl("video", "thumbnail", true)!, "http://local").searchParams.get("format"), "thumbnail");
});
test("R2 location uses configured origins and original keys, refusing arbitrary origins and mismatches", () => {
  const env = { CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://assets.example.com", CLOUDFLARE_R2_BUCKET_NAME: "canonical",
    CLOUDFLARE_R2_USER_DATA_PUBLIC_BASE_URL: "https://personal.example.com", CLOUDFLARE_R2_USER_DATA_BUCKET_NAME: "personal",
    CLOUDFLARE_R2_LEGACY_ORIGINS: JSON.stringify({ "https://old.example.com": "personal" }) };
  const item = { id: "image", mediaType: "image" as const, provider: "cloudflare-r2" as const, assetId: "legacy/original.png", src: "https://old.example.com/legacy/original.png", description: "Original" };
  assert.deepEqual(r2Location(item, env), { bucket: "personal", key: "legacy/original.png" });
  assert.throws(() => r2Location({ ...item, src: "https://untrusted.example.com/legacy/original.png" }, env), { code: "UNSUPPORTED_LEGACY_IMAGE_ORIGIN" });
  assert.throws(() => r2Location({ ...item, assetId: "other.png" }, env), { code: "INVALID_R2_REFERENCE" });
});
test("both historical canonical cover origins map to the same bucket without rewriting stored references", () => {
  const origins = ["https://historical.r2.dev", "https://assets.example.com"];
  for (const base of origins) {
    const env = { CLOUDFLARE_R2_PUBLIC_BASE_URL: base, CLOUDFLARE_R2_BUCKET_NAME: "canonical",
      CLOUDFLARE_R2_LEGACY_ORIGINS: JSON.stringify(Object.fromEntries(origins.map(origin => [origin, "canonical"]))) };
    for (const origin of origins) {
      const item = { id: "cover", mediaType: "image" as const, provider: "cloudflare-r2" as const,
        assetId: "path-templates/deck/introduction/cover.png", src: `${origin}/path-templates/deck/introduction/cover.png`, description: "Cover" };
      const before = structuredClone(item);
      assert.deepEqual(r2Location(item, env), { bucket: "canonical", key: item.assetId });
      assert.deepEqual(item, before);
      if (origin !== base) assert.throws(() => r2Location(item, { ...env, CLOUDFLARE_R2_LEGACY_ORIGINS: undefined }), { code: "UNSUPPORTED_LEGACY_IMAGE_ORIGIN" });
    }
  }
});
test("Stream token request is bounded, source ID remains unchanged and provider failures fail closed", async (t) => {
  const previous = { account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_STREAM_API_TOKEN };
  process.env.CLOUDFLARE_ACCOUNT_ID = "fixture"; process.env.CLOUDFLARE_STREAM_API_TOKEN = "fixture";
  t.after(() => { for (const [name, value] of [["CLOUDFLARE_ACCOUNT_ID", previous.account], ["CLOUDFLARE_STREAM_API_TOKEN", previous.token]]) { if (value === undefined) delete process.env[name!]; else process.env[name!] = value; } });
  let called = false;
  const fakeFetch: typeof fetch = async (input, init) => {
    called = true; assert.equal(String(input).endsWith("/original-video/token"), true);
    const expiry = JSON.parse(String(init?.body)).exp;
    assert.ok(expiry > Date.now() / 1000 && expiry <= Date.now() / 1000 + 3601);
    return Response.json({ success: true, result: { token: "signed.fixture.token" } });
  };
  assert.equal(await streamTokenUrl("original-video", "manifest", fakeFetch), "https://videodelivery.net/signed.fixture.token/manifest/video.m3u8");
  assert.equal(called, true);
  const before = Date.now(), grant = await streamPlaybackGrant("original-video", fakeFetch);
  assert.ok(grant.reuseUntil >= before + 600_000 && grant.reuseUntil <= Date.now() + 600_000);
  assert.ok(grant.reuseUntil < grant.expiresAt - 30_000);
  assert.equal(grant.thumbnailUrl, "https://videodelivery.net/signed.fixture.token/thumbnails/thumbnail.jpg");
  await assert.rejects(streamTokenUrl("original-video", "iframe", async () => Response.json({ success: false }, { status: 403 })), { code: "STREAM_TOKEN_FAILED" });
});
test("new protected Stream uploads require signed URLs without altering provider identities", async (t) => {
  const keys = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_STREAM_API_TOKEN", "CLOUDFLARE_STREAM_CUSTOMER_CODE", "NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA"];
  const previous = keys.map((key) => process.env[key]);
  for (const key of keys) process.env[key] = key === "NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA" ? "1" : "fixture";
  t.after(() => { keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; }); });
  t.mock.method(globalThis, "fetch", async (_input: unknown, options: RequestInit) => {
    assert.equal(JSON.parse(String(options.body)).requireSignedURLs, true);
    return Response.json({ success: true, result: { uid: "unchanged-provider-id", uploadURL: "https://fixture.invalid/upload" } });
  });
  assert.equal((await createCloudflareStreamDirectUpload({ creator: "fixture" })).uid, "unchanged-provider-id");
});
test("R2 delivery serves image bytes privately without a public redirect, and rejects active content", async (t) => {
  const values = { CLOUDFLARE_ACCOUNT_ID: "fixture", CLOUDFLARE_R2_ACCESS_KEY_ID: "fixture", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "fixture",
    CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://fixture.invalid", CLOUDFLARE_R2_BUCKET_NAME: "fixture-bucket" };
  const previous = Object.keys(values).map((key) => process.env[key]);
  Object.assign(process.env, values);
  t.after(() => { Object.keys(values).forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; }); });
  let contentType = "image/png";
  t.mock.method(S3Client.prototype, "send", async (command: GetObjectCommand) => {
    assert.equal(command.input.Bucket, "fixture-bucket"); assert.equal(command.input.Key, "original.png");
    return { ContentType: contentType, Body: { transformToWebStream: () => new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("fixture-image")); controller.close(); } }) } };
  });
  const item = { id: "image", description: "fixture", mediaType: "image" as const, provider: "cloudflare-r2" as const, assetId: "original.png", src: "https://fixture.invalid/original.png" };
  const response = await readProtectedImage(item);
  assert.equal(await response.text(), "fixture-image");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store"); assert.equal(response.headers.get("Vary"), "Cookie"); assert.equal(response.headers.get("Location"), null);
  contentType = "text/html";
  await assert.rejects(readProtectedImage(item), { code: "INVALID_IMAGE_RESPONSE" });
});
