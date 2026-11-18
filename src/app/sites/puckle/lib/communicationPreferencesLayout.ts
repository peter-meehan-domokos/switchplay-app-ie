import {
  channelLabel, hasBroadcastYes, PREFERENCE_ITEMS, PREFERENCES_HEADING, preferenceKeysFor,
  type Answer, type PreferenceKey, type PreferencesAudience, type StoredPreferences,
} from "./communicationPreferences";

/**
 * Presentational pipeline for the preferences section (Join form, settings and the no-account manage page).
 * Raw state -> read-only layout. Components render the layout and send interactions through the `with*` helpers.
 */
export type PreferenceField = "puckleUpdates" | "newsAndOffers" | "occasionalPersonalContact" | "invitations";
export type PreferencesState = Readonly<{
  puckleUpdates: Answer | ""; newsAndOffers: Answer | ""; occasionalPersonalContact: Answer | ""; invitations: Answer | "";
  email: boolean; sms: boolean;
}>;
export type PreferencesErrorKey = PreferenceField | "channels";
export type PreferencesErrors = Readonly<Partial<Record<PreferencesErrorKey, string>>>;
/** What the surrounding form already knows, so the section can say what a channel needs. */
export type PreferencesContacts = Readonly<{ emailAvailable: boolean; hasEmail: boolean; hasMobile: boolean }>;

export const initialPreferencesState: PreferencesState = { puckleUpdates: "", newsAndOffers: "", occasionalPersonalContact: "", invitations: "", email: false, sms: false };
export const PREFERENCE_FIELDS: readonly PreferenceField[] = ["puckleUpdates", "newsAndOffers", "occasionalPersonalContact", "invitations"];

export const PREFERENCE_MESSAGES = {
  answer: "Choose Yes or No.",
  channels: "Choose email, text message or both.",
  emailNeedsAddress: "Add your email address above to receive emails, or untick Email.",
  smsNeedsMobile: "Add a valid mobile number above to receive text messages, or untick Text message.",
} as const;

const invitationKey = (audience: PreferencesAudience): PreferenceKey | null =>
  audience === "student" ? "guidedMathsInvitations" : audience === "teacher" ? "teacherCollaborationInvitations" : null;
/** Maps the screen field onto the stored preference for this audience. */
const keyFor = (field: PreferenceField, audience: PreferencesAudience): PreferenceKey | null => field === "invitations" ? invitationKey(audience) : field;
export const broadcastYes = (state: PreferencesState, audience: PreferencesAudience) =>
  hasBroadcastYes(Object.fromEntries(PREFERENCE_FIELDS.flatMap(field => {
    const key = keyFor(field, audience), value = state[field];
    return key && value ? [[key, value]] : [];
  })));

/** A channel with no broadcast Yes is never kept: hidden state cannot linger as consent. */
const withoutStaleChannels = (state: PreferencesState, audience: PreferencesAudience): PreferencesState =>
  broadcastYes(state, audience) ? state : { ...state, email: false, sms: false };
export const withAnswer = (state: PreferencesState, audience: PreferencesAudience, field: PreferenceField, value: Answer): PreferencesState =>
  withoutStaleChannels({ ...state, [field]: value }, audience);
export const withChannel = (state: PreferencesState, channel: "email" | "sms", checked: boolean): PreferencesState => ({ ...state, [channel]: checked });
/** Switching between student, teacher and interested clears the audience-specific invitation answer. */
export const withAudienceChange = (state: PreferencesState, audience: PreferencesAudience): PreferencesState =>
  withoutStaleChannels({ ...state, invitations: "" }, audience);
/** Unsubscribe from everything: every choice for the audience becomes No and the channels are cleared. */
export const withAllNo = (state: PreferencesState, audience: PreferencesAudience): PreferencesState =>
  PREFERENCE_FIELDS.reduce((next, field) => keyFor(field, audience) ? withAnswer(next, audience, field, "no") : next, state);
/** The email channel cannot apply without an email address (for example the mobile-only route). */
export const withoutEmailChannel = (state: PreferencesState): PreferencesState => state.email ? { ...state, email: false } : state;

export function preferencesStateFrom(stored: Pick<StoredPreferences, "answers" | "channels"> | null | undefined, audience: PreferencesAudience): PreferencesState {
  if (!stored) return initialPreferencesState;
  const invitation = invitationKey(audience);
  return {
    puckleUpdates: stored.answers.puckleUpdates ?? "", newsAndOffers: stored.answers.newsAndOffers ?? "",
    occasionalPersonalContact: stored.answers.occasionalPersonalContact ?? "", invitations: invitation ? stored.answers[invitation] ?? "" : "",
    email: stored.channels.email, sms: stored.channels.sms,
  };
}

/** The request body fragment. Channels are only ever true while a broadcast category is Yes. */
export function buildPreferencesPayload(state: PreferencesState, audience: PreferencesAudience) {
  const answers = Object.fromEntries(preferenceKeysFor(audience).map(key => [key, state[key === "guidedMathsInvitations" || key === "teacherCollaborationInvitations" ? "invitations" : key]]));
  const on = broadcastYes(state, audience);
  return { answers, channels: { email: on && state.email, sms: on && state.sms } };
}

export function validatePreferencesState(state: PreferencesState, audience: PreferencesAudience, contacts: PreferencesContacts): PreferencesErrors {
  const unanswered = PREFERENCE_FIELDS.filter(field => keyFor(field, audience) && !state[field]);
  const on = broadcastYes(state, audience);
  const channels = !on ? undefined
    : !state.email && !state.sms ? PREFERENCE_MESSAGES.channels
    : state.email && !contacts.hasEmail ? PREFERENCE_MESSAGES.emailNeedsAddress
    : state.sms && !contacts.hasMobile ? PREFERENCE_MESSAGES.smsNeedsMobile : undefined;
  return { ...Object.fromEntries(unanswered.map(field => [field, PREFERENCE_MESSAGES.answer])), ...(channels ? { channels } : {}) };
}

export type PreferenceRowView = Readonly<{ field: PreferenceField; title: string; text: string; value: Answer | ""; error?: string }>;
export type PreferencesLayout = Readonly<{
  heading: string;
  rows: readonly PreferenceRowView[];
  channels: Readonly<{ visible: boolean; label: string; emailOffered: boolean; email: boolean; sms: boolean; error?: string }>;
}>;
export function buildPreferencesLayout(state: PreferencesState, audience: PreferencesAudience, errors: PreferencesErrors, contacts: Pick<PreferencesContacts, "emailAvailable">): PreferencesLayout {
  const rows = PREFERENCE_FIELDS.flatMap(field => {
    const key = keyFor(field, audience);
    return key ? [{ field, title: PREFERENCE_ITEMS[key].title, text: PREFERENCE_ITEMS[key].text, value: state[field], ...(errors[field] ? { error: errors[field] } : {}) }] : [];
  });
  const visible = broadcastYes(state, audience);
  return {
    heading: PREFERENCES_HEADING, rows,
    channels: { visible, label: channelLabel(audience), emailOffered: contacts.emailAvailable, email: visible && state.email, sms: visible && state.sms, ...(errors.channels ? { error: errors.channels } : {}) },
  };
}
