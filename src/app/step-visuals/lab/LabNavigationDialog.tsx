"use client";

import { useEffect, useRef } from "react";
import type { ExperienceId, LabCard } from "./experienceRegistry";
import styles from "./Lab.module.css";

type NavigationProps = Readonly<{
  id: string;
  open: boolean;
  cards: readonly LabCard[];
  selected: ExperienceId | null;
  expandedCards: readonly string[];
  onToggleCard: (id: string) => void;
  onSelect: (id: ExperienceId) => void;
  onDismiss: () => void;
  onAfterClose: () => void;
}>;

export default function LabNavigationDialog({ id, open, cards, selected, expandedCards, onToggleCard, onSelect, onDismiss, onAfterClose }: NavigationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      className={styles.spvDialog}
      id={id}
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onClose={onAfterClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        // Keep ordinary button navigation consistent with Safari's keyboard preferences.
        const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]
          .filter((button) => button.getClientRects().length > 0);
        if (!controls.length) return;
        const index = controls.findIndex((button) => button === document.activeElement);
        const nextIndex = index < 0 ? 0 : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault();
        controls[nextIndex].focus();
      }}
    >
      <div className={styles.spvDialogHeading}>
        <h2 className={styles.spvDialogTitle} id={`${id}-title`}>Choose a visualisation</h2>
        <button className={styles.spvClose} ref={closeRef} type="button" aria-label="Close visualisations menu" onClick={onDismiss}>×</button>
      </div>
      <nav aria-label="Card experiences">
        {cards.map((card) => {
          const expanded = expandedCards.includes(card.id);
          const childrenId = `${id}-${card.id}-experiences`;
          return (
            <section className={styles.spvCardGroup} key={card.id}>
              <h3 className={styles.spvCardHeading}>
                <button className={styles.spvDisclosure} type="button" aria-expanded={expanded} aria-controls={childrenId} onClick={() => onToggleCard(card.id)}>
                  <span>{card.label}</span>
                  <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                </button>
              </h3>
              <ul className={styles.spvExperiences} id={childrenId} hidden={!expanded}>
                {card.experiences.map((experience) => (
                  <li className={styles.spvExperienceItem} key={experience.id}>
                    <button className={styles.spvExperienceButton} type="button" aria-current={selected === experience.id ? "page" : undefined} onClick={() => onSelect(experience.id)}>
                      {experience.label}
                      {selected === experience.id ? <span className={styles.spvCurrentMark} aria-hidden="true">●</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>
    </dialog>
  );
}
