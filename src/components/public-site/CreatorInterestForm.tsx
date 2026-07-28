"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import {
  CREATOR_INTEREST_LIMITS,
  type CreatorInterestErrorResponse,
  type CreatorInterestFieldErrors,
  type CreatorInterestFieldName,
  type CreatorInterestFormValues,
  type CreatorInterestSuccessResponse,
  validateCreatorInterestInput,
} from "@/lib/publicCreatorInterest";
import buttonStyles from "./PublicButton.module.css";
import styles from "./CreatorInterestForm.module.css";

const initialValues: CreatorInterestFormValues = {
  name: "",
  email: "",
  age: "",
  location: "",
  creatorIdea: "",
  additionalInformation: "",
  companyWebsite: "",
};

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const FIELD_ORDER: CreatorInterestFieldName[] = [
  "name",
  "email",
  "age",
  "location",
  "creatorIdea",
  "additionalInformation",
];

export default function CreatorInterestForm() {
  const [values, setValues] = useState<CreatorInterestFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<CreatorInterestFieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [formError, setFormError] = useState("");
  const isSubmittingRef = useRef(false);
  const fieldRefs = useRef<Partial<Record<CreatorInterestFieldName, HTMLInputElement | HTMLTextAreaElement | null>>>(
    {},
  );
  const successRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "success") {
      successRef.current?.focus();
    }
  }, [status]);

  function updateValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    const fieldName = name as CreatorInterestFieldName;

    setValues((currentValues) => ({ ...currentValues, [fieldName]: value }));
    setFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
    setFormError("");
  }

  function focusFirstInvalidField(errors: CreatorInterestFieldErrors) {
    const firstInvalidField = FIELD_ORDER.find((fieldName) => errors[fieldName]);

    if (firstInvalidField) {
      fieldRefs.current[firstInvalidField]?.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    const validation = validateCreatorInterestInput(values);

    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      setFormError("");
      focusFirstInvalidField(validation.fieldErrors);
      return;
    }

    isSubmittingRef.current = true;
    setStatus("submitting");
    setFieldErrors({});
    setFormError("");

    try {
      const response = await fetch("/api/public/creator-interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          age: validation.data.age,
        }),
      });
      const responseBody = (await response.json()) as CreatorInterestSuccessResponse | CreatorInterestErrorResponse;

      if (!response.ok || !responseBody.ok) {
        const nextFieldErrors = !responseBody.ok && responseBody.fieldErrors ? responseBody.fieldErrors : {};

        setFieldErrors(nextFieldErrors);
        setFormError(
          Object.keys(nextFieldErrors).length > 0
            ? ""
            : "Something went wrong and your response was not sent. Please try again.",
        );
        setStatus("error");
        isSubmittingRef.current = false;

        if (Object.keys(nextFieldErrors).length > 0) {
          focusFirstInvalidField(nextFieldErrors);
        }

        return;
      }

      setStatus("success");
    } catch {
      setFormError("Something went wrong and your response was not sent. Please try again.");
      setStatus("error");
      isSubmittingRef.current = false;
    }
  }

  function handleSendAnotherResponse() {
    isSubmittingRef.current = false;
    setValues(initialValues);
    setFieldErrors({});
    setFormError("");
    setStatus("idle");
  }

  if (status === "success") {
    return (
      <section className={styles.formSection} id="creator-interest" aria-labelledby="creator-interest-title">
        <div className={styles.successMessage} ref={successRef} tabIndex={-1} role="status" aria-live="polite">
          <h2 id="creator-interest-title">Thanks — we’ve received your interest.</h2>
          <p>We’ll review what you shared and get in touch if it looks like a good fit for the early creator group.</p>
          <button
            className={`${buttonStyles.button} ${buttonStyles.secondary}`}
            type="button"
            onClick={handleSendAnotherResponse}
          >
            Send another response
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.formSection} id="creator-interest" aria-labelledby="creator-interest-title">
      <header className={styles.formHeader}>
        <h2 id="creator-interest-title">Interested in creating a path?</h2>
        <p>
          Tell us a little about yourself and what you might want to share. You do not need to have your idea fully
          worked out.
        </p>
      </header>

      {formError ? (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.fieldGrid}>
          <Field
            error={fieldErrors.name}
            inputMode="text"
            label="Your name"
            maxLength={CREATOR_INTEREST_LIMITS.name}
            name="name"
            onChange={updateValue}
            required
            setRef={(element) => {
              fieldRefs.current.name = element;
            }}
            type="text"
            value={values.name}
          />
          <Field
            error={fieldErrors.email}
            inputMode="email"
            label="Email address"
            maxLength={CREATOR_INTEREST_LIMITS.email}
            name="email"
            onChange={updateValue}
            required
            setRef={(element) => {
              fieldRefs.current.email = element;
            }}
            type="email"
            value={values.email}
          />
          <Field
            error={fieldErrors.age}
            inputMode="numeric"
            label="Your age"
            max={CREATOR_INTEREST_LIMITS.ageMax}
            min={CREATOR_INTEREST_LIMITS.ageMin}
            name="age"
            onChange={updateValue}
            required
            setRef={(element) => {
              fieldRefs.current.age = element;
            }}
            type="number"
            value={values.age}
          />
          <Field
            error={fieldErrors.location}
            inputMode="text"
            label="Where are you based?"
            maxLength={CREATOR_INTEREST_LIMITS.location}
            name="location"
            onChange={updateValue}
            placeholder="For example, Galway"
            required
            setRef={(element) => {
              fieldRefs.current.location = element;
            }}
            type="text"
            value={values.location}
          />
        </div>

        <TextAreaField
          error={fieldErrors.creatorIdea}
          hint="A rough idea is enough. You can tell us about something you learned, achieved or worked through."
          label="What experience or achievement might you want to share?"
          maxLength={CREATOR_INTEREST_LIMITS.creatorIdea}
          name="creatorIdea"
          onChange={updateValue}
          required
          setRef={(element) => {
            fieldRefs.current.creatorIdea = element;
          }}
          value={values.creatorIdea}
        />
        <TextAreaField
          error={fieldErrors.additionalInformation}
          label="Anything else you would like us to know?"
          maxLength={CREATOR_INTEREST_LIMITS.additionalInformation}
          name="additionalInformation"
          onChange={updateValue}
          required={false}
          setRef={(element) => {
            fieldRefs.current.additionalInformation = element;
          }}
          value={values.additionalInformation}
        />

        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="creator-interest-company-website">Company website</label>
          <input
            autoComplete="off"
            id="creator-interest-company-website"
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
            {status === "submitting" ? "Sending..." : "Send my interest"}
          </button>
          <p className={styles.statusText} role="status" aria-live="polite">
            {status === "submitting" ? "Sending your interest." : ""}
          </p>
        </div>
      </form>
    </section>
  );
}

