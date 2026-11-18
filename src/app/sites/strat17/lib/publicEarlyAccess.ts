import { formatPhoneAsE164, normalizePhoneNumberFallback } from "@/lib/phoneCountries";

export type EarlyAccessFormValues = {
  name: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  goals: string;
  additionalInformation: string;
  companyWebsite: string;
};

export type EarlyAccessRequestData = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  phoneCountryCode?: unknown;
  goals?: unknown;
  additionalInformation?: unknown;
  companyWebsite?: unknown;
};

export type ValidatedEarlyAccessData = {
  name: string;
  email: string | null;
  phone: string | null;
  goals: string;
  additionalInformation: string;
};

export type EarlyAccessFieldName = keyof EarlyAccessFormValues;

export type EarlyAccessFieldErrors = Partial<Record<EarlyAccessFieldName | "contact", string>>;

export type EarlyAccessSuccessResponse = {
  ok: true;
  message?: string;
};

export type EarlyAccessErrorResponse = {
  ok: false;
  error: string;
  fieldErrors?: EarlyAccessFieldErrors;
};

export const EARLY_ACCESS_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  goals: 800,
  additionalInformation: 800,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s()-]+$/;

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const normalizePhoneNumber = normalizePhoneNumberFallback;

export function validateEarlyAccessInput(input: EarlyAccessRequestData):
  | { ok: true; data: ValidatedEarlyAccessData }
  | { ok: false; fieldErrors: EarlyAccessFieldErrors } {
  const name = toTrimmedString(input.name);
  const email = toTrimmedString(input.email).toLowerCase();
  const phone = toTrimmedString(input.phone);
  const phoneCountryCode = toTrimmedString(input.phoneCountryCode);
  const normalizedPhone = formatPhoneAsE164(phone, phoneCountryCode);
  const goals = toTrimmedString(input.goals);
  const additionalInformation = toTrimmedString(input.additionalInformation);
  const fieldErrors: EarlyAccessFieldErrors = {};

  if (!name) {
    fieldErrors.name = "Please enter your name.";
  } else if (name.length > EARLY_ACCESS_LIMITS.name) {
    fieldErrors.name = `Name must be ${EARLY_ACCESS_LIMITS.name} characters or fewer.`;
  }

  if (!email && !phone) {
    fieldErrors.contact = "Please provide either an email address or a mobile phone number.";
  }

  if (email && (email.length > EARLY_ACCESS_LIMITS.email || !EMAIL_PATTERN.test(email))) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  if (phone.length > EARLY_ACCESS_LIMITS.phone) {
    fieldErrors.phone = `Mobile phone number must be ${EARLY_ACCESS_LIMITS.phone} characters or fewer.`;
  } else if (phone && (!PHONE_PATTERN.test(phone) || normalizedPhone.length < 5)) {
    fieldErrors.phone = "Please enter a valid mobile phone number.";
  }

  if (goals.length > EARLY_ACCESS_LIMITS.goals) {
    fieldErrors.goals = `Please keep this to ${EARLY_ACCESS_LIMITS.goals} characters or fewer.`;
  }

  if (additionalInformation.length > EARLY_ACCESS_LIMITS.additionalInformation) {
    fieldErrors.additionalInformation =
      `Please keep this to ${EARLY_ACCESS_LIMITS.additionalInformation} characters or fewer.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      name,
      email: email || null,
      phone: normalizedPhone || null,
      goals,
      additionalInformation,
    },
  };
}
