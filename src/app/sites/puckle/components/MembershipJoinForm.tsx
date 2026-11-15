"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { bindingFrom, currentTimeMs, requestEmailCode, submitAccount, submitInterest, submitJoinContact, verifyEmailCode, type JoinResponse } from "../lib/joinClient";
import {
  buildAccountPayload, buildContactPayload, buildInterestPayload, buildMembershipJoinLayout, codeIsCurrent, errorsFromServerCode, FIELD_MESSAGES,
  initialJoinFlowState, initialJoinFormState, normalisedEmail, validateJoinForm, withChoice, withCode, withCodeSent, withCourse,
  withLevel, withMobile, withNoEmail, withOutcome, withShowPassword, withStage, withText, withVerifiedProof, withoutErrors, withoutProof,
  type JoinChoice, type JoinErrors, type JoinFieldKey, type JoinFlowState, type JoinFormState,
} from "../lib/membershipJoinLayout";
import { SITE_NAME, SUPPORT_EMAIL } from "../siteInfo";
import buttonStyles from "./PublicButton.module.css";
import formStyles from "./CreatorInterestForm.module.css";
import InterestRegistrationForm from "./InterestRegistrationForm";
import { JoinTextField, type JoinEditors } from "./JoinFields";
import styles from "./MembershipJoinForm.module.css";
import PublicPhoneInput from "./PublicPhoneInput";
import RegistrationWelcome from "./RegistrationWelcome";
import StudentRegistrationForm from "./StudentRegistrationForm";
import TeacherRegistrationForm from "./TeacherRegistrationForm";

type FormError = Readonly<{ text: string; accountLinks?: boolean }>;
/** Editing a field clears only the errors that edit can resolve. */
const ERRORS_CLEARED_BY: Readonly<Record<string, readonly JoinFieldKey[]>> = {
  email: ["email", "contact"], mobile: ["mobile", "contact"], dobDay: ["dob"], dobMonth: ["dob"], dobYear: ["dob"],
  course: ["course", "courseOther", "level", "levelOther"], level: ["level", "levelOther"],
};
const clearedBy = (key: string): readonly JoinFieldKey[] => ERRORS_CLEARED_BY[key] ?? [key as JoinFieldKey];
const GENERIC: FormError = { text: "Something went wrong and nothing was saved. Please try again." };
const NETWORK: FormError = { text: "We couldn't reach Puckle. Check your connection and try again. What you've entered is still here." };
const ACCOUNT_UNCERTAIN: FormError = { text: "We couldn't confirm that your account was created. If you can sign in, you're all set. Otherwise, try again.", accountLinks: true };

function describe(response: JoinResponse): FormError {
  if (response.status === 0) return NETWORK;
  if (response.status === 404) return { text: "Joining isn't available right now." };
  if (response.status === 429) return { text: "Please wait a little before trying again." };
  return GENERIC;
}

