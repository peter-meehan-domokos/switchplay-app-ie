import assert from "node:assert/strict";
import { test } from "node:test";
import { createGroupMediaProvider, groupMediaConfiguration } from "../src/lib/groupExperiences/media/providers";
import type { GroupMediaRecord } from "../src/lib/groupExperiences/media/model";
const env = { GROUP_MEDIA_PRIVATE_PROVIDER_VERIFIED: "1", NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "1", CLOUDFLARE_ACCOUNT_ID: "account",
  CLOUDFLARE_STREAM_API_TOKEN: "test", CLOUDFLARE_R2_ACCESS_KEY_ID: "test", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "test",
  CLOUDFLARE_R2_GROUP_MEDIA_BUCKET_NAME: "private-group", CLOUDFLARE_R2_BUCKET_NAME: "public", CLOUDFLARE_R2_USER_DATA_BUCKET_NAME: "personal" };
const row = { contributionId: "12345678-1234-1234-1234-123456789abc", authorUserId: "bob", experienceId: "group", cardTemplateId: "card", kind: "video", contentType: "video/mp4", size: 100, state: "pending" } as GroupMediaRecord;
test("private configuration is deny by default and rejects shared legacy buckets and trial flag", () => {
  assert.throws(() => groupMediaConfiguration("image", { ...env, GROUP_MEDIA_PRIVATE_PROVIDER_VERIFIED: undefined, INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL: "1" }));
  assert.throws(() => groupMediaConfiguration("image", { ...env, CLOUDFLARE_R2_GROUP_MEDIA_BUCKET_NAME: "public" }));
  assert.equal(groupMediaConfiguration("image", env).bucket, "private-group");
});
test("Stream allocation always requires signed URLs and binds immutable contribution metadata", async () => {
  let body: Record<string, unknown> = {};
  const provider = createGroupMediaProvider({ env, fetch: async (_url, init) => { body = JSON.parse(String(init?.body)); return Response.json({ success: true, result: { uid: "ABCDEF1234567890ABCDEF1234567890", uploadURL: "https://upload.videodelivery.net/test" } }); } });
  const a = await provider.allocate(row);
  assert.equal(body.requireSignedURLs, true); assert.equal(body.maxDurationSeconds, 150);
  assert.deepEqual(body.meta, { groupContributionId: row.contributionId, experienceId: "group", cardTemplateId: "card" });
  assert.equal(a.asset.assetId, "abcdef1234567890abcdef1234567890"); assert.ok(a.expiresAt);
});
test("Stream readiness verifies actor, origin, allocation and signed protection", async () => {
  let result: Record<string, unknown> = { creator: "bob", requireSignedURLs: true, readyToStream: true,
    meta: { groupContributionId: row.contributionId, experienceId: "group", cardTemplateId: "card" } };
  const provider = createGroupMediaProvider({ env, fetch: async () => Response.json({ success: true, result }) });
  const r = { ...row, asset: { provider: "stream" as const, assetId: "abcdef1234567890abcdef1234567890" } };
  assert.equal((await provider.status(r)).status, "ready");
  for (const changes of [{ creator: "alice" }, { requireSignedURLs: false }, { meta: {} }]) {
    const saved = result; result = { ...result, ...changes }; await assert.rejects(provider.status(r)); result = saved;
  }
});
test("cleanup accepts provider not-found but rejects permission errors and wrong allocation paths", async () => {
  let status = 404;
  const provider = createGroupMediaProvider({ env, fetch: async () => Response.json({}, { status }) });
  const r = { ...row, state: "deleted" as const, asset: { provider: "stream" as const, assetId: "abcdef1234567890abcdef1234567890" } };
  await provider.remove(r); status = 403; await assert.rejects(provider.remove(r));
  await assert.rejects(provider.remove({ ...r, kind: "image", asset: { provider: "r2", assetId: "user-cards/bob/legacy.jpg", bucket: "private-group" } }));
});

test("image signing uses dedicated bucket, exact length, metadata and conditional PUT without a public URL", async () => {
  let input: Record<string, unknown> = {}, signed: Record<string, unknown> = {};
  const provider = createGroupMediaProvider({ env, sign: (async (_client, command, options) => {
    input = command.input as Record<string, unknown>; signed = options as Record<string, unknown>; return "https://private-r2.test/signed-put";
  }) as typeof import("@aws-sdk/s3-request-presigner").getSignedUrl });
  const result = await provider.allocate({ ...row, kind: "image", contentType: "image/jpeg" });
  assert.equal(input.Bucket, "private-group"); assert.equal(input.Key, `group-media/${row.contributionId}.jpg`);
  assert.equal(input.IfNoneMatch, "*"); assert.equal(input.ContentLength, 100);
  assert.deepEqual(input.Metadata, { creator: "bob", "contribution-id": row.contributionId, "experience-id": "group", "card-template-id": "card" });
  assert.equal(result.headers["If-None-Match"], "*"); assert.equal(signed.expiresIn, 300);
  assert.ok((signed.unhoistableHeaders as Set<string>).has("x-amz-meta-creator"));
  assert.ok(!("deliveryUrl" in result)); assert.ok(!("src" in result));
});

