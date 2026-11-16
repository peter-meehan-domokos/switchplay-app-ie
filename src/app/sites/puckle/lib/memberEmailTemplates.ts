import type { Education, MembershipCategory } from "@/lib/puckleMemberships";

// Founder alerts carry what is needed to follow up personally. Passwords, hashes and date of birth never appear.
type Message = { subject: string; text: string };
const line = (label: string, value: string | null | undefined) => (value ? `${label}: ${value}\n` : "");
/**
 * Subjects are built to be told apart at a glance in an inbox list: a priority tag first ([ACTION] means someone
 * is waiting for you, [FYI] is informational), then a distinct emoji and CAPITALISED event name, then who it is about.
 */
const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);
const subject = (priority: "ACTION" | "FYI", icon: string, event: string, about: string) => `[${priority}] ${icon} ${event}: ${clean(about)}`;
const COURSES: Record<string, string> = {
  "leaving-cert": "Leaving Cert maths", "junior-cycle": "Junior Cycle maths", gcse: "GCSE maths", "a-level": "A-level maths", other: "Other", "dont-know": "Don't know",
};
export function describeEducation(education: Education | undefined): string | null {
  if (!education) return null;
  const course = education.course === "other" ? `Other (${education.courseOther})` : COURSES[education.course];
  const level = education.level === null ? "no level (A-level)" : education.level === "other" ? `Other (${education.levelOther})` : education.level;
  return `${course}, level: ${level}`;
}
export function founderTeacherRegistrationEmail(input: { id: string; name: string; email: string; mobile: string | null; introduction: string }): Message {
  return { subject: subject("ACTION", "🍎", "NEW TEACHER", input.name), text:
    `A teacher has created a Puckle account (ordinary access; no publishing permission).\n\n${line("Name", input.name)}${line("Email", input.email)}${line("Mobile", input.mobile)}`
    + `${input.introduction ? `\nIntroduction:\n${input.introduction}\n` : "\nNo introduction given.\n"}\nRecord: puckleMemberships _id ${input.id}\nPlease follow up personally.` };
}
/** Informational only: students join without approval. No password, hash or date of birth. */
export function founderStudentRegistrationEmail(input: { id: string; name: string; username: string; email: string; mobile: string | null; education?: Education; registeredAt: Date }): Message {
  const course = input.education ? input.education.course === "other" ? `Other (${input.education.courseOther})` : COURSES[input.education.course] : null;
  const level = !input.education ? null : input.education.level === null ? "Not applicable (A-level)" : input.education.level === "other" ? `Other (${input.education.levelOther})` : input.education.level;
  return { subject: subject("FYI", "🎓", "NEW STUDENT", input.name), text:
    `A new student has joined Puckle. No approval is needed.\n\n${line("Name", input.name)}${line("Username", input.username)}${line("Email", input.email)}${line("Mobile", input.mobile)}`
    + `${line("Course", course)}${line("Level", level)}${line("Registered", `${input.registeredAt.toISOString().slice(0, 16).replace("T", " ")} UTC`)}\nRecord: puckleMemberships _id ${input.id}` };
}
export function founderNoEmailRequestEmail(input: { id: string; category: MembershipCategory; name: string; mobile: string; education?: Education; introduction?: string }): Message {
  return { subject: subject("ACTION", "📱", `CALL BACK (no email, ${input.category})`, input.name), text:
    `Someone without an email address asked Puckle to contact them. No account was created.\n\n${line("Category", input.category)}${line("Name", input.name)}${line("Mobile", input.mobile)}`
    + `${line("Course", describeEducation(input.education))}${input.introduction ? `\nIntroduction:\n${input.introduction}\n` : ""}\nRecord: puckleJoinContactRequests _id ${input.id}\nPlease contact them by phone or text.` };
}
export function founderInterestEmail(input: { id: string; name: string; email: string | null; mobile: string | null; reason: string; message: string; emailUpdates: boolean }): Message {
  return { subject: subject(input.email ? "FYI" : "ACTION", input.email ? "🔔" : "📱", input.email ? "UPDATES SIGN-UP" : "CALL BACK (updates, no email)", input.name), text:
    `Someone asked for occasional Puckle updates. No account was created.\n\n${line("Name", input.name)}${line("Email", input.email)}${line("Mobile", input.mobile)}${line("Interest", input.reason)}`
    + `${line("Email updates", input.emailUpdates ? "requested by email" : "none (mobile-only: follow-up only)")}${input.message ? `\nMessage:\n${input.message}\n` : ""}\nRecord: puckleInterestContacts _id ${input.id}` };
}
export function founderTuitionEnquiryEmail(input: { id: string; linkedAccount: boolean; data: { enquirerType: string; studentName: string; contactName: string; mathsCourse: string; email: string | null; phone: string | null; preferredContactMethod: string; message: string } }): Message {
  const d = input.data;
  const who = d.enquirerType === "parent-guardian" ? `parent of ${d.studentName}` : d.enquirerType === "student-under-18" ? `${d.studentName} (under 18; contact ${d.contactName})` : `${d.contactName} (adult student)`;
  return { subject: subject("ACTION", "📩", "TUITION ENQUIRY", `${who}, ${d.mathsCourse}`), text:
    `A free-session enquiry was submitted. Nothing is booked and no account or membership was created.\n\n${line("From", d.enquirerType)}${line("Student", d.studentName)}${line("Contact", d.contactName)}`
    + `${line("Course", d.mathsCourse)}${line("Email", d.email)}${line("Mobile", d.phone)}${line("Preferred contact", d.preferredContactMethod)}${line("Linked to a signed-in Puckle student", input.linkedAccount ? "yes" : null)}`
    + `${d.message ? `\nMessage:\n${d.message}\n` : ""}\nRecord: puckleTuitionEnquiries _id ${input.id}\nPlease arrange the introduction personally.` };
}
/** Informational: a student asked a parent/guardian (by email) to approve Group Experiences. No decision is needed from you. */
export function founderParentApprovalRequestEmail(input: { id: string; childName: string; username: string; guardianEmail: string; guardianPhone: string | null; delivery: string; sourceSite: string }): Message {
  return { subject: subject("FYI", "👪", "PARENT APPROVAL SENT", input.childName), text:
    `A student asked a parent or guardian to approve Group Experiences. The approval email went to the parent; nothing is needed from you.\n\n${line("Student", input.childName)}${line("Username", input.username)}`
    + `${line("Parent/guardian email", input.guardianEmail)}${line("Parent/guardian mobile (not verified)", input.guardianPhone)}${line("Email delivery", input.delivery)}${line("Requested from", input.sourceSite)}\nAccount _id ${input.id}` };
}
/** Needs you: the parent has no email address, so no approval link could be sent. */
export function founderParentContactRequestEmail(input: { id: string; childName: string; username: string; guardianPhone: string }): Message {
  return { subject: subject("ACTION", "📞", "PARENT HAS NO EMAIL, PLEASE CALL", input.childName), text:
    `A student under 16 gave only a mobile number for a parent or guardian, so no approval email could be sent. Group Experience approval is NOT recorded. Please contact the parent personally.\n\n`
    + `${line("Student", input.childName)}${line("Username", input.username)}${line("Parent/guardian mobile (not verified)", input.guardianPhone)}\nRecord: puckleJoinContactRequests _id ${input.id}\nThe student can keep learning privately meanwhile.` };
}
