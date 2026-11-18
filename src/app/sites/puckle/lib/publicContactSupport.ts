import { formatPhoneAsE164 } from "@/lib/phoneCountries";

export const CONTACT_SUPPORT_PURPOSES = [
  "Technical support",
  "Report an issue",
  "Creator enquiry",
  "Early access enquiry",
  "Partnership or organisation",
  "Press or media",
  "General enquiry",
] as const;

export type ContactSupportPurpose = (typeof CONTACT_SUPPORT_PURPOSES)[number];

export type ContactSupportFormValues = {
  name: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  purpose: string;
  message: string;
  companyWebsite: string;
};

export type ContactSupportRequestData = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  phoneCountryCode?: unknown;
  purpose?: unknown;
  message?: unknown;
  companyWebsite?: unknown;
};

export type ValidatedContactSupportData = {
  name: string;
  email: string | null;
  phone: string | null;
  purpose: ContactSupportPurpose;
  message: string;
};

export type ContactSupportFieldName = keyof ContactSupportFormValues;

export type ContactSupportFieldErrors = Partial<Record<ContactSupportFieldName | "contact", string>>;

export type ContactSupportSuccessResponse = {
  ok: true;
};

export type ContactSupportErrorResponse = {
  ok: false;
  error: string;
  fieldErrors?: ContactSupportFieldErrors;
};

export const CONTACT_SUPPORT_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  message: 2000,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s()-]+$/;

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isContactSupportPurpose(value: string): value is ContactSupportPurpose {
  return CONTACT_SUPPORT_PURPOSES.some((purpose) => purpose === value);
}

export function validateContactSupportInput(input: ContactSupportRequestData):
  | { ok: true; data: ValidatedContactSupportData }
  | { ok: false; fieldErrors: ContactSupportFieldErrors } {
  const name = toTrimmedString(input.name);
  const email = toTrimmedString(input.email).toLowerCase();
  const phone = toTrimmedString(input.phone);
  const phoneCountryCode = toTrimmedString(input.phoneCountryCode);
  const normalizedPhone = formatPhoneAsE164(phone, phoneCountryCode);
  const purpose = toTrimmedString(input.purpose);
  const message = toTrimmedString(input.message);
  const fieldErrors: ContactSupportFieldErrors = {};

  if (!name) {
    fieldErrors.name = "Please enter your name.";
  } else if (name.length > CONTACT_SUPPORT_LIMITS.name) {
    fieldErrors.name = `Name must be ${CONTACT_SUPPORT_LIMITS.name} characters or fewer.`;
  }

  if (!email && !phone) {
    fieldErrors.contact = "Please provide either an email address or a mobile phone number.";
  }

  if (email && (email.length > CONTACT_SUPPORT_LIMITS.email || !EMAIL_PATTERN.test(email))) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  if (phone.length > CONTACT_SUPPORT_LIMITS.phone) {
    fieldErrors.phone = `Mobile phone number must be ${CONTACT_SUPPORT_LIMITS.phone} characters or fewer.`;
  } else if (phone && (!PHONE_PATTERN.test(phone) || normalizedPhone.length < 5)) {
    fieldErrors.phone = "Please enter a valid mobile phone number.";
  }

  if (!purpose) {
    fieldErrors.purpose = "Please choose a purpose.";
  } else if (!isContactSupportPurpose(purpose)) {
    fieldErrors.purpose = "Please choose a valid purpose.";
  }

  if (!message) {
    fieldErrors.message = "Please enter your message.";
  } else if (message.length > CONTACT_SUPPORT_LIMITS.message) {
    fieldErrors.message = `Please keep your message to ${CONTACT_SUPPORT_LIMITS.message} characters or fewer.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const validatedPurpose = purpose as ContactSupportPurpose;

  return {
    ok: true,
    data: {
      name,
      email: email || null,
      phone: normalizedPhone || null,
      purpose: validatedPurpose,
      message,
    },
  };
}