test("image readiness and cleanup reject forged object metadata and never delete a shared bucket", async () => {
  let creator = "bob", deletes = 0;
  const s3 = { send: async (command: { constructor: { name: string } }) => {
    if (command.constructor.name === "DeleteObjectCommand") { deletes++; return {}; }
    return { ContentType: "image/jpeg", ContentLength: 100, Metadata: { creator, "contribution-id": row.contributionId, "experience-id": "group", "card-template-id": "card" } };
  } } as unknown as import("@aws-sdk/client-s3").S3Client;
  const provider = createGroupMediaProvider({ env, s3 });
  const r = { ...row, kind: "image" as const, contentType: "image/jpeg", asset: { provider: "r2" as const, assetId: `group-media/${row.contributionId}.jpg`, bucket: "private-group" } };
  assert.equal((await provider.status(r)).status, "ready");
  creator = "alice"; await assert.rejects(provider.status(r)); await assert.rejects(provider.remove({ ...r, state: "deleted" }));
  assert.equal(deletes, 0); creator = "bob";
  await provider.remove({ ...r, state: "deleted" }); assert.equal(deletes, 1);
  await assert.rejects(provider.remove({ ...r, state: "deleted", asset: { ...r.asset, bucket: "personal" } })); assert.equal(deletes, 1);
});

test("Stream cleanup checks immutable provider provenance before physical deletion", async () => {
  let deletes = 0, creator = "foreign";
  const provider = createGroupMediaProvider({ env, fetch: async (_url, init) => {
    if (init?.method === "DELETE") { deletes++; return Response.json({ success: true }); }
    return Response.json({ success: true, result: { creator, requireSignedURLs: true,
      meta: { groupContributionId: row.contributionId, experienceId: "group", cardTemplateId: "card" } } });
  } });
  const r = { ...row, state: "deleted" as const, asset: { provider: "stream" as const, assetId: "abcdef1234567890abcdef1234567890" } };
  await assert.rejects(provider.remove(r)); assert.equal(deletes, 0);
  creator = "bob"; await provider.remove(r); assert.equal(deletes, 1);
});

test("private image delivery streams bytes through the app and preserves download headers", async () => {
  const s3 = { send: async (command: { constructor: { name: string } }) => ({ ContentType: "image/jpeg", ContentLength: 100,
    Metadata: { creator: "bob", "contribution-id": row.contributionId, "experience-id": "group", "card-template-id": "card" },
    ...(command.constructor.name === "GetObjectCommand" ? { Body: { transformToWebStream: () => new Response("image bytes").body } } : {}) }) } as unknown as import("@aws-sdk/client-s3").S3Client;
  const provider = createGroupMediaProvider({ env, s3 });
  const r = { ...row, kind: "image" as const, contentType: "image/jpeg", state: "attached" as const,
    asset: { provider: "r2" as const, assetId: `group-media/${row.contributionId}.jpg`, bucket: "private-group" } };
  const response = await provider.deliver(r, "download");
  assert.equal(await response.text(), "image bytes"); assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store"); assert.equal(response.headers.get("Location"), null);
  assert.equal(response.headers.get("Content-Disposition"), 'attachment; filename="card-media.jpg"');
});

test("signed video playback and download reuse grants while never exposing unsigned provider URLs", async t => {
  const previousAccount = process.env.CLOUDFLARE_ACCOUNT_ID, previousToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  process.env.CLOUDFLARE_ACCOUNT_ID = "account"; process.env.CLOUDFLARE_STREAM_API_TOKEN = "test";
  t.after(() => { for (const [key, value] of [["CLOUDFLARE_ACCOUNT_ID", previousAccount], ["CLOUDFLARE_STREAM_API_TOKEN", previousToken]]) if (value === undefined) delete process.env[key!]; else process.env[key!] = value; });
  const requests: { url: string; body: unknown }[] = [];
  const provider = createGroupMediaProvider({ env, fetch: async (input, init) => {
    const url = String(input); requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith("/token")) { assert.ok(init?.signal); return Response.json({ success: true, result: { token: "signed.grant" } }); }
    if (url.endsWith("/downloads")) return Response.json({ success: true, result: { default: { status: "ready", url: "https://videodelivery.net/unsigned/downloads/default.mp4" } } });
    return Response.json({ success: true, result: { creator: "bob", readyToStream: true, requireSignedURLs: true,
      meta: { groupContributionId: row.contributionId, experienceId: "group", cardTemplateId: "card" } } });
  } });
  const r = { ...row, state: "attached" as const, asset: { provider: "stream" as const, assetId: "abcdef1234567890abcdef1234567890" } };
  const playback = await (await provider.deliver(r, "playback")).json();
  assert.ok(playback.grant.manifestUrl.includes("signed.grant"));
  const download = await (await provider.deliver(r, "download")).json();
  assert.ok(download.url.includes("signed.grant")); assert.ok(!download.url.includes("unsigned"));
  assert.equal((requests.findLast(r => r.url.endsWith("/token"))!.body as { downloadable: boolean }).downloadable, true);
});
