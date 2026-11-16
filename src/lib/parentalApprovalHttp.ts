import { securityError, securityJson } from "./accountSecurityHttp";
import { SUPPORT_EMAIL } from "./parentalApprovalScope";

const MESSAGES: Readonly<Record<string, [number, string]>> = {
  APPROVAL_NOT_REQUIRED: [409, "Parent or guardian approval is only needed for students under 16."],
  APPROVAL_AGE_UNKNOWN: [409, `We don't have your date of birth, so we can't send an approval request. Please email ${SUPPORT_EMAIL}.`],
  GUARDIAN_EMAIL_IS_ACCOUNT: [400, "Please enter your parent or guardian's email address, not your own."],
  APPROVAL_ALREADY_GRANTED: [409, `Your parent or guardian has already approved this. To change who approved it, please email ${SUPPORT_EMAIL}.`],
  INVALID_MOBILE: [400, "Please enter a valid mobile number, including its country code (for example +353 87 123 4567)."],
  GUARDIAN_CONTACT_REQUIRED: [400, "Please enter your parent or guardian's email address or mobile number."],
  APPROVAL_STATE_CHANGED: [409, "Something changed while you were doing this. Please refresh and try again."],
  ACTOR_MISMATCH: [409, "You're signed in as a different account now. Please refresh."],
  DECLARATION_REQUIRED: [400, "Please confirm the statement before continuing."],
  INVALID_DECISION: [400, "Please choose an option."],
  LINK_NOT_USABLE: [410, "This link can no longer be used. A decision may already have been made, or a newer link replaced it."],
};
export function parentalApprovalError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const known = MESSAGES[code];
  return known ? securityJson({ error: known[1], code }, known[0]) : securityError(error);
}
