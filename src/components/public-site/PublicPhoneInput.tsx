"use client";

import { useEffect, useRef, useState } from "react";
import PhoneInput, { type Country, type Value } from "react-phone-number-input";
import { DEFAULT_PHONE_COUNTRY_CODE, getDefaultPhoneCountryCodeFromLocales } from "@/lib/phoneCountries";
import styles from "./CreatorInterestForm.module.css";

type PublicPhoneInputProps = {
  contactErrorId?: string;
  error?: string;
  forceInvalid?: boolean;
  idPrefix: string;
  maxLength: number;
  onPhoneChange: (value: string) => void;
  setRef: (element: HTMLInputElement | null) => void;
  value: string;
};

export default function PublicPhoneInput({
  contactErrorId,
  error,
  forceInvalid = false,
  idPrefix,
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
    if (didDetectCountryRef.current) {
      return;
    }

    didDetectCountryRef.current = true;
    setDefaultCountry(getDefaultPhoneCountryCodeFromLocales(navigator.languages ?? [navigator.language]));
  }, []);

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>Mobile phone number</label>
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
