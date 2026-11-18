import { formatPhoneAsE164 } from "@/lib/phoneCountries";

export const ENQUIRER_TYPES = ["student-under-18", "student-adult", "parent-guardian"] as const;
export type EnquirerType = (typeof ENQUIRER_TYPES)[number];

export const MATHS_COURSES = ["leaving-cert", "junior-cycle", "gcse", "a-level", "other"] as const;
export type MathsCourse = (typeof MATHS_COURSES)[number];

export const CONTACT_METHODS = ["text", "phone", "email"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export type ContactRelationship = "self" | "parent-guardian";

export type EnquiryFormValues = {
  enquirerType: EnquirerType | "";
  studentName: string;
  contactName: string;
  mathsCourse: MathsCourse | "";
  email: string;
  phone: string;
  phoneCountryCode: string;
  preferredContactMethod: ContactMethod | "";
  message: string;
  companyWebsite: string;
};

export type EnquiryRequestData = {
  [Key in keyof EnquiryFormValues]?: unknown;
};

export type ValidatedEnquiryData = {
  enquirerType: EnquirerType;
  /** The student the tuition is for. For an adult student this is the same person as the contact. */
  studentName: string;
  /** The person to contact. For a student under 18 this is their parent or guardian. */
  contactName: string;
  contactRelationship: ContactRelationship;
  mathsCourse: MathsCourse;
  email: string | null;
  phone: string | null;
  preferredContactMethod: ContactMethod;
  message: string;
};

export type EnquiryFieldName = keyof EnquiryFormValues;

export type EnquiryFieldErrors = Partial<Record<EnquiryFieldName | "contact", string>>;

export type EnquirySuccessResponse = {
  ok: true;
  message?: string;
};

export type EnquiryErrorResponse = {
  ok: false;
  error: string;
  fieldErrors?: EnquiryFieldErrors;
};

export const ENQUIRY_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  message: 800,
} as const;

export const ENQUIRY_SUCCESS_MESSAGE =
  "Thanks for getting in touch! I’ll contact you using your preferred method to arrange your free introductory conversation.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s()-]+$/;
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isEnquirerType(value: string): value is EnquirerType {
  return (ENQUIRER_TYPES as readonly string[]).includes(value);
}

function isMathsCourse(value: string): value is MathsCourse {
  return (MATHS_COURSES as readonly string[]).includes(value);
}

function isContactMethod(value: string): value is ContactMethod {
  return (CONTACT_METHODS as readonly string[]).includes(value);
}

/**
 * The contact method to use given what has been entered. With only one contact detail the choice is
 * implied (email, or text message for a mobile number). With both or neither it is whatever was chosen.
 */
export function resolvePreferredContactMethod(
  values: Pick<EnquiryFormValues, "email" | "phone" | "preferredContactMethod">,
): ContactMethod | "" {
  const hasEmail = values.email.trim().length > 0;
  const hasPhone = values.phone.trim().length > 0;

  if (hasEmail && !hasPhone) return "email";
  if (hasPhone && !hasEmail) return values.preferredContactMethod === "phone" ? "phone" : "text";
  return values.preferredContactMethod;
}

export function validateTuitionEnquiry(
  input: EnquiryRequestData,
): { ok: true; data: ValidatedEnquiryData } | { ok: false; fieldErrors: EnquiryFieldErrors } {
  const fieldErrors: EnquiryFieldErrors = {};

  const enquirerTypeInput = toTrimmedString(input.enquirerType);
  const enquirerType = isEnquirerType(enquirerTypeInput) ? enquirerTypeInput : null;
  const contactName = toTrimmedString(input.contactName);
  const studentNameInput = toTrimmedString(input.studentName);
  const mathsCourseInput = toTrimmedString(input.mathsCourse);
  const mathsCourse = isMathsCourse(mathsCourseInput) ? mathsCourseInput : null;
  const email = toTrimmedString(input.email).toLowerCase();
  const phone = toTrimmedString(input.phone);
  const phoneCountryCode = toTrimmedString(input.phoneCountryCode);
  const normalizedPhone = formatPhoneAsE164(phone, phoneCountryCode);
  const message = toTrimmedString(input.message);

  if (!enquirerType) {
    fieldErrors.enquirerType = "Please choose who the enquiry is from.";
  }

  const needsStudentName = enquirerType === "student-under-18" || enquirerType === "parent-guardian";

  if (!contactName) {
    fieldErrors.contactName =
      enquirerType === "student-under-18" ? "Please enter a parent or guardian’s name." : "Please enter your name.";
  } else if (contactName.length > ENQUIRY_LIMITS.name) {
    fieldErrors.contactName = `Name must be ${ENQUIRY_LIMITS.name} characters or fewer.`;
  }

  if (needsStudentName) {
    if (!studentNameInput) {
      fieldErrors.studentName = "Please enter the student’s first name.";
    } else if (studentNameInput.length > ENQUIRY_LIMITS.name) {
      fieldErrors.studentName = `Name must be ${ENQUIRY_LIMITS.name} characters or fewer.`;
    }
  }

  if (!mathsCourse) {
    fieldErrors.mathsCourse = "Please select the maths course.";
  }

  const emailProvided = email.length > 0;
  const phoneProvided = phone.length > 0;
  const emailValid = emailProvided && email.length <= ENQUIRY_LIMITS.email && EMAIL_PATTERN.test(email);
  const phoneValid =
    phoneProvided &&
    phone.length <= ENQUIRY_LIMITS.phone &&
    PHONE_PATTERN.test(phone) &&
    E164_PATTERN.test(normalizedPhone);

  if (!emailProvided && !phoneProvided) {
    fieldErrors.contact = "Please add an email address or a mobile number.";
  }

  if (emailProvided && !emailValid) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  if (phoneProvided && !phoneValid) {
    fieldErrors.phone = "Please enter a valid mobile number.";
  }

  const preferredInput = toTrimmedString(input.preferredContactMethod);
  const preferred = preferredInput
    ? preferredInput
    : resolvePreferredContactMethod({
        email: emailProvided ? email : "",
        phone: phoneProvided ? phone : "",
        preferredContactMethod: "",
      });

  if (!emailProvided && !phoneProvided) {
    // The missing contact details are already reported above; no separate preferred-method error.
  } else if (!isContactMethod(preferred)) {
    fieldErrors.preferredContactMethod = "Please choose how you’d like to be contacted.";
  } else if (preferred === "email" && !emailValid) {
    fieldErrors.preferredContactMethod = "Please add a valid email address to be contacted by email.";
  } else if ((preferred === "text" || preferred === "phone") && !phoneValid) {
    fieldErrors.preferredContactMethod = "Please add a valid mobile number to be contacted by phone or text.";
  }

  if (message.length > ENQUIRY_LIMITS.message) {
    fieldErrors.message = `Please keep this to ${ENQUIRY_LIMITS.message} characters or fewer.`;
  }

  if (Object.keys(fieldErrors).length > 0 || !enquirerType || !mathsCourse || !isContactMethod(preferred)) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      enquirerType,
      studentName: needsStudentName ? studentNameInput : contactName,
      contactName,
      contactRelationship: enquirerType === "student-adult" ? "self" : "parent-guardian",
      mathsCourse,
      email: emailValid ? email : null,
      phone: phoneValid ? normalizedPhone : null,
      preferredContactMethod: preferred,
      message,
    },
  };
}
