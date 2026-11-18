import styles from "./StepMediaTabs.module.css";

// Conservative physical budget at 320px: the existing 252px card baseline is
// scaled to at most 302px, with 20px internal padding and the card border.
// S11 supplies --step-media-scale so tab typography retains its CSS pixel size.
export const STEP_MEDIA_TAB_WIDTH = 250;
/** Use the exact learner tab classes and browser font metrics; no server typography emulation. */
export function stepMediaLabelsFit(labels: readonly string[]): boolean {
  if (labels.length <= 1) return true;
  const probe = document.createElement("div");
  probe.className = `${styles.tabs} ${styles.probe}`;
  probe.style.width = `${STEP_MEDIA_TAB_WIDTH}px`; probe.style.setProperty("--step-media-scale", "1");
  probe.setAttribute("aria-hidden", "true"); probe.inert = true;
  for (const label of labels) {
    const tab = document.createElement("button"); tab.type = "button"; tab.className = styles.tab; tab.textContent = label;
    probe.appendChild(tab);
  }
  document.body.appendChild(probe);
  try {
    const width = [...probe.children].reduce((sum, child) => sum + child.getBoundingClientRect().width, 0);
    return width + parseFloat(getComputedStyle(probe).columnGap) * (labels.length - 1) <= STEP_MEDIA_TAB_WIDTH + 0.01;
  } finally { probe.remove(); }
}
