import { isSupportedImageUploadContentType } from "@/lib/imageUploadContentTypes";
import type { CloudflareR2ImageMediaItem, CloudflareStreamVideoMediaItem } from "@/lib/media";

export const MAX_MEDIA_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type MediaUploadTarget =
  | {
      scope: "deck-introduction";
      deckTemplateId: string;
    }
  | {
      scope: "user-card";
      deckTemplateId: string;
      cardId: string;
    };

export type ImageDirectUploadResponse = {
  assetId: string;
  deliveryUrl: string;
  mediaItemId?: string;
  uploadURL: string;
};

export type StreamDirectUploadResponse = {
  maxDurationSeconds: number;
  uid: string;
  uploadURL: string;
};

type VideoDimensions = {
  height: number;
  width: number;
};

export function createImageDirectUploadRequestBody(target: MediaUploadTarget, file: Pick<File, "type">) {
  if (target.scope === "user-card") {
    return {
      scope: "user-card" as const,
      deckTemplateId: target.deckTemplateId,
      cardId: target.cardId,
      contentType: file.type,
    };
  }

  return {
    contentType: file.type,
    deckTemplateId: target.deckTemplateId,
  };
}

export function createStreamDirectUploadRequestBody(target: MediaUploadTarget, file: Pick<File, "name">) {
  if (target.scope === "user-card") {
    return {
      scope: "user-card" as const,
      deckTemplateId: target.deckTemplateId,
      cardId: target.cardId,
      originalFilename: file.name,
    };
  }

  return { name: file.name };
}

function getUploadErrorMessage(errorBody: unknown, fallback: string) {
  if (typeof errorBody === "object" && errorBody !== null && "error" in errorBody && typeof errorBody.error === "string") {
    return errorBody.error;
  }

  return fallback;
}

function isImageDirectUploadResponse(value: unknown): value is ImageDirectUploadResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "assetId" in value &&
    typeof value.assetId === "string" &&
    value.assetId.trim() !== "" &&
    "uploadURL" in value &&
    typeof value.uploadURL === "string" &&
    value.uploadURL.trim() !== "" &&
    "deliveryUrl" in value &&
    typeof value.deliveryUrl === "string" &&
    value.deliveryUrl.trim() !== "" &&
    (!("mediaItemId" in value) || value.mediaItemId === undefined || (typeof value.mediaItemId === "string" && value.mediaItemId.trim() !== ""))
  );
}

function isStreamDirectUploadResponse(value: unknown): value is StreamDirectUploadResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "uid" in value &&
    typeof value.uid === "string" &&
    value.uid.trim() !== "" &&
    "uploadURL" in value &&
    typeof value.uploadURL === "string" &&
    value.uploadURL.trim() !== "" &&
    "maxDurationSeconds" in value &&
    typeof value.maxDurationSeconds === "number"
  );
}

export function validateImageUploadFile(file: Pick<File, "size" | "type">): string | null {
  if (!isSupportedImageUploadContentType(file.type)) {
    return "Choose an image file.";
  }

  if (file.size > MAX_MEDIA_IMAGE_FILE_SIZE_BYTES) {
    return "Choose an image smaller than 10 MB.";
  }

  return null;
}

export function validateVideoUploadFile(file: Pick<File, "type">): string | null {
  return file.type && !file.type.startsWith("video/") ? "Choose a video file." : null;
}

export function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function throwIfUploadAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Upload cancelled.", "AbortError");
  }
}

export async function requestImageDirectUpload(
  target: MediaUploadTarget,
  file: Pick<File, "type">,
  signal: AbortSignal,
): Promise<ImageDirectUploadResponse> {
  const response = await fetch("/api/media/images/direct-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createImageDirectUploadRequestBody(target, file)),
    signal,
  });
  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getUploadErrorMessage(responseBody, "Unable to prepare image upload."));
  }

  if (!isImageDirectUploadResponse(responseBody)) {
    throw new Error("Image upload could not be prepared.");
  }

  if (target.scope === "user-card" && !responseBody.mediaItemId) {
    throw new Error("Image upload could not be prepared.");
  }

  return responseBody;
}

