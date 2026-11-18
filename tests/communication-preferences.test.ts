import assert from "node:assert/strict";
import { test } from "node:test";
import { describePreferences, isOptedIn, preferenceKeysFor, validateCommunicationPreferences } from "../src/app/sites/puckle/lib/communicationPreferences";
import {
  buildPreferencesLayout, buildPreferencesPayload, initialPreferencesState, preferencesStateFrom, validatePreferencesState, withAllNo, withAnswer, withAudienceChange, withChannel, withUpdatesAnswer, withoutEmailChannel,
} from "../src/app/sites/puckle/lib/communicationPreferencesLayout";
import { buildMembershipJoinLayout, buildRegistrationDetails, initialJoinFlowState, initialJoinFormState, validateJoinForm, withChoice, withNoEmail, withPreferenceAnswer, withPreferenceChannel, withText } from "../src/app/sites/puckle/lib/membershipJoinLayout";
import { validateInterestContact, validateRegistrationDetails } from "../src/app/sites/puckle/lib/membershipRegistration";

const NOW = new Date("2026-11-18T12:00:00Z");
const both = { email: "a@example.com", mobile: "+353871234567" };
const answers = (audience: "student" | "teacher" | "interest", value: "yes" | "no") => Object.fromEntries(preferenceKeysFor(audience).map(key => [key, value]));
const payload = (audience: "student" | "teacher" | "interest", value: "yes" | "no", channels = { email: false, sms: false }) => ({ answers: answers(audience, value), channels });
const rowsOf = (audience: "student" | "teacher" | "interest") => buildPreferencesLayout(initialPreferencesState, audience, {}, { emailAvailable: true }).rows.map(row => [row.title, row.text]);

