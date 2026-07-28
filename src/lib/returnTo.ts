const DEFAULT_RETURN_TO = "/decks";
const PROTOCOL_PATTERN = /[a-z][a-z\d+.-]*:/i;
const LOGIN_PATH_PATTERN = /^\/login(?:[/?#]|$)/;

export function getSafeReturnTo(value: string | string[] | undefined | null) {
  const returnTo = Array.isArray(value) ? value[0] : value;

  if (
    typeof returnTo !== "string" ||
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//") ||
    PROTOCOL_PATTERN.test(returnTo) ||
    LOGIN_PATH_PATTERN.test(returnTo)
  ) {
    return DEFAULT_RETURN_TO;
  }

  return returnTo;
}
