import assert from "node:assert/strict";
import test from "node:test";
import {
  CloudflareR2ConfigError,
  CloudflareR2ValidationError,
  R2_PRESIGNED_UPLOAD_EXPIRATION_SECONDS,
  createCloudflareR2DirectUpload,
  createCloudflareR2ImageMediaItem,
  createCloudflareR2ObjectKey,
  createCloudflareR2UserCardImageDirectUpload,
  createCloudflareR2UserCardImageObjectKey,
  createR2PublicObjectUrl,
  createR2UserDataPublicObjectUrl,
} from "../src/lib/cloudflareR2";

function setR2Env() {
  process.env.CLOUDFLARE_ACCOUNT_ID = "account-id";
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "access-key-id";
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "secret-access-key";
  process.env.CLOUDFLARE_R2_BUCKET_NAME = "switchplay-assets";
  process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL = "https://cdn.example.com/deck-media/";
}

function clearR2Env() {
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  delete process.env.CLOUDFLARE_R2_BUCKET_NAME;
  delete process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
}

function setR2UserDataEnv() {
  process.env.CLOUDFLARE_ACCOUNT_ID = "account-id";
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "access-key-id";
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "secret-access-key";
  process.env.CLOUDFLARE_R2_USER_DATA_BUCKET_NAME = "path-user-data";
  process.env.CLOUDFLARE_R2_USER_DATA_PUBLIC_BASE_URL = "https://user-uploads.example.com/";
}

test("object key generation is namespaced and preserves a validated extension", () => {
  const objectKey = createCloudflareR2ObjectKey("peter-fiddle-deck-1", "image/jpeg", "fixed-id");

  assert.equal(objectKey, "path-templates/peter-fiddle-deck-1/introduction/fixed-id.jpg");
});

test("unsafe deckTemplateId values are rejected", () => {
  assert.throws(() => createCloudflareR2ObjectKey("../peter", "image/png", "fixed-id"), CloudflareR2ValidationError);
  assert.throws(() => createCloudflareR2ObjectKey("peter/deck", "image/png", "fixed-id"), CloudflareR2ValidationError);
  assert.throws(() => createCloudflareR2ObjectKey("peter..deck", "image/png", "fixed-id"), CloudflareR2ValidationError);
});

test("user-card object keys use the user-data namespace and validated identifiers", () => {
  const objectKey = createCloudflareR2UserCardImageObjectKey(
    "507f1f77bcf86cd799439011",
    "deck-2026-09-18-maths-formulae-1",
    "card-003",
    "image/png",
    "fixed-id",
  );

  assert.equal(
    objectKey,
    "user-decks/507f1f77bcf86cd799439011/deck-2026-09-18-maths-formulae-1/cards/card-003/fixed-id.png",
  );
  assert.throws(
    () => createCloudflareR2UserCardImageObjectKey("user-1", "deck-1", "card-1", "image/png", "fixed-id"),
    CloudflareR2ValidationError,
  );
});

test("public URL helper joins the configured base URL and object key", () => {
  setR2Env();

  assert.equal(
    createR2PublicObjectUrl("path-templates/peter-fiddle-deck-1/introduction/fixed-id.jpg"),
    "https://cdn.example.com/deck-media/path-templates/peter-fiddle-deck-1/introduction/fixed-id.jpg",
  );
});

test("missing R2 configuration fails clearly", () => {
  clearR2Env();

  assert.throws(() => createR2PublicObjectUrl("path-templates/peter-fiddle-deck-1/introduction/fixed-id.jpg"), CloudflareR2ConfigError);
});

test("user-data public URL helper joins the user-data base URL and object key", () => {
  setR2UserDataEnv();

  assert.equal(
    createR2UserDataPublicObjectUrl("user-decks/507f1f77bcf86cd799439011/deck-1/cards/card-1/fixed-id.png"),
    "https://user-uploads.example.com/user-decks/507f1f77bcf86cd799439011/deck-1/cards/card-1/fixed-id.png",
  );
});

