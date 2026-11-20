import {
  channelLabel, hasBroadcastYes, PREFERENCE_ITEMS, PREFERENCES_HEADING, preferenceKeysFor, REGISTRATION_UPDATES_TEXT, SETTINGS_GROUPS, SETTINGS_HEADING, SETTINGS_ITEMS,
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
/**
 * Puckle Updates answers the three broadcast preferences together on the student and teacher registration forms, so a
 * student or teacher keeps those in step. The interested-party form has its own separate answers, so leaving the other
 * forms for it clears what they derived.
 */
export const withUpdatesAnswer = (state: PreferencesState, audience: PreferencesAudience, value: Answer): PreferencesState =>
  withoutStaleChannels({ ...state, puckleUpdates: value, newsAndOffers: value, invitations: value }, audience);
export const withAudienceChange = (state: PreferencesState, audience: PreferencesAudience): PreferencesState =>
  audience === "interest" ? withoutStaleChannels({ ...state, newsAndOffers: "", invitations: "" }, audience)
    : withoutStaleChannels({ ...state, newsAndOffers: state.puckleUpdates, invitations: state.puckleUpdates }, audience);
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

/** full: every preference is its own row. registration: the two-question student and teacher form. settings: grouped full rows. */
export type PreferencesVariant = "full" | "registration" | "settings";
export const registrationVariantFor = (audience: PreferencesAudience): PreferencesVariant => audience === "interest" ? "full" : "registration";
const REGISTRATION_FIELDS: readonly PreferenceField[] = ["puckleUpdates", "occasionalPersonalContact"];
const fieldsFor = (variant: PreferencesVariant) => variant === "registration" ? REGISTRATION_FIELDS : PREFERENCE_FIELDS;

export function validatePreferencesState(state: PreferencesState, audience: PreferencesAudience, contacts: PreferencesContacts, variant: PreferencesVariant = "full"): PreferencesErrors {
  const unanswered = fieldsFor(variant).filter(field => keyFor(field, audience) && !state[field]);
  const on = broadcastYes(state, audience);
  const channels = !on ? undefined
    : !state.email && !state.sms ? PREFERENCE_MESSAGES.channels
    : state.email && !contacts.hasEmail ? PREFERENCE_MESSAGES.emailNeedsAddress
    : state.sms && !contacts.hasMobile ? PREFERENCE_MESSAGES.smsNeedsMobile : undefined;
  return { ...Object.fromEntries(unanswered.map(field => [field, PREFERENCE_MESSAGES.answer])), ...(channels ? { channels } : {}) };
}

/**
 * Presentation only. On narrow screens the description sits beside the Yes | No buttons and wraps; these closing phrases are kept
 * together so the first line ends after "invites" and after "help". Where the whole text fits on one line nothing changes, and the
 * text itself is not altered.
 */
const KEPT_TAILS = ["and occasional offers", "or ask for feedback."] as const;
export const splitKeptTail = (text: string): Readonly<{ lead: string; tail: string }> => {
  const tail = KEPT_TAILS.find(candidate => text.endsWith(` ${candidate}`));
  return tail ? { lead: text.slice(0, text.length - tail.length), tail } : { lead: text, tail: "" };
};

export type PreferenceRowView = Readonly<{ field: PreferenceField; title: string; text: string; value: Answer | ""; error?: string }>;
export type ChannelsView = Readonly<{ visible: boolean; label: string; emailOffered: boolean; email: boolean; sms: boolean; error?: string }>;
/** Settings only: the update preferences nested under Puckle Updates (with their delivery choice), and personal contact apart. */
export type PreferenceGroupView = Readonly<{ id: "updates" | "personal"; title: string; text: string; rows: readonly PreferenceRowView[]; channels?: ChannelsView }>;
export type PreferencesLayout = Readonly<{
  heading: string;
  rows: readonly PreferenceRowView[];
  channels: ChannelsView;
  groups?: readonly PreferenceGroupView[];
}>;
export function buildPreferencesLayout(state: PreferencesState, audience: PreferencesAudience, errors: PreferencesErrors, contacts: Pick<PreferencesContacts, "emailAvailable">, variant: PreferencesVariant = "full"): PreferencesLayout {
  const wording = (field: PreferenceField, key: PreferenceKey) =>
    variant === "settings" ? SETTINGS_ITEMS[key]
    : variant === "registration" && field === "puckleUpdates" && audience !== "interest" ? { title: PREFERENCE_ITEMS[key].title, text: REGISTRATION_UPDATES_TEXT[audience] }
    : PREFERENCE_ITEMS[key];
  const rows = fieldsFor(variant).flatMap(field => {
    const key = keyFor(field, audience);
    return key ? [{ field, ...wording(field, key), value: state[field], ...(errors[field] ? { error: errors[field] } : {}) }] : [];
  });
  const visible = broadcastYes(state, audience);
  const channels: ChannelsView = { visible, label: channelLabel(audience), emailOffered: contacts.emailAvailable, email: visible && state.email, sms: visible && state.sms, ...(errors.channels ? { error: errors.channels } : {}) };
  const groups = variant !== "settings" ? undefined : [
    { id: "updates" as const, ...SETTINGS_GROUPS.updates, rows: rows.filter(row => row.field !== "occasionalPersonalContact"), channels },
    { id: "personal" as const, ...SETTINGS_GROUPS.personal, rows: rows.filter(row => row.field === "occasionalPersonalContact") },
  ];
  return { heading: variant === "settings" ? SETTINGS_HEADING : PREFERENCES_HEADING, rows, channels, ...(groups ? { groups } : {}) };
}