test("each audience sees the approved titles and supporting lines, in order", () => {
  const shared = [
    ["Puckle Updates", "A fortnightly roundup of new maths content and activities."],
    ["News and offers", "Major new features, special offers and promotions."],
    ["Occasional personal contact", "We may get in touch to offer help or ask for feedback."],
  ];
  assert.deepEqual(rowsOf("student"), [...shared, ["Guided maths invitations", "Invitations to join teacher-led maths activities and revision groups."]]);
  assert.deepEqual(rowsOf("teacher"), [...shared, ["Teacher collaboration invitations", "Invitations to explore teaching ideas, share resources and collaborate"]]);
  assert.deepEqual(rowsOf("interest"), shared);
});
test("nothing is preselected and the layout heading is the approved one", () => {
  const layout = buildPreferencesLayout(initialPreferencesState, "student", {}, { emailAvailable: true });
  assert.equal(layout.heading, "Stay in touch with Puckle");
  assert.ok(layout.rows.every(row => row.value === ""));
  assert.equal(layout.channels.visible, false);
});
test("the channel box appears for updates, news or the audience's invitations, never for personal contact alone", () => {
  const visible = (audience: "student" | "teacher" | "interest", field: Parameters<typeof withAnswer>[2]) =>
    buildPreferencesLayout(withAnswer(initialPreferencesState, audience, field, "yes"), audience, {}, { emailAvailable: true }).channels.visible;
  assert.equal(visible("student", "puckleUpdates"), true);
  assert.equal(visible("student", "newsAndOffers"), true);
  assert.equal(visible("student", "invitations"), true);
  assert.equal(visible("teacher", "invitations"), true);
  assert.equal(visible("student", "occasionalPersonalContact"), false);
  assert.equal(visible("interest", "invitations"), false, "interested parties have no invitations");
  const label = (audience: "student" | "interest") => buildPreferencesLayout(withAnswer(initialPreferencesState, audience, "puckleUpdates", "yes"), audience, {}, { emailAvailable: true }).channels.label;
  assert.equal(label("student"), "Receive updates and invitations by");
  assert.equal(label("interest"), "Receive updates by");
});
test("channels start unchecked, are independent, and are never kept without a broadcast Yes", () => {
  const on = withAnswer(initialPreferencesState, "student", "puckleUpdates", "yes");
  assert.deepEqual([on.email, on.sms], [false, false]);
  const checked = withChannel(withChannel(on, "email", true), "sms", true);
  assert.deepEqual([checked.email, checked.sms], [true, true]);
  const off = withAnswer(checked, "student", "puckleUpdates", "no");
  assert.deepEqual([off.email, off.sms], [false, false], "hidden channels cannot linger as consent");
  const personalOnly = withAnswer(withChannel(initialPreferencesState, "email", true), "student", "occasionalPersonalContact", "yes");
  assert.equal(personalOnly.email, false);
  assert.deepEqual(buildPreferencesPayload(withChannel(withAnswer(initialPreferencesState, "student", "occasionalPersonalContact", "yes"), "sms", true), "student").channels, { email: false, sms: false });
});
test("changing audience keeps the derived answers in step: students and teachers follow Puckle Updates, interested parties start clean", () => {
  const student = withUpdatesAnswer(initialPreferencesState, "student", "yes");
  const teacher = withAudienceChange(student, "teacher");
  assert.deepEqual([teacher.puckleUpdates, teacher.newsAndOffers, teacher.invitations], ["yes", "yes", "yes"]);
  const interest = withAudienceChange(student, "interest");
  assert.deepEqual([interest.puckleUpdates, interest.newsAndOffers, interest.invitations], ["yes", "", ""], "the interested-party answers are not carried over");
  assert.deepEqual([withAudienceChange(interest, "teacher").newsAndOffers, withAudienceChange(interest, "teacher").invitations], ["yes", "yes"]);
  assert.equal(withAudienceChange(withChannel(withUpdatesAnswer(initialPreferencesState, "student", "no"), "sms", true), "teacher").sms, false);
});
test("submission is blocked until every choice is answered; an all-No set is valid", () => {
  const found = validatePreferencesState(initialPreferencesState, "student", { emailAvailable: true, hasEmail: true, hasMobile: true });
  assert.deepEqual(Object.keys(found).sort(), ["invitations", "newsAndOffers", "occasionalPersonalContact", "puckleUpdates"]);
  assert.equal(found.puckleUpdates, "Choose Yes or No.");
  assert.deepEqual(Object.keys(validatePreferencesState(initialPreferencesState, "interest", { emailAvailable: true, hasEmail: true, hasMobile: true })).sort(), ["newsAndOffers", "occasionalPersonalContact", "puckleUpdates"]);
  const allNo = ["puckleUpdates", "newsAndOffers", "occasionalPersonalContact", "invitations"].reduce((state, field) => withAnswer(state, "student", field as "puckleUpdates", "no"), initialPreferencesState);
  assert.deepEqual(validatePreferencesState(allNo, "student", { emailAvailable: true, hasEmail: false, hasMobile: false }), {});
});
test("a required channel, a usable email and a valid mobile are enforced", () => {
  const yes = withAnswer(["newsAndOffers", "occasionalPersonalContact", "invitations"].reduce((state, field) => withAnswer(state, "student", field as "puckleUpdates", "no"), initialPreferencesState), "student", "puckleUpdates", "yes");
  const check = (state: typeof yes, contacts = { emailAvailable: true, hasEmail: true, hasMobile: true }) => validatePreferencesState(state, "student", contacts).channels;
  assert.equal(check(yes), "Choose email, text message or both.");
  assert.equal(check(withChannel(yes, "email", true)), undefined);
  assert.equal(check(withChannel(yes, "sms", true)), undefined);
  assert.equal(check(withChannel(withChannel(yes, "sms", true), "email", true)), undefined);
  assert.match(check(withChannel(yes, "sms", true), { emailAvailable: true, hasEmail: true, hasMobile: false })!, /valid mobile number/);
  assert.match(check(withChannel(yes, "email", true), { emailAvailable: true, hasEmail: false, hasMobile: true })!, /email address/);
});
test("the Join form wires the section: answers, hidden consent and the mobile-only route", () => {
  const layoutOf = (form: typeof initialJoinFormState) => buildMembershipJoinLayout(form, initialJoinFlowState);
  const student = withPreferenceChannel(withPreferenceAnswer(initialJoinFormState, "puckleUpdates", "yes"), "email", true);
  assert.equal(layoutOf(student).preferences.channels.email, true);
  assert.equal(validateJoinForm(student).channels, "Add your email address above to receive emails, or untick Email.");
  const withEmail = withText(student, "email", "a@example.com");
  assert.equal(validateJoinForm(withEmail).channels, undefined);
  const mobileOnly = withNoEmail(withEmail, true);
  assert.equal(mobileOnly.preferences.email, false, "no email address means no email channel");
  assert.equal(layoutOf(mobileOnly).preferences.channels.emailOffered, false);
  assert.deepEqual(layoutOf(withChoice(student, "teacher")).preferences.rows.map(row => row.title), ["Puckle Updates", "Occasional personal contact"], "students and teachers answer two questions");
  assert.equal(layoutOf(withChoice(student, "teacher")).preferences.rows[0].value, "yes", "Puckle Updates stays answered when the audience changes");
  assert.equal(layoutOf(withChoice(student, "interest")).preferences.rows.length, 3, "the interested-party form keeps its own three");
});
test("saved choices pre-populate an editing screen and unknown stays unanswered", () => {
  const stored = validateCommunicationPreferences({ answers: { ...answers("teacher", "yes"), occasionalPersonalContact: "no" }, channels: { email: true, sms: false } }, "teacher", both, "account-settings", NOW);
  const state = preferencesStateFrom(stored, "teacher");
  assert.deepEqual([state.puckleUpdates, state.occasionalPersonalContact, state.invitations, state.email, state.sms], ["yes", "no", "yes", true, false]);
  assert.deepEqual(preferencesStateFrom(null, "student"), initialPreferencesState);
  assert.equal(preferencesStateFrom(undefined, "student").puckleUpdates, "");
});

