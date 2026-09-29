import { cardMediaRequestUrl, type CardMediaRequest, type CardMediaDownload } from "@/lib/cardMediaViewer";
import { StreamVideoReadinessRequestError, type StreamVideoReadinessStatus } from "@/lib/mediaUploadClient";

async function readResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Unable to access this media. Please retry.");
  return body;
}

export async function requestCardVideoReadiness(target: CardMediaRequest, signal: AbortSignal): Promise<StreamVideoReadinessStatus> {
  try {
    const body = await readResponse(await fetch(cardMediaRequestUrl(target, "playback"), { signal, cache: "no-store" }));
    if (!["ready", "processing", "failed"].includes(body?.status)) throw new Error("Unable to read video status.");
    return body;
  } catch (error) {
    if (signal.aborted) throw error;
    // Network/auth failures must not be mislabeled as confirmed video processing.
    throw new StreamVideoReadinessRequestError(error instanceof Error ? error.message : "Unable to check video status.", false);
  }
}

export async function requestCardMediaDownload(target: CardMediaRequest, prepare: boolean, signal: AbortSignal): Promise<CardMediaDownload> {
  const response = await fetch(prepare ? "/api/media/card" : cardMediaRequestUrl(target, "download"), {
    method: prepare ? "POST" : "GET",
    ...(prepare ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(target) } : {}),
    cache: "no-store", signal,
  });
  const body = await readResponse(response);
  const validUrl = typeof body?.url === "string" &&
    (body.url.startsWith("https://") || (body.url.startsWith("/api/media/card/file?") && !body.url.startsWith("//")));
  if (!["ready", "preparing", "not-requested", "failed"].includes(body?.status) ||
      (body.status === "ready" && (!validUrl || typeof body.filename !== "string"))) {
    throw new Error("Unable to read download status.");
  }
  return body;
}

export type DownloadState = { status: "idle" } | CardMediaDownload | { status: "error"; message: string };

export function startCardMediaDownload(target: CardMediaRequest, onState: (state: DownloadState) => void, onReady: (download: Extract<CardMediaDownload, { status: "ready" }>) => void, options: {
  request?: typeof requestCardMediaDownload;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
  maxChecks?: number;
} = {}) {
  const controller = new AbortController();
  const request = options.request ?? requestCardMediaDownload;
  const schedule = options.schedule ?? setTimeout;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let checks = 0;
  let stopped = false;
  const check = async (prepare: boolean) => {
    try {
      let result = await request(target, prepare, controller.signal);
      if (stopped) return;
      // A video may finish Stream processing after the initial POST.
      if (result.status === "not-requested" && !prepare) result = await request(target, true, controller.signal);
      if (stopped) return;
      if (result.status === "failed") throw new Error("Download preparation failed. Please retry.");
      if (result.status === "ready") { onState(result); onReady(result); return; }
      checks += 1;
      if (checks >= (options.maxChecks ?? 60)) throw new Error("Download preparation is taking longer than expected. Please retry.");
      onState({ ...result, status: "preparing" });
      timer = schedule(() => { void check(false); }, Math.min(10_000, 1500 * 1.25 ** checks));
    } catch (error) {
      if (!stopped) onState({ status: "error", message: error instanceof Error ? error.message : "Unable to prepare download." });
    }
  };
  onState({ status: "preparing" });
  void check(true);
  return () => { stopped = true; controller.abort(); if (timer !== undefined) (options.cancel ?? clearTimeout)(timer); };
}
