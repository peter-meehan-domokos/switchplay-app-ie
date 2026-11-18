"use client";

import type { MembershipJoinLayout } from "../lib/membershipJoinLayout";
import { JoinTextArea, type JoinSectionProps } from "./JoinFields";

export default function TeacherRegistrationForm({ layout, form, edit }: JoinSectionProps & Readonly<{ layout: MembershipJoinLayout["teacher"] }>) {
  if (!layout.visible) return null;
  return <JoinTextArea id="join-teacherIntroduction" maxLength={2000} onChange={value => edit.text("teacherIntroduction", value)} rows={5} value={form.teacherIntroduction} view={layout.introduction} />;
}