// ---- the authoritative server validator --------------------------------------------------------
test("the server stores explicit answers with provenance and rejects anything incomplete", () => {
  const stored = validateCommunicationPreferences(payload("student", "no"), "student", { email: null, mobile: null }, "join-form", NOW);
  assert.deepEqual(stored.answers, answers("student", "no"));
  assert.deepEqual([stored.source, stored.wordingVersion, stored.recordedAt, stored.channels], ["join-form", "puckle-communication-preferences-v2", NOW, { email: false, sms: false }]);
  for (const audience of ["student", "teacher", "interest"] as const) {
    assert.equal(Object.keys(validateCommunicationPreferences(payload(audience, "no"), audience, both, "x", NOW).answers).length, audience === "interest" ? 3 : 4);
    const missing = { ...answers(audience, "no") }; delete missing.puckleUpdates;
    assert.throws(() => validateCommunicationPreferences({ answers: missing, channels: { email: false, sms: false } }, audience, both, "x"), /PREFERENCES_INCOMPLETE/);
    assert.throws(() => validateCommunicationPreferences({ answers: { ...answers(audience, "no"), puckleUpdates: "" }, channels: { email: false, sms: false } }, audience, both, "x"), /PREFERENCES_INCOMPLETE/);
  }
  for (const bad of [undefined, null, "yes", [], {}, { answers: {} }, { channels: {} }]) assert.throws(() => validateCommunicationPreferences(bad, "student", both, "x"));
});
test("the server rejects fabricated, contradictory and wrong-audience payloads", () => {
  const reject = (value: unknown, audience: "student" | "teacher" | "interest", pattern: RegExp, contacts: { email: string | null; mobile: string | null } = both) => assert.throws(() => validateCommunicationPreferences(value, audience, contacts, "x"), pattern);
  reject({ ...payload("student", "no"), extra: true }, "student", /PREFERENCES_INVALID/);
  reject({ answers: { ...answers("student", "no"), mystery: "yes" }, channels: { email: false, sms: false } }, "student", /PREFERENCES_INVALID/);
  reject({ answers: answers("student", "no"), channels: { email: false, sms: false, whatsapp: true } }, "student", /PREFERENCES_INVALID/);
  reject({ answers: { ...answers("teacher", "no"), guidedMathsInvitations: "no" }, channels: { email: false, sms: false } }, "teacher", /PREFERENCES_INVALID/);
  reject({ answers: answers("student", "no"), channels: { email: false, sms: false } } , "teacher", /PREFERENCES_INVALID/);
  reject({ answers: { ...answers("interest", "no"), guidedMathsInvitations: "yes" }, channels: { email: false, sms: false } }, "interest", /PREFERENCES_INVALID/);
  reject({ answers: { ...answers("student", "no"), puckleUpdates: "maybe" }, channels: { email: false, sms: false } }, "student", /PREFERENCES_INVALID/);
  reject({ answers: { ...answers("student", "no"), puckleUpdates: true }, channels: { email: false, sms: false } }, "student", /PREFERENCES_INVALID/);
  reject({ answers: answers("student", "no"), channels: { email: "yes", sms: false } }, "student", /PREFERENCES_INVALID/);
  reject(payload("student", "no", { email: true, sms: false }), "student", /CHANNELS_WITHOUT_CONSENT/);
  reject({ answers: { ...answers("student", "no"), occasionalPersonalContact: "yes" }, channels: { email: false, sms: true } }, "student", /CHANNELS_WITHOUT_CONSENT/);
  reject(payload("student", "yes"), "student", /CHANNEL_REQUIRED/);
  reject(payload("student", "yes", { email: true, sms: false }), "student", /EMAIL_CHANNEL_NEEDS_EMAIL/, { email: null, mobile: "+353871234567" });
  reject(payload("student", "yes", { email: false, sms: true }), "student", /SMS_CHANNEL_NEEDS_MOBILE/, { email: "a@example.com", mobile: null });
  assert.equal(validateCommunicationPreferences(payload("student", "yes", { email: true, sms: true }), "student", both, "x").channels.sms, true);
});
test("registration, mobile-only contact and interest validators require the preferences", () => {
  const student = { registrationCategory: "student", name: "Sam", email: "sam@example.com", dateOfBirth: "2010-01-01", education: { course: "gcse", level: "higher-tier" } };
  assert.throws(() => validateRegistrationDetails(student, "email", "2026-11-18"), /PREFERENCES_INVALID/);
  assert.throws(() => validateRegistrationDetails({ ...student, communicationPreferences: payload("teacher", "no") }, "email", "2026-11-18"), /PREFERENCES_INVALID/);
  const ok = validateRegistrationDetails({ ...student, communicationPreferences: payload("student", "no") }, "email", "2026-11-18", NOW);
  assert.equal(ok.communicationPreferences.answers.guidedMathsInvitations, "no");
  assert.throws(() => validateRegistrationDetails({ ...student, mobile: "+353871234567", communicationPreferences: payload("student", "yes", { email: false, sms: false }) }, "email", "2026-11-18"), /CHANNEL_REQUIRED/);
  assert.throws(() => validateRegistrationDetails({ ...student, email: undefined, mobile: "+353871234567", communicationPreferences: payload("student", "yes", { email: true, sms: false }) }, "no-email", "2026-11-18"), /EMAIL_CHANNEL_NEEDS_EMAIL/);
  assert.throws(() => validateInterestContact({ name: "Pat", email: "p@example.com", reason: "" }), /PREFERENCES_INVALID/);
  assert.throws(() => validateInterestContact({ name: "Pat", email: "p@example.com", communicationPreferences: payload("interest", "yes", { email: false, sms: true }) }), /SMS_CHANNEL_NEEDS_MOBILE/);
  const interest = validateInterestContact({ name: "Pat", email: "p@example.com", communicationPreferences: payload("interest", "yes", { email: true, sms: false }) }, NOW);
  assert.equal(interest.communicationPreferences.source, "join-interest-form");
});

