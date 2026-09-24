"use client";

import CloudflareStreamPlayer from "@/components/media/CloudflareStreamPlayer";
import { useStreamVideoReadiness } from "@/components/media/useStreamVideoReadiness";
import type { MediaUploadTarget } from "@/lib/mediaUploadClient";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";

type StreamVideoReadinessPreviewProps = {
  mediaItem: CloudflareStreamVideoMediaItem;
  target: MediaUploadTarget;
};

function getProcessingLabel(progress: number | undefined) {
  return progress === undefined ? "Processing video…" : `Processing video… ${Math.round(progress)}%`;
}

export default function StreamVideoReadinessPreview({ mediaItem, target }: StreamVideoReadinessPreviewProps) {
  const { retry, state } = useStreamVideoReadiness(target, mediaItem.assetId);

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
