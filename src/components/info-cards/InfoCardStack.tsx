import type { ReactNode, Ref } from "react";
import styles from "@/components/decks/StepView.module.css";

// The 1A presentation is shared by its visual fixture and the real consultation.
// Phase 1B adds movement/selection here; playback and modal ownership stay outside.
export default function InfoCardStack({ id, children, onClose, closeRef }: {
  id: string;
  children: ReactNode;
  onClose: () => void;
  closeRef?: Ref<HTMLButtonElement>;
}) {
  return <section id={id} className={styles.preview} aria-label="Information cards" data-info-card-stack="">
    <div className={styles.backing} aria-hidden="true" data-info-card-backing="" />
    <div className={styles.backing} aria-hidden="true" data-info-card-backing="" />
    <div className={styles.topCard}>{children}</div>
    <button ref={closeRef} className={styles.consultationClose} type="button" aria-label="Close information card stack" onClick={onClose}>×</button>
  </section>;
}
