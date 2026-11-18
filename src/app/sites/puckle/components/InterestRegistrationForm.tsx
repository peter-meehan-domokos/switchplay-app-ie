"use client";

import type { MembershipJoinLayout } from "../lib/membershipJoinLayout";
import { JoinTextArea, type JoinSectionProps } from "./JoinFields";
import styles from "./MembershipJoinForm.module.css";

/** Interested-party sign-up. Communication choices are asked in the shared preferences section below. */
export default function InterestRegistrationForm({ layout, form, edit }: JoinSectionProps & Readonly<{ layout: MembershipJoinLayout["interest"] }>) {
  if (!layout.visible) return null;
  return (
    <>
      <JoinTextArea id="join-reason" maxLength={500} onChange={value => edit.text("reason", value)} rows={5} value={form.reason} view={layout.reason} />
      {layout.mobileOnlyNote ? <p className={styles.hint}>{layout.mobileOnlyNote}</p> : null}
    </>
  );
}
