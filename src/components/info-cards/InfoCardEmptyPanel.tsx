"use client";

import { useEffect, useLayoutEffect, useRef, type Ref } from "react";
import { motion, useAnimate, useMotionValue, useReducedMotion, type AnimationSequence } from "motion/react";
import { hiddenPouchOffset, pouchClosingStep, pouchOpeningStep, POUCH_ANGLE_DEGREES } from "./infoCardPouchMotion";
import stepStyles from "@/components/decks/StepView.module.css";
import styles from "./InfoCardConsultation.module.css";

// The compact panel shown by an empty pouch. It leaves and returns to the pouch with the same motion as the
// physical stack (infoCardPouchMotion). Dismissal is the dialog's outside tap, Escape or the pouch itself.
export default function InfoCardEmptyPanel({ id, pouch, closing, settled, disabled, addRef, onAdd, onExited, label = "Add Personal Info Card" }: {
  // An admin in the Group perspective adds a Group Admin Info Card (checkpoint 4.4).
  label?: string;
  id: string;
  pouch: HTMLElement;
  closing: boolean;
  settled: boolean;
  disabled: boolean;
  addRef: Ref<HTMLButtonElement>;
  onAdd: () => void;
  onExited: () => void;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = Boolean(useReducedMotion());
  const x = useMotionValue(0), y = useMotionValue(0), rotate = useMotionValue(0), opacity = useMotionValue(settled ? 1 : 0);
  const positioned = useRef(settled), moved = useRef(false);
  const exited = useRef(onExited);
  useLayoutEffect(() => { exited.current = onExited; }, [onExited]);

  useEffect(() => {
    const panel = scope.current;
    if (!panel || settled && !closing && !moved.current) return;
    moved.current = true;
    let active = true;
    const hidden = hiddenPouchOffset(panel, pouch), firstOpening = !positioned.current;
    if (firstOpening) { positioned.current = true; x.set(reduced ? 0 : hidden.x); y.set(reduced ? 0 : hidden.y); rotate.set(reduced ? 0 : POUCH_ANGLE_DEGREES); }
    if (!closing) opacity.set(reduced ? 0 : 1);
    const sequence: AnimationSequence = [closing ? pouchClosingStep(panel, hidden, reduced) : pouchOpeningStep(panel, reduced, firstOpening)];
    const control = animate(sequence);
    void control.then(() => { if (active && closing) exited.current(); });
    return () => { active = false; control.stop(); };
  }, [animate, closing, reduced, scope, x, y, rotate, opacity, pouch, settled]);

  return <motion.div ref={scope} id={id} className={`${stepStyles.preview} ${styles.emptyPanel}`} aria-label="Information cards" data-info-empty-panel=""
    data-info-empty-phase={closing ? "closing" : "open"} style={{ x, y, rotate, opacity }}>
    <button ref={addRef} type="button" className={styles.emptyAdd} disabled={disabled} onClick={onAdd}>{label}</button>
  </motion.div>;
}
