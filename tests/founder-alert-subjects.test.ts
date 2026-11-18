import assert from "node:assert/strict";
import { test } from "node:test";
import {
  founderInterestEmail, founderNoEmailRequestEmail, founderParentApprovalRequestEmail, founderParentContactRequestEmail, founderParentDecisionEmail, founderStudentRegistrationEmail,
  founderTeacherRegistrationEmail, founderTuitionEnquiryEmail,
} from "../src/app/sites/puckle/lib/memberEmailTemplates";

const tuition = (enquirerType: string) => founderTuitionEnquiryEmail({ id: "i", linkedAccount: false, data: { enquirerType, studentName: "Aoife", contactName: "Mary Murphy", mathsCourse: "gcse", email: "m@example.com", phone: "+353871234567", preferredContactMethod: "email", message: "" } });
const alerts = {
  student: founderStudentRegistrationEmail({ id: "i", name: "Ada", username: "ada_l", email: "a@example.com", mobile: null, registeredAt: new Date("2026-11-16T09:00:00Z") }),
  teacher: founderTeacherRegistrationEmail({ id: "i", name: "Mr Byrne", email: "t@example.com", mobile: null, introduction: "" }),
  tuitionParent: tuition("parent-guardian"), tuitionUnder18: tuition("student-under-18"), tuitionAdult: tuition("student-adult"),
  noEmailStudent: founderNoEmailRequestEmail({ id: "i", category: "student", name: "Sam", mobile: "+353871234567" }),
  interestEmail: founderInterestEmail({ id: "i", name: "Pat", email: "p@example.com", mobile: null, reason: "", message: "" }),
  interestMobile: founderInterestEmail({ id: "i", name: "Rae", email: null, mobile: "+353871234567", reason: "", message: "" }),
  parentApproval: founderParentApprovalRequestEmail({ id: "i", childName: "Niamh", username: "niamh1", guardianEmail: "mum@example.com", guardianPhone: "+353871234567", delivery: "sent", sourceSite: "puckle" }),
  parentNoEmail: founderParentContactRequestEmail({ id: "i", childName: "Niamh", username: "niamh1", guardianPhone: "+353871234567" }),
  parentApproved: founderParentDecisionEmail({ id: "i", childName: "Niamh", username: "niamh1", decision: "approved", guardianEmail: "mum@example.com", guardianPhone: null, decidedAt: new Date("2026-11-16T10:00:00Z") }),
  parentDeclined: founderParentDecisionEmail({ id: "i", childName: "Niamh", username: "niamh1", decision: "declined", guardianEmail: "mum@example.com", guardianPhone: null, decidedAt: new Date("2026-11-16T10:00:00Z") }),
};
test("every alert starts with a priority tag, an icon and a CAPITALISED event name, then who it is about", () => {
  for (const [name, alert] of Object.entries(alerts)) assert.match(alert.subject, /^\[(ACTION|FYI)\] \S+ [A-Z][A-Z ]+[^:]*: \S/u, name);
});
test("the kinds of alert can be told apart from the first characters of the subject", () => {
  const kinds = { student: alerts.student, teacher: alerts.teacher, tuition: alerts.tuitionParent, noEmail: alerts.noEmailStudent, interest: alerts.interestEmail, parentApproval: alerts.parentApproval, parentNoEmail: alerts.parentNoEmail, parentApproved: alerts.parentApproved, parentDeclined: alerts.parentDeclined };
  const heads = Object.values(kinds).map(alert => alert.subject.split(":")[0]);
  assert.equal(new Set(heads).size, heads.length, heads.join(" | "));
  const icons = Object.values(kinds).map(alert => alert.subject.split(" ")[1]); assert.equal(new Set(icons).size, icons.length, "each kind has its own icon");
});
test("[ACTION] means someone is waiting for you; [FYI] is informational", () => {
  const priority = (alert: { subject: string }) => alert.subject.slice(1, alert.subject.indexOf("]"));
  for (const action of [alerts.teacher, alerts.tuitionParent, alerts.tuitionUnder18, alerts.tuitionAdult, alerts.noEmailStudent, alerts.interestMobile, alerts.parentNoEmail]) assert.equal(priority(action), "ACTION", action.subject);
  for (const info of [alerts.student, alerts.interestEmail, alerts.parentApproval, alerts.parentApproved, alerts.parentDeclined]) assert.equal(priority(info), "FYI", info.subject);
});
test("subjects name who the alert is about, and tuition says who is asking", () => {
  assert.equal(alerts.student.subject, "[FYI] 🎓 NEW STUDENT: Ada"); assert.equal(alerts.parentApproval.subject, "[FYI] 👪 PARENT APPROVAL SENT: Niamh");
  assert.equal(alerts.parentNoEmail.subject, "[ACTION] 📞 PARENT HAS NO EMAIL, PLEASE CALL: Niamh");
  assert.equal(alerts.parentApproved.subject, "[FYI] ✅ PARENT APPROVED: Niamh"); assert.equal(alerts.parentDeclined.subject, "[FYI] ❌ PARENT DECLINED: Niamh");
  assert.equal(alerts.tuitionParent.subject, "[ACTION] 📩 TUITION ENQUIRY: parent of Aoife, gcse");
  assert.equal(alerts.tuitionUnder18.subject, "[ACTION] 📩 TUITION ENQUIRY: Aoife (under 18; contact Mary Murphy), gcse");
  assert.equal(alerts.tuitionAdult.subject, "[ACTION] 📩 TUITION ENQUIRY: Mary Murphy (adult student), gcse");
});
test("names cannot break the subject line: control characters and length are neutralised", () => {
  const nasty = founderStudentRegistrationEmail({ id: "i", name: "Ada\r\nBcc: x@evil.test\u0000   " + "x".repeat(200), username: "u", email: "a@example.com", mobile: null, registeredAt: new Date() });
  assert.ok(!/[\r\n\u0000]/.test(nasty.subject)); assert.ok(nasty.subject.length < 120);
});
test("parent alerts carry the contact details you need and never a date of birth or password", () => {
  assert.match(alerts.parentApproval.text, /Parent\/guardian email: mum@example\.com/); assert.match(alerts.parentApproval.text, /mobile \(not verified\): \+353871234567/);
  assert.match(alerts.parentNoEmail.text, /\+353871234567/); assert.match(alerts.parentNoEmail.text, /NOT recorded/); assert.match(alerts.parentNoEmail.text, /contact the parent personally/);
  for (const alert of Object.values(alerts)) assert.ok(!/password|passwordHash|date of birth|dateOfBirth/i.test(alert.text.replace(/No password[^.]*\./, "")), alert.subject);
});
