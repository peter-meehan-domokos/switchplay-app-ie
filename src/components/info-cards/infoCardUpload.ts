import type { InfoMedia } from "@/lib/infoCards/model";
import { validateImageUploadFile, validateVideoUploadFile, uploadFileToCloudflareStream } from "@/lib/mediaUploadClient";
import { CreatorRequestError } from "../creator/creatorRequest";
import type { InfoCardEditorController } from "./infoCardEditorController";

type Allocation = { uploadURL: string; media: InfoMedia; proof: string; headers?: Record<string, string> };
export async function uploadInfoCardMedia(controller: InfoCardEditorController, file: File, signal: AbortSignal) {
  const kind = file.type.startsWith("image/") ? "image" : "video";
  const issue = kind === "image" ? validateImageUploadFile(file) : validateVideoUploadFile(file);
  if (issue) throw new CreatorRequestError(400, "INVALID_INFO_UPLOAD_FILE", { message: issue });
  const assertActive = () => { if (signal.aborted) throw new DOMException("Upload cancelled.", "AbortError"); };
  await controller.flush(); await controller.ensureCreated(); assertActive();
  const allocation = await controller.request<Allocation>(`${controller.url}/upload`, "POST", { kind, ...(kind === "image" ? { contentType: file.type } : {}) });
  assertActive();
  // Only the byte transfer is classified here. A browser network or CORS failure rejects fetch itself
  // (not a response), and must read as a failed transfer, never as a lost connection to the app.
  try {
    if (kind === "image") {
      const response = await fetch(allocation.uploadURL, { method: "PUT", headers: allocation.headers, body: file, signal });
      if (!response.ok) throw new CreatorRequestError(response.status, "INFO_IMAGE_UPLOAD_FAILED");
    } else await uploadFileToCloudflareStream(allocation.uploadURL, file, signal);
  } catch (cause) {
    if (signal.aborted || cause instanceof CreatorRequestError) throw cause;
    throw new CreatorRequestError(0, kind === "image" ? "INFO_IMAGE_UPLOAD_FAILED" : "INFO_VIDEO_UPLOAD_FAILED");
  }
  assertActive();
  // Merge into the latest text, never the buffer captured when upload began.
  // Failed/cancelled transfers leave the previous media reference untouched.
  controller.edit({ ...controller.desired, mediaItem: allocation.media }, controller.visibility, allocation.proof);
  await controller.flush();
  return allocation.media;
}
