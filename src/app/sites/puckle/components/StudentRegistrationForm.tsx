"use client";

import type { MathsCourse, MathsLevel } from "@/lib/puckleMemberships";
import type { MembershipJoinLayout } from "../lib/membershipJoinLayout";
import formStyles from "./CreatorInterestForm.module.css";
import { JoinSelectField, JoinTextField, type JoinSectionProps } from "./JoinFields";
import styles from "./MembershipJoinForm.module.css";

export default function StudentRegistrationForm({ layout, form, edit }: JoinSectionProps & Readonly<{ layout: MembershipJoinLayout["student"] }>) {
  if (!layout.visible) return null;
  const dob = layout.dob;
  return (
    <>
      <fieldset aria-describedby={dob.error ? "join-dob-error" : "join-dob-hint"} className={styles.dob}>
        <legend>{dob.label}</legend>
        <div className={styles.dobRow}>
          {([["dobDay", "Day", "bday-day", 2, form.dobDay], ["dobMonth", "Month", "bday-month", 2, form.dobMonth], ["dobYear", "Year", "bday-year", 4, form.dobYear]] as const).map(([key, label, autoComplete, maxLength, value]) => (
            <div className={formStyles.field} key={key}>
              <label htmlFor={`join-${key}`}>{label}</label>
              <input aria-invalid={dob.error ? "true" : "false"} autoComplete={autoComplete} id={`join-${key}`} inputMode="numeric" maxLength={maxLength} name={key}
                onChange={event => edit.text(key, event.target.value.replace(/\D/g, ""))} pattern="[0-9]*" placeholder={label === "Year" ? "YYYY" : label === "Day" ? "DD" : "MM"} type="text" value={value} />
            </div>
          ))}
        </div>
        {dob.hint ? <p className={styles.hint} id="join-dob-hint">{dob.hint}</p> : null}
        {dob.error ? <p className={formStyles.fieldError} id="join-dob-error">{dob.error}</p> : null}
      </fieldset>
      {layout.ageNotice ? <p className={styles.notice} role="note">{layout.ageNotice}</p> : null}
      <JoinSelectField id="join-course" onChange={value => edit.course(value as MathsCourse | "")} options={layout.courseOptions} placeholder="Choose a course" value={form.course} view={layout.course} />
      <JoinTextField autoComplete="off" id="join-courseOther" maxLength={200} onChange={value => edit.text("courseOther", value)} value={form.courseOther} view={layout.courseOther} />
      <JoinSelectField disabled={layout.level.disabled} id="join-level" onChange={value => edit.level(value as MathsLevel | "")} options={layout.levelOptions}
        placeholder={layout.level.placeholder} value={form.level} view={layout.level} />
      <JoinTextField autoComplete="off" id="join-levelOther" maxLength={200} onChange={value => edit.text("levelOther", value)} value={form.levelOther} view={layout.levelOther} />
    </>
  );
}
