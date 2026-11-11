"use client";

import { useEffect, useRef, useState } from "react";
import PhoneInput, { type Country, type Value } from "react-phone-number-input";
import { DEFAULT_PHONE_COUNTRY_CODE, getDefaultPhoneCountryCodeFromLocales } from "@/lib/phoneCountries";
import styles from "./CreatorInterestForm.module.css";

type PublicPhoneInputProps = {
  contactErrorId?: string;
  error?: string;
  forceInvalid?: boolean;
  detectCountry?: boolean;
  idPrefix: string;
  label?: string;
  maxLength: number;
  onPhoneChange: (value: string) => void;
  setRef: (element: HTMLInputElement | null) => void;
  value: string;
};

export default function PublicPhoneInput({
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
  const didDetectCountryRef = useRef(false);
  const [defaultCountry, setDefaultCountry] = useState<Country>(DEFAULT_PHONE_COUNTRY_CODE);
  const inputId = `${idPrefix}-phone`;
  const errorId = `${inputId}-error`;
  const describedBy = [contactErrorId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;
  const inputClassName = [
    styles.phoneInput,
    error || forceInvalid ? styles.phoneInputInvalid : undefined,
  ].filter(Boolean).join(" ");

  useEffect(() => {
    if (!detectCountry || didDetectCountryRef.current) {
      return;
    }

    didDetectCountryRef.current = true;
    setDefaultCountry(getDefaultPhoneCountryCodeFromLocales(navigator.languages ?? [navigator.language]));
  }, [detectCountry]);

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <PhoneInput
        aria-describedby={describedBy}
        aria-invalid={error || forceInvalid ? "true" : "false"}
        autoComplete="tel"
        className={inputClassName}
        countryCallingCodeEditable={false}
        defaultCountry={defaultCountry}
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
