import { randomUUID } from "node:crypto";
import { getFileExtensionForImageUploadContentType, isSupportedImageUploadContentType, type SupportedImageUploadContentType } from "../imageUploadContentTypes";
import { isCloudflareR2ImageMediaItem } from "../media";
import { requireCondition } from "./domain";

function safeId(value: string) { requireCondition(/^[a-zA-Z0-9-]+$/.test(value), "INVALID_MEDIA_NAMESPACE_ID"); return value; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function personalCardImageKey(userId: string, cardTemplateId: string, contentType: SupportedImageUploadContentType, uuid = randomUUID()) {
  requireCondition(UUID.test(uuid), "INVALID_ASSET_UUID");
  requireCondition(isSupportedImageUploadContentType(contentType), "INVALID_IMAGE_CONTENT_TYPE");
  return `user-cards/${safeId(userId)}/${safeId(cardTemplateId)}/${uuid}.${getFileExtensionForImageUploadContentType(contentType)}`;
}
// Browser submissions may use only the new namespace. Trusted legacy references enter
// through the migration boundary, never by widening browser upload validation.
export function validateNewPersonalImage(value: unknown, userId: string, cardTemplateId: string, publicUrl: (key: string) => string) {
  requireCondition(isCloudflareR2ImageMediaItem(value), "INVALID_PERSONAL_IMAGE");
  const prefix = `user-cards/${safeId(userId)}/${safeId(cardTemplateId)}/`;
  const filename = value.assetId.slice(prefix.length);
  const [stem, extension] = filename.split(".");
  requireCondition(value.assetId.startsWith(prefix) && UUID.test(stem) && ["avif", "gif", "jpg", "png", "webp"].includes(extension) && filename.split(".").length === 2, "FOREIGN_PERSONAL_MEDIA_KEY");
  requireCondition(value.src === publicUrl(value.assetId) && value.id === `image-${filename.replace(/\.[^.]+$/, "")}`, "INVALID_PERSONAL_MEDIA_REFERENCE");
  return value;
}
