export const SUPPORTED_IMAGE_UPLOAD_CONTENT_TYPES = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SupportedImageUploadContentType = (typeof SUPPORTED_IMAGE_UPLOAD_CONTENT_TYPES)[number];

const IMAGE_UPLOAD_CONTENT_TYPE_EXTENSIONS: Record<SupportedImageUploadContentType, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isSupportedImageUploadContentType(value: unknown): value is SupportedImageUploadContentType {
  return typeof value === "string" && SUPPORTED_IMAGE_UPLOAD_CONTENT_TYPES.includes(value as SupportedImageUploadContentType);
}

export function getFileExtensionForImageUploadContentType(contentType: SupportedImageUploadContentType) {
  return IMAGE_UPLOAD_CONTENT_TYPE_EXTENSIONS[contentType];
}
