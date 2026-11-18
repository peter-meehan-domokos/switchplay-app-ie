/**
 * Puckle communication preferences: the approved wording, the stored shape and the authoritative validator.
 * Browser-safe and free of I/O. "Unanswered" is the absence of an answer, never an implied Yes or No.
 */
export type PreferencesAudience = "student" | "teacher" | "interest";
export type Answer = "yes" | "no";
export type PreferenceKey = "puckleUpdates" | "newsAndOffers" | "occasionalPersonalContact" | "guidedMathsInvitations" | "teacherCollaborationInvitations";
export type Channel = "email" | "sms";
export type StoredPreferences = {
  answers: Partial<Record<PreferenceKey, Answer>>;
  channels: { email: boolean; sms: boolean };
  source: string; wordingVersion: string; recordedAt: Date;
};

/** v2: the student and teacher form asks two questions, one of which covers three stored preferences. Earlier records keep v1. */
export const PREFERENCES_WORDING_VERSION = "puckle-communication-preferences-v2";
export const PREFERENCES_HEADING = "Stay in touch with Puckle";

export const PREFERENCE_ITEMS: Readonly<Record<PreferenceKey, Readonly<{ title: string; text: string }>>> = {
  puckleUpdates: { title: "Puckle Updates", text: "A fortnightly roundup of new maths content and activities." },
  newsAndOffers: { title: "News and offers", text: "Major new features, special offers and promotions." },
  occasionalPersonalContact: { title: "Occasional personal contact", text: "We may get in touch to offer help or ask for feedback." },
  guidedMathsInvitations: {
    title: "Group Experiences invitations",
    text: "Invitations to Group Experiences: teacher-led maths activities you complete at your own pace, as part of a group.",
  },
  teacherCollaborationInvitations: {
    title: "Teacher collaboration invitations",
    text: "Invitations to explore teaching ideas, share resources and collaborate",
  },
};

/**
 * Presentation only. The initial student and teacher registration asks two questions, and Puckle Updates answers the three
 * broadcast preferences together. Settings shows the same stored preferences individually, grouped under Puckle Updates.
 */
export const REGISTRATION_UPDATES_TEXT: Readonly<Record<"student" | "teacher", string>> = {
  student: "Maths content, group invites and occasional offers",
  teacher: "Teaching resources, collaboration opportunities, news and occasional offers.",
};
export const SETTINGS_HEADING = "Communication preferences";
export const SETTINGS_GROUPS = {
  updates: { title: "Puckle Updates", text: "Choose which updates and invitations you would like to receive." },
  personal: { title: "Personal contact", text: "" },
} as const;
/** Wording of each individual preference on the Settings page. */
export const SETTINGS_ITEMS: Readonly<Record<PreferenceKey, Readonly<{ title: string; text: string }>>> = {
  ...PREFERENCE_ITEMS,
  puckleUpdates: { title: "New maths content", text: "A fortnightly roundup of new lessons, interactive activities and revision materials." },
  guidedMathsInvitations: { title: "Group Experiences invitations", text: "Invitations to Group Experiences: teacher-led maths activities you complete at your own pace, as part of a group." },
  teacherCollaborationInvitations: { title: "Teacher collaboration invitations", text: "Invitations to explore teaching ideas, share resources and collaborate with other teachers." },
};

const SHARED: readonly PreferenceKey[] = ["puckleUpdates", "newsAndOffers", "occasionalPersonalContact"];
/** The choices shown for each audience, in order. The other-interested-party form has no invitations. */
export const preferenceKeysFor = (audience: PreferencesAudience): readonly PreferenceKey[] =>
  audience === "student" ? [...SHARED, "guidedMathsInvitations"] : audience === "teacher" ? [...SHARED, "teacherCollaborationInvitations"] : SHARED;
/** Categories that send broadcast updates or invitations, and so need a delivery channel. Personal contact does not. */
export const isBroadcastKey = (key: PreferenceKey) => key !== "occasionalPersonalContact";
export const hasBroadcastYes = (answers: Partial<Record<PreferenceKey, Answer>>) =>
  (Object.keys(answers) as PreferenceKey[]).some(key => isBroadcastKey(key) && answers[key] === "yes");
export const channelLabel = (audience: PreferencesAudience) => audience === "interest" ? "Receive updates by" : "Receive updates and invitations by";

type Input = Record<string, unknown>;
const plain = (value: unknown): Input => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("PREFERENCES_INVALID");
  return value as Input;
};
const onlyKeys = (input: Input, keys: readonly string[]) => { if (Object.keys(input).some(key => !keys.includes(key))) throw new Error("PREFERENCES_INVALID"); };

/**
 * Authoritative validation of a full set of answers (new sign-ups and the settings screens). Every choice for the audience
 * must be answered, channels only apply while a broadcast category is Yes, Email needs an email address and Text needs a mobile.
 */
export function validateCommunicationPreferences(
  value: unknown, audience: PreferencesAudience, contacts: { email: string | null; mobile: string | null }, source: string, now = new Date(),
): StoredPreferences {
  const input = plain(value);
  onlyKeys(input, ["answers", "channels"]);
  const rawAnswers = plain(input.answers), rawChannels = plain(input.channels);
  const keys = preferenceKeysFor(audience);
  onlyKeys(rawAnswers, keys);
  onlyKeys(rawChannels, ["email", "sms"]);
  const answers: Partial<Record<PreferenceKey, Answer>> = {};
  for (const key of keys) {
    const answer = rawAnswers[key];
    if (answer === undefined || answer === null || answer === "") throw new Error("PREFERENCES_INCOMPLETE");
    if (answer !== "yes" && answer !== "no") throw new Error("PREFERENCES_INVALID");
    answers[key] = answer;
  }
  if (typeof rawChannels.email !== "boolean" || typeof rawChannels.sms !== "boolean") throw new Error("PREFERENCES_INVALID");
  const channels = { email: rawChannels.email, sms: rawChannels.sms };
  if (!hasBroadcastYes(answers)) {
    if (channels.email || channels.sms) throw new Error("CHANNELS_WITHOUT_CONSENT");
  } else {
    if (!channels.email && !channels.sms) throw new Error("CHANNEL_REQUIRED");
    if (channels.email && !contacts.email) throw new Error("EMAIL_CHANNEL_NEEDS_EMAIL");
    if (channels.sms && !contacts.mobile) throw new Error("SMS_CHANNEL_NEEDS_MOBILE");
  }
  return { answers, channels, source, wordingVersion: PREFERENCES_WORDING_VERSION, recordedAt: now };
}

/** Recipient filtering for any future optional message: an explicit Yes and a selected channel. Unknown, No and withdrawn never match. */
export function isOptedIn(prefs: StoredPreferences | null | undefined, key: PreferenceKey, channel?: Channel): boolean {
  if (!prefs || prefs.answers[key] !== "yes") return false;
  return isBroadcastKey(key) ? !!channel && prefs.channels[channel] === true : true;
}

/** A short, legible summary for founder alerts. */
export function describePreferences(prefs: StoredPreferences | null | undefined): string {
  if (!prefs) return "Communication choices: none recorded\n";
  const rows = (Object.keys(prefs.answers) as PreferenceKey[]).map(key => `  ${PREFERENCE_ITEMS[key].title}: ${prefs.answers[key] === "yes" ? "Yes" : "No"}\n`).join("");
  const delivery = [prefs.channels.email ? "Email" : "", prefs.channels.sms ? "Text message" : ""].filter(Boolean).join(" and ") || "none";
  return `Communication choices:\n${rows}  Delivery: ${delivery}\n`;
}
