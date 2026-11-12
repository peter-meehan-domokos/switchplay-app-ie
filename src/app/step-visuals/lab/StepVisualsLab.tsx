"use client";

import { useCallback, useId, useRef, useState } from "react";
import RootsFactorsLabSession, { type LabActivityMode } from "./RootsFactorsLabSession";
import { layoutPreviewOptions } from "./layoutPreviewFixtures";
import { SurfaceLifecycle } from "../platform/web/SurfaceLifecycle";
import { findExperience, initialExperienceId, labCards, type ExperienceId } from "./experienceRegistry";
import LabNavigationDialog from "./LabNavigationDialog";
import SparklinePreview from "./SparklinePreview";
import styles from "./Lab.module.css";
import LearningRecordPreview from "./LearningRecordPreview";
import { createLearningConsole } from "./learningConsole";
import type { Card1LearningEvent, Card1LearningResult, Card1SessionRecords } from "../activities/roots-factors/learningRecords";
import IntegrationLabSession from "./integration-lab-session";

export default function StepVisualsLab() {
  const [selected, setSelected] = useState<ExperienceId | null>(initialExperienceId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<LabActivityMode>("guided");
  const [expandedCards, setExpandedCards] = useState<readonly string[]>([labCards[0].id]);
  const [exitKey, setExitKey] = useState(0);
  const [records, setRecords] = useState<Card1SessionRecords | null>(null);
  const [events, setEvents] = useState<readonly Card1LearningEvent[]>([]);
  const [completed, setCompleted] = useState<readonly Card1LearningResult[]>([]);
  const nextExperience = useRef<ExperienceId | null>(null);
  const [learningConsole] = useState(() => createLearningConsole());
  const onEvent = useCallback((event: Card1LearningEvent) => {
    learningConsole.onEvent?.(event);
    setEvents((previous) => [...previous, event]);
  }, [learningConsole]);
  const onComplete = useCallback((result: Card1LearningResult) => {
    learningConsole.onComplete?.(result);
    setCompleted((previous) => [...previous, result]);
  }, [learningConsole]);
  const onRecordsChange = useCallback((value: Card1SessionRecords) => {
    learningConsole.onRecordsChange?.(value);
    setRecords(value);
  }, [learningConsole]);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const focusExperience = useRef(false);
  const menuId = useId();
  const previewId = useId();
  const experience = findExperience(selected);

  const selectExperience = (id: ExperienceId) => {
    if ((selected === "card-1-interactive" || selected === "integration-area") && id !== selected) {
      nextExperience.current = id;
      setExitKey((value) => value + 1);
      return;
    }
    focusExperience.current = id !== selected;
    if (id !== selected) setPreviewMode("guided");
    setSelected(id);
    setMenuOpen(false);
  };

  const exitExperience = () => {
    if (selected === "card-1-interactive") learningConsole.onExit();
    if (nextExperience.current) {
      const id = nextExperience.current;
      nextExperience.current = null;
      focusExperience.current = true;
      setPreviewMode("guided");
      setSelected(id);
      setMenuOpen(false);
      return;
    }
    focusExperience.current = false;
    setSelected(null);
    setMenuOpen(true);
  };
  const requestExit = () => setExitKey((value) => value + 1);

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
                <select id={previewId} aria-label="Layout preview" disabled={menuOpen} value={previewMode} onChange={(event) => setPreviewMode(event.target.value as LabActivityMode)}>
                  <option value="guided">Guided activity</option>
                  {layoutPreviewOptions.map((option) => <option key={option.id} value={option.id} aria-label={option.description}>{option.label}</option>)}
                  <option value="sparkline">Sparkline preview</option>
                </select>
              </label>
            ) : <p className={styles.spvLabName}>{experience?.label ?? "Choose an experience"}</p>}
          </div>
        </div>
      </header>
      <main className={styles.spvHost} ref={hostRef}>
        <SurfaceLifecycle active={!menuOpen}>
          {selected === "card-1-interactive" ? <RootsFactorsLabSession key={selected} mode={previewMode} onExit={exitExperience}
            exitKey={exitKey} onExitRequest={requestExit} onEvent={onEvent} onComplete={onComplete} onRecordsChange={onRecordsChange} /> : null}
          {selected === "card-1-sparklines" ? <SparklinePreview key={selected} /> : null}
          {selected === "integration-area" ? <IntegrationLabSession key={selected} onExit={exitExperience} exitKey={exitKey} /> : null}
          {selected === null ? (
            <section className={styles.spvEmpty}>
              <h1 className={styles.spvExperienceTitle}>Choose an experience</h1>
              <p className={styles.spvDescription}>Open the menu to explore the available visuals.</p>
              <button className={styles.spvChooseButton} type="button" onClick={() => setMenuOpen(true)}>Browse visualisations</button>
            </section>
          ) : null}
          {selected !== "integration-area" ? <LearningRecordPreview records={records} events={events} completed={completed} /> : null}
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
