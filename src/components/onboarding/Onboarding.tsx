"use client";

import { useEffect } from "react";
import type { GuardianLayout, OnboardingLayout, OnboardingUi } from "./onboardingLayout";
import styles from "./Onboarding.module.css";

export type OnboardingActions = Readonly<{
  setDraft: (value: string) => void; send: () => void; openWelcome: () => void; explore: () => void;
  requestSession: () => void; dismissReminder: () => void; welcomePresented: () => void;
}>;

function GuardianForm({ guardian, ui, actions, id }: { guardian: GuardianLayout; ui: OnboardingUi; actions: OnboardingActions; id: string }) {
  return (
    <form className={styles.form} noValidate onSubmit={event => { event.preventDefault(); actions.send(); }}>
      <p className={styles.text}>{guardian.intro}</p>
      {guardian.statusLine ? <p className={styles.text}>{guardian.statusLine}</p> : null}
      {guardian.deliveryNote ? <p className={styles.note}>{guardian.deliveryNote}</p> : null}
      <label className={styles.label} htmlFor={id}>{guardian.emailLabel}</label>
      <input autoCapitalize="none" autoComplete="off" autoCorrect="off" className={styles.input} disabled={ui.sending} id={id} inputMode="email"
        maxLength={254} onChange={event => actions.setDraft(event.target.value)} spellCheck={false} type="email" value={ui.draft} />
      <button className={styles.primary} disabled={ui.sending || !ui.draft.trim()} type="submit">{ui.sending ? "Sending…" : guardian.buttonLabel}</button>
    </form>
  );
}

export default function Onboarding({ layout, ui, actions }: { layout: OnboardingLayout; ui: OnboardingUi; actions: OnboardingActions }) {
  const welcomeVisible = layout.kind === "welcome";
  const { welcomePresented } = actions;
  useEffect(() => { if (welcomeVisible) welcomePresented(); }, [welcomeVisible, welcomePresented]);
  if (layout.kind === "none") return null;
  const message = ui.message ? <p className={ui.message.tone === "error" ? styles.error : styles.note} role={ui.message.tone === "error" ? "alert" : "status"}>{ui.message.text}</p> : null;
  if (layout.kind === "pill") {
    return <button className={styles.pill} data-onboarding="pill" onClick={actions.openWelcome} type="button">{layout.label}</button>;
  }
  const support = layout.supportLink ? <p className={styles.small}>Is your date of birth wrong? <a className={styles.link} href="/contact">Contact us</a>.</p> : null;
  if (layout.kind === "welcome") {
    return (
      <section aria-label="Welcome to Puckle" className={styles.welcome} data-onboarding="welcome">
        <h2 className={styles.heading}>{layout.heading}</h2>
        <p className={styles.text}>{layout.body}</p>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={actions.requestSession} type="button">Request a free session</button>
          <button className={styles.secondary} onClick={actions.explore} type="button">Explore Puckle</button>
        </div>
        {layout.guardian ? <GuardianForm actions={actions} guardian={layout.guardian} id="onboarding-guardian" ui={ui} /> : null}
        {message}{support}
      </section>
    );
  }
  return (
    <section aria-label="Group features" className={styles.reminder} data-onboarding="reminder">
      <div className={styles.row}>
        <h2 className={styles.heading}>{layout.heading}</h2>
        <button aria-label="Dismiss" className={styles.close} onClick={actions.dismissReminder} type="button">×</button>
      </div>
      <GuardianForm actions={actions} guardian={layout.guardian} id="onboarding-guardian" ui={ui} />
      {message}{support}
    </section>
  );
}
