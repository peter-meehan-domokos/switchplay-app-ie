import { ageOn, dublinToday } from "@/lib/age";
import { formatPhoneAsE164 } from "@/lib/phoneCountries";
import { validateCommunicationPreferences, type StoredPreferences } from "./communicationPreferences";
import type { Education, MathsCourse, MathsLevel, MembershipCategory } from "@/lib/puckleMemberships";

export const COURSE_LEVELS: Record<MathsCourse, readonly MathsLevel[]> = {
  "leaving-cert": ["higher", "ordinary", "foundation", "other", "dont-know"],
  "junior-cycle": ["higher", "ordinary", "other", "dont-know"],
  gcse: ["higher-tier", "foundation-tier", "other", "dont-know"],
  "a-level": [], other: ["other", "dont-know"], "dont-know": ["other", "dont-know"],
};
export const INTEREST_SOURCE = "join-interest-form";
export const JOIN_SOURCE = "join-form";
export type RegistrationDetails = {
  registrationCategory: MembershipCategory; name: string; email: string | null; mobile: string | null;
  dateOfBirth?: string; education?: Education; teacherIntroduction?: string;
  communicationPreferences: StoredPreferences;
};
type Input = Record<string, unknown>;
function object(value: unknown): Input {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_SUBMISSION");
  return value as Input;
}
function text(value: unknown, maximum: number, required = false): string {
  if (value !== undefined && value !== null && typeof value !== "string") throw new Error("INVALID_TEXT");
  const result = typeof value === "string" ? value.trim() : "";
  if ((required && !result) || result.length > maximum) throw new Error("INVALID_TEXT");
  return result;
}
function allowed(input: Input, keys: string[]) {
  if (Object.keys(input).some(key => !keys.includes(key))) throw new Error("UNEXPECTED_FIELD");
}
export function validateEducation(value: unknown): Education {
  const input = object(value);
  allowed(input, ["course", "courseOther", "level", "levelOther"]);
  const course = text(input.course, 30) as MathsCourse;
  if (!Object.hasOwn(COURSE_LEVELS, course)) throw new Error("INVALID_COURSE");
  const courseOther = text(input.courseOther, 200, course === "other");
  const levelOther = text(input.levelOther, 200);
  if (course !== "other" && courseOther) throw new Error("INCOMPATIBLE_COURSE_TEXT");
  if (course === "a-level") {
    if (input.level != null || levelOther) throw new Error("A_LEVEL_HAS_NO_LEVEL");
    return { course, courseOther: null, level: null, levelOther: null };
  }
  const level = text(input.level, 30) as MathsLevel;
  if (!COURSE_LEVELS[course].includes(level)) throw new Error("INVALID_LEVEL");
  if (level === "other" ? !levelOther : !!levelOther) throw new Error("INVALID_LEVEL_TEXT");
  return { course, courseOther: courseOther || null, level, levelOther: levelOther || null };
}
/** UI helper for later Join forms; changing course clears all incompatible level state. */
export function educationAfterCourseChange(course: MathsCourse): Education {
  if (!Object.hasOwn(COURSE_LEVELS, course)) throw new Error("INVALID_COURSE");
  return { course, courseOther: null, level: null, levelOther: null };
}
/** Shared by the server validators and the Join form. Returns E.164, "" when blank, or throws INVALID_MOBILE. */
export function normaliseMobile(value: string, countryCode: string): string {
  const mobileInput = value.trim();
  const mobile = mobileInput ? formatPhoneAsE164(mobileInput, countryCode) : "";
  if (mobileInput && (!/^\+?[0-9\s()-]+$/.test(mobileInput) || !/^\+[1-9]\d{6,14}$/.test(mobile))) throw new Error("INVALID_MOBILE");
  return mobile;
}
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function contacts(input: Input, mode: "email" | "no-email" | "interest") {
  const email = text(input.email, 254).toLowerCase();
  const mobile = normaliseMobile(text(input.mobile, 30), text(input.phoneCountryCode, 5));
  if (email && !EMAIL_PATTERN.test(email)) throw new Error("INVALID_EMAIL");
  if (mode === "email" && !email) throw new Error("EMAIL_REQUIRED");
  if (mode === "no-email" && (email || !mobile)) throw new Error("NO_EMAIL_REQUIRES_MOBILE");
  if (mode === "interest" && !email && !mobile) throw new Error("CONTACT_REQUIRED");
  return { email: email || null, mobile: mobile || null };
}
/** Category/profile validation only. Does not accept credentials, verify email or create accounts. */
export function validateRegistrationDetails(value: unknown, mode: "email" | "no-email", today = dublinToday(), now = new Date()): RegistrationDetails {
  if (mode !== "email" && mode !== "no-email") throw new Error("INVALID_CONTACT_MODE");
  const input = object(value);
  allowed(input, ["registrationCategory", "name", "email", "mobile", "phoneCountryCode", "dateOfBirth", "education", "teacherIntroduction", "communicationPreferences"]);
  const category = input.registrationCategory;
  if (category !== "student" && category !== "teacher") throw new Error("INVALID_REGISTRATION_CATEGORY");
  const contact = contacts(input, mode);
  // Every choice must be answered; the channels must fit the contact details given. Nothing is ever inferred.
  const communicationPreferences = validateCommunicationPreferences(input.communicationPreferences, category, contact, JOIN_SOURCE, now);
  const result: RegistrationDetails = { registrationCategory: category, name: text(input.name, 100, true), ...contact, communicationPreferences };
  if (category === "student") {
    const dateOfBirth = text(input.dateOfBirth, 10, true);
    if (ageOn(dateOfBirth, today) < 13) throw new Error("MINIMUM_AGE_13");
    if (input.teacherIntroduction !== undefined) throw new Error("INCOMPATIBLE_CATEGORY_FIELDS");
    return { ...result, dateOfBirth, education: validateEducation(input.education) };
  }
  if (input.dateOfBirth !== undefined || input.education !== undefined) throw new Error("INCOMPATIBLE_CATEGORY_FIELDS");
  return { ...result, teacherIntroduction: text(input.teacherIntroduction, 2000) };
}
export function validateNoEmailContact(value: unknown, today = dublinToday(), now = new Date()) {
  const data = validateRegistrationDetails(value, "no-email", today, now);
  return { kind: "no-email-join-request" as const, noEmailReason: "no-email-address" as const,
    registrationCategory: data.registrationCategory, name: data.name, mobile: data.mobile!, communicationPreferences: data.communicationPreferences,
    ...(data.dateOfBirth ? { submittedDateOfBirth: data.dateOfBirth, education: data.education } : {}),
    ...(data.teacherIntroduction !== undefined ? { teacherIntroduction: data.teacherIntroduction } : {}) };
}
export function validateInterestContact(value: unknown, now = new Date()) {
  const input = object(value);
  allowed(input, ["name", "email", "mobile", "phoneCountryCode", "reason", "message", "communicationPreferences"]);
  const contact = contacts(input, "interest");
  // Nothing is inferred from submitting: only the explicit answers are stored.
  return { name: text(input.name, 100, true), ...contact, reason: text(input.reason, 500), message: text(input.message, 2000),
    communicationPreferences: validateCommunicationPreferences(input.communicationPreferences, "interest", contact, INTEREST_SOURCE, now) };
}
