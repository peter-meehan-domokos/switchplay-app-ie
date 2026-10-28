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
  if (kind === "image") {
    const response = await fetch(allocation.uploadURL, { method: "PUT", headers: allocation.headers, body: file, signal });
    if (!response.ok) throw new CreatorRequestError(response.status, "INFO_IMAGE_UPLOAD_FAILED");
  } else await uploadFileToCloudflareStream(allocation.uploadURL, file, signal);
  assertActive();
  // Merge into the latest text, never the buffer captured when upload began.
  // Failed/cancelled transfers leave the previous media reference untouched.
  controller.edit({ ...controller.desired, mediaItem: allocation.media }, controller.visibility, allocation.proof);
  await controller.flush();
  return allocation.media;
}
