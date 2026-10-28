"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};

export default function CreatorModeSelector({ mode, disabled, onChange }: {
  mode: "deck" | "info-card"; disabled?: boolean; onChange: (mode: "deck" | "info-card") => void;
}) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return <label><select aria-label="Creator mode" value={mode} disabled={!hydrated || disabled}
    onChange={event => onChange(event.target.value as "deck" | "info-card")}
    style={{ font: "inherit", maxWidth: "100%", background: "transparent", color: "inherit", border: "1px solid currentColor", borderRadius: 4, padding: "5px 3px" }}>
    <option value="deck">Deck</option><option value="info-card">Info Card</option>
  </select></label>;
}
