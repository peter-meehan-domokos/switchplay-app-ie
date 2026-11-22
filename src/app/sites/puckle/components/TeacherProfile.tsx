"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { buildTeacherProfileLayout } from "./teacherProfileLayout";
import styles from "./TeacherProfile.module.css";

// Longer than the closing transition in TeacherProfile.module.css (160ms), so the dialog is only closed once it has faded out.
const CLOSE_DELAY_MS = 180;

/**
 * The teacher's profile beneath the portrait, with a "Read more" button that opens a native modal dialog. The browser provides the
 * focus trap, Escape, the inert background and top-layer stacking. Animation state lives in data-state on the dialog
 * (opening -> open -> closing), so there is no React state to fall out of step with rapid clicks or Escape during a transition.
 */
export default function TeacherProfile() {
  const layout = buildTeacherProfileLayout();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const pageOverflow = useRef("");
  const pressedBackdrop = useRef(false);

  const open = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    pageOverflow.current = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog.dataset.state = "opening";
    dialog.showModal();
    void dialog.offsetHeight; // commit the starting styles so the transition runs
    dialog.dataset.state = "open";
  };

  // Starts the exit transition once; repeat requests (a second Escape, a double click) while it runs do nothing.
  const requestClose = () => {
    const dialog = dialogRef.current;
    if (!dialog?.open || closeTimer.current !== undefined) return;
    dialog.dataset.state = "closing";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = window.setTimeout(() => dialog.close(), reduced ? 0 : CLOSE_DELAY_MS);
  };

  // Every way of closing ends here: restore the page scroll and return focus to the trigger.
  const handleClosed = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
    document.documentElement.style.overflow = pageOverflow.current;
    if (dialogRef.current) dialogRef.current.dataset.state = "closed";
    triggerRef.current?.focus();
  };

  useEffect(() => () => {
    window.clearTimeout(closeTimer.current);
    if (dialogRef.current?.open) document.documentElement.style.overflow = pageOverflow.current;
  }, []);

  // A click on the backdrop is reported on the dialog itself; the panel fills the dialog, so clicks inside never match. Requiring the
  // press to start on the backdrop too stops a text selection that ends outside the panel from dismissing it.
  const handlePointerDown = (event: PointerEvent<HTMLDialogElement>) => { pressedBackdrop.current = event.target === event.currentTarget; };
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (pressedBackdrop.current && event.target === event.currentTarget) requestClose();
    pressedBackdrop.current = false;
  };

  // A native modal dialog keeps the page behind inert, but Tab can still leave it for the browser's own controls. Keep focus inside:
  // from the last control Tab wraps to the first, and from the first Shift+Tab wraps to the last.
  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")];
    const first = controls[0], last = controls.at(-1), active = document.activeElement;
    if (!first || !last) return;
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <figcaption className={styles.profile}>
      <p className={styles.name}>{layout.name}</p>
      <p className={styles.qualifications}>{layout.qualifications}</p>
      <p className={styles.experience}>
        {layout.experience.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      <button aria-haspopup="dialog" className={styles.readMore} onClick={open} ref={triggerRef} type="button">
        {layout.readMoreLabel}
        <svg aria-hidden="true" className={styles.arrow} focusable="false" height="12" viewBox="0 0 12 12" width="12">
          <path d="M3.5 8.5l5-5M4 3.5h4.5V8" />
        </svg>
      </button>

      <dialog
        aria-labelledby={titleId}
        className={styles.dialog}
        data-state="closed"
        onCancel={(event) => { event.preventDefault(); requestClose(); }}
        onClick={handleClick}
        onClose={handleClosed}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        ref={dialogRef}
      >
        <div className={styles.panel}>
          <div className={styles.dialogTop}>
            <p className={styles.eyebrow}>{layout.dialog.eyebrow}</p>
            <button aria-label={layout.dialog.closeLabel} className={styles.close} onClick={requestClose} type="button">
              <svg aria-hidden="true" focusable="false" height="18" viewBox="0 0 18 18" width="18">
                <path d="M4 4l10 10M14 4L4 14" />
              </svg>
            </button>
          </div>
          {/* Focusable so keyboard users can scroll the biography with the arrow keys when it overflows. */}
          <div className={styles.dialogBody} tabIndex={0}>
            <h2 className={styles.dialogName} id={titleId}>{layout.name}</h2>
            <p className={styles.headline}>
              <span className={styles.unit}>{layout.dialog.headline[0]}</span>
              <span aria-hidden="true" className={styles.headlineDot}> · </span>
              <span className={styles.unit}>{layout.dialog.headline[1]}</span>
            </p>
            {/* Each qualification is an unbreakable unit. Line breaks and the dots between units are switched by width in the CSS, so a
                dot only ever appears between two qualifications that share a line. */}
            <p className={styles.credentials}>
              <span className={styles.unit}>{layout.dialog.credentials[0]}</span>
              <span aria-hidden="true" className={styles.dotAB}> · </span>
              <br className={styles.breakA} />
              <span className={styles.unit}>{layout.dialog.credentials[1]}</span>
              <br className={styles.breakB} />
              <span className={styles.unit}>{layout.dialog.credentials[2]}</span>
              <span aria-hidden="true" className={styles.dotCD}> · </span>
              <br className={styles.breakC} />
              <span className={styles.unit}>{layout.dialog.credentials[3]}</span>
            </p>
            <hr className={styles.divider} />
            {layout.dialog.blocks.map((block) => {
              if (block.kind === "quote") {
                return (
                  <figure className={styles.quote} key={block.id}>
                    <blockquote>{block.text}</blockquote>
                    <figcaption>
                      — <strong>{block.name}</strong>, {block.role}
                    </figcaption>
                  </figure>
                );
              }
              if (block.kind === "note") return <p className={styles.note} key={block.id}>{block.text}</p>;
              return (
                <p className={styles.paragraph} key={block.id}>
                  {block.runs.map((run) => (run.strong ? <strong key={run.text}>{run.text}</strong> : run.text))}
                </p>
              );
            })}
          </div>
        </div>
      </dialog>
    </figcaption>
  );
}
