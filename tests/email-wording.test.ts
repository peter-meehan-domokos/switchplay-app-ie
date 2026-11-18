import assert from "node:assert/strict";
import { test } from "node:test";
import { existingAccountEmail, parentApprovalRequestEmail, passwordResetEmail, verificationEmail } from "../src/lib/accountEmailTemplates";
import { emailActionDocument } from "../src/lib/emailActionDocument";
import { GROUP_EXPERIENCE_EXPLANATION, GUARDIAN_DECLARATION } from "../src/lib/parentalApprovalScope";
import { parentalApprovalError } from "../src/lib/parentalApprovalHttp";
import * as founder from "../src/app/sites/puckle/lib/memberEmailTemplates";

// Everything a student, parent or the founder can read in a Puckle email or on the approval page speaks only of Puckle.
const OTHER_NAMES = /switchplay|strat17|puckleclubs|puckleyard/i;
const T = "A".repeat(43);
test("account and parent emails sent for Puckle never mention any other website or app", () => {
  const messages = [verificationEmail("Puckle", "123456"), existingAccountEmail("Puckle", "https://puckleup.com"), passwordResetEmail("Puckle", "https://puckleup.com", T),
    parentApprovalRequestEmail("Puckle", "https://puckleup.com", T, "Niamh")];
  for (const message of messages) { assert.doesNotMatch(message.subject, OTHER_NAMES, message.subject); assert.doesNotMatch(message.text, OTHER_NAMES, message.subject); }
  assert.match(messages[3].text, /Group Experiences on Puckle\./);
});
test("the parent approval explanation and declaration name only Puckle", () => {
  assert.doesNotMatch(GROUP_EXPERIENCE_EXPLANATION.text, OTHER_NAMES); assert.doesNotMatch(GUARDIAN_DECLARATION.text, OTHER_NAMES);
});
test("the self-contained parent/reset page contains no other site names", async () => {
  assert.doesNotMatch(await emailActionDocument().text(), OTHER_NAMES);
});
test("founder alerts name only Puckle", () => {
  const alerts = [
    founder.founderStudentRegistrationEmail({ id: "i", name: "Ada", username: "ada", email: "a@example.com", mobile: null, registeredAt: new Date() }),
    founder.founderTeacherRegistrationEmail({ id: "i", name: "T", email: "t@example.com", mobile: null, introduction: "" }),
    founder.founderNoEmailRequestEmail({ id: "i", category: "student", name: "S", mobile: "+353871234567" }),
    founder.founderInterestEmail({ id: "i", name: "P", email: "p@example.com", mobile: null, reason: "", message: "" }),
    founder.founderTuitionEnquiryEmail({ id: "i", linkedAccount: false, data: { enquirerType: "parent-guardian", studentName: "A", contactName: "M", mathsCourse: "gcse", email: null, phone: "+353871234567", preferredContactMethod: "text", message: "" } }),
    founder.founderParentApprovalRequestEmail({ id: "i", childName: "N", username: "n", guardianEmail: "m@example.com", guardianPhone: null, delivery: "sent", sourceSite: "puckle" }),
    founder.founderParentContactRequestEmail({ id: "i", childName: "N", username: "n", guardianPhone: "+353871234567" }),
    founder.founderParentDecisionEmail({ id: "i", childName: "N", username: "n", decision: "approved", guardianEmail: "m@example.com", guardianPhone: null, decidedAt: new Date() }),
    founder.founderParentDecisionEmail({ id: "i", childName: "N", username: "n", decision: "declined", guardianEmail: "m@example.com", guardianPhone: null, decidedAt: new Date() }),
  ];
  for (const alert of alerts) { assert.doesNotMatch(alert.subject, OTHER_NAMES); assert.doesNotMatch(alert.text, OTHER_NAMES, alert.subject); }
});
test("parents and students are told to use support@puckleup.com, consistently, and the page and errors agree", async () => {
  const request = parentApprovalRequestEmail("Puckle", "https://puckleup.com", T, "Niamh");
  assert.match(request.text, /reply to this email or write to support@puckleup\.com/); assert.doesNotMatch(request.text, /hello@/);
  assert.match(GROUP_EXPERIENCE_EXPLANATION.text, /support@puckleup\.com/);
  const page = await emailActionDocument().text();
  assert.match(page, /write to support@puckleup\.com/); assert.doesNotMatch(page, /hello@|contact the website/);
  for (const code of ["APPROVAL_AGE_UNKNOWN", "APPROVAL_ALREADY_GRANTED"]) assert.match(((await parentalApprovalError(new Error(code)).json()) as { error: string }).error, /support@puckleup\.com/);
});