test("unsupported image content types are rejected before presigning", async () => {
  setR2Env();

  await assert.rejects(
    createCloudflareR2DirectUpload({
      creator: "user-1",
      contentType: "image/svg+xml",
      deckTemplateId: "peter-fiddle-deck-1",
    }),
    CloudflareR2ValidationError,
  );
});

test("presigned upload metadata maps assetId to the server-generated object key", async () => {
  setR2Env();

  const directUpload = await createCloudflareR2DirectUpload({
    creator: "user-1",
    contentType: "image/webp",
    deckTemplateId: "peter-fiddle-deck-1",
    signedUrlImpl: async (_client, command, options) => {
      const commandInput = command.input as {
        Bucket?: string;
        Key?: string;
        ContentType?: string;
        Metadata?: Record<string, string>;
      };

      assert.equal(options?.expiresIn, R2_PRESIGNED_UPLOAD_EXPIRATION_SECONDS);
      assert.deepEqual(commandInput, {
        Bucket: "switchplay-assets",
        Key: commandInput.Key,
        ContentType: "image/webp",
        Metadata: { creator: "user-1" },
      });
      assert.match(String(commandInput.Key), /^path-templates\/peter-fiddle-deck-1\/introduction\/[0-9a-f-]+\.webp$/);

      return "https://signed.example.com/upload";
    },
  });

  assert.match(directUpload.assetId, /^path-templates\/peter-fiddle-deck-1\/introduction\/[0-9a-f-]+\.webp$/);
  assert.equal(directUpload.uploadURL, "https://signed.example.com/upload");
  assert.equal(directUpload.deliveryUrl, `https://cdn.example.com/deck-media/${directUpload.assetId}`);
});

test("user-card presigned uploads use the user-data bucket and return a media item id", async () => {
  setR2UserDataEnv();

  const directUpload = await createCloudflareR2UserCardImageDirectUpload({
    creator: "507f1f77bcf86cd799439011",
    contentType: "image/png",
    deckTemplateId: "deck-1",
    cardId: "card-003",
    signedUrlImpl: async (_client, command) => {
      const commandInput = command.input as {
        Bucket?: string;
        Key?: string;
        ContentType?: string;
        Metadata?: Record<string, string>;
      };

      assert.equal(commandInput.Bucket, "path-user-data");
      assert.match(String(commandInput.Key), /^user-decks\/507f1f77bcf86cd799439011\/deck-1\/cards\/card-003\/[0-9a-f-]+\.png$/);
      assert.equal(commandInput.ContentType, "image/png");
      assert.deepEqual(commandInput.Metadata, { creator: "507f1f77bcf86cd799439011" });
      return "https://signed.example.com/user-card-upload";
    },
  });

  assert.match(directUpload.assetId, /^user-decks\/507f1f77bcf86cd799439011\/deck-1\/cards\/card-003\/[0-9a-f-]+\.png$/);
  assert.match(directUpload.mediaItemId, /^image-[0-9a-f-]+$/);
  assert.equal(directUpload.uploadURL, "https://signed.example.com/user-card-upload");
  assert.equal(directUpload.deliveryUrl, `https://user-uploads.example.com/${directUpload.assetId}`);
});

test("R2 media item uses an app id distinct from the full object key", () => {
  const mediaItem = createCloudflareR2ImageMediaItem({
    assetId: "path-templates/peter-fiddle-deck-1/introduction/fixed-id.webp",
    deliveryUrl: "https://cdn.example.com/deck-media/path-templates/peter-fiddle-deck-1/introduction/fixed-id.webp",
    description: "Intro image",
  });

  assert.deepEqual(mediaItem, {
    id: "image-fixed-id",
    mediaType: "image",
    provider: "cloudflare-r2",
    assetId: "path-templates/peter-fiddle-deck-1/introduction/fixed-id.webp",
    src: "https://cdn.example.com/deck-media/path-templates/peter-fiddle-deck-1/introduction/fixed-id.webp",
    description: "Intro image",
  });
});
