"use client";

import type { ChangeEvent, ReactNode } from "react";
import type { MathsCourse, MathsLevel } from "@/lib/puckleMemberships";
import type { FieldView, JoinFormState } from "../lib/membershipJoinLayout";
import formStyles from "./CreatorInterestForm.module.css";
import styles from "./MembershipJoinForm.module.css";

export type JoinTextKey = Parameters<typeof import("../lib/membershipJoinLayout").withText>[1];
/** Interactions are sent up to the top-level state; fields never hold or patch their own copy. */
export type JoinEditors = Readonly<{
  text: (key: JoinTextKey, value: string) => void;
  course: (value: MathsCourse | "") => void;
  level: (value: MathsLevel | "") => void;
}>;
export type JoinSectionProps = Readonly<{ form: JoinFormState; edit: JoinEditors }>;

const describedBy = (id: string, view: FieldView) => [view.hint ? `${id}-hint` : undefined, view.error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined;

export function Shell({ id, view, children }: { id: string; view: FieldView; children: ReactNode }) {
  return (
    <div className={formStyles.field}>
      <label htmlFor={id}>{view.label}</label>
      {children}
      {view.hint ? <p className={styles.hint} id={`${id}-hint`}>{view.hint}</p> : null}
      {view.error ? <p className={formStyles.fieldError} id={`${id}-error`}>{view.error}</p> : null}
    </div>
  );
}

type TextProps = Readonly<{ id: string; view: FieldView; value: string; onChange: (value: string) => void; autoComplete: string; type?: "text" | "email" | "password";
  inputMode?: "text" | "email" | "numeric"; maxLength: number; trailing?: ReactNode }>;
export function JoinTextField({ id, view, value, onChange, autoComplete, type = "text", inputMode = "text", maxLength, trailing }: TextProps) {
  if (!view.visible) return null;
  return (
    <Shell id={id} view={view}>
      <input aria-describedby={describedBy(id, view)} aria-invalid={view.error ? "true" : "false"} aria-required={view.required || undefined}
        autoCapitalize={type === "text" ? "off" : "none"} autoComplete={autoComplete} autoCorrect="off" id={id} inputMode={inputMode} maxLength={maxLength}
        name={id} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} spellCheck={false} type={type} value={value} />
      {trailing}
    </Shell>
  );
}
type SelectProps = Readonly<{ id: string; view: FieldView; value: string; onChange: (value: string) => void; options: readonly { value: string; label: string }[];
  placeholder: string; disabled?: boolean }>;
export function JoinSelectField({ id, view, value, onChange, options, placeholder, disabled = false }: SelectProps) {
  if (!view.visible) return null;
  return (
    <Shell id={id} view={view}>
      <select aria-describedby={describedBy(id, view)} aria-invalid={view.error ? "true" : "false"} disabled={disabled} id={id} name={id}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)} value={disabled ? "" : value}>
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Shell>
  );
}
type AreaProps = Readonly<{ id: string; view: FieldView; value: string; onChange: (value: string) => void; maxLength: number; rows?: number }>;
export function JoinTextArea({ id, view, value, onChange, maxLength, rows = 4 }: AreaProps) {
  if (!view.visible) return null;
  return (
    <Shell id={id} view={view}>
      <textarea aria-describedby={describedBy(id, view)} aria-invalid={view.error ? "true" : "false"} id={id} maxLength={maxLength} name={id}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)} rows={rows} value={value} />
    </Shell>
  );
}
