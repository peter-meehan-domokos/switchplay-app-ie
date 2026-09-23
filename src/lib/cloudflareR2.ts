import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getFileExtensionForImageUploadContentType, isSupportedImageUploadContentType, type SupportedImageUploadContentType } from "@/lib/imageUploadContentTypes";
import type { CloudflareR2ImageMediaItem } from "@/lib/media";

export const R2_PRESIGNED_UPLOAD_EXPIRATION_SECONDS = 300;

type CloudflareR2Config = {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  publicBaseUrl: string;
  secretAccessKey: string;
};

type CloudflareR2UserDataConfig = {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  publicBaseUrl: string;
  secretAccessKey: string;
};

export type CloudflareR2DirectUpload = {
  assetId: string;
  deliveryUrl: string;
  uploadURL: string;
};

export type CloudflareR2UserCardImageDirectUpload = {
  assetId: string;
  deliveryUrl: string;
  mediaItemId: string;
  uploadURL: string;
};

export class CloudflareR2ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareR2ConfigError";
  }
}

export class CloudflareR2ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareR2ValidationError";
  }
}

const DECK_TEMPLATE_ID_FOR_OBJECT_KEY_PATTERN = /^[a-zA-Z0-9-]+$/;
const CARD_ID_FOR_OBJECT_KEY_PATTERN = /^[a-zA-Z0-9-]+$/;
const USER_ID_FOR_OBJECT_KEY_PATTERN = /^[a-fA-F0-9]{24}$/;

export class CloudflareR2PresignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareR2PresignError";
  }
}

function getCloudflareR2Config(): CloudflareR2Config {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.trim();
  const missingConfig = [
    accountId ? null : "CLOUDFLARE_ACCOUNT_ID",
    accessKeyId ? null : "CLOUDFLARE_R2_ACCESS_KEY_ID",
    secretAccessKey ? null : "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    bucketName ? null : "CLOUDFLARE_R2_BUCKET_NAME",
    publicBaseUrl ? null : "CLOUDFLARE_R2_PUBLIC_BASE_URL",
  ].filter(Boolean);

  if (missingConfig.length > 0) {
    throw new CloudflareR2ConfigError(`Missing Cloudflare R2 configuration: ${missingConfig.join(", ")}.`);
  }

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
    throw new CloudflareR2ConfigError("Missing Cloudflare R2 configuration.");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBaseUrl };
}

function getCloudflareR2UserDataConfig(): CloudflareR2UserDataConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.CLOUDFLARE_R2_USER_DATA_BUCKET_NAME?.trim();
  const publicBaseUrl = process.env.CLOUDFLARE_R2_USER_DATA_PUBLIC_BASE_URL?.trim();
  const missingConfig = [
    accountId ? null : "CLOUDFLARE_ACCOUNT_ID",
    accessKeyId ? null : "CLOUDFLARE_R2_ACCESS_KEY_ID",
    secretAccessKey ? null : "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    bucketName ? null : "CLOUDFLARE_R2_USER_DATA_BUCKET_NAME",
    publicBaseUrl ? null : "CLOUDFLARE_R2_USER_DATA_PUBLIC_BASE_URL",
  ].filter(Boolean);

  if (missingConfig.length > 0) {
    throw new CloudflareR2ConfigError(`Missing Cloudflare R2 user-data configuration: ${missingConfig.join(", ")}.`);
  }

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
    throw new CloudflareR2ConfigError("Missing Cloudflare R2 user-data configuration.");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBaseUrl };
}

function createCloudflareR2S3Client(config: CloudflareR2Config | CloudflareR2UserDataConfig) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function assertSupportedImageUploadContentType(contentType: string): SupportedImageUploadContentType {
  if (!isSupportedImageUploadContentType(contentType)) {
    throw new CloudflareR2ValidationError("Unsupported image content type.");
  }

  return contentType;
}

function assertDeckTemplateIdForObjectKey(deckTemplateId: string) {
  const normalizedDeckTemplateId = deckTemplateId.trim();

  if (normalizedDeckTemplateId === "") {
    throw new CloudflareR2ValidationError("deckTemplateId is required.");
  }

  if (!DECK_TEMPLATE_ID_FOR_OBJECT_KEY_PATTERN.test(normalizedDeckTemplateId)) {
    throw new CloudflareR2ValidationError("deckTemplateId contains unsupported characters.");
  }

  return normalizedDeckTemplateId;
}

function assertCardIdForObjectKey(cardId: string) {
  const normalizedCardId = cardId.trim();

  if (!CARD_ID_FOR_OBJECT_KEY_PATTERN.test(normalizedCardId)) {
    throw new CloudflareR2ValidationError("cardId contains unsupported characters.");
  }

  return normalizedCardId;
}

function assertUserIdForObjectKey(userId: string) {
  const normalizedUserId = userId.trim();

  if (!USER_ID_FOR_OBJECT_KEY_PATTERN.test(normalizedUserId)) {
    throw new CloudflareR2ValidationError("userId must be a MongoDB ObjectId.");
  }

  return normalizedUserId;
}

