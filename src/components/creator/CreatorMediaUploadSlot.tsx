"use client";

import { UploadIcon } from "@/components/icons/uploadIcon";
import type { StepMediaItem } from "@/lib/stepMedia";

type CreatorMediaUploadSlotProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  isUploading?: boolean;
  items: readonly StepMediaItem[];
  onCancelUpload?: () => void;
  onOpen: (origin: HTMLButtonElement) => void;
  size: "intro" | "pair";
};

export default function CreatorMediaUploadSlot({
  ariaLabel,
  className,
  disabled = false,
  isUploading = false,
  items,
  onCancelUpload,
  onOpen,
  size,
}: CreatorMediaUploadSlotProps) {
  const stateClassName = items.length ? "creator-media-upload-slot--uploaded" : "creator-media-upload-slot--empty";
  const label = isUploading ? "Uploading..." : items.length === 1 && items[0].kind !== "activity"
    ? items[0].media.description : items.length ? items.map(item => item.label).join(" · ") : "Add media";
  const rootClassName = ["creator-media-upload-slot", `creator-media-upload-slot--${size}`, stateClassName, className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName} data-creator-pan-exempt>
      <button aria-label={ariaLabel} className="creator-media-upload-control" disabled={disabled} onClick={event => onOpen(event.currentTarget)} type="button">
        <UploadIcon className="creator-media-upload-icon" />
        <span className="creator-media-upload-label">{label}</span>
      </button>
      {isUploading && onCancelUpload ? (
        <button aria-label="Cancel upload" className="creator-media-upload-cancel" onClick={onCancelUpload} type="button">
          ×
        </button>
      ) : null}
    </div>
  );
}
