import { CreatorRequestError } from "../creator/creatorRequest";
import type { InfoCapacityFieldIssue } from "@/lib/infoCards/capacity";

export function infoCardError(error: unknown, visibleCapacityIssues: readonly InfoCapacityFieldIssue[] = []): string {
  if (!(error instanceof CreatorRequestError)) return "The connection failed. Your local edits are retained; retry when connected.";
  if (error.code.includes("REVISION") || error.code.includes("CONFLICT")) return "This card changed in another session. Your local edits are retained. Review them before reloading the saved version.";
  if (error.code.startsWith("INFO_MATHS_")) {
    const m = error.details?.measurement as import("./infoCardMaths").InfoMathsMeasurement | undefined;
    if (m?.result.status === "ready" && visibleCapacityIssues.some(issue => issue.field === (!m.headerFits ? "title" : "body"))) return "";
    if (m?.result.status === "invalid-input") return m.result.diagnostics.filter(d => d.severity === "error").map(d => d.message).join(" ");
    if (m?.result.status === "ready") return !m.headerFits ? "The series name and title are too wide to fit together." : `The explanation exceeds the card: required ${m.result.layout.width.toFixed(1)} × ${m.result.layout.height.toFixed(1)}px; normal area ${m.result.layout.available.width.toFixed(1)} × ${m.result.layout.available.height?.toFixed(1)}px. Your draft is saved.`;
    const failure = error.details?.failure;
    if (failure === "authentication") return "Publication verification is blocked by server authentication configuration. Your draft is saved.";
    if (failure === "browser-startup") return "The publication verification browser could not start. Your draft is saved; retry later.";
    if (failure === "timeout") return "Publication verification timed out on the server. Your draft is saved; retry later.";
    if (failure === "fonts") return "Publication verification could not load the required fonts. Your draft is saved; retry later.";
    return "Publication layout could not be verified on the server. Your draft is saved; retry later.";
  }
  const capacity = error.details?.capacity as { issues?: string[]; fieldIssues?: InfoCapacityFieldIssue[] } | undefined;
  if (capacity?.issues) {
    // Suppress only exact capacity diagnostics already visible at a field.
    // Other server validation, stale results and legacy responses stay visible.
    const visibleCodes = new Set(visibleCapacityIssues.map(issue => issue.code));
    const repeated = new Set(error.code === "INFO_CAPACITY_EXCEEDED"
      ? capacity.fieldIssues?.filter(issue => visibleCodes.has(issue.code)).map(issue => issue.message) : []);
    return capacity.issues.filter(issue => !repeated.has(issue)).join(" ");
  }
  if (error.code === "INVALID_INFO_UPLOAD_FILE" && typeof error.details?.message === "string") return error.details.message;
  const messages: Record<string, string> = {
    INFO_PUBLICATION_INCOMPLETE: "Choose a series and complete the title and explanation before publishing.",
    INFO_MEDIA_PROVIDER_VERIFICATION_REQUIRED: "Media is unavailable until protected Cloudflare delivery has been verified. Your text draft is safe.",
    INFO_MEDIA_NOT_READY_OR_UNPROTECTED: "The video is still processing or its protection could not be verified. Check its status and retry.",
    INFO_INDEX_SETUP_REQUIRED: "Info Cards database indexes have not been installed in this environment. Your local text is retained.",
    SERIES_FORBIDDEN: "That series is no longer available for a new selection. Choose an eligible series; your text is retained.",
    PUBLIC_VISIBILITY_PERMANENT: "A publicly published info card cannot be made private again.",
    INFO_MEDIA_FORBIDDEN: "This media could not be attached or accessed. Retry the upload; your text is retained.",
    INFO_IMAGE_UPLOAD_FAILED: "The image transfer failed. Retry the upload; your text and previous media are retained.",
    INFO_FORBIDDEN: "This info card is unavailable to your account.",
    INFO_PUBLICATION_RECOVERY_REQUIRED: "Confirm the previous publication outcome using Retry before leaving or editing.",
    INFO_RECOVERY_UNAVAILABLE: "Local recovery storage is unavailable. Keep this page open and allow session storage before editing.",
  };
  if (error.status === 401) return "Please sign in again before continuing. Your local edits are retained.";
  return messages[error.code] ?? `The operation could not be completed (${error.code}). Your local edits are retained.`;
}

export function renderingCheckError(error: unknown): string {
  if (error instanceof CreatorRequestError) {
    if (error.code.includes("REVISION")) return "The saved card changed during the check. Run Check rendering again for the current revision.";
    const failure = error.details?.failure;
    if (failure === "authentication") return "Rendering check is blocked by server authentication configuration.";
    if (failure === "browser-startup") return "The rendering check browser could not start.";
    if (failure === "timeout") return "Rendering check timed out.";
    if (failure === "fonts") return "Rendering check could not load the required fonts.";
    if (failure === "busy") return "A rendering check is already running. Try again shortly.";
  }
  return "Rendering check could not finish. Your card and publication are unchanged.";
}
