import assert from "node:assert/strict";
import { test } from "node:test";
import { S3Client } from "@aws-sdk/client-s3";
import { createInstructionalImageUpload, verifyInstructionalImageObject } from "../src/lib/cloudflareR2";
import { uploadFileToR2 } from "../src/lib/mediaUploadClient";

const config = { CLOUDFLARE_ACCOUNT_ID: "fixture", CLOUDFLARE_R2_ACCESS_KEY_ID: "fixture", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "fixture", CLOUDFLARE_R2_BUCKET_NAME: "fixture", CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://r2.invalid" };
test("canonical upload signs target ownership and write-once headers; publication checks stored metadata", async t => {
  const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]])); Object.assign(process.env, config);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const upload = await createInstructionalImageUpload({ creator: "alice", scope: "card", targetId: "card", contentType: "image/png" });
  assert.match(upload.assetId, /^instructional-images\/alice\/card\/card\/[a-f\d-]+\.png$/);
  const url = new URL(upload.uploadURL), signed = url.searchParams.get("X-Amz-SignedHeaders")!;
  for (const key of Object.keys(upload.headers)) assert(signed.split(";").includes(key.toLowerCase()));
  for (const key of Object.keys(upload.headers).filter(key => key.startsWith("x-amz-meta-"))) assert.equal(url.searchParams.get(key), null);
  assert.equal(upload.headers["If-None-Match"], "*");
  const allocation = { assetId: upload.assetId, src: upload.deliveryUrl, ownerUserId: "alice", uploadScope: "card", uploadTargetId: "card" };
  let metadata = { creator: "alice" }, length = 5, type = "image/png";
  t.mock.method(S3Client.prototype, "send", async () => ({ Metadata: metadata, ContentLength: length, ContentType: type }));
  await verifyInstructionalImageObject(allocation);
  for (const changed of [{ ...metadata, creator: "bob" }, {}]) {
    metadata = changed as typeof metadata; await assert.rejects(verifyInstructionalImageObject(allocation));
  }
  metadata = { creator: "alice" };
  length = 0; await assert.rejects(verifyInstructionalImageObject(allocation));
  length = 10 * 1024 * 1024 + 1; await assert.rejects(verifyInstructionalImageObject(allocation));
  length = 5; type = "image/svg+xml"; await assert.rejects(verifyInstructionalImageObject(allocation));
  await assert.rejects(verifyInstructionalImageObject({ ...allocation, src: "https://foreign.invalid/image.png" }));
  await assert.rejects(verifyInstructionalImageObject({ ...allocation, uploadTargetId: "other-card" }));
  await assert.rejects(verifyInstructionalImageObject({ ...allocation, uploadScope: "deck" }));
  await assert.rejects(createInstructionalImageUpload({ creator: "../bob", scope: "card", targetId: "card", contentType: "image/png" }));
});
test("browser R2 transfer sends required signed headers without changing legacy transfers", async t => {
  const calls: RequestInit[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => { calls.push(init); return new Response(null, { status: 200 }); });
  const file = new File(["image"], "image.png", { type: "image/png" }), signal = new AbortController().signal;
  const headers = { "If-None-Match": "*", "x-amz-meta-creator": "alice" };
  await uploadFileToR2("https://r2.invalid/upload", file, signal, headers);
  assert.deepEqual(calls[0].headers, { "Content-Type": "image/png", ...headers });
  await uploadFileToR2("https://r2.invalid/legacy", file, signal);
  assert.deepEqual(calls[1].headers, { "Content-Type": "image/png" });
});
