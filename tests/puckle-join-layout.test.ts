import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAccountPayload, buildContactPayload, buildInterestPayload, buildMembershipJoinLayout, buildRegistrationDetails, dobStatus, errorsFromServerCode,
  initialJoinFlowState, initialJoinFormState, validateJoinForm, withChoice, withCode, withCodeSent, withCourse, withLevel, withMobile,
  withNoEmail, withStage, withText, withVerifiedProof, type JoinFormState,
} from "../src/app/sites/puckle/lib/membershipJoinLayout";
import { isJoinOpen } from "../src/app/sites/puckle/lib/joinAvailability";
import { validateInterestContact, validateNoEmailContact, validateRegistrationDetails } from "../src/app/sites/puckle/lib/membershipRegistration";

const TODAY = "2026-11-14";
const flow = initialJoinFlowState;
const layoutOf = (form: JoinFormState, f = flow, errors = {}, now = 0) => buildMembershipJoinLayout(form, f, errors, now, TODAY);
const text = (form: JoinFormState, values: Partial<Record<Parameters<typeof withText>[1], string>>) =>
  Object.entries(values).reduce((state, [key, value]) => withText(state, key as Parameters<typeof withText>[1], value as string), form);
const validStudent = (extra: Partial<Record<Parameters<typeof withText>[1], string>> = {}) =>
  withLevel(withCourse(text(initialJoinFormState, { name: "Ada", username: "ada_l", email: "Ada@Example.com ", password: "correct horse battery", dobDay: "14", dobMonth: "11", dobYear: "2010", ...extra }), "gcse"), "higher-tier");

