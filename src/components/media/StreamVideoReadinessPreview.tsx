"use client";

import CloudflareStreamPlayer from "@/components/media/CloudflareStreamPlayer";
import { useStreamVideoReadiness } from "@/components/media/useStreamVideoReadiness";
import type { MediaUploadTarget } from "@/lib/mediaUploadClient";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
import { isPhase2MockVideo, PHASE2_MOCK_VIDEO_NOTICE } from "@/lib/phase2MediaFixture";

type StreamVideoReadinessPreviewProps = {
  mediaItem: CloudflareStreamVideoMediaItem;
  target: MediaUploadTarget;
};

function getProcessingLabel(progress: number | undefined) {
  return progress === undefined ? "Processing video…" : `Processing video… ${Math.round(progress)}%`;
}

export default function StreamVideoReadinessPreview({ mediaItem, target }: StreamVideoReadinessPreviewProps) {
  const mock = isPhase2MockVideo(mediaItem.assetId);
  const { retry, state } = useStreamVideoReadiness(target, mediaItem.assetId, !mock);
  if (mock) return <p className="stream-video-readiness-preview">{PHASE2_MOCK_VIDEO_NOTICE}</p>;

  if (state.status === "ready") {
    return <CloudflareStreamPlayer key={`${mediaItem.assetId}:ready`} mediaItem={mediaItem} />;
  }

  if (state.status === "failed") {
    return (
      <div className="stream-video-readiness-preview" role="alert">
        <p>Video processing failed.</p>
        <button className="creator-modal-secondary" onClick={retry} type="button">Check again</button>
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="stream-video-readiness-preview" role="alert">
        <p>Unable to check video processing status.</p>
        <button className="creator-modal-secondary" onClick={retry} type="button">Retry</button>
      </div>
    );
  }

  if (state.status === "waiting") {
    return (
      <div className="stream-video-readiness-preview" role="status">
        <p>Video is still processing. Check again.</p>
        <button className="creator-modal-secondary" onClick={retry} type="button">Check again</button>
      </div>
    );
  }

  return (
    <div className="stream-video-readiness-preview" role="status">
      <p>{getProcessingLabel(state.progress)}</p>
    </div>
  );
}
