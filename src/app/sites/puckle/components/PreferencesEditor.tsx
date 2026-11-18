"use client";

import { type FormEvent, useRef, useState } from "react";
import type { PreferencesAudience, StoredPreferences } from "../lib/communicationPreferences";
import {
  buildPreferencesLayout, buildPreferencesPayload, preferencesStateFrom, validatePreferencesState, withAllNo, withAnswer, withChannel,
  type PreferenceField, type PreferencesErrors, type PreferencesState, type PreferencesVariant,
} from "../lib/communicationPreferencesLayout";
import { normaliseMobile } from "../lib/membershipRegistration";
import buttonStyles from "./PublicButton.module.css";
import CommunicationPreferences from "./CommunicationPreferences";
import styles from "./PreferencesEditor.module.css";
import PublicPhoneInput from "./PublicPhoneInput";

type Saved = Pick<StoredPreferences, "answers" | "channels">;
type Props = Readonly<{
  idPrefix: string; audience: PreferencesAudience; initial: Saved | null;
  /** What the person already has on file, so a channel can be checked before saving. */
  hasEmail: boolean; hasMobile: boolean;
  endpoint: string; extraBody?: Readonly<Record<string, unknown>>; unsubscribe?: boolean;
  /** Settings groups the update choices under Puckle Updates; the no-account page keeps the plain list. */
  variant?: PreferencesVariant;
}>;
type Status = Readonly<{ kind: "idle" | "saving" | "saved" | "error"; text: string }>;
const IDLE: Status = { kind: "idle", text: "" };
const ERRORS: Readonly<Record<string, string>> = {
  SIGN_IN_REQUIRED: "Please sign in again, then save.", INVALID_LINK: "This link isn't valid any more.",
};

const mobileValid = (value: string) => { try { return !!normaliseMobile(value, "IE"); } catch { return false; } };

/** Editing screen for saved choices. Saved answers are pre-populated; nothing changes until Save. */
export default function PreferencesEditor({ idPrefix, audience, initial, hasEmail, hasMobile, endpoint, extraBody = {}, unsubscribe = false, variant = "full" }: Props) {
  const [state, setState] = useState<PreferencesState>(() => preferencesStateFrom(initial, audience));
  const [mobile, setMobile] = useState("");
  const [errors, setErrors] = useState<PreferencesErrors>({});
  const [status, setStatus] = useState<Status>(IDLE);
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const needsMobile = !hasMobile && state.sms;
  const layout = buildPreferencesLayout(state, audience, errors, { emailAvailable: hasEmail }, variant);

  const edit = (next: PreferencesState, cleared: readonly (PreferenceField | "channels")[]) => {
    setState(next); setStatus(IDLE);
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => !cleared.includes(key as PreferenceField)))); 
  };
  async function save(next: PreferencesState, mobileValue: string) {
    if (busy.current) return;
    const contacts = { emailAvailable: hasEmail, hasEmail, hasMobile: hasMobile || mobileValid(mobileValue) };
    const found = validatePreferencesState(next, audience, contacts);
    if (Object.keys(found).length) {
      setErrors(found); setStatus(IDLE);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    busy.current = true; setErrors({}); setStatus({ kind: "saving", text: "Saving…" });
    try {
      const response = await fetch(endpoint, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...extraBody, communicationPreferences: buildPreferencesPayload(next, audience), ...(!hasMobile && next.sms && mobileValue ? { mobile: mobileValue, phoneCountryCode: "IE" } : {}) }) });
      const body = await response.json().catch(() => null) as { ok?: boolean; code?: string } | null;
      setStatus(response.ok && body?.ok ? { kind: "saved", text: "Your choices are saved." }
        : { kind: "error", text: ERRORS[body?.code ?? ""] ?? "We couldn't save your choices. Nothing was changed. Please try again." });
    } catch { setStatus({ kind: "error", text: "We couldn't reach Puckle. Nothing was changed. Please try again." }); }
    busy.current = false;
  }

  return (
    <form className={styles.form} noValidate onSubmit={(event: FormEvent) => { event.preventDefault(); void save(state, mobile); }} ref={formRef}>
      <CommunicationPreferences idPrefix={idPrefix} layout={layout}
        onAnswer={(field, value) => edit(withAnswer(state, audience, field, value), [field, "channels"])}
        onChannel={(channel, checked) => edit(withChannel(state, channel, checked), ["channels"])}
        belowChannels={needsMobile ? (
        <div className={styles.mobile}>
          <PublicPhoneInput idPrefix={`${idPrefix}-mobile`} label="Mobile number for text messages" maxLength={30} onPhoneChange={value => { setMobile(value); setStatus(IDLE); setErrors(current => ({ ...current, channels: undefined })); }} setRef={() => undefined} value={mobile} />
        </div>
        ) : null} />
      <div className={styles.actions}>
        <button className={`${buttonStyles.button} ${buttonStyles.primary}`} disabled={status.kind === "saving"} type="submit">{status.kind === "saving" ? "Saving…" : "Save changes"}</button>
        {unsubscribe ? (
          <button className={styles.unsubscribe} disabled={status.kind === "saving"} onClick={() => { const none = withAllNo(state, audience); setState(none); setErrors({}); void save(none, mobile); }} type="button">Unsubscribe from everything</button>
        ) : null}
      </div>
      <p aria-live="polite" className={status.kind === "error" ? styles.error : styles.status} role="status">{status.text}</p>
    </form>
  );
}
