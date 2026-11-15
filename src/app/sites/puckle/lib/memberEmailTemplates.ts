import type { Education, MembershipCategory } from "@/lib/puckleMemberships";

// Founder alerts carry what is needed to follow up personally. Passwords, hashes and date of birth never appear.
type Message = { subject: string; text: string };
const line = (label: string, value: string | null | undefined) => (value ? `${label}: ${value}\n` : "");
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
  return { subject: "Puckle: new teacher registration", text:
    `A teacher has created a Puckle account (ordinary access; no publishing permission).\n\n${line("Name", input.name)}${line("Email", input.email)}${line("Mobile", input.mobile)}`
    + `${input.introduction ? `\nIntroduction:\n${input.introduction}\n` : "\nNo introduction given.\n"}\nRecord: puckleMemberships _id ${input.id}\nPlease follow up personally.` };
}
export function founderNoEmailRequestEmail(input: { id: string; category: MembershipCategory; name: string; mobile: string; education?: Education; introduction?: string }): Message {
  return { subject: `Puckle: no-email ${input.category} contact request`, text:
    `Someone without an email address asked Puckle to contact them. No account was created.\n\n${line("Category", input.category)}${line("Name", input.name)}${line("Mobile", input.mobile)}`
    + `${line("Course", describeEducation(input.education))}${input.introduction ? `\nIntroduction:\n${input.introduction}\n` : ""}\nRecord: puckleJoinContactRequests _id ${input.id}\nPlease contact them by phone or text.` };
}
export function founderInterestEmail(input: { id: string; name: string; email: string | null; mobile: string | null; reason: string; message: string; emailUpdates: boolean }): Message {
  return { subject: "Puckle: new updates sign-up", text:
    `Someone asked for occasional Puckle updates. No account was created.\n\n${line("Name", input.name)}${line("Email", input.email)}${line("Mobile", input.mobile)}${line("Interest", input.reason)}`
    + `${line("Email updates", input.emailUpdates ? "requested by email" : "none (mobile-only: follow-up only)")}${input.message ? `\nMessage:\n${input.message}\n` : ""}\nRecord: puckleInterestContacts _id ${input.id}` };
}
export function founderTuitionEnquiryEmail(input: { id: string; linkedAccount: boolean; data: { enquirerType: string; studentName: string; contactName: string; mathsCourse: string; email: string | null; phone: string | null; preferredContactMethod: string; message: string } }): Message {
  const d = input.data;
  return { subject: "Puckle: new tuition enquiry", text:
    `A free-session enquiry was submitted. Nothing is booked and no account or membership was created.\n\n${line("From", d.enquirerType)}${line("Student", d.studentName)}${line("Contact", d.contactName)}`
    + `${line("Course", d.mathsCourse)}${line("Email", d.email)}${line("Mobile", d.phone)}${line("Preferred contact", d.preferredContactMethod)}${line("Linked to a signed-in Puckle student", input.linkedAccount ? "yes" : null)}`
    + `${d.message ? `\nMessage:\n${d.message}\n` : ""}\nRecord: puckleTuitionEnquiries _id ${input.id}\nPlease arrange the introduction personally.` };
}