export default function MembershipJoinForm() {
  const [form, setForm] = useState<JoinFormState>(initialJoinFormState);
  const [flow, setFlow] = useState<JoinFlowState>(initialJoinFlowState);
  const [errors, setErrors] = useState<JoinErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const busyRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const doneRef = useRef<HTMLDivElement | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);
  const layout = buildMembershipJoinLayout(form, flow, errors, nowMs);

  useEffect(() => {
    if (flow.stage === "code") codeRef.current?.focus();
    if (flow.stage === "done") doneRef.current?.focus();
  }, [flow.stage]);
  useEffect(() => {
    if (flow.stage !== "code" || layout.code.resendInSeconds === 0) return;
    const timer = window.setInterval(() => setNowMs(currentTimeMs()), 1000);
    return () => window.clearInterval(timer);
  }, [flow.stage, layout.code.resendInSeconds]);

  const focusFirstInvalid = () => requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  function edited(next: JoinFormState, keys: readonly JoinFieldKey[]) {
    setForm(next);
    setErrors(current => withoutErrors(current, keys));
    setFormError(null);
  }
  const edit: JoinEditors = {
    text: (key, value) => edited(withText(form, key, value), clearedBy(key)),
    course: value => edited(withCourse(form, value), clearedBy("course")),
    level: value => edited(withLevel(form, value), clearedBy("level")),
  };

  /** One place releases the in-flight guard, so no path can leave the form permanently busy. */
  function release() { busyRef.current = false; setBusy(false); }
  function fail(next: JoinErrors, message: FormError | null = null) {
    setErrors(next); setFormError(message); release();
    if (Object.keys(next).length) focusFirstInvalid();
  }

  async function sendCode(resend: boolean) {
    const email = normalisedEmail(form);
    const response = await requestEmailCode(email, resend || codeIsCurrent(form, flow) ? flow.binding : null);
    const binding = bindingFrom(response.body);
    if (response.status === 200 && binding) {
      const sentAt = currentTimeMs();
      setNowMs(sentAt);
      setFlow(withCodeSent(flow, binding, email, sentAt));
      setErrors({}); setFormError(null);
      return release();
    }
    return fail({}, response.status === 429 ? { text: "Please wait a minute before asking for another code." }
      : response.status === 0 ? NETWORK : { text: "We couldn't send a code just now. Check your email address and try again in a moment." });
  }
  async function createAccount(proofFlow: JoinFlowState) {
    const response = await submitAccount(buildAccountPayload(form, proofFlow));
    const body = response.body;
    if (response.status === 201 && body?.ok === true) {
      const category = body.category === "teacher" ? "teacher" : "student";
      const signedIn = body.signedIn === true;
      setFlow(withOutcome(proofFlow, { kind: "account", category, signedIn }));
      release();
      // A signed-in student sees the timed welcome, which then opens My Decks (RegistrationWelcome).
      return;
    }
    const code = typeof body?.code === "string" ? body.code : "";
    setFlow(withStage(proofFlow, "details"));
    if (response.status === 409 && code === "USERNAME_TAKEN") return fail({ username: "That username is already taken. Choose another and continue. You won't need a new code." });
    if (response.status === 409) return fail({}, { text: "We couldn't create an account with these details. If you already have an account, sign in or reset your password.", accountLinks: true });
    if (code === "INVALID_EMAIL_PROOF") {
      setFlow(withoutProof(proofFlow));
      return fail({}, { text: "Your email verification has expired or was already used. If you've just tried to join, try signing in. Otherwise, request a new code.", accountLinks: true });
    }
    if (response.status === 400) return fail(errorsFromServerCode(code) ?? {}, errorsFromServerCode(code) ? null : { text: "Please check your details and try again." });
    return fail({}, response.status >= 500 || response.status === 0 ? ACCOUNT_UNCERTAIN : describe(response));
  }
  async function verifyThenCreate() {
    if (!flow.binding || !/^\d{6}$/.test(flow.code)) return fail({ code: FIELD_MESSAGES.code });
    const response = await verifyEmailCode(flow.binding, normalisedEmail(form), flow.code);
    const proof = typeof response.body?.proof === "string" ? response.body.proof : null;
    if (response.status !== 200 || !proof) {
      return fail({ code: response.status === 0 || response.status >= 500 ? "We couldn't check that code just now. Please try again." : "That code isn't right, or it has expired. Check it and try again, or send a new code." });
    }
    return createAccount(withVerifiedProof(flow, proof, normalisedEmail(form)));
  }
  async function submitContact() {
    const response = await (form.choice === "interest" ? submitInterest(buildInterestPayload(form)) : submitJoinContact(buildContactPayload(form)));
    if (response.status === 201 && response.body?.ok === true) {
      setFlow(withOutcome(flow, form.choice === "interest" ? { kind: "interest", byEmail: !form.noEmail && !!form.email.trim() } : { kind: "contact-request", category: form.choice === "teacher" ? "teacher" : "student" }));
      return release();
    }
    const code = typeof response.body?.code === "string" ? response.body.code : "";
    const mapped = response.status === 400 ? errorsFromServerCode(code) : null;
    return fail(mapped ?? {}, mapped ? null : response.status === 400 ? { text: "Please check your details and try again." } : describe(response));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const kind = layout.submission.kind;
    if (kind === "verify-code") {
      busyRef.current = true; setBusy(true); setFormError(null); setErrors({});
      return verifyThenCreate();
    }
    const found = validateJoinForm(form);
    if (Object.keys(found).length) { setErrors(found); setFormError(null); focusFirstInvalid(); return; }
    if (kind === "resume-code") { setFlow(withStage(flow, "code")); return; }
    busyRef.current = true; setBusy(true); setErrors({}); setFormError(null);
    if (kind === "send-code") return sendCode(false);
    if (kind === "create-account") return createAccount(flow);
    return submitContact();
  }

  const accountLinks = formError?.accountLinks ? (
    <> <Link href="/login">Sign in</Link> or <Link href="/login/forgot-password">reset your password</Link>.</>
  ) : null;

  if (flow.stage === "done" && flow.outcome) {
    const outcome = flow.outcome;
    return (
      <section aria-labelledby="join-title" className={styles.page}>
        <h1 id="join-title">{layout.heading}</h1>
        <div className={styles.success} ref={doneRef} role="status" tabIndex={-1}>
          {outcome.kind === "account" ? (
            outcome.category === "student" ? (
              outcome.signedIn ? <RegistrationWelcome /> : (
              <>
                <h2>Welcome to {SITE_NAME}!</h2>
                <p>Your account is ready. Please sign in to get started.</p>
                <Link className={`${buttonStyles.button} ${buttonStyles.primary}`} href="/login">Sign in</Link>
              </>)
            ) : (
              <>
                <h2>Thanks, you&apos;re in!</h2>
                <p>{outcome.signedIn ? "Your account is ready and you're signed in." : "Your account is ready. Please sign in to get started."} {SITE_NAME} will be in touch personally.</p>
                {outcome.signedIn ? <a className={`${buttonStyles.button} ${buttonStyles.primary}`} href="/decks">Open {SITE_NAME}</a> : <Link className={`${buttonStyles.button} ${buttonStyles.primary}`} href="/login">Sign in</Link>}
              </>
            )
          ) : outcome.kind === "contact-request" ? (
            <>
              <h2>Thanks, we have your details.</h2>
              <p>{SITE_NAME} will contact you on your mobile number about next steps. No account has been created yet.</p>
            </>
          ) : (
            <>
              <h2>You&apos;re on the list.</h2>
              {outcome.byEmail ? (
                <p>You&apos;ve asked for occasional {SITE_NAME} updates by email, and we&apos;ll send them as {SITE_NAME} develops. No account was created. To stop them at any time, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
              ) : (
                <p>Thanks. We&apos;ll use your mobile number only to follow up on this request. Updates are sent by email, so none will be sent to you, and no marketing texts. No account was created.</p>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  const codeStage = layout.stage === "code";
  const toggle = layout.emailRouteToggle;
  const kind = layout.submission.kind;
  return (
    <section aria-labelledby="join-title" className={styles.page}>
      <h1 id="join-title">{layout.heading}</h1>
      <form className={styles.form} noValidate onSubmit={handleSubmit} ref={formRef}>
        {!codeStage ? (
          <fieldset className={styles.choices}>
            <legend className={styles.srOnly}>How would you like to join?</legend>
            {layout.choices.map(choice => (
              <label className={styles.choice} key={choice.id}>
                <input checked={choice.selected} name="joinChoice" onChange={() => { setForm(withChoice(form, choice.id as JoinChoice)); setErrors({}); setFormError(null); }} type="radio" value={choice.id} />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <p className={styles.intro}>{layout.intro}</p>
        {formError ? <p className={formStyles.formError} role="alert">{formError.text}{accountLinks}</p> : null}

        {codeStage ? (
          <div className={styles.codePanel}>
            <p>We&apos;ve sent a 6-digit code to <strong>{layout.code.email}</strong>. It can take a minute to arrive, so check your spam folder too.</p>
            <div className={formStyles.field}>
              <label htmlFor="join-code">{layout.code.field.label}</label>
              <input aria-describedby={layout.code.field.error ? "join-code-error" : "join-code-hint"} aria-invalid={layout.code.field.error ? "true" : "false"} autoComplete="one-time-code" id="join-code"
                inputMode="numeric" maxLength={6} name="code" onChange={event => { setFlow(withCode(flow, event.target.value)); setErrors({}); }} pattern="[0-9]*" ref={codeRef} type="text" value={flow.code} />
              <p className={styles.hint} id="join-code-hint">{layout.code.field.hint}</p>
              {layout.code.field.error ? <p className={formStyles.fieldError} id="join-code-error">{layout.code.field.error}</p> : null}
            </div>
            <div className={styles.codeActions}>
              <button className={styles.linkButton} disabled={busy || !layout.code.canResend} onClick={() => { busyRef.current = true; setBusy(true); void sendCode(true); }} type="button">
                {layout.code.canResend ? "Send a new code" : `Send a new code in ${layout.code.resendInSeconds}s`}
              </button>
              <button className={styles.linkButton} disabled={busy} onClick={() => { setFlow(withStage(flow, "details")); setErrors({}); setFormError(null); }} type="button">Change my email or details</button>
            </div>
          </div>
        ) : (
          <div className={styles.fields}>
            <JoinTextField autoComplete={form.choice === "student" ? "given-name" : "name"} id="join-name" maxLength={100} onChange={value => edit.text("name", value)} value={form.name} view={layout.name} />
            {layout.contactError ? <p className={formStyles.fieldError} id="join-contact-error" role="alert">{layout.contactError}</p> : null}
            <JoinTextField autoComplete="email" id="join-email" inputMode="email" maxLength={254} onChange={value => edit.text("email", value)} type="email" value={form.email} view={layout.email} />
            <JoinTextField autoComplete="username" id="join-username" maxLength={30} onChange={value => edit.text("username", value)} value={form.username} view={layout.username} />
            <JoinTextField autoComplete="new-password" id="join-password" maxLength={128} onChange={value => edit.text("password", value)} type={layout.password.inputType} value={form.password} view={layout.password}
              trailing={layout.password.visible ? <label className={styles.checkbox}><input checked={form.showPassword} onChange={event => setForm(withShowPassword(form, event.target.checked))} type="checkbox" /><span>Show password</span></label> : null} />
            <div className={styles.mobile}>
              <PublicPhoneInput contactErrorId={layout.contactError ? "join-contact-error" : undefined} error={layout.mobile.error} forceInvalid={!!layout.contactError} idPrefix="join" label={layout.mobile.label} maxLength={30}
                onPhoneChange={value => { edited(withMobile(form, value), clearedBy("mobile")); }} setRef={() => undefined} value={form.mobile} />
              {layout.mobile.hint ? <p className={styles.hint}>{layout.mobile.hint}</p> : null}
            </div>
            {toggle.visible ? (
              <div className={styles.toggleRow}>
                <button className={styles.linkButton} onClick={() => { setForm(withNoEmail(form, !form.noEmail)); setErrors({}); setFormError(null); setFlow(withoutProof(flow)); }} type="button">{toggle.label}</button>
                {toggle.description ? <p className={styles.hint}>{toggle.description}</p> : null}
              </div>
            ) : null}
            <StudentRegistrationForm edit={edit} form={form} layout={layout.student} />
            <TeacherRegistrationForm edit={edit} form={form} layout={layout.teacher} />
            <InterestRegistrationForm edit={edit} form={form} layout={layout.interest} />
            <div aria-hidden="true" className={formStyles.honeypot}>
              <label htmlFor="join-company-website">Company website</label>
              <input autoComplete="off" id="join-company-website" name="companyWebsite" onChange={event => setForm(withText(form, "companyWebsite", event.target.value))} tabIndex={-1} type="text" value={form.companyWebsite} />
            </div>
          </div>
        )}

        {layout.submission.notice ? <p className={styles.notice} data-testid="submission-notice">{layout.submission.notice}</p> : null}
        <div className={styles.submitRow}>
          <button className={`${buttonStyles.button} ${buttonStyles.primary}`} data-submission={kind} disabled={busy} type="submit">{busy ? layout.submission.busyLabel : layout.submission.label}</button>
          <p aria-live="polite" className={formStyles.statusText} role="status">{busy ? layout.submission.busyLabel : ""}</p>
        </div>
        <p className={formStyles.privacyNotice}>
          By continuing you agree that {SITE_NAME} may use your details to run your account and respond to you. See our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </form>
      <p className={styles.crossLinks}>
        Already have an account? <Link href="/login">Log in</Link>. Prefer to try a session first? <Link href="/#early-access">Request a free session</Link>.
      </p>
    </section>
  );
}
