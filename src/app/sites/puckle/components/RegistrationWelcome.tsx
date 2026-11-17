"use client";

import { useEffect, useRef, useState } from "react";
import { welcomeSchedule, welcomeTimeline, WELCOME_ENTER_MS, WELCOME_EXIT_MS, type WelcomePhase } from "../lib/registrationWelcome";
import { SITE_NAME } from "../siteInfo";
import styles from "./MembershipJoinForm.module.css";

/**
 * Shown once, straight after a verified student registration. It covers the page with the site's own
 * background, fades in, stays readable, fades out, and only then opens My Decks, so neither the Join
 * page nor a half-loaded application is ever visible behind it.
 */
export default function RegistrationWelcome() {
  const [phase, setPhase] = useState<WelcomePhase>("enter");
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    cardRef.current?.focus();
    const timeline = welcomeTimeline(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const timers = welcomeSchedule(timeline).map(step => window.setTimeout(() => {
      if (step.phase === "navigate") window.location.assign("/decks"); // full-document navigation: a clean start for the new session
      else setPhase(step.phase);
    }, step.at));
    return () => timers.forEach(window.clearTimeout);
  }, []);
  return (
    <div className={styles.welcomeOverlay} data-phase={phase} data-testid="registration-welcome"
      style={{ "--welcome-enter": `${WELCOME_ENTER_MS}ms`, "--welcome-exit": `${WELCOME_EXIT_MS}ms` } as React.CSSProperties}>
      <div className={`${styles.success} ${styles.welcomeCard}`} ref={cardRef} role="status" tabIndex={-1}>
        <h2>Welcome to {SITE_NAME}!</h2>
        <p>Your account is ready and you&apos;re signed in. Taking you to your space…</p>
      </div>
    </div>
  );
}