// ---- recipient filtering and founder summary ---------------------------------------------------
test("recipient filtering needs an explicit Yes and a selected channel; unknown, No and withdrawn never match", () => {
  const stored = validateCommunicationPreferences({ answers: { ...answers("student", "no"), puckleUpdates: "yes" }, channels: { email: true, sms: false } }, "student", both, "x", NOW);
  assert.equal(isOptedIn(stored, "puckleUpdates", "email"), true);
  assert.equal(isOptedIn(stored, "puckleUpdates", "sms"), false, "channel not selected");
  assert.equal(isOptedIn(stored, "newsAndOffers", "email"), false, "answered No");
  assert.equal(isOptedIn(stored, "puckleUpdates"), false, "a broadcast needs a channel");
  assert.equal(isOptedIn(undefined, "puckleUpdates", "email"), false, "unknown members are never opted in");
  assert.equal(isOptedIn(null, "occasionalPersonalContact"), false);
  const personal = validateCommunicationPreferences({ answers: { ...answers("student", "no"), occasionalPersonalContact: "yes" }, channels: { email: false, sms: false } }, "student", both, "x", NOW);
  assert.equal(isOptedIn(personal, "occasionalPersonalContact"), true);
  const withdrawn = validateCommunicationPreferences(payload("student", "no"), "student", both, "x", NOW);
  assert.equal(isOptedIn(withdrawn, "puckleUpdates", "email"), false);
});
test("the founder summary lists the choices and delivery channels", () => {
  const stored = validateCommunicationPreferences({ answers: { ...answers("interest", "no"), newsAndOffers: "yes" }, channels: { email: true, sms: true } }, "interest", both, "x", NOW);
  const text = describePreferences(stored);
  assert.match(text, /Puckle Updates: No/); assert.match(text, /News and offers: Yes/); assert.match(text, /Delivery: Email and Text message/);
  assert.match(describePreferences(undefined), /none recorded/);
  assert.match(describePreferences(validateCommunicationPreferences(payload("student", "no"), "student", both, "x", NOW)), /Delivery: none/);
});
test("state helpers never mutate", () => {
  const before = JSON.stringify(initialPreferencesState);
  withAnswer(initialPreferencesState, "student", "puckleUpdates", "yes"); withChannel(initialPreferencesState, "sms", true); withoutEmailChannel(initialPreferencesState);
  assert.equal(JSON.stringify(initialPreferencesState), before);
});
test("unsubscribe sets every choice for the audience to No and clears the channels", () => {
  const on = withChannel(withAnswer(withAnswer(initialPreferencesState, "teacher", "puckleUpdates", "yes"), "teacher", "invitations", "yes"), "email", true);
  const none = withAllNo(on, "teacher");
  assert.deepEqual([none.puckleUpdates, none.newsAndOffers, none.occasionalPersonalContact, none.invitations, none.email, none.sms], ["no", "no", "no", "no", false, false]);
  assert.deepEqual(validatePreferencesState(none, "teacher", { emailAvailable: true, hasEmail: true, hasMobile: false }), {});
  assert.equal(withAllNo(initialPreferencesState, "interest").invitations, "", "interested parties have no invitation choice");
  assert.equal(on.email, true, "the original state is untouched");
});

