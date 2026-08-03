"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { DEFAULT_PHONE_COUNTRY_CODE } from "@/lib/phoneCountries";
import {
  CONTACT_SUPPORT_LIMITS,
  CONTACT_SUPPORT_PURPOSES,
  type ContactSupportErrorResponse,
  type ContactSupportFieldErrors,
  type ContactSupportFieldName,
  type ContactSupportFormValues,
  type ContactSupportSuccessResponse,
  validateContactSupportInput,
} from "@/lib/publicContactSupport";
import SupportErrorMessage from "@/components/support/SupportErrorMessage";
import buttonStyles from "./PublicButton.module.css";
import PublicPhoneInput from "./PublicPhoneInput";
import styles from "./CreatorInterestForm.module.css";

const initialValues: ContactSupportFormValues = {
  name: "",
  email: "",
  phone: "",
  phoneCountryCode: DEFAULT_PHONE_COUNTRY_CODE,
  purpose: "",
  message: "",
  companyWebsite: "",
};

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const FIELD_ORDER: Array<ContactSupportFieldName | "contact"> = [
  "name",
  "contact",
  "email",
  "phone",
  "purpose",
  "message",
];

export default function ContactSupportForm() {
  const [values, setValues] = useState<ContactSupportFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<ContactSupportFieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [formError, setFormError] = useState(false);
  const isSubmittingRef = useRef(false);
  const fieldRefs = useRef<Partial<Record<ContactSupportFieldName, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>>({});
  const successRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "success") {
      successRef.current?.focus();
    }
  }, [status]);

  function clearFieldError(fieldName: ContactSupportFieldName) {
    setFieldErrors((currentErrors) => {
      const shouldClearContact = fieldName === "email" || fieldName === "phone";

      if (!currentErrors[fieldName] && (!shouldClearContact || !currentErrors.contact)) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      if (shouldClearContact) {
        delete nextErrors.contact;
      }
      return nextErrors;
    });
    setFormError(false);
  }

  function updateValue(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    const fieldName = name as ContactSupportFieldName;

    setValues((currentValues) => ({ ...currentValues, [fieldName]: value }));
    clearFieldError(fieldName);
  }

  function updatePhoneValue(phone: string) {
    setValues((currentValues) => ({ ...currentValues, phone }));
    clearFieldError("phone");
  }

  function focusFirstInvalidField(errors: ContactSupportFieldErrors) {
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

    const validation = validateContactSupportInput(values);

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
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const responseBody = (await response.json()) as ContactSupportSuccessResponse | ContactSupportErrorResponse;

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

      setStatus("success");
    } catch {
      setFormError(true);
      setStatus("error");
      isSubmittingRef.current = false;
    }
  }

  function handleSendAnotherMessage() {
    isSubmittingRef.current = false;
    setValues(initialValues);
    setFieldErrors({});
    setFormError(false);
    setStatus("idle");
  }

  if (status === "success") {
    return (
      <div className={styles.successMessage} ref={successRef} tabIndex={-1} role="status" aria-live="polite">
        <h2>Thanks, we have received your message.</h2>
        <p>We will get back to you as soon as we can.</p>
        <button
          className={`${buttonStyles.button} ${buttonStyles.secondary}`}
          type="button"
          onClick={handleSendAnotherMessage}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <>
      {formError ? <SupportErrorMessage className={styles.formError} /> : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.fieldGrid}>
          <Field
            error={fieldErrors.name}
            inputMode="text"
            label="Name"
            maxLength={CONTACT_SUPPORT_LIMITS.name}
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

        <SelectField
          error={fieldErrors.purpose}
          label="Purpose"
          name="purpose"
          onChange={updateValue}
          setRef={(element) => {
            fieldRefs.current.purpose = element;
          }}
          value={values.purpose}
        />

        <TextAreaField
          error={fieldErrors.message}
          label="Message"
          maxLength={CONTACT_SUPPORT_LIMITS.message}
          name="message"
          onChange={updateValue}
          setRef={(element) => {
            fieldRefs.current.message = element;
          }}
          value={values.message}
        />

        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="contact-support-company-website">Company website</label>
          <input
            autoComplete="off"
            id="contact-support-company-website"
            name="companyWebsite"
            onChange={updateValue}
            tabIndex={-1}
            type="text"
            value={values.companyWebsite}
          />
        </div>

        <div className={styles.submitRow}>
          <button
            className={`${buttonStyles.button} ${buttonStyles.primary}`}
            disabled={status === "submitting"}
            type="submit"
          >
            {status === "submitting" ? "Sending..." : "Send message"}
          </button>
          <p className={styles.statusText} role="status" aria-live="polite">
            {status === "submitting" ? "Sending your message." : ""}
          </p>
        </div>
        <p className={styles.privacyNotice}>
          By submitting this form, you agree that Switchplay may use your details to respond to you. See our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </form>
    </>
  );
}

type FieldProps = {
  describedBy?: string;
  error?: string;
  forceInvalid?: boolean;
  inputMode: "email" | "text";
  label: string;
  maxLength: number;
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
  const inputId = `contact-support-${name}`;
  const errorId = `${inputId}-error`;
  const resolvedDescribedBy = [describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
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
        <p className={styles.fieldError} id={errorId}>
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
  const contactErrorId = "contact-support-contact-error";

  return (
    <section className={styles.contactSection} aria-labelledby="contact-support-contact-title">
      <header className={styles.contactHeader}>
        <h3 id="contact-support-contact-title">How can we contact you?</h3>
        <p>Provide whichever contact method suits you best. You can also provide both.</p>
      </header>
      {contactError ? (
        <p className={styles.fieldError} id={contactErrorId}>
          {contactError}
        </p>
      ) : null}
      <div className={styles.fieldGrid}>
        <Field
          describedBy={contactError ? contactErrorId : undefined}
          error={emailError}
          forceInvalid={Boolean(contactError)}
          inputMode="email"
          label="Email address"
          maxLength={CONTACT_SUPPORT_LIMITS.email}
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
          idPrefix="contact-support"
          maxLength={CONTACT_SUPPORT_LIMITS.phone}
          onPhoneChange={onPhoneChange}
          setRef={setPhoneRef}
          value={phoneValue}
        />
      </div>
    </section>
  );
}

type SelectFieldProps = {
  error?: string;
  label: string;
  name: "purpose";
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  setRef: (element: HTMLSelectElement | null) => void;
  value: string;
};

function SelectField({ error, label, name, onChange, setRef, value }: SelectFieldProps) {
  const inputId = `contact-support-${name}`;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>
        {label}
        <span aria-label="required"> *</span>
      </label>
      <select
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : "false"}
        id={inputId}
        name={name}
        onChange={onChange}
        ref={setRef}
        required
        value={value}
      >
        <option value="">Choose a purpose</option>
        {CONTACT_SUPPORT_PURPOSES.map((purpose) => (
          <option key={purpose} value={purpose}>
            {purpose}
          </option>
        ))}
      </select>
      {error ? (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextAreaFieldProps = {
  error?: string;
  label: string;
  maxLength: number;
  name: "message";
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  setRef: (element: HTMLTextAreaElement | null) => void;
  value: string;
};

function TextAreaField({ error, label, maxLength, name, onChange, setRef, value }: TextAreaFieldProps) {
  const inputId = `contact-support-${name}`;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>
        {label}
        <span aria-label="required"> *</span>
      </label>
      <textarea
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : "false"}
        id={inputId}
        maxLength={maxLength}
        name={name}
        onChange={onChange}
        ref={setRef}
        required
        rows={6}
        value={value}
      />
      {error ? (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
