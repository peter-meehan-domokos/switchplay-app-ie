"use client";

import { useEffect, useRef, useState } from "react";
import PhoneInput, { type Country, type Value } from "react-phone-number-input";
import { DEFAULT_PHONE_COUNTRY_CODE, parseVisitorCountry, resolveInitialPhoneCountry } from "@/lib/phoneCountries";
import styles from "./CreatorInterestForm.module.css";

type PublicPhoneInputProps = {
  contactErrorId?: string;
  error?: string;
  forceInvalid?: boolean;
  className?: string;
  detectCountry?: boolean;
  idPrefix: string;
  label?: string;
  maxLength: number;
  onPhoneChange: (value: string) => void;
  setRef: (element: HTMLInputElement | null) => void;
  value: string;
};

export default function PublicPhoneInput({
  className,
  contactErrorId,
  error,
  detectCountry = true,
  forceInvalid = false,
  idPrefix,
  label = "Mobile phone number",
  maxLength,
  onPhoneChange,
  setRef,
  value,
}: PublicPhoneInputProps) {
  const userChoseCountryRef = useRef(false);
  const valueRef = useRef(value);
  const [defaultCountry, setDefaultCountry] = useState<Country>(DEFAULT_PHONE_COUNTRY_CODE);
  const inputId = `${idPrefix}-phone`;
  const errorId = `${inputId}-error`;
  const describedBy = [contactErrorId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;
  const inputClassName = [
    styles.phoneInput,
    error || forceInvalid ? styles.phoneInputInvalid : undefined,
  ].filter(Boolean).join(" ");

  useEffect(() => { valueRef.current = value; }, [value]);

  // Initial country only: IP country (Vercel), else browser language, else Ireland. Skipped once the visitor has
  // picked a country or typed a number, so detection can never override them.
  useEffect(() => {
    if (!detectCountry) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    fetch("/api/public/puckle/visitor-country", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => parseVisitorCountry(body?.country))
      .catch(() => null)
      .then((visitorCountry) => {
        clearTimeout(timeout);
        if (cancelled || userChoseCountryRef.current || valueRef.current) return;
        setDefaultCountry(resolveInitialPhoneCountry({ visitorCountry, locales: navigator.languages ?? [navigator.language] }));
      });
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [detectCountry]);

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")} onChange={(event) => { if ((event.target as HTMLElement).tagName === "SELECT") userChoseCountryRef.current = true; }}>
      <label htmlFor={inputId}>{label}</label>
      <PhoneInput
        aria-describedby={describedBy}
        aria-invalid={error || forceInvalid ? "true" : "false"}
        autoComplete="tel"
        className={inputClassName}
        countryCallingCodeEditable={false}
        defaultCountry={defaultCountry}
        focusInputOnCountrySelection={false}
        id={inputId}
        international
        limitMaxLength
        maxLength={maxLength}
        name="phone"
        numberInputProps={{ ref: setRef }}
        onChange={(nextValue?: Value) => onPhoneChange(nextValue ?? "")}
        value={value || undefined}
        withCountryCallingCode
      />
      {error ? (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
