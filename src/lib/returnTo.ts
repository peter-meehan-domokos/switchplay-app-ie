const DEFAULT_RETURN_TO = "/decks";
const PROTOCOL_PATTERN = /[a-z][a-z\d+.-]*:/i;
const LOGIN_PATH_PATTERN = /^\/login(?:[/?#]|$)/;

export function getSafeReturnTo(value: string | string[] | undefined | null) {
  const returnTo = Array.isArray(value) ? value[0] : value;
  if (typeof returnTo !== "string" || returnTo.length > 2048) return DEFAULT_RETURN_TO;
  let decoded = returnTo;
  // Browsers normalize backslashes and some callers decode redirect targets.
  // Validate bounded decoding layers while preserving the original safe URL.
  for (let layer = 0; layer < 4; layer++) {
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded) ||
      PROTOCOL_PATTERN.test(decoded) || LOGIN_PATH_PATTERN.test(decoded)) return DEFAULT_RETURN_TO;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return returnTo;
      decoded = next;
    } catch { return DEFAULT_RETURN_TO; }
  }
  return DEFAULT_RETURN_TO;
}