export async function requestStreamDirectUpload(
  target: MediaUploadTarget,
  file: Pick<File, "name">,
  signal: AbortSignal,
): Promise<StreamDirectUploadResponse> {
  const response = await fetch("/api/media/stream/direct-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createStreamDirectUploadRequestBody(target, file)),
    signal,
  });
  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getUploadErrorMessage(responseBody, "Unable to prepare video upload."));
  }

  if (!isStreamDirectUploadResponse(responseBody)) {
    throw new Error("Video upload could not be prepared.");
  }

  return responseBody;
}

export async function uploadFileToR2(uploadURL: string, file: File, signal: AbortSignal) {
  const response = await fetch(uploadURL, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
    signal,
  });

  if (!response.ok) {
    throw new Error("Image upload failed.");
  }
}

export async function uploadFileToCloudflareStream(uploadURL: string, file: File, signal: AbortSignal) {
  const uploadBody = new FormData();

  uploadBody.append("file", file);

  const response = await fetch(uploadURL, {
    method: "POST",
    body: uploadBody,
    signal,
  });

  if (!response.ok) {
    throw new Error("Video upload failed.");
  }
}

export function createImageMediaItem(
  directUpload: ImageDirectUploadResponse,
  description: string,
): CloudflareR2ImageMediaItem {
  const assetName = directUpload.assetId.split("/").at(-1) ?? directUpload.assetId;
  const assetStem = assetName.replace(/\.[^.]+$/, "") || assetName;

  return {
    id: directUpload.mediaItemId ?? `image-${assetStem}`,
    mediaType: "image",
    provider: "cloudflare-r2",
    assetId: directUpload.assetId,
    src: directUpload.deliveryUrl,
    description,
  };
}

export function createStreamVideoMediaItem(
  directUpload: StreamDirectUploadResponse,
  description: string,
  dimensions: VideoDimensions | null,
): CloudflareStreamVideoMediaItem {
  return {
    id: `stream-${directUpload.uid}`,
    mediaType: "video",
    provider: "cloudflare-stream",
    assetId: directUpload.uid,
    src: `https://iframe.videodelivery.net/${encodeURIComponent(directUpload.uid)}`,
    description,
    ...(dimensions ?? {}),
  };
}

export function getLocalVideoDimensions(file: File): Promise<VideoDimensions | null> {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let isSettled = false;
    let timeoutId: number | null = null;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const settle = (dimensions: VideoDimensions | null) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      cleanup();
      resolve(dimensions);
    };

    timeoutId = window.setTimeout(() => settle(null), 10_000);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadedmetadata", () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const hasDimensions = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;

      settle(hasDimensions ? { width, height } : null);
    }, { once: true });
    video.addEventListener("error", () => settle(null), { once: true });
    video.src = objectUrl;
    video.load();
  });
}

export async function uploadImageMedia(
  target: MediaUploadTarget,
  file: File,
  signal: AbortSignal,
): Promise<CloudflareR2ImageMediaItem> {
  const directUpload = await requestImageDirectUpload(target, file, signal);
  throwIfUploadAborted(signal);
  await uploadFileToR2(directUpload.uploadURL, file, signal);
  throwIfUploadAborted(signal);

  return createImageMediaItem(directUpload, file.name || "Introduction image");
}

export async function uploadVideoMedia(
  target: MediaUploadTarget,
  file: File,
  signal: AbortSignal,
): Promise<CloudflareStreamVideoMediaItem> {
  const dimensions = await getLocalVideoDimensions(file);
  throwIfUploadAborted(signal);
  const directUpload = await requestStreamDirectUpload(target, file, signal);

  await uploadFileToCloudflareStream(directUpload.uploadURL, file, signal);
  throwIfUploadAborted(signal);

  return createStreamVideoMediaItem(directUpload, file.name || "Video attached", dimensions);
}

export function clearSelectedFileInput(input: Pick<HTMLInputElement, "value">) {
  input.value = "";
}