// ---- the two-question student and teacher registration --------------------------------------------
const joined = (choice: "student" | "teacher", updates: "yes" | "no" | "", personal: "yes" | "no" | "") => {
  let form = withChoice(initialJoinFormState, choice);
  if (updates) form = withPreferenceAnswer(form, "puckleUpdates", updates);
  if (personal) form = withPreferenceAnswer(form, "occasionalPersonalContact", personal);
  return form;
};
test("registration asks two questions with the approved wording, nothing preselected", () => {
  for (const [choice, text] of [["student", "Maths content, guided activities, news and occasional offers."], ["teacher", "Teaching resources, collaboration opportunities, news and occasional offers."]] as const) {
    const layout = buildMembershipJoinLayout(joined(choice, "", ""), initialJoinFlowState).preferences;
    assert.deepEqual(layout.rows.map(row => [row.field, row.title, row.text, row.value]), [
      ["puckleUpdates", "Puckle Updates", text, ""], ["occasionalPersonalContact", "Occasional personal contact", "We may get in touch to offer help or ask for feedback.", ""]]);
  }
});
test("both registration questions must be answered, and declining both is valid", () => {
  for (const choice of ["student", "teacher"] as const) {
    assert.deepEqual(Object.keys(validateJoinForm(joined(choice, "", ""))).filter(key => ["puckleUpdates", "newsAndOffers", "occasionalPersonalContact", "invitations"].includes(key)).sort(), ["occasionalPersonalContact", "puckleUpdates"]);
    assert.equal(validateJoinForm(joined(choice, "yes", "")).occasionalPersonalContact, "Choose Yes or No.");
    assert.equal(validateJoinForm(joined(choice, "", "no")).puckleUpdates, "Choose Yes or No.");
    const declined = validateJoinForm(joined(choice, "no", "no"));
    assert.equal(declined.puckleUpdates, undefined); assert.equal(declined.occasionalPersonalContact, undefined); assert.equal(declined.channels, undefined);
  }
});
test("Puckle Updates maps onto the three stored broadcast preferences, personal contact stays independent", () => {
  const stored = (choice: "student" | "teacher", updates: "yes" | "no", personal: "yes" | "no", email = false) => {
    const base = withText(withText(joined(choice, updates, personal), "name", "Ada"), "email", "a@example.com");
    const details = buildRegistrationDetails(email ? withPreferenceChannel(base, "email", true) : base);
    // The same request body the browser sends, through the unchanged server validator.
    const body = { ...details, ...(choice === "student" ? { dateOfBirth: "2010-05-01", education: { course: "gcse", courseOther: "", level: "higher-tier", levelOther: "" } } : {}) };
    return validateRegistrationDetails(body, "email", "2026-11-18", NOW).communicationPreferences.answers;
  };
  for (const choice of ["student", "teacher"] as const) {
    const invitation = choice === "student" ? "guidedMathsInvitations" : "teacherCollaborationInvitations";
    assert.deepEqual(stored(choice, "yes", "yes", true), { puckleUpdates: "yes", newsAndOffers: "yes", [invitation]: "yes", occasionalPersonalContact: "yes" }, "all Yes");
    assert.deepEqual(stored(choice, "no", "no"), { puckleUpdates: "no", newsAndOffers: "no", [invitation]: "no", occasionalPersonalContact: "no" }, "all No");
    assert.deepEqual(stored(choice, "yes", "no", true), { puckleUpdates: "yes", newsAndOffers: "yes", [invitation]: "yes", occasionalPersonalContact: "no" }, "updates only");
    assert.deepEqual(stored(choice, "no", "yes"), { puckleUpdates: "no", newsAndOffers: "no", [invitation]: "no", occasionalPersonalContact: "yes" }, "personal contact only");
  }
});
test("changing Puckle Updates changes all three together and removes a channel that no longer applies", () => {
  const on = withPreferenceChannel(joined("student", "yes", "no"), "sms", true);
  assert.equal(on.preferences.sms, true);
  const off = withPreferenceAnswer(on, "puckleUpdates", "no");
  assert.deepEqual([off.preferences.puckleUpdates, off.preferences.newsAndOffers, off.preferences.invitations, off.preferences.sms], ["no", "no", "no", false]);
  assert.equal(buildMembershipJoinLayout(joined("student", "no", "yes"), initialJoinFlowState).preferences.channels.visible, false, "personal contact alone needs no delivery channel");
});

