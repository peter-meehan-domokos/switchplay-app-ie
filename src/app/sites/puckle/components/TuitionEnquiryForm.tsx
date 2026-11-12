"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import {
  CONTACT_METHODS,
  type ContactMethod,
  ENQUIRER_TYPES,
  ENQUIRY_LIMITS,
  type EnquirerType,
  MATHS_COURSES,
  type MathsCourse,
  type EnquiryErrorResponse,
  type EnquiryFieldErrors,
  type EnquiryFormValues,
  type EnquirySuccessResponse,
  resolvePreferredContactMethod,
  validateTuitionEnquiry,
} from "../lib/publicTuitionEnquiry";
import { DEFAULT_PHONE_COUNTRY_CODE } from "@/lib/phoneCountries";
import SupportErrorMessage from "./SupportErrorMessage";
import { SITE_NAME } from "../siteInfo";
import buttonStyles from "./PublicButton.module.css";
import formStyles from "./CreatorInterestForm.module.css";
import styles from "./TuitionEnquiryForm.module.css";
import PublicPhoneInput from "./PublicPhoneInput";

const initialValues: EnquiryFormValues = {
  enquirerType: "",
  studentName: "",
  contactName: "",
  mathsCourse: "",
  email: "",
  phone: "",
  phoneCountryCode: DEFAULT_PHONE_COUNTRY_CODE,
  preferredContactMethod: "",
  message: "",
  companyWebsite: "",
};

const ENQUIRER_LABELS: Record<EnquirerType, string> = {
  "student-under-18": "Student under 18",
  "student-adult": "Student aged 18 or over",
  "parent-guardian": "Parent or guardian",
};

const MATHS_COURSE_LABELS: Record<MathsCourse, string> = {
  "leaving-cert": "Leaving Cert maths",
  "junior-cycle": "Junior Cycle maths",
  gcse: "GCSE maths",
  "a-level": "A-level maths",
  other: "Other maths qualification",
};