test("student is selected by default and every choice shows mobile and the no-email route immediately", () => {
  const initial = layoutOf(initialJoinFormState);
  assert.equal(initial.heading, "Join Puckle.");
  assert.deepEqual(initial.choices.map(choice => [choice.label, choice.selected]), [["I'm here to learn", true], ["I'm a teacher", false], ["I'm interested in Puckle", false]]);
  for (const choice of ["student", "teacher", "interest"] as const) {
    const layout = layoutOf(withChoice(initialJoinFormState, choice));
    assert.equal(layout.mobile.visible, true, choice);
    assert.equal(layout.emailRouteToggle.visible, true, choice);
    assert.equal(layout.emailRouteToggle.label, "Don't have an email address?");
    assert.equal(layout.email.visible, true, choice);
  }
});
test("common details survive moving between choices; only the active category's fields are visible", () => {
  const entered = withMobile(text(initialJoinFormState, { name: "Ada", email: "a@example.com", username: "ada_l", password: "a long enough password" }), "+353871234567");
  const teacher = withChoice(entered, "teacher");
  assert.equal(teacher.name, "Ada"); assert.equal(teacher.mobile, "+353871234567"); assert.equal(teacher.email, "a@example.com");
  const layout = layoutOf(teacher);
  assert.equal(layout.teacher.visible, true); assert.equal(layout.student.visible, false); assert.equal(layout.interest.visible, false);
  assert.equal(layout.teacher.introduction.label, "Tell us a little about yourself and how you'd like to use Puckle.");
  assert.equal(layout.teacher.introduction.required, false);
  const interest = withChoice(teacher, "interest");
  assert.equal(interest.password, ""); assert.equal(interest.username, "");
  assert.equal(interest.name, "Ada");
  assert.equal(withChoice(interest, "interest"), interest);
});
test("no-email route clears and hides credentials, requires mobile and names the submission kind", () => {
  const filled = text(validStudent(), {});
  const noEmail = withNoEmail(filled, true);
  assert.deepEqual([noEmail.email, noEmail.username, noEmail.password], ["", "", ""]);
  const layout = layoutOf(noEmail);
  assert.deepEqual([layout.email.visible, layout.username.visible, layout.password.visible], [false, false, false]);
  assert.equal(layout.mobile.visible, true); assert.equal(layout.mobile.required, true);
  assert.equal(layout.submission.kind, "contact-request");
  assert.match(layout.submission.notice!, /No account will be created/);
  assert.equal(layout.emailRouteToggle.label, "I do have an email address");
  const back = layoutOf(withNoEmail(noEmail, false));
  assert.equal(back.email.visible, true); assert.equal(back.mobile.required, false); assert.equal(back.submission.kind, "send-code");
  assert.equal(layoutOf(withChoice(validStudent(), "teacher")).submission.kind, "send-code");
  assert.equal(layoutOf(withChoice(validStudent(), "interest")).submission.kind, "interest");
});
test("contact payloads never carry credentials", () => {
  const noEmail = withNoEmail(withMobile(validStudent({ dobYear: "2010" }), "+353871234567"), true);
  const payload = buildContactPayload(noEmail);
  assert.ok(!JSON.stringify(payload).match(/password|username|ada_l|correct horse/));
  assert.equal(payload.details.email, "");
  const accepted = validateNoEmailContact(payload.details, TODAY);
  assert.equal(accepted.mobile, "+353871234567"); assert.equal(accepted.kind, "no-email-join-request");
});
test("course and level rules, including A-level null", () => {
  const course = (value: Parameters<typeof withCourse>[1]) => withCourse(initialJoinFormState, value);
  assert.deepEqual(layoutOf(course("leaving-cert")).student.levelOptions.map(option => option.value), ["higher", "ordinary", "foundation", "other", "dont-know"]);
  assert.deepEqual(layoutOf(course("junior-cycle")).student.levelOptions.map(option => option.value), ["higher", "ordinary", "other", "dont-know"]);
  assert.deepEqual(layoutOf(course("gcse")).student.levelOptions.map(option => option.label), ["Higher tier", "Foundation tier", "Other", "Don't know"]);
  for (const open of ["other", "dont-know"] as const) assert.deepEqual(layoutOf(course(open)).student.levelOptions.map(option => option.value), ["other", "dont-know"]);
  const aLevel = layoutOf(course("a-level")).student;
  assert.equal(aLevel.level.visible, false, "the whole Level field is hidden"); assert.equal(aLevel.level.required, false); assert.equal(aLevel.levelOther.visible, false); assert.deepEqual(aLevel.levelOptions, []);
  assert.equal(layoutOf(course("gcse")).student.level.visible, true, "other courses show Level again");
  assert.equal(layoutOf(course("other")).student.courseOther.visible, true);
  assert.equal(layoutOf(course("gcse")).student.courseOther.visible, false);
});
test("changing course clears incompatible level text; switching to A-level stores null and switching away requires a new level", () => {
  const picked = withLevel(text(withLevel(withCourse(initialJoinFormState, "other"), "other"), { courseOther: "IB", levelOther: "SL" }), "other");
  const gcse = withCourse(picked, "gcse");
  assert.deepEqual([gcse.courseOther, gcse.level, gcse.levelOther], ["", "", ""]);
  const level = withLevel(withCourse(initialJoinFormState, "gcse"), "foundation-tier");
  const aLevel = withCourse(level, "a-level");
  assert.deepEqual([aLevel.level, aLevel.levelOther], ["", ""]);
  const named = validStudent(); const a = withCourse(named, "a-level");
  assert.deepEqual(validateJoinForm(a, TODAY), {});
  assert.equal((buildRegistrationDetails(a, TODAY) as { education: { level: unknown } }).education.level, null);
  assert.deepEqual(validateRegistrationDetails(buildRegistrationDetails(a, TODAY), "email", TODAY).education, { course: "a-level", courseOther: null, level: null, levelOther: null });
  const away = withCourse(a, "leaving-cert");
  assert.equal(validateJoinForm(away, TODAY).level, "Choose your level.");
  assert.equal(withLevel(withLevel(away, "other"), "higher").levelOther, "");
  assert.equal(withCourse(a, "a-level"), a);
});
test("Other and Don't know choices demand their text or explicit answer", () => {
  const other = text(withLevel(withCourse(validStudent(), "other"), "other"), {});
  assert.deepEqual(Object.keys(validateJoinForm(other, TODAY)).sort(), ["courseOther", "levelOther"]);
  const filled = text(other, { courseOther: "IB maths", levelOther: "SL" });
  assert.deepEqual(validateJoinForm(filled, TODAY), {});
  assert.deepEqual(validateRegistrationDetails(buildRegistrationDetails(filled, TODAY), "email", TODAY).education, { course: "other", courseOther: "IB maths", level: "other", levelOther: "SL" });
  const unknown = withLevel(withCourse(validStudent(), "dont-know"), "dont-know");
  assert.deepEqual(validateJoinForm(unknown, TODAY), {});
  assert.deepEqual(validateRegistrationDetails(buildRegistrationDetails(unknown, TODAY), "email", TODAY).education, { course: "dont-know", courseOther: null, level: "dont-know", levelOther: null });
  assert.equal(validateJoinForm(withLevel(withCourse(validStudent(), "dont-know"), ""), TODAY).level, "Choose your level.");
});
test("date of birth boundaries: 13th birthday today, the day before, leap day and impossible dates", () => {
  const dob = (day: string, month: string, year: string) => dobStatus(text(initialJoinFormState, { dobDay: day, dobMonth: month, dobYear: year }), TODAY);
  assert.equal(dob("14", "11", "2013").kind, "valid"); assert.equal((dob("14", "11", "2013") as { age: number }).age, 13);
  assert.equal(dob("15", "11", "2013").kind, "under-minimum");
  assert.equal(dob("1", "1", "2020").kind, "under-minimum");
  assert.equal(dob("15", "11", "2026").kind, "future");
  assert.equal(dob("31", "2", "2010").kind, "invalid"); assert.equal(dob("29", "2", "2011").kind, "invalid");
  assert.equal(dob("29", "2", "2012").kind, "valid");
  assert.equal(dob("", "", "").kind, "missing"); assert.equal(dob("1", "", "2010").kind, "invalid"); assert.equal(dob("1", "1", "10").kind, "invalid");
  assert.equal(dobStatus(text(initialJoinFormState, { dobDay: "29", dobMonth: "2", dobYear: "2012" }), "2025-02-28").kind, "under-minimum");
  assert.equal(dobStatus(text(initialJoinFormState, { dobDay: "29", dobMonth: "2", dobYear: "2012" }), "2025-03-01").kind, "valid");
});
test("under-16 students see private-learning wording; 16 and over see none", () => {
  const notice = (year: string) => layoutOf(text(initialJoinFormState, { dobDay: "14", dobMonth: "11", dobYear: year })).student.ageNotice;
  const agreed = "You're good to go! You can start learning privately on Puckle now. Some group features will need a parent or guardian's approval.";
  assert.equal(notice("2013"), agreed); assert.equal(notice("2011"), agreed);
  assert.equal(notice("2010"), null); assert.equal(notice("2009"), null); assert.equal(notice("2014"), null);
  assert.equal(layoutOf(text(withChoice(initialJoinFormState, "teacher"), { dobYear: "2013" })).student.ageNotice, null);
});
test("password and username rules mirror the server and report every problem at once", () => {
  const base = validStudent();
  assert.deepEqual(validateJoinForm(base, TODAY), {});
  assert.ok(validateJoinForm(text(base, { password: "short-pass" }), TODAY).password);
  assert.deepEqual(validateJoinForm(text(base, { password: "twelve-chars" }), TODAY), {});
  assert.ok(validateJoinForm(text(base, { password: "x".repeat(73) }), TODAY).password);
  assert.deepEqual(validateJoinForm(text(base, { password: "y".repeat(72) }), TODAY), {});
  assert.ok(validateJoinForm(text(base, { password: "é".repeat(37) }), TODAY).password, "74 bytes");
  assert.ok(validateJoinForm(text(base, { password: "           leading and trailing  " }), TODAY).password === undefined, "no trimming or composition rules");
  for (const username of ["ab", "has space", "a@b.com", "x".repeat(31), "naïve"]) assert.ok(validateJoinForm(text(base, { username }), TODAY).username, username);
  for (const username of ["abc", "A_b-9", "x".repeat(30)]) assert.equal(validateJoinForm(text(base, { username }), TODAY).username, undefined, username);
  const many = validateJoinForm(initialJoinFormState, TODAY);
  assert.deepEqual(Object.keys(many).sort(), ["course", "dob", "email", "name", "password", "username"]);
});
test("mobile is optional with email, required without, and must be valid when supplied", () => {
  assert.equal(validateJoinForm(validStudent(), TODAY).mobile, undefined);
  assert.ok(validateJoinForm(withMobile(validStudent(), "not a number"), TODAY).mobile);
  assert.ok(validateJoinForm(withMobile(validStudent(), "+1"), TODAY).mobile);
  assert.equal(validateJoinForm(withMobile(validStudent(), "+353871234567"), TODAY).mobile, undefined);
  const noEmail = withNoEmail(validStudent(), true);
  assert.equal(validateJoinForm(noEmail, TODAY).mobile, "Enter a mobile number so we can contact you.");
  assert.deepEqual(validateJoinForm(withMobile(noEmail, "+353871234567"), TODAY), {});
});
test("interest is an updates sign-up: one purpose, no checkbox, needs only an email or a mobile", () => {
  const interest = withChoice(initialJoinFormState, "interest");
  const layout = layoutOf(interest);
  assert.equal(layout.intro, "Interested in Puckle? Leave your details and we'll send you occasional updates as it develops.");
  assert.equal(layout.submission.label, "Keep me updated"); assert.equal(layout.submission.kind, "interest");
  assert.ok(!("emailUpdates" in layout.interest), "no marketing checkbox");
  assert.equal(layout.interest.reason.label, "What brings you to Puckle? (optional)"); assert.equal(layout.interest.reason.required, false);
  assert.deepEqual(Object.keys(validateJoinForm(interest, TODAY)).sort(), ["contact", "name"]);
  const named = text(interest, { name: "Sam" });
  assert.equal(validateJoinForm(withMobile(named, "+353871234567"), TODAY).contact, undefined);
  assert.deepEqual(validateJoinForm(text(named, { email: "sam@example.com" }), TODAY), {}, "reason is optional");
  const noEmail = withNoEmail(named, true);
  assert.equal(validateJoinForm(noEmail, TODAY).mobile, "Enter a mobile number so we can contact you.");
  assert.match(layoutOf(noEmail).interest.mobileOnlyNote!, /No marketing texts/); assert.match(layoutOf(noEmail).submission.notice!, /follow up/);
  assert.equal(layoutOf(text(named, { email: "sam@example.com" })).interest.mobileOnlyNote, null);
  const payload = buildInterestPayload(text(text(named, { email: "sam@example.com" }), { reason: "parent" })).details;
  assert.ok(!("emailUpdates" in payload));
  const accepted = validateInterestContact(payload, new Date(0));
  assert.deepEqual([accepted.email, accepted.communication.emailUpdates, accepted.communication.source, accepted.communication.wordingVersion], ["sam@example.com", true, "join-interest-form", "puckle-updates-signup-v1"]);
  const mobileOnly = validateInterestContact(buildInterestPayload(withMobile(noEmail, "+353871234567")).details);
  assert.deepEqual([mobileOnly.email, mobileOnly.communication.emailUpdates], [null, false], "mobile-only is follow-up only");
  assert.throws(() => validateInterestContact({ ...payload, emailUpdates: true }), /UNEXPECTED_FIELD/);
});
test("email flow: code, verification and a corrected username reuse the same proof", () => {
  const form = validStudent();
  assert.equal(layoutOf(form).submission.kind, "send-code");
  const sent = withCodeSent(flow, { challengeId: "c".repeat(43), flowToken: "f".repeat(43) }, "ada@example.com", 1_000);
  assert.equal(layoutOf(form, sent, {}, 2_000).submission.kind, "verify-code");
  assert.equal(layoutOf(form, sent, {}, 2_000).code.resendInSeconds, 59);
  assert.equal(layoutOf(form, sent, {}, 61_000).code.canResend, true);
  assert.equal(layoutOf(form, withStage(sent, "details")).submission.kind, "resume-code");
  assert.equal(layoutOf(text(form, { email: "other@example.com" }), withStage(sent, "details")).submission.kind, "send-code", "a changed email needs a new code");
  const proven = withVerifiedProof(withStage(sent, "details"), "p".repeat(43), "ada@example.com");
  assert.equal(layoutOf(form, proven).submission.kind, "create-account");
  assert.equal(layoutOf(text(form, { username: "someone_else" }), proven).submission.kind, "create-account");
  assert.equal(layoutOf(text(form, { email: "other@example.com" }), proven).submission.kind, "send-code");
  const payload = buildAccountPayload(form, proven);
  assert.equal(payload.proof, "p".repeat(43)); assert.equal(payload.username, "ada_l");
  assert.equal(withCode(flow, "12a3 456789").code, "123456");
});
test("every valid client form is accepted by the authoritative server validators", () => {
  const forms = [validStudent(), withMobile(validStudent(), "+353871234567"), withCourse(validStudent(), "a-level"), withChoice(text(validStudent(), {}), "teacher"),
    text(withChoice(validStudent(), "teacher"), { teacherIntroduction: "I teach Junior Cycle maths." })];
  for (const form of forms) {
    assert.deepEqual(validateJoinForm(form, TODAY), {});
    const accepted = validateRegistrationDetails(buildRegistrationDetails(form, TODAY), "email", TODAY);
    assert.equal(accepted.email, "ada@example.com");
    assert.equal(accepted.registrationCategory, form.choice);
  }
  const teacher = validateRegistrationDetails(buildRegistrationDetails(withChoice(validStudent(), "teacher"), TODAY), "email", TODAY);
  assert.equal(teacher.dateOfBirth, undefined); assert.equal(teacher.education, undefined); assert.equal(teacher.teacherIntroduction, "");
});
test("server rejection codes map back onto correctable fields", () => {
  assert.deepEqual(Object.keys(errorsFromServerCode("MINIMUM_AGE_13")!), ["dob"]);
  assert.equal(errorsFromServerCode("MINIMUM_AGE_13")!.dob, "You need to be at least 13 to join Puckle.");
  assert.deepEqual(Object.keys(errorsFromServerCode("INVALID_USERNAME")!), ["username"]);
  assert.equal(errorsFromServerCode("UNEXPECTED_FIELD"), null);
});
test("building layouts never mutates state, flow or errors", () => {
  const form = validStudent(), before = JSON.stringify([form, flow]);
  layoutOf(form); validateJoinForm(form, TODAY); buildAccountPayload(form, flow); buildContactPayload(form); buildInterestPayload(form);
  assert.equal(JSON.stringify([form, flow]), before);
});
test("public Join stays closed on a production deployment unless explicitly opened", () => {
  assert.equal(isJoinOpen({ NODE_ENV: "production" }), false);
  assert.equal(isJoinOpen({ NODE_ENV: "production", PUCKLE_JOIN_ENABLED: "true" }), false);
  assert.equal(isJoinOpen({ NODE_ENV: "production", PUCKLE_JOIN_ENABLED: "1" }), true);
  assert.equal(isJoinOpen({ NODE_ENV: "development" }), true);
  assert.equal(isJoinOpen({ NODE_ENV: "test" }), true);
});
