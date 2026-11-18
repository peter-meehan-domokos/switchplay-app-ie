import { ageOn, dublinToday, parseDateOfBirth } from "@/lib/age";
import { validateNewPassword } from "@/lib/accountCredentials";
import type { MathsCourse, MathsLevel } from "@/lib/puckleMemberships";
import { joinPrelaunchNotice, type JoinPrelaunchNotice } from "./joinPrelaunchNotice";
import {
  buildPreferencesLayout, buildPreferencesPayload, initialPreferencesState, validatePreferencesState, withAnswer, withAudienceChange, withChannel, withoutEmailChannel,
  type PreferenceField, type PreferencesErrorKey, type PreferencesLayout, type PreferencesState,
} from "./communicationPreferencesLayout";
import type { Answer } from "./communicationPreferences";
import { COURSE_LEVELS, EMAIL_PATTERN, normaliseMobile } from "./membershipRegistration";

/**
 * Presentational pipeline for the Join form: raw state -> read-only layout. Components render the
 * layout and send interactions back through the pure `with*` helpers; they never patch a layout.
 * Everything here is immutable and free of browser APIs, so the server and tests can run it.
 */
export type JoinChoice = "student" | "teacher" | "interest";
export const JOIN_CHOICES: readonly JoinChoice[] = ["student", "teacher", "interest"];
export const JOIN_HEADING = "Join Puckle.";
export const DEFAULT_PHONE_REGION = "IE";
export const MINIMUM_AGE = 13;
export const RESEND_COOLDOWN_SECONDS = 60;
export const TEACHER_INTRODUCTION_LABEL = "Tell us a little about yourself and how you'd like to use Puckle.";
export const INTEREST_INTRO = "Interested in Puckle? Leave your details and we'll send you occasional updates as it develops.";

export type JoinFormState = Readonly<{
  choice: JoinChoice; noEmail: boolean;
  name: string; username: string; email: string; password: string; showPassword: boolean;
  mobile: string; phoneCountryCode: string;
  dobDay: string; dobMonth: string; dobYear: string;
  course: MathsCourse | ""; courseOther: string; level: MathsLevel | ""; levelOther: string;
  teacherIntroduction: string; reason: string; message: string; companyWebsite: string;
  /** Communication choices. Every answer starts unanswered. */
  preferences: PreferencesState;
}>;
export type JoinOutcome =
  | { kind: "account"; category: "student" | "teacher"; signedIn: boolean }
  | { kind: "contact-request"; category: "student" | "teacher" }
  | { kind: "interest"; byEmail: boolean; manageLink?: string };
export type JoinFlowState = Readonly<{
  stage: "details" | "code" | "done";
  binding: { challengeId: string; flowToken: string } | null;
  codeEmail: string | null; codeSentAt: number | null;
  proof: { proof: string; email: string } | null;
  code: string; outcome: JoinOutcome | null;
}>;
export type JoinFieldKey = "name" | "username" | "email" | "password" | "mobile" | "contact" | "dob" | "course" | "courseOther"
  | "level" | "levelOther" | "teacherIntroduction" | "reason" | "message" | "code" | PreferencesErrorKey;
export type JoinErrors = Readonly<Partial<Record<JoinFieldKey, string>>>;

export const initialJoinFormState: JoinFormState = {
  choice: "student", noEmail: false, name: "", username: "", email: "", password: "", showPassword: false,
  mobile: "", phoneCountryCode: DEFAULT_PHONE_REGION, dobDay: "", dobMonth: "", dobYear: "",
  course: "", courseOther: "", level: "", levelOther: "", teacherIntroduction: "", reason: "", message: "", companyWebsite: "", preferences: initialPreferencesState,
};
export const initialJoinFlowState: JoinFlowState = { stage: "details", binding: null, codeEmail: null, codeSentAt: null, proof: null, code: "", outcome: null };

// ---- state transitions -------------------------------------------------------------------------
const credentialsCleared = { username: "", password: "", showPassword: false } as const;
/** Common details survive moving between choices; credentials never travel into a contact-only choice. */
export const withChoice = (state: JoinFormState, choice: JoinChoice): JoinFormState =>
  choice === state.choice ? state : { ...state, choice, preferences: withAudienceChange(state.preferences, choice), ...(choice === "interest" ? credentialsCleared : {}) };
