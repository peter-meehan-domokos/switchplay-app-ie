const MAX_SHARE_FILE_BYTES = 32 * 1024 * 1024;

export function isIphoneOrIpadSafari(browser: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">) {
  const isAppleMobile = /iPhone|iPad|iPod/.test(browser.userAgent) ||
    (browser.platform === "MacIntel" && browser.maxTouchPoints > 1);
  return isAppleMobile && /AppleWebKit/.test(browser.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(browser.userAgent);
}

export function isShareCancellation(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function fetchShareableVideoFile(url: string, filename: string, signal: AbortSignal, fetchFile = fetch): Promise<File | null> {
  const response = await fetchFile(url, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("The video could not be loaded for sharing. Please retry.");
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > MAX_SHARE_FILE_BYTES) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) throw new Error("The video could not be loaded for sharing. Please retry.");
  if (/text\/html|application\/json/i.test(response.headers.get("content-type") ?? "")) {
    await response.body.cancel();
    throw new Error("The video download returned an unexpected response. Please retry.");
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SHARE_FILE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(Uint8Array.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (signal.aborted) throw signal.reason;
  return new File(chunks, filename, { type: "video/mp4" });
}
