"use client";
import { ADMIN_CONTENT_LABEL, type AdminContentToggleLayout } from "./adminContentToggleLayout";

// A single switch (not a two-segment control): the label, then a small track. The row it sits in is fixed at the
// bottom of the follower list and grid, outside their scrolling area.
export default function AdminContentToggle({ layout, onChange }: { layout: AdminContentToggleLayout; onChange(value: boolean): void }) {
  return <button type="button" role="switch" className="admin-content-toggle" aria-checked={layout.checked} onClick={() => onChange(!layout.checked)}>
    <span className="admin-content-toggle-label">{ADMIN_CONTENT_LABEL}</span>
    <span className="admin-content-toggle-track" aria-hidden="true"><span className="admin-content-toggle-knob" /></span>
  </button>;
}
