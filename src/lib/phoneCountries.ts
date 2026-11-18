import { getCountryCallingCode, isSupportedCountry, type CountryCode } from "libphonenumber-js";

export const DEFAULT_PHONE_COUNTRY_CODE: CountryCode = "IE";

const PHONE_DECORATION_PATTERN = /[\s()-]/g;
const E164_PATTERN = /^\+[1-9]\d{4,14}$/;

export function getDefaultPhoneCountryCodeFromLocales(locales: readonly string[]) {
  for (const locale of locales) {
    try {
      const region = new Intl.Locale(locale).region;

      if (region && isSupportedCountry(region)) {
        return region;
      }
    } catch {
      // Ignore malformed browser locale values and use the fallback below.
    }
  }

  return DEFAULT_PHONE_COUNTRY_CODE;
}

/** A valid country from Vercel's x-vercel-ip-country value, or null (absent on local development and in tests). */
export function parseVisitorCountry(value: string | null | undefined): CountryCode | null {
  const code = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(code) && isSupportedCountry(code) ? (code as CountryCode) : null;
}

export const visitorCountryFromHeaders = (headers: Pick<Headers, "get">) => parseVisitorCountry(headers.get("x-vercel-ip-country"));

/** The initial phone country: the visitor's IP country, else the browser language, else Ireland. Never overrides a user choice. */
export function resolveInitialPhoneCountry(input: { visitorCountry: string | null | undefined; locales: readonly string[] }): CountryCode {
  return parseVisitorCountry(input.visitorCountry) ?? getDefaultPhoneCountryCodeFromLocales(input.locales);
}

export function normalizePhoneNumberFallback(value: string) {
  return value.trim().replace(PHONE_DECORATION_PATTERN, "");
}

export function formatPhoneAsE164(value: string, countryCode: string | null | undefined) {
  const fallback = normalizePhoneNumberFallback(value);

  if (!fallback) {
    return "";
  }

  if (fallback.startsWith("+")) {
    return E164_PATTERN.test(fallback) ? fallback : fallback;
  }

  if (countryCode && isSupportedCountry(countryCode)) {
    const nationalNumber = fallback.replace(/\D/g, "").replace(/^0+/, "");
    const candidate = `+${getCountryCallingCode(countryCode)}${nationalNumber}`;

    return E164_PATTERN.test(candidate) ? candidate : fallback;
  }

  return fallback;
}
