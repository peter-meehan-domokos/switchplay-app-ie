const MAX_SHARE_FILE_BYTES = 32 * 1024 * 1024;

export type VideoFetchDiagnostic = {
  stage: "fetch" | "response" | "stream" | "blob" | "file" | "size-guard";
  requestUrl: string;
  responseUrl?: string;
  status?: number;
  responseType?: ResponseType;
  contentType?: string | null;
  contentLength?: string | null;
  upstreamUrl?: string | null;
  upstreamStatus?: string | null;
  upstreamContentType?: string | null;
  upstreamContentLength?: string | null;
  upstreamAllowOrigin?: string | null;
  exception?: string;
  size?: number;
};

export function formatVideoFetchDiagnostic(details: VideoFetchDiagnostic) {
  const safeUrl = (value: string | undefined) => {
    if (!value) return "unavailable";
    try {
      const url = new URL(value, typeof location === "undefined" ? "https://app.invalid" : location.origin);
      return `${url.origin}/…/${url.pathname.split("/").at(-1)}`;
    } catch { return "invalid URL"; }
  };
  const appOrigin = typeof location === "undefined" ? "" : location.origin;
  const cors = details.upstreamStatus
    ? details.upstreamAllowOrigin === "*" || details.upstreamAllowOrigin === appOrigin ? "upstream header allows app origin" : "upstream header missing or mismatched"
    : details.responseType === "opaque" ? "opaque response" : details.responseType ? "browser received response" : "unknown; fetch rejected before response";
  return `stage=${details.stage}; request=${safeUrl(details.requestUrl)}; final=${safeUrl(details.responseUrl)}; ` +
    `status=${details.status ?? "unavailable"}; MIME=${details.contentType ?? "unavailable"}; ` +
    `length=${details.contentLength ?? "unavailable"}; type=${details.responseType ?? "unavailable"}; ` +
    `opaque=${details.responseType === "opaque" ? "yes" : details.responseType ? "no" : "unknown"}; ` +
    `bytes=${details.size ?? "unavailable"}; exception=${details.exception ?? "none"}; CORS=${cors}` +
    (details.upstreamStatus ? `; upstream-final=${safeUrl(details.upstreamUrl ?? undefined)}; upstream-status=${details.upstreamStatus}; ` +
      `upstream-MIME=${details.upstreamContentType || "unavailable"}; upstream-length=${details.upstreamContentLength || "unavailable"}; ` +
      `upstream-allow-origin=${details.upstreamAllowOrigin || "none"}` : "");
}

export function isIphoneOrIpadSafari(browser: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">) {
  const isAppleMobile = /iPhone|iPad|iPod/.test(browser.userAgent) ||
    (browser.platform === "MacIntel" && browser.maxTouchPoints > 1);
  return isAppleMobile && /AppleWebKit/.test(browser.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(browser.userAgent);
}

export function isShareCancellation(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function fetchShareableVideoFile(url: string, filename: string, signal: AbortSignal, fetchFile = fetch,
  onDiagnostic?: (details: VideoFetchDiagnostic) => void): Promise<File | null> {
  const details: VideoFetchDiagnostic = { stage: "fetch", requestUrl: url };
  try {
    const response = await fetchFile(url, { signal, cache: "no-store", mode: "cors" });
    Object.assign(details, { stage: "response", responseUrl: response.url, status: response.status,
      responseType: response.type, contentType: response.headers.get("content-type"), contentLength: response.headers.get("content-length"),
      upstreamUrl: response.headers.get("x-media-upstream-url"), upstreamStatus: response.headers.get("x-media-upstream-status"),
      upstreamContentType: response.headers.get("x-media-upstream-content-type"), upstreamContentLength: response.headers.get("x-media-upstream-content-length"),
      upstreamAllowOrigin: response.headers.get("x-media-upstream-allow-origin") });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declaredSize = details.contentLength === null ? NaN : Number(details.contentLength);
    if (declaredSize > MAX_SHARE_FILE_BYTES) {
      details.stage = "size-guard";
      details.size = declaredSize;
      onDiagnostic?.({ ...details });
      await response.body?.cancel();
      return null;
    }
    if (/text\/html|application\/json/i.test(details.contentType ?? "")) {
      await response.body?.cancel();
      throw new Error("Response is not an MP4");
    }
    let blob: Blob;
    if (Number.isFinite(declaredSize) && declaredSize >= 0) {
      details.stage = "blob";
      blob = await response.blob();
      if (blob.size > MAX_SHARE_FILE_BYTES) {
        details.stage = "size-guard";
        details.size = blob.size;
        onDiagnostic?.({ ...details });
        return null;
      }
    } else {
      if (!response.body) throw new Error("Response body is unavailable");
      details.stage = "stream";
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_SHARE_FILE_BYTES) {
            details.stage = "size-guard";
            details.size = size;
            onDiagnostic?.({ ...details });
            await reader.cancel();
            return null;
          }
          chunks.push(Uint8Array.from(value));
        }
      } finally {
        reader.releaseLock();
      }
      details.stage = "blob";
      blob = new Blob(chunks, { type: "video/mp4" });
    }
    if (signal.aborted) throw signal.reason;
    details.stage = "file";
    const file = new File([blob], filename.toLowerCase().endsWith(".mp4") ? filename : `${filename}.mp4`, { type: "video/mp4" });
    onDiagnostic?.({ ...details, size: file.size });
    return file;
  } catch (error) {
    if (signal.aborted) throw error;
    details.exception = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    onDiagnostic?.({ ...details });
    throw error;
  }
}