/** The no-email route has no credential controls: they are cleared, never merely hidden. */
export const withNoEmail = (state: JoinFormState, noEmail: boolean): JoinFormState =>
  noEmail === state.noEmail ? state : noEmail ? { ...state, noEmail, email: "", preferences: withoutEmailChannel(state.preferences), ...credentialsCleared } : { ...state, noEmail };
export const withText = <K extends "name" | "username" | "email" | "password" | "dobDay" | "dobMonth" | "dobYear" | "courseOther" | "levelOther"
  | "teacherIntroduction" | "reason" | "message" | "companyWebsite" | "phoneCountryCode">(state: JoinFormState, key: K, value: string): JoinFormState =>
  ({ ...state, [key]: value });
export const withMobile = (state: JoinFormState, mobile: string): JoinFormState => ({ ...state, mobile });
export const withPreferenceAnswer = (state: JoinFormState, field: PreferenceField, value: Answer): JoinFormState =>
  ({ ...state, preferences: withAnswer(state.preferences, state.choice, field, value) });
export const withPreferenceChannel = (state: JoinFormState, channel: "email" | "sms", checked: boolean): JoinFormState =>
  ({ ...state, preferences: withChannel(state.preferences, channel, checked) });
export const withShowPassword = (state: JoinFormState, showPassword: boolean): JoinFormState => ({ ...state, showPassword });
/** Changing course clears every incompatible level answer and its custom text. */
export const withCourse = (state: JoinFormState, course: MathsCourse | ""): JoinFormState =>
  course === state.course ? state : { ...state, course, courseOther: "", level: "", levelOther: "" };
export const withLevel = (state: JoinFormState, level: MathsLevel | ""): JoinFormState =>
  ({ ...state, level, levelOther: level === "other" ? state.levelOther : "" });

export const withoutErrors = (errors: JoinErrors, keys: readonly JoinFieldKey[]): JoinErrors =>
  Object.fromEntries(Object.entries(errors).filter(([key]) => !keys.includes(key as JoinFieldKey)));
export const normalisedEmail = (state: JoinFormState) => state.email.trim().toLowerCase();
export const proofIsCurrent = (state: JoinFormState, flow: JoinFlowState) => !!flow.proof && flow.proof.email === normalisedEmail(state);
export const codeIsCurrent = (state: JoinFormState, flow: JoinFlowState) => !!flow.binding && flow.codeEmail === normalisedEmail(state);
export const withCodeSent = (flow: JoinFlowState, binding: { challengeId: string; flowToken: string }, email: string, at: number): JoinFlowState =>
  ({ ...flow, stage: "code", binding, codeEmail: email, codeSentAt: at, code: "", proof: null });
export const withVerifiedProof = (flow: JoinFlowState, proof: string, email: string): JoinFlowState => ({ ...flow, proof: { proof, email } });
export const withStage = (flow: JoinFlowState, stage: JoinFlowState["stage"]): JoinFlowState => ({ ...flow, stage });
export const withCode = (flow: JoinFlowState, code: string): JoinFlowState => ({ ...flow, code: code.replace(/\D/g, "").slice(0, 6) });
export const withoutProof = (flow: JoinFlowState): JoinFlowState => ({ ...flow, proof: null, binding: null, codeEmail: null, codeSentAt: null, code: "" });
export const withOutcome = (flow: JoinFlowState, outcome: JoinOutcome): JoinFlowState => ({ ...flow, stage: "done", outcome });

// ---- date of birth ------------------------------------------------------------------------------
export type DobStatus =
  | { kind: "missing" } | { kind: "invalid" } | { kind: "future" } | { kind: "under-minimum" }
  | { kind: "valid"; value: string; age: number };
