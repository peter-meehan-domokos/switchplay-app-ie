import assert from "node:assert/strict";
import { test } from "node:test";
import { COURSE_LEVELS, educationAfterCourseChange, validateEducation, validateInterestContact, validateNoEmailContact, validateRegistrationDetails } from "../src/app/sites/puckle/lib/membershipRegistration";
const today = "2026-11-14";
const noPrefs = (...keys: string[]) => ({ answers: Object.fromEntries(keys.map(key => [key, "no"])), channels: { email: false, sms: false } });
const STUDENT_PREFS = noPrefs("puckleUpdates", "newsAndOffers", "occasionalPersonalContact", "guidedMathsInvitations");
const TEACHER_PREFS = noPrefs("puckleUpdates", "newsAndOffers", "occasionalPersonalContact", "teacherCollaborationInvitations");
const INTEREST_PREFS = noPrefs("puckleUpdates", "newsAndOffers", "occasionalPersonalContact");
const student = { registrationCategory: "student", name: " Sam ", email: " SAM@EXAMPLE.COM ", dateOfBirth: "2013-11-14", education: { course: "gcse", level: "higher-tier" }, communicationPreferences: STUDENT_PREFS };
test("student validation requires DOB >=13 and category-specific education", () => {
  const result = validateRegistrationDetails(student, "email", today);
  assert.equal(result.email, "sam@example.com"); assert.equal(result.mobile, null); assert.equal(result.name, "Sam");
  for (const change of [{ dateOfBirth: "2013-11-15" }, { dateOfBirth: "2027-01-01" }, { dateOfBirth: "2023-02-29" }, { dateOfBirth: undefined }, { education: undefined }, { registrationCategory: "admin" }]) assert.throws(() => validateRegistrationDetails({ ...student, ...change }, "email", today));
});
test("all course/level options validate; Other requires text", () => {
  for (const [course, levels] of Object.entries(COURSE_LEVELS)) for (const level of levels) {
    assert.equal(validateEducation({ course, level, ...(course === "other" ? { courseOther: "IB" } : {}), ...(level === "other" ? { levelOther: "custom" } : {}) }).level, level);
  }
  assert.throws(() => validateEducation({ course: "other", level: "dont-know" }));
  assert.throws(() => validateEducation({ course: "dont-know", level: "higher" }));
  assert.throws(() => validateEducation({ course: "gcse", level: "higher" }));
  assert.throws(() => validateEducation({ course: "junior-cycle", level: "other" }));
  assert.throws(() => validateEducation({ course: "__proto__", level: "other" }));
});
test("A-level clears level state; switching away requires a new applicable level", () => {
  const alevel = educationAfterCourseChange("a-level");
  assert.equal(alevel.level, null); assert.equal(alevel.levelOther, null);
  assert.deepEqual(validateEducation(alevel), alevel);
  assert.equal(validateEducation({ course: "a-level" }).level, null);
  assert.throws(() => validateEducation({ course: "a-level", level: "higher" }));
  assert.throws(() => validateEducation({ course: "a-level", level: null, levelOther: "old" }));
  assert.throws(() => validateEducation(educationAfterCourseChange("gcse")));
  assert.equal(validateEducation({ ...educationAfterCourseChange("gcse"), level: "foundation-tier" }).level, "foundation-tier");
});
test("teacher introduction is optional and no student fields/authorities are accepted", () => {
  assert.equal(validateRegistrationDetails({ registrationCategory: "teacher", name: "Pat", email: "pat@example.com", communicationPreferences: TEACHER_PREFS }, "email", today).teacherIntroduction, "");
  for (const field of ["permissions", "isAdmin", "safeguarding", "userId", "ageAssurance", "groupExperienceApproval"]) assert.throws(() => validateRegistrationDetails({ ...student, [field]: true }, "email", today));
  assert.throws(() => validateRegistrationDetails({ registrationCategory: "teacher", name: "Pat", email: "pat@example.com", dateOfBirth: student.dateOfBirth, communicationPreferences: TEACHER_PREFS }, "email", today));
});
test("mobile is optional with email, validated if supplied, and mandatory without email", () => {
  assert.equal(validateRegistrationDetails({ ...student, mobile: "+353871234567" }, "email", today).mobile, "+353871234567");
  assert.throws(() => validateRegistrationDetails({ ...student, mobile: "invalid" }, "email", today));
  const contact = { ...student, email: undefined, mobile: "+353871234567" };
  assert.equal(validateNoEmailContact(contact, today).submittedDateOfBirth, student.dateOfBirth);
  assert.equal(validateNoEmailContact({ registrationCategory: "teacher", name: "Pat", mobile: "+353871234567", communicationPreferences: TEACHER_PREFS }, today).kind, "no-email-join-request");
  assert.throws(() => validateNoEmailContact({ ...contact, mobile: undefined }, today));
  assert.throws(() => validateNoEmailContact(student, today));
  for (const field of ["username", "password", "passwordHash", "emailVerifiedAt"]) assert.throws(() => validateNoEmailContact({ ...contact, [field]: "secret" }, today));
});
test("interest email/mobile/both stay contact-only and imply no consent", () => {
  const base = { name: "Pat", reason: "Interested", mobile: "+353871234567", communicationPreferences: INTEREST_PREFS };
  const result = validateInterestContact(base, new Date("2026-11-14"));
  assert.equal(result.email, null); assert.equal(result.communicationPreferences.channels.email, false);
  assert.throws(() => validateInterestContact({ ...base, emailUpdates: true }), /UNEXPECTED_FIELD/);
  assert.throws(() => validateInterestContact({ ...base, mobile: undefined }));
  assert.throws(() => validateInterestContact({ ...base, password: "secret" }));
  assert.equal(validateInterestContact({ ...base, email: "PAT@example.com" }).email, "pat@example.com");
  assert.equal(validateInterestContact({ name: "Pat", mobile: "+353871234567", communicationPreferences: INTEREST_PREFS }).reason, "", "reason is optional");
  assert.equal(validateInterestContact({ ...base, mobile: undefined, email: "pat@example.com" }).mobile, null);
});
