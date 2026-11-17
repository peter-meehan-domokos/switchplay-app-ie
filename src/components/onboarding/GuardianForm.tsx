"use client";

import type { GuardianLayout, OnboardingUi } from "./onboardingLayout";
import styles from "./Onboarding.module.css";

/** The existing parent or guardian request form. Shared by the onboarding host and the pre-launch welcome. */
export type GuardianFormActions = Readonly<{ setDraft: (value: string) => void; setPhoneDraft: (value: string) => void; send: () => void }>;

export function GuardianForm({ guardian, ui, actions, id }: { guardian: GuardianLayout; ui: OnboardingUi; actions: GuardianFormActions; id: string }) {
  return (
    <form className={styles.form} noValidate onSubmit={event => { event.preventDefault(); actions.send(); }}>
      <p className={styles.text}>{guardian.intro}</p>
      {guardian.statusLine ? <p className={styles.text}>{guardian.statusLine}</p> : null}
      {guardian.deliveryNote ? <p className={styles.note}>{guardian.deliveryNote}</p> : null}
      <label className={styles.label} htmlFor={id}>{guardian.emailLabel}</label>
      <input autoCapitalize="none" autoComplete="off" autoCorrect="off" className={styles.input} disabled={ui.sending} id={id} inputMode="email"
        maxLength={254} onChange={event => actions.setDraft(event.target.value)} spellCheck={false} type="email" value={ui.draft} />
      <label className={styles.label} htmlFor={`${id}-phone`}>{guardian.phoneLabel}</label>
      <input autoComplete="off" className={styles.input} disabled={ui.sending} id={`${id}-phone`} inputMode="tel" maxLength={30}
        onChange={event => actions.setPhoneDraft(event.target.value)} type="tel" value={ui.phoneDraft} />
      <p className={styles.small}>{guardian.phoneHint}</p>
      <button className={styles.primary} disabled={ui.sending || (!ui.draft.trim() && !ui.phoneDraft.trim())} type="submit">{ui.sending ? "Sending…" : guardian.buttonLabel}</button>
    </form>
  );
}
