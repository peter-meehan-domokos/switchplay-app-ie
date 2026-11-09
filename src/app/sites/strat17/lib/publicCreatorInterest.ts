import { formatPhoneAsE164, normalizePhoneNumberFallback } from "@/lib/phoneCountries";

export type CreatorInterestFormValues = {
  name: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  age: string;
  location: string;
  creatorIdea: string;
  additionalInformation: string;
  companyWebsite: string;
};

export type CreatorInterestRequestData = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  phoneCountryCode?: unknown;
  age?: unknown;
  location?: unknown;
  creatorIdea?: unknown;
  additionalInformation?: unknown;
  companyWebsite?: unknown;
};

export type ValidatedCreatorInterestData = {
  name: string;
  email: string | null;
  phone: string | null;
  age: number;
  location: string;
  creatorIdea: string;
  additionalInformation: string;
};

export type CreatorInterestFieldName = keyof CreatorInterestFormValues;

export type CreatorInterestFieldErrors = Partial<Record<CreatorInterestFieldName | "contact", string>>;

export type CreatorInterestSuccessResponse = {
  ok: true;
};

export type CreatorInterestErrorResponse = {
  ok: false;
  error: string;
  fieldErrors?: CreatorInterestFieldErrors;
};

export const CREATOR_INTEREST_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  ageMin: 1,
  ageMax: 120,
  location: 120,
  creatorIdea: 1200,
  additionalInformation: 1200,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s()-]+$/;

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const normalizePhoneNumber = normalizePhoneNumberFallback;

function parseAge(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }

  return Number.NaN;
}

export function validateCreatorInterestInput(input: CreatorInterestRequestData):
  | { ok: true; data: ValidatedCreatorInterestData }
  | { ok: false; fieldErrors: CreatorInterestFieldErrors } {
  const name = toTrimmedString(input.name);
  const email = toTrimmedString(input.email).toLowerCase();
  const phone = toTrimmedString(input.phone);
  const phoneCountryCode = toTrimmedString(input.phoneCountryCode);
  const normalizedPhone = formatPhoneAsE164(phone, phoneCountryCode);
  const location = toTrimmedString(input.location);
  const creatorIdea = toTrimmedString(input.creatorIdea);
  const additionalInformation = toTrimmedString(input.additionalInformation);
  const age = parseAge(input.age);
  const fieldErrors: CreatorInterestFieldErrors = {};

  if (!name) {
    fieldErrors.name = "Please enter your name.";
  } else if (name.length > CREATOR_INTEREST_LIMITS.name) {
    fieldErrors.name = `Name must be ${CREATOR_INTEREST_LIMITS.name} characters or fewer.`;
  }

  if (!email && !phone) {
    fieldErrors.contact = "Please provide either an email address or a mobile phone number.";
  }

  if (email && (email.length > CREATOR_INTEREST_LIMITS.email || !EMAIL_PATTERN.test(email))) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  if (phone.length > CREATOR_INTEREST_LIMITS.phone) {
    fieldErrors.phone = `Mobile phone number must be ${CREATOR_INTEREST_LIMITS.phone} characters or fewer.`;
  } else if (phone && (!PHONE_PATTERN.test(phone) || normalizedPhone.length < 5)) {
    fieldErrors.phone = "Please enter a valid mobile phone number.";
  }

  if (!Number.isFinite(age)) {
    fieldErrors.age = "Please enter your age.";
  } else if (!Number.isInteger(age)) {
    fieldErrors.age = "Please enter your age as a whole number.";
  } else if (age < CREATOR_INTEREST_LIMITS.ageMin) {
    fieldErrors.age = "Please enter a valid age.";
  } else if (age > CREATOR_INTEREST_LIMITS.ageMax) {
    fieldErrors.age = "Please enter a valid age.";
  }

  if (!location) {
    fieldErrors.location = "Please tell us where you are based.";
  } else if (location.length > CREATOR_INTEREST_LIMITS.location) {
    fieldErrors.location = `Location must be ${CREATOR_INTEREST_LIMITS.location} characters or fewer.`;
  }

  if (!creatorIdea) {
    fieldErrors.creatorIdea = "Please tell us what you might want to share.";
  } else if (creatorIdea.length > CREATOR_INTEREST_LIMITS.creatorIdea) {
    fieldErrors.creatorIdea = `Please keep this to ${CREATOR_INTEREST_LIMITS.creatorIdea} characters or fewer.`;
  }

  if (additionalInformation.length > CREATOR_INTEREST_LIMITS.additionalInformation) {
    fieldErrors.additionalInformation =
      `Please keep this to ${CREATOR_INTEREST_LIMITS.additionalInformation} characters or fewer.`;
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
      age,
      location,
      creatorIdea,
      additionalInformation,
    },
  };
}
