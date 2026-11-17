/**
 * Where pre-launch members may go. Pure path classification used by the proxy.
 *
 * Pages: only the learning areas are restricted. Everything else (public site, login, account emails) is open.
 * APIs: fail closed. Only the groups below stay open; any other /api path is part of the unfinished platform.
 */
export const PRELAUNCH_RESTRICTED_PAGE_SEGMENTS = ["decks", "library", "progress", "creator"] as const;

/** Prefix match on a path segment boundary. */
const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Registration, sign-in/out, tuition and interest enquiries, parental approval, account emails, onboarding status. */
export const PRELAUNCH_OPEN_API_PREFIXES = [
  "/api/auth", "/api/public", "/api/account-actions", "/api/account/onboarding", "/api/account/parental-approval",
] as const;

export type PrelaunchPathKind = "restricted-page" | "restricted-api" | "open";

export function classifyPrelaunchPath(pathname: string): PrelaunchPathKind {
  if (under(pathname, "/api")) return PRELAUNCH_OPEN_API_PREFIXES.some(prefix => under(pathname, prefix)) ? "open" : "restricted-api";
  const first = pathname.split("/")[1] ?? "";
  return (PRELAUNCH_RESTRICTED_PAGE_SEGMENTS as readonly string[]).includes(first) ? "restricted-page" : "open";
}

/** The Puckle page that every restricted page is shown as for a pre-launch member. */
export const PRELAUNCH_REWRITE_PATH = "/sites/puckle/prelaunch";

export type PrelaunchRouteDecision = { kind: "pass" } | { kind: "rewrite"; pathname: string } | { kind: "blockApi" };

/**
 * `access` is null when there is no valid signed session (the existing sign-in screen or 401 applies),
 * "normal" for an exempt account and "prelaunch" for any other signed-in account.
 */
export function decidePrelaunchRoute(input: { pathname: string; access: "normal" | "prelaunch" | null }): PrelaunchRouteDecision {
  if (input.access !== "prelaunch") return { kind: "pass" };
  const kind = classifyPrelaunchPath(input.pathname);
  if (kind === "restricted-page") return { kind: "rewrite", pathname: PRELAUNCH_REWRITE_PATH };
  if (kind === "restricted-api") return { kind: "blockApi" };
  return { kind: "pass" };
}
