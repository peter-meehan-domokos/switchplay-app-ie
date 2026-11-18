/**
 * Presentational projection for the onboarding host. Raw status + local interaction state in, a read-only
 * description of what to show out. Components render it and send interactions back through the host state.
 */
export type ApprovalStatusName = "not-requested" | "pending" | "approved" | "declined" | "withdrawn";
export type OnboardingStatus = Readonly<{
  actorId: string; show: boolean; student?: boolean; welcomePending?: boolean;
  approval?: Readonly<{ eligibility: "eligible" | "not-required" | "age-unknown"; status: ApprovalStatusName; canRequest: boolean; guardianEmail: string | null; delivery: string | null }>;
}>;
export type OnboardingUi = Readonly<{
  outsideInteraction: boolean; blocked: boolean; confirming: boolean; unavailable: boolean;
  welcomePresented: boolean; welcomeDismissed: boolean; reminderDismissed: boolean; openedByRequest: boolean;
  draft: string; phoneDraft: string; sending: boolean; message: Readonly<{ text: string; tone: "info" | "error" }> | null;
}>;
export const initialOnboardingUi: OnboardingUi = {
  outsideInteraction: false, blocked: false, confirming: false, unavailable: false, welcomePresented: false, welcomeDismissed: false,
  reminderDismissed: false, openedByRequest: false, draft: "", phoneDraft: "", sending: false, message: null,
};
export type GuardianLayout = Readonly<{
  intro: string; statusLine: string | null; deliveryNote: string | null; buttonLabel: string; emailLabel: string; phoneLabel: string; phoneHint: string;
}>;
export type OnboardingLayout =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "pill"; label: string }>
  | Readonly<{ kind: "welcome"; heading: string; body: string; guardian: GuardianLayout | null; supportLink: boolean }>
  | Readonly<{ kind: "reminder"; heading: string; guardian: GuardianLayout; supportLink: boolean }>;

const FORM_STATES: readonly ApprovalStatusName[] = ["not-requested", "pending", "declined", "withdrawn"];
export function guardianLayoutFor(status: OnboardingStatus, welcome: boolean): GuardianLayout | null {
  const approval = status.approval;
  if (!approval || approval.eligibility !== "eligible" || !approval.canRequest || !FORM_STATES.includes(approval.status)) return null;
  const delivery = approval.status === "pending" && approval.delivery && approval.delivery !== "sent" ? "We couldn't confirm the email was sent. You can send it again." : null;
  const emailLabel = "Parent or guardian's email", phoneLabel = "Parent or guardian's mobile (optional)";
  const phoneHint = "If they don't use email, enter just a mobile number and we'll contact them ourselves; approval isn't recorded until we have.";
  switch (approval.status) {
    case "pending": return { intro: "We've asked your parent or guardian to approve group features. You can keep learning meanwhile.", statusLine: approval.guardianEmail ? `Sent to ${approval.guardianEmail}.` : null, deliveryNote: delivery, buttonLabel: "Send it again", emailLabel, phoneLabel, phoneHint };
    case "declined": return { intro: "Your parent or guardian declined group features. You can still learn privately. You can ask again if things change.", statusLine: null, deliveryNote: null, buttonLabel: "Ask again", emailLabel, phoneLabel, phoneHint };
    case "withdrawn": return { intro: "Your parent or guardian withdrew their approval for group features. You can still learn privately. You can ask again.", statusLine: null, deliveryNote: null, buttonLabel: "Ask again", emailLabel, phoneLabel, phoneHint };
    default: return { intro: welcome ? "You're under 16, so group features need a parent or guardian's approval. This is optional and you can learn privately right now. To ask now, enter their email and we'll send them a request." : "Group features need a parent or guardian's approval. Want to ask now? You can keep learning privately either way.", statusLine: null, deliveryNote: null, buttonLabel: "Send approval request", emailLabel, phoneLabel, phoneHint };
  }
}

/** Body of the existing parental approval request, shared by every place that asks. */
export function guardianRequestBody(actorId: string, email: string, phone: string) {
  return { action: "request", ...(email ? { guardianEmail: email } : {}), ...(phone ? { guardianPhone: phone } : {}), expectedUserId: actorId };
}

export function buildOnboardingLayout(status: OnboardingStatus | null, ui: OnboardingUi): OnboardingLayout {
  if (!status || !status.show || ui.confirming || ui.unavailable || ui.blocked) return { kind: "none" };
  const welcomeLive = (!!status.student && !!status.welcomePending) || ui.welcomePresented;
  if (welcomeLive) {
    if (ui.welcomeDismissed) return { kind: "none" }; // dismissal never triggers an immediate replacement popup
    // Never auto-expand over active learning: after outside interaction the same welcome opens only on request.
    if (!ui.welcomePresented && ui.outsideInteraction && !ui.openedByRequest) return { kind: "pill", label: "Welcome to Puckle" };
    return { kind: "welcome", heading: "Welcome to Puckle", body: "Your account is ready. Want to try a free 20–30 minute online session, or look around first?",
      guardian: guardianLayoutFor(status, true), supportLink: !!status.approval && status.approval.eligibility === "eligible" };
  }
  const guardian = guardianLayoutFor(status, false);
  if (!guardian || ui.reminderDismissed) return { kind: "none" };
  return { kind: "reminder", heading: "Group features", guardian, supportLink: true };
}
