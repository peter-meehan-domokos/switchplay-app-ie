import type { PresentationAction } from "../../activities/roots-factors/presentationLayouts";
import styles from "./LearningUI.module.css";

/** Navigation presentation only; the action keeps its existing reducer identity. */
export default function ActivityNavigation({ action, onAction, sizing = false }: { action: PresentationAction | null; onAction?: (id: string) => void; sizing?: boolean }) {
  return <div className={styles.spvNavigation} data-spv-navigation={sizing ? undefined : true}>
    {action ? <button className={styles.spvNavigationAction} type="button" disabled={!action.enabled || !onAction} onClick={() => onAction?.(action.id)}>
      {action.label}<span aria-hidden="true">→</span>
    </button> : null}
  </div>;
}