const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  text: "Text message",
  phone: "Phone call",
  email: "Email",
};

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function TuitionEnquiryForm() {
  const [values, setValues] = useState<EnquiryFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<EnquiryFieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [formError, setFormError] = useState(false);
  const [submittedUnder18, setSubmittedUnder18] = useState(false);
  const isSubmittingRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "success") {
      successRef.current?.focus();
    }
  }, [status]);

  const { enquirerType } = values;
  const isUnder18 = enquirerType === "student-under-18";
  const hasEmail = values.email.trim().length > 0;
  const hasPhone = values.phone.trim().length > 0;
  const preferredContactMethod = resolvePreferredContactMethod(values);

  function clearErrors(...keys: Array<keyof EnquiryFieldErrors>) {
    setFieldErrors((currentErrors) => {
      if (!keys.some((key) => currentErrors[key])) return currentErrors;
      const nextErrors = { ...currentErrors };
      keys.forEach((key) => delete nextErrors[key]);
      return nextErrors;
    });
    setFormError(false);
  }

  function updateText(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    clearErrors(name as keyof EnquiryFieldErrors, ...(name === "email" ? (["contact", "preferredContactMethod"] as const) : []));
  }

  function updateMathsCourse(event: ChangeEvent<HTMLSelectElement>) {
    setValues((current) => ({ ...current, mathsCourse: event.target.value as MathsCourse | "" }));
    clearErrors("mathsCourse");
  }

  function updatePhone(phone: string) {
    setValues((current) => ({ ...current, phone }));
    clearErrors("phone", "contact", "preferredContactMethod");
  }

  function updateEnquirerType(next: EnquirerType) {
    setValues((current) => ({ ...current, enquirerType: next }));
    clearErrors("enquirerType", "studentName", "contactName");
  }

  function updatePreferredMethod(next: ContactMethod) {
    setValues((current) => ({ ...current, preferredContactMethod: next }));
    clearErrors("preferredContactMethod");
  }

  function focusFirstInvalidField() {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingRef.current) return;

    const payload: EnquiryFormValues = { ...values, preferredContactMethod };
    const validation = validateTuitionEnquiry(payload);

    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      setFormError(false);
      focusFirstInvalidField();
      return;
    }

    isSubmittingRef.current = true;
    setStatus("submitting");
    setFieldErrors({});
    setFormError(false);

    try {
      const response = await fetch("/api/public/puckle/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseBody = (await response.json()) as EnquirySuccessResponse | EnquiryErrorResponse;

      if (!response.ok || !responseBody.ok) {
        const nextFieldErrors = !responseBody.ok && responseBody.fieldErrors ? responseBody.fieldErrors : {};

        setFieldErrors(nextFieldErrors);
        setFormError(Object.keys(nextFieldErrors).length === 0);
        setStatus("error");
        isSubmittingRef.current = false;

        if (Object.keys(nextFieldErrors).length > 0) focusFirstInvalidField();
        return;
      }

      setSubmittedUnder18(payload.enquirerType === "student-under-18");
      setStatus("success");
    } catch {
      setFormError(true);
      setStatus("error");
      isSubmittingRef.current = false;
    }
  }

  const studentNameField = (
    <TextField
      autoComplete="off"
      error={fieldErrors.studentName}
      label="Student’s first name"
      maxLength={ENQUIRY_LIMITS.name}
      name="studentName"
      onChange={updateText}
      value={values.studentName}
    />
  );

  return (
    <section className={styles.section} id="early-access" aria-labelledby="enquiry-title">
      <div className={styles.copy}>
        <h2 id="enquiry-title">Try Puckle for yourself.</h2>
        <p>
          Start with a free 20–30 minute online session. We’ll talk about your maths, tackle something together and
          give you a feel for how {SITE_NAME} works.
        </p>
      </div>

      {status === "success" ? (
        <div className={styles.success} ref={successRef} tabIndex={-1} role="status" aria-live="polite">
          <h3>Thanks — I’ll be in touch!</h3>
          <p>
            {submittedUnder18
              ? "I’ll contact your parent or guardian using their preferred method to arrange your free online session."
              : "I’ll contact you using your preferred method to arrange your free online session."}
          </p>
        </div>
      ) : (
        <div className={styles.formWrap}>
          {formError ? <SupportErrorMessage className={formStyles.formError} /> : null}

          <form className={styles.form} noValidate onSubmit={handleSubmit} ref={formRef}>
            <RadioGroup
              error={fieldErrors.enquirerType}
              legend="Are you a…"
              name="enquirerType"
              onChange={updateEnquirerType}
              options={ENQUIRER_TYPES.map((value) => ({ value, label: ENQUIRER_LABELS[value] }))}
              value={enquirerType}
            />

            {enquirerType ? (
              <>
                <div className={styles.fields}>
                  {isUnder18 ? studentNameField : null}
                  <TextField
                    autoComplete="name"
                    error={fieldErrors.contactName}
                    label={isUnder18 ? "Parent or guardian’s name" : "Your name"}
                    maxLength={ENQUIRY_LIMITS.name}
                    name="contactName"
                    onChange={updateText}
                    value={values.contactName}
                  />
                  {enquirerType === "parent-guardian" ? studentNameField : null}
                  {isUnder18 ? (
                    <p className={styles.note}>
                      Please provide your parent or guardian’s contact details with their permission. I’ll contact them
                      to arrange the free session.
                    </p>
                  ) : null}
                </div>

                <div className={formStyles.field}>
                  <label htmlFor="enquiry-mathsCourse">Which maths course is this for?</label>
                  <select
                    aria-describedby={fieldErrors.mathsCourse ? "enquiry-mathsCourse-error" : undefined}
                    aria-invalid={fieldErrors.mathsCourse ? "true" : "false"}
                    id="enquiry-mathsCourse"
                    name="mathsCourse"
                    onChange={updateMathsCourse}
                    value={values.mathsCourse}
                  >
                    <option value="">Select an option</option>
                    {MATHS_COURSES.map((course) => (
                      <option key={course} value={course}>
                        {MATHS_COURSE_LABELS[course]}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.mathsCourse ? (
                    <p className={formStyles.fieldError} id="enquiry-mathsCourse-error">
                      {fieldErrors.mathsCourse}
                    </p>
                  ) : null}
                </div>

                <div className={styles.fields}>
                  {fieldErrors.contact ? (
                    <p className={formStyles.fieldError} id="enquiry-contact-error" role="alert">
                      {fieldErrors.contact}
                    </p>
                  ) : null}
                  <TextField
                    autoComplete="email"
                    describedBy={fieldErrors.contact ? "enquiry-contact-error" : undefined}
                    error={fieldErrors.email}
                    forceInvalid={Boolean(fieldErrors.contact)}
                    inputMode="email"
                    label={isUnder18 ? "Parent or guardian’s email" : "Email"}
                    maxLength={ENQUIRY_LIMITS.email}
                    name="email"
                    onChange={updateText}
                    type="email"
                    value={values.email}
                  />
                  <PublicPhoneInput
                    contactErrorId={fieldErrors.contact ? "enquiry-contact-error" : undefined}
                    detectCountry={false}
                    error={fieldErrors.phone}
                    forceInvalid={Boolean(fieldErrors.contact)}
                    idPrefix="enquiry"
                    label={isUnder18 ? "Parent or guardian’s mobile number" : "Mobile number"}
                    maxLength={ENQUIRY_LIMITS.phone}
                    onPhoneChange={updatePhone}
                    setRef={() => undefined}
                    value={values.phone}
                  />
                </div>

                <RadioGroup
                  disabledValues={[
                    ...(hasEmail && !hasPhone ? (["text", "phone"] as const) : []),
                    ...(hasPhone && !hasEmail ? (["email"] as const) : []),
                  ]}
                  error={fieldErrors.preferredContactMethod}
                  inline
                  legend="How would you prefer to be contacted?"
                  name="preferredContactMethod"
                  onChange={updatePreferredMethod}
                  options={CONTACT_METHODS.map((value) => ({ value, label: CONTACT_METHOD_LABELS[value] }))}
                  value={preferredContactMethod}
                />

                <div className={`${formStyles.field} ${styles.messageField}`}>
                  <label htmlFor="enquiry-message">Anything else you’d like me to know?</label>
                  <textarea
                    aria-describedby={fieldErrors.message ? "enquiry-message-error" : undefined}
                    aria-invalid={fieldErrors.message ? "true" : "false"}
                    id="enquiry-message"
                    maxLength={ENQUIRY_LIMITS.message}
                    name="message"
                    onChange={updateText}
                    placeholder="Questions about Puckle, maths topics or anything else..."
                    rows={3}
                    value={values.message}
                  />
                  {fieldErrors.message ? (
                    <p className={formStyles.fieldError} id="enquiry-message-error">
                      {fieldErrors.message}
                    </p>
                  ) : null}
                </div>

                <div className={formStyles.honeypot} aria-hidden="true">
                  <label htmlFor="enquiry-company-website">Company website</label>
                  <input
                    autoComplete="off"
                    id="enquiry-company-website"
                    name="companyWebsite"
                    onChange={updateText}
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
                    {status === "submitting" ? "Sending..." : "Request a free session"}
                  </button>
                  <p className={formStyles.statusText} role="status" aria-live="polite">
                    {status === "submitting" ? "Sending your enquiry." : ""}
                  </p>
                </div>
                <p className={formStyles.privacyNotice}>
                  By submitting this form, you agree that {SITE_NAME} may use your details to respond to you. See our{" "}
                  <Link href="/privacy">Privacy Policy</Link>.
                </p>
              </>
            ) : null}
          </form>
        </div>
      )}
    </section>
  );
}

type TextFieldProps = {
  autoComplete: string;
  describedBy?: string;
  error?: string;
  forceInvalid?: boolean;
  inputMode?: "email" | "text";
  label: string;
  maxLength: number;
  name: "contactName" | "email" | "studentName";
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: "email" | "text";
  value: string;
};

function TextField({
  autoComplete,
  describedBy,
  error,
  forceInvalid = false,
  inputMode = "text",
  label,
  maxLength,
  name,
  onChange,
  type = "text",
  value,
}: TextFieldProps) {
  const inputId = `enquiry-${name}`;
  const errorId = `${inputId}-error`;
  const resolvedDescribedBy = [describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={formStyles.field}>
      <label htmlFor={inputId}>{label}</label>
      <input
        aria-describedby={resolvedDescribedBy}
        aria-invalid={error || forceInvalid ? "true" : "false"}
        autoComplete={autoComplete}
        id={inputId}
        inputMode={inputMode}
        maxLength={maxLength}
        name={name}
        onChange={onChange}
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

type RadioGroupProps<TValue extends string> = {
  disabledValues?: ReadonlyArray<TValue>;
  error?: string;
  inline?: boolean;
  legend: string;
  name: string;
  onChange: (value: TValue) => void;
  options: ReadonlyArray<{ value: TValue; label: string }>;
  value: TValue | "";
};

function RadioGroup<TValue extends string>({
  disabledValues = [],
  error,
  inline = false,
  legend,
  name,
  onChange,
  options,
  value,
}: RadioGroupProps<TValue>) {
  const errorId = `enquiry-${name}-error`;

  return (
    <fieldset className={styles.group} aria-describedby={error ? errorId : undefined}>
      <legend>{legend}</legend>
      <div className={inline ? `${styles.options} ${styles.optionsInline}` : styles.options}>
        {options.map((option, index) => (
          <label className={styles.option} key={option.value}>
            <input
              aria-invalid={error && index === 0 ? "true" : undefined}
              checked={value === option.value}
              disabled={disabledValues.includes(option.value)}
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p className={formStyles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