export function dobStatus(state: JoinFormState, today = dublinToday()): DobStatus {
  const parts = [state.dobDay.trim(), state.dobMonth.trim(), state.dobYear.trim()];
  if (parts.every(part => !part)) return { kind: "missing" };
  if (parts.some(part => !part) || !/^\d{1,2}$/.test(parts[0]) || !/^\d{1,2}$/.test(parts[1]) || !/^\d{4}$/.test(parts[2])) return { kind: "invalid" };
  try {
    const value = parseDateOfBirth(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`);
    if (value > today) return { kind: "future" };
    const age = ageOn(value, today);
    return age < MINIMUM_AGE ? { kind: "under-minimum" } : { kind: "valid", value, age };
  } catch { return { kind: "invalid" }; }
}

// ---- validation (client mirror of the authoritative server validators) --------------------------
export const FIELD_MESSAGES = {
  name: "Enter your name.", username: "Choose a username of 3–30 letters, numbers, underscores or hyphens.",
  email: "Enter a valid email address.", emailRequired: "Enter your email address.",
  password: "Use at least 12 characters. A password can be at most 72 bytes, so very long passwords or many emoji may not fit.",
  mobile: "Enter a valid mobile number.", mobileRequired: "Enter a mobile number so we can contact you.",
  contact: "Enter an email address or a mobile number.", dobMissing: "Enter your date of birth.", dobInvalid: "Enter a real date of birth as day, month and year.",
  underMinimum: "You need to be at least 13 to join Puckle.", course: "Choose your maths course.", courseOther: "Tell us which course.",
  level: "Choose your level.", levelOther: "Tell us which level.", reason: "Tell us what brings you to Puckle.",
  code: "Enter the 6-digit code from your email.",
} as const;
const mobileProblem = (state: JoinFormState): string | null => {
  const required = state.noEmail;
  if (!state.mobile.trim()) return required ? FIELD_MESSAGES.mobileRequired : null;
  try { return normaliseMobile(state.mobile, state.phoneCountryCode) ? null : FIELD_MESSAGES.mobile; } catch { return FIELD_MESSAGES.mobile; }
};
const usernameOk = (value: string) => /^[A-Za-z0-9_-]{3,30}$/.test(value.trim());
const passwordOk = (value: string) => { try { validateNewPassword(value); return true; } catch { return false; } };
const educationErrors = (state: JoinFormState): JoinErrors => {
  const aLevel = state.course === "a-level";
  return {
    ...(!state.course ? { course: FIELD_MESSAGES.course } : {}),
    ...(state.course === "other" && !state.courseOther.trim() ? { courseOther: FIELD_MESSAGES.courseOther } : {}),
    ...(state.course && !aLevel && !state.level ? { level: FIELD_MESSAGES.level } : {}),
    ...(!aLevel && state.level === "other" && !state.levelOther.trim() ? { levelOther: FIELD_MESSAGES.levelOther } : {}),
  };
};
/** What the rest of the form offers a delivery channel: Email needs a valid address, Text needs a valid mobile. */
const preferenceContacts = (state: JoinFormState) => ({
  emailAvailable: !state.noEmail,
  hasEmail: !state.noEmail && EMAIL_PATTERN.test(state.email.trim().toLowerCase()),
  hasMobile: !!state.mobile.trim() && mobileProblem(state) === null,
});
export function validateJoinForm(state: JoinFormState, today = dublinToday()): JoinErrors {
  const mobile = mobileProblem(state);
  const email = state.email.trim();
  const dob = state.choice === "student" ? dobStatus(state, today) : null;
  const dobMessage = !dob || dob.kind === "valid" ? null
    : dob.kind === "missing" ? FIELD_MESSAGES.dobMissing : dob.kind === "under-minimum" ? FIELD_MESSAGES.underMinimum : FIELD_MESSAGES.dobInvalid;
  const emailRoute = !state.noEmail;
  const accountChoice = state.choice !== "interest";
  const errors: JoinErrors = {
    ...(!state.name.trim() ? { name: FIELD_MESSAGES.name } : {}),
    ...(accountChoice && emailRoute && !email ? { email: FIELD_MESSAGES.emailRequired } : {}),
    ...(emailRoute && email && !EMAIL_PATTERN.test(email.toLowerCase()) ? { email: FIELD_MESSAGES.email } : {}),
    ...(accountChoice && emailRoute && !usernameOk(state.username) ? { username: FIELD_MESSAGES.username } : {}),
    ...(accountChoice && emailRoute && !passwordOk(state.password) ? { password: FIELD_MESSAGES.password } : {}),
    ...(mobile ? { mobile } : {}),
    ...(state.choice === "interest" && emailRoute && !email && !state.mobile.trim() ? { contact: FIELD_MESSAGES.contact } : {}),
    ...(dobMessage ? { dob: dobMessage } : {}),
    ...(state.choice === "student" ? educationErrors(state) : {}),
    ...validatePreferencesState(state.preferences, state.choice, preferenceContacts(state)),
  };
  return errors;
}
const SERVER_CODE_FIELD: Readonly<Record<string, JoinFieldKey>> = {
  INVALID_USERNAME: "username", INVALID_NEW_PASSWORD: "password", INVALID_EMAIL: "email", EMAIL_REQUIRED: "email",
  INVALID_MOBILE: "mobile", NO_EMAIL_REQUIRES_MOBILE: "mobile", CONTACT_REQUIRED: "contact", INVALID_TEXT: "name",
  MINIMUM_AGE_13: "dob", INVALID_DATE_OF_BIRTH: "dob", FUTURE_DATE_OF_BIRTH: "dob",
  INVALID_COURSE: "course", INVALID_LEVEL: "level", INVALID_LEVEL_TEXT: "levelOther",
  PREFERENCES_INCOMPLETE: "puckleUpdates", PREFERENCES_INVALID: "puckleUpdates", CHANNELS_WITHOUT_CONSENT: "puckleUpdates",
  CHANNEL_REQUIRED: "channels", EMAIL_CHANNEL_NEEDS_EMAIL: "channels", SMS_CHANNEL_NEEDS_MOBILE: "channels",
};
/** Maps an authoritative server rejection onto the field the person can correct; null means a form-level message. */
export function errorsFromServerCode(code: string): JoinErrors | null {
  const field = SERVER_CODE_FIELD[code];
  if (!field) return null;
  const messages: Partial<Record<JoinFieldKey, string>> = {
    username: FIELD_MESSAGES.username, password: FIELD_MESSAGES.password, email: FIELD_MESSAGES.email, mobile: FIELD_MESSAGES.mobile,
    contact: FIELD_MESSAGES.contact, name: FIELD_MESSAGES.name, dob: code === "MINIMUM_AGE_13" ? FIELD_MESSAGES.underMinimum : FIELD_MESSAGES.dobInvalid,
    course: FIELD_MESSAGES.course, level: FIELD_MESSAGES.level, levelOther: FIELD_MESSAGES.levelOther,
    puckleUpdates: "Choose Yes or No for each option.", channels: code === "CHANNEL_REQUIRED" ? "Choose email, text message or both." : code === "EMAIL_CHANNEL_NEEDS_EMAIL" ? "Add your email address above to receive emails, or untick Email." : "Add a valid mobile number above to receive text messages, or untick Text message.",
  };
  return { [field]: messages[field] ?? "Check this field." };
}

// ---- request payloads ----------------------------------------------------------------------------
const education = (state: JoinFormState) => ({
  course: state.course, courseOther: state.course === "other" ? state.courseOther.trim() : "",
  level: state.course === "a-level" ? null : state.level, levelOther: state.course !== "a-level" && state.level === "other" ? state.levelOther.trim() : "",
});
/** Only the active choice's fields are ever submitted. */
export function buildRegistrationDetails(state: JoinFormState, today = dublinToday()) {
  const common = { name: state.name.trim(), email: state.noEmail ? "" : state.email.trim(), mobile: state.mobile.trim(), phoneCountryCode: state.phoneCountryCode,
    communicationPreferences: buildPreferencesPayload(state.preferences, state.choice) };
  const dob = dobStatus(state, today);
  return state.choice === "student"
    ? { registrationCategory: "student", ...common, dateOfBirth: dob.kind === "valid" ? dob.value : "", education: education(state) }
    : { registrationCategory: "teacher", ...common, teacherIntroduction: state.teacherIntroduction.trim() };
}
export const buildAccountPayload = (state: JoinFormState, flow: JoinFlowState) => ({
  details: buildRegistrationDetails(state), username: state.username.trim(), password: state.password,
  challengeId: flow.binding?.challengeId, flowToken: flow.binding?.flowToken, proof: flow.proof?.proof,
});
export const buildContactPayload = (state: JoinFormState) => ({ details: buildRegistrationDetails(state), companyWebsite: state.companyWebsite });
export const buildInterestPayload = (state: JoinFormState) => ({
  details: { name: state.name.trim(), email: state.noEmail ? "" : state.email.trim(), mobile: state.mobile.trim(), phoneCountryCode: state.phoneCountryCode,
    reason: state.reason.trim(), message: "", communicationPreferences: buildPreferencesPayload(state.preferences, "interest") },
  companyWebsite: state.companyWebsite,
});

// ---- the layout ---------------------------------------------------------------------------------
export const COURSE_OPTIONS: readonly { value: MathsCourse; label: string }[] = [
  { value: "leaving-cert", label: "Leaving Cert maths" }, { value: "junior-cycle", label: "Junior Cycle maths" },
  { value: "gcse", label: "GCSE maths" }, { value: "a-level", label: "A-level maths" },
  { value: "other", label: "Other" }, { value: "dont-know", label: "Don't know" },
];
const LEVEL_LABELS: Readonly<Record<MathsLevel, string>> = {
  higher: "Higher", ordinary: "Ordinary", foundation: "Foundation", "higher-tier": "Higher tier", "foundation-tier": "Foundation tier", other: "Other", "dont-know": "Don't know",
};
export type SubmissionKind = "send-code" | "resume-code" | "create-account" | "verify-code" | "contact-request" | "interest";
export type FieldView = Readonly<{ visible: boolean; required: boolean; label: string; hint?: string; error?: string }>;
export type MembershipJoinLayout = Readonly<{
  heading: string;
  choices: readonly { id: JoinChoice; label: string; selected: boolean }[];
  /** Null while the pre-launch student introduction replaces it. */
  intro: string | null;
  /** Pre-launch wording above the student and teacher forms; null outside pre-launch mode and for the interest choice. */
  prelaunchNotice: JoinPrelaunchNotice | null;
  stage: JoinFlowState["stage"];
  name: FieldView; username: FieldView; email: FieldView; password: FieldView & { inputType: "text" | "password" };
  mobile: FieldView; contactError?: string;
  emailRouteToggle: Readonly<{ visible: boolean; label: string; description: string | null }>;
  student: Readonly<{ visible: boolean; dob: FieldView; ageNotice: string | null; course: FieldView; courseOther: FieldView;
    level: FieldView & { disabled: boolean; placeholder: string }; levelOther: FieldView; courseOptions: typeof COURSE_OPTIONS;
    levelOptions: readonly { value: MathsLevel; label: string }[] }>;
  teacher: Readonly<{ visible: boolean; introduction: FieldView }>;
  interest: Readonly<{ visible: boolean; reason: FieldView; mobileOnlyNote: string | null }>;
  preferences: PreferencesLayout;
  code: Readonly<{ visible: boolean; email: string; field: FieldView; canResend: boolean; resendInSeconds: number }>;
  submission: Readonly<{ kind: SubmissionKind; label: string; busyLabel: string; notice: string | null }>;
}>;
const field = (label: string, visible: boolean, required: boolean, error?: string, hint?: string): FieldView => ({ label, visible, required, ...(hint ? { hint } : {}), ...(error ? { error } : {}) });
const CHOICE_LABELS: Readonly<Record<JoinChoice, string>> = { student: "I'm here to learn", teacher: "I'm a teacher", interest: "I'm interested in Puckle" };
const INTROS: Readonly<Record<JoinChoice, string>> = {
  student: "Join free to learn maths with Puckle's cards and keep track of your progress.",
  teacher: "Teachers are welcome to explore Puckle and help shape it. You'll get an ordinary account to try things out.",
  interest: INTEREST_INTRO,
};
export function ageNoticeFor(status: DobStatus): string | null {
  if (status.kind !== "valid" || status.age >= 16) return null;
  return "You're good to go! You can start learning privately on Puckle now. Some group features will need a parent or guardian's approval.";
}
export function buildMembershipJoinLayout(state: JoinFormState, flow: JoinFlowState, errors: JoinErrors = {}, nowMs = 0, today = dublinToday(), prelaunch = false): MembershipJoinLayout {
  const { choice, noEmail } = state;
  const isStudent = choice === "student", isTeacher = choice === "teacher", isInterest = choice === "interest";
  const emailRoute = !noEmail;
  const accountRoute = !isInterest && emailRoute;
  const dob = isStudent ? dobStatus(state, today) : { kind: "missing" as const };
  const proofReady = accountRoute && proofIsCurrent(state, flow);
  const codeStage = accountRoute && flow.stage === "code";
  const aLevel = state.course === "a-level";
  const levelOptions = state.course ? COURSE_LEVELS[state.course].map(value => ({ value, label: LEVEL_LABELS[value] })) : [];
  const resendInSeconds = flow.codeSentAt === null ? 0 : Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - (nowMs - flow.codeSentAt) / 1000));
  const codePending = accountRoute && !codeStage && !proofReady && codeIsCurrent(state, flow);
  const submissionKind: SubmissionKind = isInterest ? "interest" : noEmail ? "contact-request" : codeStage ? "verify-code" : proofReady ? "create-account" : codePending ? "resume-code" : "send-code";
  const submission = {
    interest: { label: "Keep me updated", busyLabel: "Sending…", notice: noEmail ? "No account will be created. We'll use your mobile number to follow up on this request, and for any text messages you choose above." : "No account will be created. You can change or withdraw your choices at any time." },
    "contact-request": { label: "Send my details", busyLabel: "Sending…", notice: "No account will be created. We'll use your mobile number to contact you about next steps." },
    "send-code": { label: "Email me a verification code", busyLabel: "Sending code…", notice: "We'll email a 6-digit code to confirm your address, then create your account." },
    "resume-code": { label: "Enter my verification code", busyLabel: "One moment…", notice: "We've already emailed you a code." },
    "verify-code": { label: "Verify and create my account", busyLabel: "Creating your account…", notice: null },
    "create-account": { label: "Create my account", busyLabel: "Creating your account…", notice: "Your email is verified." },
  }[submissionKind];
  const emailLabel = isInterest ? "Email (optional if you give a mobile number)" : "Email";
  return {
    heading: JOIN_HEADING,
    choices: JOIN_CHOICES.map(id => ({ id, label: CHOICE_LABELS[id], selected: id === choice })),
    intro: prelaunch && choice === "student" ? null : INTROS[choice],
    prelaunchNotice: prelaunch ? joinPrelaunchNotice(choice) : null,
    stage: flow.stage,
    name: field(isStudent ? "First name" : "Your name", true, true, errors.name),
    username: field("Choose a username", accountRoute, true, errors.username, "3–30 letters, numbers, underscores or hyphens. Case matters."),
    email: field(emailLabel, emailRoute, !isInterest, errors.email),
    password: { ...field("Choose a password", accountRoute, true, errors.password, "At least 12 characters."), inputType: state.showPassword ? "text" : "password" },
    mobile: field(noEmail ? "Mobile number" : "Mobile number (optional)", true, noEmail, errors.mobile,
      noEmail ? "We'll contact you on this number. It isn't used to sign in." : "Not used to sign in. We may use it to follow up on your request."),
    ...(errors.contact ? { contactError: errors.contact } : {}),
    emailRouteToggle: { visible: !codeStage, label: noEmail ? "I do have an email address" : "Don't have an email address?",
      description: noEmail ? (isInterest ? "Mobile-only: we'll contact you on your number." : "You're sending a mobile-only request. No account will be created.") : null },
    student: {
      visible: isStudent,
      dob: field("Date of birth", isStudent, true, errors.dob, "Day, month and year."),
      ageNotice: ageNoticeFor(dob),
      course: field("Which maths course are you studying?", isStudent, true, errors.course),
      courseOther: field("Which course?", isStudent && state.course === "other", true, errors.courseOther),
      level: { ...field("Level", isStudent && !!state.course && !aLevel, !aLevel, errors.level), disabled: aLevel, placeholder: "Choose your level" },
      levelOther: field("Which level?", isStudent && !aLevel && state.level === "other", true, errors.levelOther),
      courseOptions: COURSE_OPTIONS, levelOptions,
    },
    teacher: { visible: isTeacher, introduction: field(TEACHER_INTRODUCTION_LABEL, isTeacher, false, errors.teacherIntroduction) },
    interest: {
      visible: isInterest,
      reason: field("What brings you to Puckle? (optional)", isInterest, false, errors.reason, "For example: parent, teacher, student or just curious."),
      mobileOnlyNote: isInterest && noEmail ? "We'll use your number to follow up on your request, and for any text messages you choose below." : null,
    },
    preferences: buildPreferencesLayout(state.preferences, choice, errors, { emailAvailable: emailRoute }),
    code: { visible: codeStage, email: flow.codeEmail ?? "", field: field("Verification code", codeStage, true, errors.code, "The 6-digit code we emailed you. It expires in 10 minutes."),
      canResend: resendInSeconds === 0, resendInSeconds },
    submission: { kind: submissionKind, ...submission },
  };
}
