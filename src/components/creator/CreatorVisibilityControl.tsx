"use client";

import type { Visibility } from "@/lib/cards/model";

export default function CreatorVisibilityControl({ label, value, publishedPublic, disabled, onChange }: {
  label: string;
  value: Visibility;
  publishedPublic: boolean;
  disabled?: boolean;
  onChange: (visibility: Visibility) => void;
}) {
  return <select className="creator-visibility-control" aria-label={`${label} publication visibility`}
    title={publishedPublic ? "Public publication is permanent." : "Visibility for the next publication. Saving does not publish."}
    value={value} disabled={publishedPublic || disabled} onChange={(event) => onChange(event.currentTarget.value as Visibility)}>
    <option value="private">Private</option>
    <option value="public">Public</option>
  </select>;
}
