export type CreatorInterestFormValues = {
  name: string;
  email: string;
  age: string;
  location: string;
  creatorIdea: string;
  additionalInformation: string;
  companyWebsite: string;
};

export type CreatorInterestRequestData = {
  name?: unknown;
  email?: unknown;
  age?: unknown;
  location?: unknown;
  creatorIdea?: unknown;
  additionalInformation?: unknown;
  companyWebsite?: unknown;
};

export type ValidatedCreatorInterestData = {
  name: string;
  email: string;
  age: number;
  location: string;
  creatorIdea: string;
  additionalInformation: string;
};

export type CreatorInterestFieldName = keyof CreatorInterestFormValues;

export type CreatorInterestFieldErrors = Partial<Record<CreatorInterestFieldName, string>>;

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
  ageMin: 18,
  ageMax: 120,
  location: 120,
  creatorIdea: 1200,
  additionalInformation: 1200,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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

  if (!email) {
    fieldErrors.email = "Please enter your email address.";
  } else if (email.length > CREATOR_INTEREST_LIMITS.email || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  if (!Number.isFinite(age)) {
    fieldErrors.age = "Please enter your age.";
  } else if (!Number.isInteger(age)) {
    fieldErrors.age = "Please enter your age as a whole number.";
  } else if (age < CREATOR_INTEREST_LIMITS.ageMin) {
    fieldErrors.age = "You need to be 18 or over to register interest as a creator.";
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
      email,
      age,
      location,
      creatorIdea,
      additionalInformation,
    },
  };
}
