// Presentation only: persisted references and upload validation remain unchanged.
export function protectedMediaUrl(provider: "r2" | "stream", identity: string, format = "image") {
  return `/api/media/protected?${new URLSearchParams({ provider, identity, format })}`;
}
export function imageDeliveryUrl(src: string, enabled = process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === "1") {
  return enabled && /^https:\/\//.test(src) ? protectedMediaUrl("r2", src) : src;
}
export function streamDeliveryUrl(assetId: string, format: "manifest" | "thumbnail" | "iframe", enabled = process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === "1") {
  return enabled ? protectedMediaUrl("stream", assetId, format) : null;
}
