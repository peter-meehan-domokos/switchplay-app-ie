import type { InfoMedia } from "@/lib/infoCards/model";

// The single place that decides what the Info Card editor's media area shows. It returns exactly one state
// with its message and the only actions that state permits, so conflicting messages or duplicate controls
// cannot appear. The component renders this projection and never patches it.
export type InfoCardMediaState = "unavailable" | "empty" | "uploading" | "processing" | "ready" | "failed-upload" | "failed-processing";
export type InfoCardMediaAction = "choose" | "replace" | "chooseAnother" | "retry" | "cancel" | "remove";
export type InfoCardVideoStatus = { state: "" | "checking" | "processing" | "ready" | "failed"; progress?: number; error: string };

export type InfoCardMediaLayout = {
  state: InfoCardMediaState;
  message: string;
  tone: "none" | "status" | "alert";
  actions: readonly InfoCardMediaAction[];
};

type MediaInput = {
  mediaItem: Pick<InfoMedia, "mediaType"> | null;
  uploading: boolean;
  failedFile: boolean;
  uploadError: string;
  videoStatus: InfoCardVideoStatus;
  ready: boolean;
};

// Attached media can always be removed, even if the title or series was cleared since it was attached; choosing
// another file needs a title and series, so only Remove remains in that case.
export function buildInfoCardMediaLayout(input: MediaInput): InfoCardMediaLayout {
  const layout = describeMedia({ ...input, ready: true });
  if (input.ready) return layout;
  return input.mediaItem ? { ...layout, actions: layout.actions.filter(action => action === "remove") }
    : { state: "unavailable", message: "", tone: "none", actions: [] };
}

function describeMedia({ mediaItem, uploading, failedFile, uploadError, videoStatus }: MediaInput): InfoCardMediaLayout {
  if (uploading) return { state: "uploading", message: "Uploading… your text keeps saving.", tone: "status", actions: ["cancel"] };
  if (uploadError) return { state: "failed-upload", message: uploadError, tone: "alert", actions: [...(failedFile ? ["retry" as const] : []), "chooseAnother", "cancel"] };
  if (!mediaItem) return { state: "empty", message: "Add an image or video (optional).", tone: "none", actions: ["choose"] };
  if (mediaItem.mediaType === "video") {
    if (videoStatus.state === "failed") return { state: "failed-processing", message: "The video could not be processed. Choose another file or remove it.", tone: "alert", actions: ["chooseAnother", "remove"] };
    if (videoStatus.error) return { state: "processing", message: videoStatus.error, tone: "alert", actions: ["replace", "remove"] };
    if (videoStatus.state === "checking") return { state: "processing", message: "Checking video…", tone: "status", actions: ["replace", "remove"] };
    if (videoStatus.state === "processing") return { state: "processing", tone: "status", actions: ["replace", "remove"],
      message: videoStatus.progress === undefined ? "Video processing…" : `Video processing (${Math.round(videoStatus.progress)}%)` };
    return { state: "ready", message: "Video ready", tone: "status", actions: ["replace", "remove"] };
  }
  return { state: "ready", message: "Image attached", tone: "none", actions: ["replace", "remove"] };
}
