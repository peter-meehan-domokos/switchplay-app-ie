"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import {
  EARLY_ACCESS_LIMITS,
  type EarlyAccessErrorResponse,
  type EarlyAccessFieldErrors,
  type EarlyAccessFieldName,
  type EarlyAccessFormValues,
  type EarlyAccessSuccessResponse,
  validateEarlyAccessInput,
} from "@/lib/publicEarlyAccess";
import { DEFAULT_PHONE_COUNTRY_CODE } from "@/lib/phoneCountries";
import SupportErrorMessage from "@/components/support/SupportErrorMessage";
import buttonStyles from "./PublicButton.module.css";
import formStyles from "./CreatorInterestForm.module.css";
import sectionStyles from "./HowItWorksSection.module.css";
import PublicPhoneInput from "./PublicPhoneInput";

const initialValues: EarlyAccessFormValues = {
  name: "",
  email: "",
  phone: "",
  phoneCountryCode: DEFAULT_PHONE_COUNTRY_CODE,
  goals: "",
  additionalInformation: "",
  companyWebsite: "",
};

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const FIELD_ORDER: Array<EarlyAccessFieldName | "contact"> = [
  "name",
  "contact",
  "email",
  "phone",
  "goals",
  "additionalInformation",
];

export default function EarlyAccessForm() {
  const [values, setValues] = useState<EarlyAccessFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<EarlyAccessFieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [formError, setFormError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Thanks, you are on the early access list.");
  const isSubmittingRef = useRef(false);
  const fieldRefs = useRef<Partial<Record<EarlyAccessFieldName, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const successRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "success") {
      successRef.current?.focus();
    }
  }, [status]);

  function updateValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    const fieldName = name as EarlyAccessFieldName;

    setValues((currentValues) => ({ ...currentValues, [fieldName]: value }));
    setFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      if (fieldName === "email" || fieldName === "phone") {
        delete nextErrors.contact;
      }
      return nextErrors;
    });
    setFormError(false);
  }

  function updatePhoneValue(phone: string) {
    setValues((currentValues) => ({ ...currentValues, phone }));
    setFieldErrors((currentErrors) => {
      if (!currentErrors.phone && !currentErrors.contact) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors.phone;
      delete nextErrors.contact;
      return nextErrors;
    });
    setFormError(false);
  }

  function focusFirstInvalidField(errors: EarlyAccessFieldErrors) {
    const firstInvalidField = FIELD_ORDER.find((fieldName) => errors[fieldName]);

    if (firstInvalidField) {
      if (firstInvalidField === "contact") {
        fieldRefs.current.email?.focus();
      } else {
        fieldRefs.current[firstInvalidField]?.focus();
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    const validation = validateEarlyAccessInput(values);

    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      setFormError(false);
      focusFirstInvalidField(validation.fieldErrors);
      return;
    }

    isSubmittingRef.current = true;
    setStatus("submitting");
    setFieldErrors({});
    setFormError(false);

    try {
      const response = await fetch("/api/public/early-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const responseBody = (await response.json()) as EarlyAccessSuccessResponse | EarlyAccessErrorResponse;

      if (!response.ok || !responseBody.ok) {
        const nextFieldErrors = !responseBody.ok && responseBody.fieldErrors ? responseBody.fieldErrors : {};

        setFieldErrors(nextFieldErrors);
        setFormError(Object.keys(nextFieldErrors).length === 0);
        setStatus("error");
        isSubmittingRef.current = false;

        if (Object.keys(nextFieldErrors).length > 0) {
          focusFirstInvalidField(nextFieldErrors);
        }

        return;
      }

      setSuccessMessage(responseBody.message ?? "Thanks, you are on the early access list.");
      setStatus("success");
    } catch {
      setFormError(true);
      setStatus("error");
      isSubmittingRef.current = false;
    }
  }

  return (
    <section className={sectionStyles.followerSection} id="early-access" aria-labelledby="early-access-title">
      <div className={sectionStyles.followerCopy}>
        <h2 id="early-access-title">Join early access</h2>
        <p>
          Join the Strat17 early access list. We&rsquo;ll let you know when new paths and ways
          to get involved become available.
        </p>
      </div>

      {status === "success" ? (
        <div className={formStyles.successMessage} ref={successRef} tabIndex={-1} role="status" aria-live="polite">
          <h3>{successMessage}</h3>
          <p>We&rsquo;ll be in touch when there is something useful for you to explore.</p>
        </div>
      ) : (
        <div className={sectionStyles.followerFormWrap}>
          {formError ? (
            <SupportErrorMessage className={formStyles.formError} />
          ) : null}

          <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
            <div className={formStyles.fieldGrid}>
              <Field
                error={fieldErrors.name}
                inputMode="text"
                label="Name"
                maxLength={EARLY_ACCESS_LIMITS.name}
                name="name"
                onChange={updateValue}
                required
                setRef={(element) => {
                  fieldRefs.current.name = element;
                }}
                type="text"
                value={values.name}
              />
            </div>

            <ContactSection
              contactError={fieldErrors.contact}
              emailError={fieldErrors.email}
              emailValue={values.email}
              onChange={updateValue}
              onPhoneChange={updatePhoneValue}
              phoneError={fieldErrors.phone}
              phoneValue={values.phone}
              setEmailRef={(element) => {
                fieldRefs.current.email = element;
              }}
              setPhoneRef={(element) => {
                fieldRefs.current.phone = element;
              }}
            />

            <TextAreaField
              error={fieldErrors.goals}
              hint="Optional. Tell us what you would like to work towards, or leave this blank if you are joining as a partner or interested party."
              label="What kinds of goals would you like help achieving?"
              maxLength={EARLY_ACCESS_LIMITS.goals}
              name="goals"
              onChange={updateValue}
              required={false}
              setRef={(element) => {
                fieldRefs.current.goals = element;
              }}
              value={values.goals}
            />
            <TextAreaField
              error={fieldErrors.additionalInformation}
              label="Anything else you would like us to know?"
              maxLength={EARLY_ACCESS_LIMITS.additionalInformation}
              name="additionalInformation"
              onChange={updateValue}
              required={false}
              setRef={(element) => {
                fieldRefs.current.additionalInformation = element;
              }}
              value={values.additionalInformation}
            />

            <div className={formStyles.honeypot} aria-hidden="true">
              <label htmlFor="early-access-company-website">Company website</label>
              <input
                autoComplete="off"
                id="early-access-company-website"
                name="companyWebsite"
                onChange={updateValue}
                tabIndex={-1}
                type="text"
                value={values.companyWebsite}
              />
            </div>

            <div className={formStyles.submitRow}>
              <button
                className={`${buttonStyles.button} ${buttonStyles.primary}`}
                disabled={status === "submitting"}
                type="submit"
              >
                {status === "submitting" ? "Sending..." : "Join early access"}
              </button>
              <p className={formStyles.statusText} role="status" aria-live="polite">
                {status === "submitting" ? "Sending your interest." : ""}
              </p>
            </div>
            <p className={formStyles.privacyNotice}>
              By submitting this form, you agree that Strat17 may use your details to respond to you. See our{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </form>
        </div>
      )}
    </section>
  );
}

type FieldProps = {
  describedBy?: string;
  error?: string;
  forceInvalid?: boolean;
  inputMode: "email" | "text";
  label: string;
  maxLength?: number;
  name: "email" | "name";
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  required: boolean;
  setRef: (element: HTMLInputElement | null) => void;
  type: "email" | "text";
  value: string;
};

function Field({
  describedBy,
  error,
  forceInvalid = false,
  inputMode,
  label,
  maxLength,
  name,
  onChange,
  required,
  setRef,
  type,
  value,
}: FieldProps) {
  const inputId = `early-access-${name}`;
  const errorId = `${inputId}-error`;
  const resolvedDescribedBy = [describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={formStyles.field}>
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-label="required"> *</span> : null}
      </label>
      <input
        aria-describedby={resolvedDescribedBy}
        aria-invalid={error || forceInvalid ? "true" : "false"}
        autoComplete={name === "email" ? "email" : "name"}
        id={inputId}
        inputMode={inputMode}
        maxLength={maxLength}
        name={name}
        onChange={onChange}
        ref={setRef}
        required={required}
        type={type}
        value={value}
      />
      {error ? (
        <p className={formStyles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type ContactSectionProps = {
  contactError?: string;
  emailError?: string;
  emailValue: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPhoneChange: (value: string) => void;
  phoneError?: string;
  phoneValue: string;
  setEmailRef: (element: HTMLInputElement | null) => void;
  setPhoneRef: (element: HTMLInputElement | null) => void;
};

function ContactSection({
  contactError,
  emailError,
  emailValue,
  onChange,
  onPhoneChange,
  phoneError,
  phoneValue,
  setEmailRef,
  setPhoneRef,
}: ContactSectionProps) {
  const contactErrorId = "early-access-contact-error";

  return (
    <section className={formStyles.contactSection} aria-labelledby="early-access-contact-title">
      <header className={formStyles.contactHeader}>
        <h3 id="early-access-contact-title">How can we contact you?</h3>
        <p>Provide whichever contact method suits you best. You can also provide both.</p>
      </header>
      {contactError ? (
        <p className={formStyles.fieldError} id={contactErrorId}>
          {contactError}
        </p>
      ) : null}
      <div className={formStyles.fieldGrid}>
        <Field
          describedBy={contactError ? contactErrorId : undefined}
          error={emailError}
          forceInvalid={Boolean(contactError)}
          inputMode="email"
          label="Email address"
          maxLength={EARLY_ACCESS_LIMITS.email}
          name="email"
          onChange={onChange}
          required={false}
          setRef={setEmailRef}
          type="email"
          value={emailValue}
        />
        <PublicPhoneInput
          contactErrorId={contactError ? contactErrorId : undefined}
          error={phoneError}
          forceInvalid={Boolean(contactError)}
          idPrefix="early-access"
          maxLength={EARLY_ACCESS_LIMITS.phone}
          onPhoneChange={onPhoneChange}
          setRef={setPhoneRef}
          value={phoneValue}
        />
      </div>
    </section>
  );
}

type TextAreaFieldProps = {
  error?: string;
  hint?: string;
  label: string;
  maxLength: number;
  name: "additionalInformation" | "goals";
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  required: boolean;
  setRef: (element: HTMLTextAreaElement | null) => void;
  value: string;
};

function TextAreaField({
  error,
  hint,
  label,
  maxLength,
  name,
  onChange,
  required,
  setRef,
  value,
}: TextAreaFieldProps) {
  const inputId = `early-access-${name}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = `${inputId}-error`;
  const describedBy = [hintId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={formStyles.field}>
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-label="required"> *</span> : null}
      </label>
      {hint ? (
        <p className={formStyles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      <textarea
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        id={inputId}
        maxLength={maxLength}
        name={name}
        onChange={onChange}
        ref={setRef}
        required={required}
        rows={4}
        value={value}
      />
      {error ? (
        <p className={formStyles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
