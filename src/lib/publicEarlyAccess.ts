export type EarlyAccessFormValues = {
  name: string;
  email: string;
  goals: string;
  additionalInformation: string;
  companyWebsite: string;
};

export type EarlyAccessRequestData = {
  name?: unknown;
  email?: unknown;
  goals?: unknown;
  additionalInformation?: unknown;
  companyWebsite?: unknown;
};

export type ValidatedEarlyAccessData = {
  name: string;
  email: string;
  goals: string;
  additionalInformation: string;
};

export type EarlyAccessFieldName = keyof EarlyAccessFormValues;

export type EarlyAccessFieldErrors = Partial<Record<EarlyAccessFieldName, string>>;

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
  goals: 800,
  additionalInformation: 800,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateEarlyAccessInput(input: EarlyAccessRequestData):
  | { ok: true; data: ValidatedEarlyAccessData }
  | { ok: false; fieldErrors: EarlyAccessFieldErrors } {
  const name = toTrimmedString(input.name);
  const email = toTrimmedString(input.email).toLowerCase();
  const goals = toTrimmedString(input.goals);
  const additionalInformation = toTrimmedString(input.additionalInformation);
  const fieldErrors: EarlyAccessFieldErrors = {};

  if (!name) {
    fieldErrors.name = "Please enter your name.";
  } else if (name.length > EARLY_ACCESS_LIMITS.name) {
    fieldErrors.name = `Name must be ${EARLY_ACCESS_LIMITS.name} characters or fewer.`;
  }

  if (!email) {
    fieldErrors.email = "Please enter your email address.";
  } else if (email.length > EARLY_ACCESS_LIMITS.email || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Please enter a valid email address.";
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
      email,
      goals,
      additionalInformation,
    },
  };
}
