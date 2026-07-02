"use client";

import type { ChangeEvent } from "react";
import { UploadIcon } from "@/components/icons/uploadIcon";
import type { MediaItem } from "@/lib/media";

type CreatorMediaUploadSlotProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  isUploading?: boolean;
  mediaItem: MediaItem | null;
  onCancelUpload?: () => void;
  onUpload: (file: File) => void;
  placeholder?: string;
  size: "intro" | "pair";
};

export default function CreatorMediaUploadSlot({
  ariaLabel,
  className,
  disabled = false,
  isUploading = false,
  mediaItem,
  onCancelUpload,
  onUpload,
  placeholder = "Upload video",
  size,
}: CreatorMediaUploadSlotProps) {
  const stateClassName = mediaItem ? "creator-media-upload-slot--uploaded" : "creator-media-upload-slot--empty";
  const label = isUploading ? "Uploading..." : mediaItem?.description ?? placeholder;
  const rootClassName = ["creator-media-upload-slot", `creator-media-upload-slot--${size}`, stateClassName, className].filter(Boolean).join(" ");

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    onUpload(file);
  }

  return (
    <div className={rootClassName} data-creator-pan-exempt>
      <label aria-label={ariaLabel} className="creator-media-upload-control">
        <UploadIcon className="creator-media-upload-icon" />
        <span className="creator-media-upload-label">{label}</span>
        <input accept="video/*" disabled={disabled || isUploading} hidden onChange={handleInputChange} type="file" />
      </label>
      {isUploading && onCancelUpload ? (
        <button aria-label="Cancel upload" className="creator-media-upload-cancel" onClick={onCancelUpload} type="button">
          ×
        </button>
      ) : null}
    </div>
  );
}
