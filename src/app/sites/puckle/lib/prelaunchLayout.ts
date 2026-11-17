/**
 * Layout pipeline for the pre-launch welcome. Raw facts about the signed-in member in, a read-only
 * description of what to show out. The component only renders it.
 */
import { guardianLayoutFor, type GuardianLayout, type OnboardingStatus } from "@/components/onboarding/onboardingLayout";
import { CONTACT_EMAIL } from "../siteInfo";

export type PrelaunchAudience = "student" | "teacher" | "other";
export type PrelaunchAction =
  /** Opens the existing tuition enquiry on the home page. */
  | Readonly<{ kind: "enquire"; label: string; href: string }>
  | Readonly<{ kind: "email"; address: string; href: string }>;
export type PrelaunchLayout = Readonly<{
  audience: PrelaunchAudience;
  kicker: string;
  heading: string;
  lead: string;
  body: string;
  followUp: Readonly<{ heading: string; text: string; action: PrelaunchAction }>;
  /** Secondary, only for a student who still needs a parent or guardian's approval. */
  parentApproval: Readonly<{ heading: string; text: string; openLabel: string; guardian: GuardianLayout }> | null;
}>;

/** The existing tuition enquiry form on the home page. */
export const TUITION_ENQUIRY_HREF = "/#early-access";

const KICKER = "EARLY ACCESS", HEADING = "Welcome to Puckle!";
const INTEREST_FOLLOW_UP = {
  heading: "Thanks for your interest!",
  text: "We've received your details and will be in touch. In the meantime, if you have more ideas or questions, you're always welcome to contact us.",
  action: { kind: "email", address: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
} as const;

/** The existing form, with an introduction that does not talk about learning or group features this early. */
const GUARDIAN_INTRO: Readonly<Record<string, string>> = {
  "not-requested": "Enter their email and we'll send them a request.",
  pending: "We've asked your parent or guardian for their permission.",
  declined: "Your parent or guardian said no for now. You can ask again if things change.",
  withdrawn: "Your parent or guardian withdrew their permission. You can ask again.",
};

export const audienceOf = (category: string | null | undefined): PrelaunchAudience => category === "student" || category === "teacher" ? category : "other";

export function buildPrelaunchLayout(input: { category: string | null | undefined; approval?: OnboardingStatus["approval"] }): PrelaunchLayout {
  const audience = audienceOf(input.category);
  if (audience === "student") {
    // Same facts and rules as the original onboarding: shown only while approval is genuinely needed and not yet obtained.
    const found = guardianLayoutFor({ actorId: "", show: true, student: true, approval: input.approval }, false);
    const guardian = found && input.approval ? { ...found, intro: GUARDIAN_INTRO[input.approval.status] ?? found.intro } : found;
    return {
      audience, kicker: KICKER, heading: HEADING,
      lead: "Our maths content opens in early December.",
      body: "Join us from the beginning, improve your maths and help shape what we create next.",
      followUp: {
        heading: "Want to get started now?",
        text: "Maths lessons with Puckle are available today, using our interactive learning platform.",
        action: { kind: "enquire", label: "Enquire about lessons", href: TUITION_ENQUIRY_HREF },
      },
      parentApproval: guardian ? { heading: "Parent or guardian approval", text: "Some sharing features require permission from a parent or guardian.", openLabel: "Ask a parent or guardian", guardian } : null,
    };
  }
  if (audience === "teacher") {
    return {
      audience, kicker: KICKER, heading: HEADING,
      lead: "Our maths content opens in early December.",
      body: "You're joining us from the beginning, with an opportunity to help shape how Puckle supports teachers and students.",
      followUp: INTEREST_FOLLOW_UP, parentApproval: null,
    };
  }
  return {
    audience, kicker: KICKER, heading: HEADING,
    lead: "We're opening in early December.",
    body: "You're joining Puckle at the beginning. We're creating new ways to learn maths, and we'd love you to be part of what comes next.",
    followUp: INTEREST_FOLLOW_UP, parentApproval: null,
  };
}