export function createCloudflareR2ObjectKey(
  deckTemplateId: string,
  contentType: string,
  uniqueId = crypto.randomUUID(),
) {
  const normalizedDeckTemplateId = assertDeckTemplateIdForObjectKey(deckTemplateId);
  const normalizedContentType = assertSupportedImageUploadContentType(contentType);
  const fileExtension = getFileExtensionForImageUploadContentType(normalizedContentType);

  return `path-templates/${normalizedDeckTemplateId}/introduction/${uniqueId}.${fileExtension}`;
}

export function createCloudflareR2UserCardImageObjectKey(
  userId: string,
  deckTemplateId: string,
  cardId: string,
  contentType: string,
  uniqueId = crypto.randomUUID(),
) {
  const normalizedUserId = assertUserIdForObjectKey(userId);
  const normalizedDeckTemplateId = assertDeckTemplateIdForObjectKey(deckTemplateId);
  const normalizedCardId = assertCardIdForObjectKey(cardId);
  const normalizedContentType = assertSupportedImageUploadContentType(contentType);
  const fileExtension = getFileExtensionForImageUploadContentType(normalizedContentType);

  return `user-decks/${normalizedUserId}/${normalizedDeckTemplateId}/cards/${normalizedCardId}/${uniqueId}.${fileExtension}`;
}

export function createR2PublicObjectUrl(objectKey: string) {
  const { publicBaseUrl } = getCloudflareR2Config();
  const normalizedBaseUrl = publicBaseUrl.replace(/\/+$/, "");
  const normalizedObjectKey = objectKey.replace(/^\/+/, "");

  return `${normalizedBaseUrl}/${normalizedObjectKey}`;
}

export function createR2UserDataPublicObjectUrl(objectKey: string) {
  const { publicBaseUrl } = getCloudflareR2UserDataConfig();
  const normalizedBaseUrl = publicBaseUrl.replace(/\/+$/, "");
  const normalizedObjectKey = objectKey.replace(/^\/+/, "");

  return `${normalizedBaseUrl}/${normalizedObjectKey}`;
}

export function createCloudflareR2ImageMediaItem({
  assetId,
  deliveryUrl,
  description,
}: {
  assetId: string;
  deliveryUrl: string;
  description: string;
}): CloudflareR2ImageMediaItem {
  const assetName = assetId.split("/").at(-1) ?? assetId;
  const assetStem = assetName.replace(/\.[^.]+$/, "") || assetName;

  return {
    id: `image-${assetStem}`,
    mediaType: "image",
    provider: "cloudflare-r2",
    assetId,
    src: deliveryUrl,
    description,
  };
}

export async function createCloudflareR2DirectUpload({
  contentType,
  creator,
  deckTemplateId,
  expiresInSeconds = R2_PRESIGNED_UPLOAD_EXPIRATION_SECONDS,
  signedUrlImpl = getSignedUrl,
}: {
  contentType: string;
  creator: string;
  deckTemplateId: string;
  expiresInSeconds?: number;
  signedUrlImpl?: typeof getSignedUrl;
}): Promise<CloudflareR2DirectUpload> {
  const config = getCloudflareR2Config();
  const objectKey = createCloudflareR2ObjectKey(deckTemplateId, contentType);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
    ContentType: assertSupportedImageUploadContentType(contentType),
    Metadata: {
      creator,
    },
  });

  try {
    const uploadURL = await signedUrlImpl(createCloudflareR2S3Client(config), command, {
      expiresIn: expiresInSeconds,
    });

    return {
      assetId: objectKey,
      uploadURL,
      deliveryUrl: createR2PublicObjectUrl(objectKey),
    };
  } catch (error) {
    throw new CloudflareR2PresignError(error instanceof Error ? error.message : "Unable to create R2 direct upload.");
  }
}

export async function createCloudflareR2UserCardImageDirectUpload({
  cardId,
  contentType,
  creator,
  deckTemplateId,
  expiresInSeconds = R2_PRESIGNED_UPLOAD_EXPIRATION_SECONDS,
  signedUrlImpl = getSignedUrl,
}: {
  cardId: string;
  contentType: string;
  creator: string;
  deckTemplateId: string;
  expiresInSeconds?: number;
  signedUrlImpl?: typeof getSignedUrl;
}): Promise<CloudflareR2UserCardImageDirectUpload> {
  const config = getCloudflareR2UserDataConfig();
  const objectKey = createCloudflareR2UserCardImageObjectKey(creator, deckTemplateId, cardId, contentType);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
    ContentType: assertSupportedImageUploadContentType(contentType),
    Metadata: {
      creator,
    },
  });

  try {
    const uploadURL = await signedUrlImpl(createCloudflareR2S3Client(config), command, {
      expiresIn: expiresInSeconds,
    });
    const assetName = objectKey.split("/").at(-1) ?? objectKey;
    const assetStem = assetName.replace(/\.[^.]+$/, "") || assetName;

    return {
      assetId: objectKey,
      deliveryUrl: createR2UserDataPublicObjectUrl(objectKey),
      mediaItemId: `image-${assetStem}`,
      uploadURL,
    };
  } catch (error) {
    throw new CloudflareR2PresignError(error instanceof Error ? error.message : "Unable to create R2 user-card image direct upload.");
  }
}
