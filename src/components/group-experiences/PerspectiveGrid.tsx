"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Identity, FollowerPreparationStatus, type FollowerReadiness, type PerspectiveChoice } from "./PerspectivePicker";
import GroupContentToggle from "./GroupContentToggle";
import type { GroupContentToggleLayout } from "./groupContentToggleLayout";

export default function PerspectiveGrid({ choices, selected, groupName, onSelect, onCollapse, followers, groupContent }: {
  choices: PerspectiveChoice[]; selected: string; groupName: string; onSelect(choice: PerspectiveChoice): void; onCollapse(): void;
  followers?: FollowerReadiness; groupContent?: { layout: GroupContentToggleLayout; onChange(value: boolean): void };
}) {
  const reduced = useReducedMotion(), [height, setHeight] = useState<number>();
  useEffect(() => {
    const update = () => setHeight((window.visualViewport?.height ?? window.innerHeight) * .38);
    update(); window.visualViewport?.addEventListener("resize", update); window.addEventListener("resize", update);
    return () => { window.visualViewport?.removeEventListener("resize", update); window.removeEventListener("resize", update); };
  }, []);
  const current = choices.find(choice => choice.key === selected);
  return <motion.section className="group-comparison-panel" aria-label="Follower comparison" style={{ height }}
    initial={reduced ? false : { y: 8, opacity: .9 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: reduced ? 0 : .18 }}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onCollapse(); } }}>
    <header><span>{groupName}{current && !current.group ? ` · ${current.name}` : ""}{groupContent?.layout.tag ? <span className="group-content-tag"> {groupContent.layout.tag}</span> : null}</span>
      <button type="button" onClick={onCollapse} aria-label="Collapse follower comparison">⌄</button></header>
    <div className="group-comparison-scroll">{followers && !followers.ready ? <FollowerPreparationStatus state={followers}/> : <div className="group-comparison-grid">
      {choices.map(choice => <button type="button" className="group-identity-card" key={choice.key} title={choice.name}
        autoFocus={choice.key === selected}
        data-perspective-key={choice.key} aria-pressed={selected === choice.key} onClick={() => onSelect(choice)}><Identity choice={choice}/></button>)}
    </div>}</div>
    {/* A thin fixed row below the scrolling tiles, the toggle at its right, where it sits in the list (4.5c). */}
    {groupContent?.layout.visible ? <div className="group-content-row"><GroupContentToggle layout={groupContent.layout} onChange={groupContent.onChange} /></div> : null}
  </motion.section>;
}
