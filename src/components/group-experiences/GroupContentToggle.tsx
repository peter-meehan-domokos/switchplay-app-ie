"use client";
import { GROUP_CONTENT_LABEL, type GroupContentToggleLayout } from "./groupContentToggleLayout";

// A single switch (not a two-segment control): the label, then a small track. The row it sits in is fixed at the
// bottom of the follower list and grid, outside their scrolling area.
export default function GroupContentToggle({ layout, onChange }: { layout: GroupContentToggleLayout; onChange(value: boolean): void }) {
  return <button type="button" role="switch" className="group-content-toggle" aria-checked={layout.checked} disabled={layout.disabled} onClick={() => onChange(!layout.checked)}>
    <span className="group-content-toggle-label">{GROUP_CONTENT_LABEL}</span>
    <span className="group-content-toggle-track" aria-hidden="true"><span className="group-content-toggle-knob" /></span>
  </button>;
}
