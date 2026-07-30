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
