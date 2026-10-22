import styles from "./InfoCardPouch.module.css";

export type InfoCardPouchProps = {
  count: number;
  expanded: boolean;
  controlsId: string;
  onToggle: () => void;
};

export default function InfoCardPouch({ count, expanded, controlsId, onToggle }: InfoCardPouchProps) {
  if (count < 1) return null;
  return (
    <button
      className={styles.pouch}
      type="button"
      aria-label={`${expanded ? "Close" : "Open"} information cards (${count} attached)`}
      aria-expanded={expanded}
      aria-controls={expanded ? controlsId : undefined}
      onClick={onToggle}
      data-info-card-pouch=""
    >
      <svg className={styles.shape} viewBox="0 0 46 46" aria-hidden="true">
        <path d="M0 0 L46 46 H0 Z" />
        <path className={styles.fold} d="M0 0 L46 46" />
      </svg>
      <span className={styles.label} aria-hidden="true" data-info-card-pouch-label="">
        <svg className={styles.information} viewBox="0 0 16 16" data-info-card-pouch-icon="">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
          <path d="M8 7.4v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span data-info-card-pouch-count="">{count}</span>
      </span>
    </button>
  );
}
