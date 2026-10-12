"use client";

import { useId, useRef, useState } from "react";
import RootsFactorsLayoutPreview from "./RootsFactorsLayoutPreview";
import { layoutPreviewOptions, type LayoutPreviewMode } from "./layoutPreviewFixtures";
import { SurfaceLifecycle } from "../platform/web/SurfaceLifecycle";
import { findExperience, initialExperienceId, labCards, type ExperienceId } from "./experienceRegistry";
import LabNavigationDialog from "./LabNavigationDialog";
import SparklinePreview from "./SparklinePreview";
import styles from "./Lab.module.css";

export default function StepVisualsLab() {
  const [selected, setSelected] = useState<ExperienceId | null>(initialExperienceId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<LayoutPreviewMode>("orientation");
  const [expandedCards, setExpandedCards] = useState<readonly string[]>([labCards[0].id]);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const focusExperience = useRef(false);
  const menuId = useId();
  const previewId = useId();
  const experience = findExperience(selected);

  const selectExperience = (id: ExperienceId) => {
    focusExperience.current = id !== selected;
    if (id !== selected) setPreviewMode("orientation");
    setSelected(id);
    setMenuOpen(false);
  };

  const exitExperience = () => {
    focusExperience.current = false;
    setSelected(null);
    setMenuOpen(true);
  };

  const toggleCard = (id: string) => {
    setExpandedCards((previous) => previous.includes(id) ? previous.filter((cardId) => cardId !== id) : [...previous, id]);
  };

  return (
    <div className={styles.spvLab}>
      <header className={styles.spvLabHeader}>
        <div className={styles.spvHeaderInner}>
          <button className={styles.spvBurger} ref={burgerRef} type="button" aria-label="Open visualisations menu" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(true)}>
            <span className={styles.spvBurgerLines} aria-hidden="true"><span /><span /><span /></span>
          </button>
          <div className={styles.spvHeaderCopy}>
            {selected === "card-1-interactive" ? (
              <label className={styles.spvPreviewSelector} htmlFor={previewId}>
                <span>Lab</span>
                <select id={previewId} aria-label="Layout preview" disabled={menuOpen} value={previewMode} onChange={(event) => setPreviewMode(event.target.value as LayoutPreviewMode)}>
                  {layoutPreviewOptions.map((option) => <option key={option.id} value={option.id} aria-label={option.description}>{option.label}</option>)}
                </select>
              </label>
            ) : <p className={styles.spvLabName}>{experience?.label ?? "Choose an experience"}</p>}
          </div>
        </div>
      </header>
      <main className={styles.spvHost} ref={hostRef}>
        <SurfaceLifecycle active={!menuOpen}>
          {selected === "card-1-interactive" ? <RootsFactorsLayoutPreview key={selected} mode={previewMode} onExit={exitExperience} /> : null}
          {selected === "card-1-sparklines" ? <SparklinePreview key={selected} /> : null}
          {selected === null ? (
            <section className={styles.spvEmpty}>
              <h1 className={styles.spvExperienceTitle}>Choose an experience</h1>
              <p className={styles.spvDescription}>Open the menu to explore the available visuals.</p>
              <button className={styles.spvChooseButton} type="button" onClick={() => setMenuOpen(true)}>Browse visualisations</button>
            </section>
          ) : null}
        </SurfaceLifecycle>
      </main>
      <LabNavigationDialog
        id={menuId}
        open={menuOpen}
        cards={labCards}
        selected={selected}
        expandedCards={expandedCards}
        onToggleCard={toggleCard}
        onSelect={selectExperience}
        onDismiss={() => setMenuOpen(false)}
        onAfterClose={() => {
          if (focusExperience.current) {
            focusExperience.current = false;
            hostRef.current?.querySelector<HTMLElement>("[data-spv-experience-heading]")?.focus();
          } else {
            burgerRef.current?.focus({ preventScroll: true });
          }
        }}
      />
    </div>
  );
}
