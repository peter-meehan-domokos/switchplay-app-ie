/** Local disposable review transport only. Never changes published media or auth. */
const previews: Record<string, string> = {
  "fixture-review-roots": "roots.png",
  "fixture-review-area": "area.png",
  "fixture-review-legacy": "roots.png",
};
export function phase2VisualReviewMediaUrl(assetId: string | undefined | null, format: "video" | "thumbnail", settings = {
  development: process.env.NODE_ENV === "development",
  enabled: process.env.NEXT_PUBLIC_PHASE2_VISUAL_REVIEW === "1",
  origin: process.env.NEXT_PUBLIC_PHASE2_VISUAL_REVIEW_MEDIA_ORIGIN,
}) {
  if (!settings.development || !settings.enabled || !settings.origin || !assetId || !Object.hasOwn(previews, assetId)) return null;
  try {
    const origin = new URL(settings.origin);
    if (origin.protocol !== "http:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      !/^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(origin.hostname)) return null;
    return `${origin.origin}${format === "video" ? "/review-media/sample.mp4" : `/assets/fixtures/${previews[assetId]}`}`;
  } catch { return null; }
}
