"use client";
import { memo, useState, useId } from "react";
import type { PerspectiveSelection } from "@/lib/groupExperiences/model";
import GroupContentToggle from "./GroupContentToggle";
import type { GroupContentToggleLayout } from "./groupContentToggleLayout";

export type PerspectiveChoice = { key: string; name: string; selection: PerspectiveSelection; group?: boolean };
export type FollowerReadiness = { ready: boolean; error?: string; retry(): void };
export function FollowerPreparationStatus({ state }: { state: FollowerReadiness }) {
  return state.error ? <p role="alert">{state.error} <button type="button" onClick={state.retry}>Retry</button></p>
    : <p role="status">Loading followers…</p>;
}
// Only the selected border changes for most tiles during comparison. Their
// public identity content is stable; names/group changes still render normally.
// `tag` is the "+ Group" marker of the Include Group content toggle: inline after the name, adding no height.
export const Identity = memo(function Identity({ choice, loading = false, tag = null }: { choice: PerspectiveChoice; loading?: boolean; tag?: string | null }) {
  const initials = choice.name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => [...word][0]).join("").toUpperCase();
  return <><span className="group-identity-avatar" aria-hidden="true">{choice.group ? <svg viewBox="0 0 32 28" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="16" cy="8" r="4"/><circle cx="6" cy="10" r="3"/><circle cx="26" cy="10" r="3"/>
    <path d="M9 25v-4a7 7 0 0 1 14 0v4M1 23v-3a5 5 0 0 1 7-4M31 23v-3a5 5 0 0 0-7-4"/>
  </svg> : initials}</span><span className="group-identity-name">{choice.name}{loading ? <small role="status" style={{ display: "block" }}>Loading…</small> : null}</span>{tag ? <span className="group-content-tag">{tag}</span> : null}</>;
}, (previous, next) => previous.loading === next.loading && previous.tag === next.tag && previous.choice.key === next.choice.key && previous.choice.name === next.choice.name && previous.choice.group === next.choice.group);
export default function PerspectivePicker({ choices, selected, ownKey, canCompare, focused, disabled, onSelect, onCompare, followers, pendingKey, preparationError, onRetry, groupContent }: {
  choices: PerspectiveChoice[]; selected: string; ownKey?: string; canCompare: boolean; focused: boolean; disabled: boolean;
  onSelect(choice: PerspectiveChoice): void; onCompare(expanded: boolean): void;
  followers?: FollowerReadiness; pendingKey?: string; preparationError?: string; onRetry?(): void;
  groupContent?: { layout: GroupContentToggleLayout; onChange(value: boolean): void };
}) {
  const [open, setOpen] = useState(false), [all, setAll] = useState(false);
  const controlsId = useId();
  const current = choices.find(choice => choice.key === (pendingKey ?? selected)) ?? choices[0];
  const visible = all || !canCompare ? choices : choices.filter(choice => choice.group || choice.key === ownKey);
  const close = () => { setOpen(false); setAll(false); onCompare(false); };
  if (choices.length === 1) return <div className="group-picker"><div className="group-picker-current group-picker-static" title={current.name}><Identity choice={current}/></div></div>;
  return <div className="group-picker" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === "Escape") { close(); event.stopPropagation(); } }}>
    {/* Permission controls availability; preparation controls selectable entries. */}
    {open && !disabled ? <div className="group-perspective-list" id={controlsId} aria-label={all ? "All followers" : "Choose perspective"}>
      {/* Only the names scroll; the Include Group content row below stays fixed (checkpoint 4.5c). */}
      <div className="group-perspective-scroll">
      {all && followers && !followers.ready ? <FollowerPreparationStatus state={followers}/> : visible.map((choice, index) => <button type="button" key={choice.key} title={choice.name} data-perspective-key={choice.key} autoFocus={index === 0}
        aria-pressed={choice.key === selected} onClick={() => { onSelect(choice); close(); }}><Identity choice={choice}/></button>)}
      {/* Keep comparison intent in the scene while the ordinary list is open,
          so focusing its Card promotes the list directly into the existing grid. */}
      {canCompare && !all ? <button type="button" onClick={() => { if (focused) close(); else setAll(true); onCompare(true); }}>All followers</button> : null}
      </div>
      {groupContent?.layout.visible ? <div className="group-content-row"><GroupContentToggle layout={groupContent.layout} onChange={groupContent.onChange} /></div> : null}
    </div> : null}
    <button className="group-picker-current" type="button" title={current.name} aria-label={`Choose perspective, ${current.name}`}
      aria-expanded={open && !disabled} aria-controls={controlsId} disabled={disabled} onClick={() => { setOpen(value => !value); setAll(false); onCompare(false); }}><Identity choice={current} loading={!!pendingKey} tag={pendingKey ? null : groupContent?.layout.tag}/></button>
    {preparationError ? <p role="alert">{preparationError} <button type="button" onClick={onRetry}>Retry</button></p> : null}
  </div>;
}
