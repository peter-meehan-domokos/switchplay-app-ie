// Only the disposable runner enables this display hint. It never changes real
// Stream identifiers, persisted metadata, authorization or playback URLs.
export function isPhase2MockVideo(assetId: string | null | undefined, enabled = process.env.NEXT_PUBLIC_PHASE2_MOCK_MEDIA === "1") {
  return enabled && !!assetId?.startsWith("fixture-");
}
export const PHASE2_MOCK_VIDEO_NOTICE = "Mock video: this disposable Phase 2 session uses a synthetic Stream ID. Upload metadata is saved, but video playback is unavailable.";