// ---- Settings: the same four stored preferences, presented in groups ---------------------------------
test("Settings groups the three update preferences under Puckle Updates and keeps personal contact apart", () => {
  const stored = { answers: { puckleUpdates: "yes", newsAndOffers: "no", occasionalPersonalContact: "yes", guidedMathsInvitations: "no" }, channels: { email: true, sms: false } } as const;
  const layoutFor = (audience: "student" | "teacher") => buildPreferencesLayout(preferencesStateFrom(audience === "student" ? stored : { ...stored, answers: { puckleUpdates: "yes", newsAndOffers: "no", occasionalPersonalContact: "yes", teacherCollaborationInvitations: "no" } }, audience), audience, {}, { emailAvailable: true }, "settings");
  const student = layoutFor("student");
  assert.deepEqual(student.groups!.map(group => [group.id, group.title, group.rows.map(row => row.title)]), [
    ["updates", "Puckle Updates", ["New maths content", "News and offers", "Guided maths invitations"]], ["personal", "Personal contact", ["Occasional personal contact"]]]);
  assert.equal(student.groups![0].text, "Choose which updates and invitations you would like to receive.");
  assert.deepEqual(student.groups![0].rows.map(row => row.text), ["A fortnightly roundup of new lessons, interactive activities and revision materials.", "Major new features, special offers and promotions.", "Invitations to teacher-led maths activities and revision groups."]);
  assert.equal(student.groups![0].channels!.visible, true, "the delivery choice sits under Puckle Updates");
  assert.equal(student.groups![1].channels, undefined);
  assert.equal(layoutFor("teacher").groups![0].rows[2].title, "Teacher collaboration invitations");
  assert.equal(layoutFor("teacher").groups![0].rows[2].text, "Invitations to explore teaching ideas, share resources and collaborate with other teachers.");
  assert.deepEqual(student.groups!.flatMap(group => group.rows.map(row => row.value)), ["yes", "no", "no", "yes"], "saved answers pre-populate each row independently");
});
test("Settings edits each preference independently and a saved set round trips unchanged", () => {
  const stored = validateCommunicationPreferences({ answers: { puckleUpdates: "no", newsAndOffers: "yes", occasionalPersonalContact: "no", guidedMathsInvitations: "no" }, channels: { email: true, sms: false } }, "student", both, "account-settings", NOW);
  const state = preferencesStateFrom(stored, "student");
  assert.deepEqual(buildPreferencesPayload(state, "student").answers, stored.answers, "mixed legacy answers load and save as they were");
  const changed = withAnswer(state, "student", "invitations", "yes");
  assert.deepEqual(buildPreferencesPayload(changed, "student").answers, { ...stored.answers, guidedMathsInvitations: "yes" }, "one preference changes alone");
  assert.deepEqual(validatePreferencesState(changed, "student", { emailAvailable: true, hasEmail: true, hasMobile: false }, "settings"), {});
  assert.deepEqual(Object.keys(validatePreferencesState(initialPreferencesState, "student", { emailAvailable: true, hasEmail: true, hasMobile: false }, "settings")).sort(), ["invitations", "newsAndOffers", "occasionalPersonalContact", "puckleUpdates"]);
});