type FieldProps = {
  error?: string;
  inputMode: "email" | "numeric" | "text";
  label: string;
  max?: number;
  maxLength?: number;
  min?: number;
  name: Exclude<CreatorInterestFieldName, "additionalInformation" | "companyWebsite" | "creatorIdea">;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required: boolean;
  setRef: (element: HTMLInputElement | null) => void;
  type: "email" | "number" | "text";
  value: string;
};

function Field({
  error,
  inputMode,
  label,
  max,
  maxLength,
  min,
  name,
  onChange,
  placeholder,
  required,
  setRef,
  type,
  value,
}: FieldProps) {
  const inputId = `creator-interest-${name}`;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-label="required"> *</span> : null}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : "false"}
        autoComplete={name === "email" ? "email" : "off"}
        id={inputId}
        inputMode={inputMode}
        max={max}
        maxLength={maxLength}
        min={min}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
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

type TextAreaFieldProps = {
  error?: string;
  hint?: string;
  label: string;
  maxLength: number;
  name: "additionalInformation" | "creatorIdea";
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
  const inputId = `creator-interest-${name}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = `${inputId}-error`;
  const describedBy = [hintId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-label="required"> *</span> : null}
      </label>
      {hint ? (
        <p className={styles.hint} id={hintId}>
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
        rows={5}
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
