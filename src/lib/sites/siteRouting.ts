import { isProductionHost, isSiteId, resolveSite, type SiteId } from "./siteResolver";

// Top-level application routes that are never rewritten to a website. A test fails if src/app gains a
// top-level folder that is neither listed here, "sites" nor "step-visuals".
export const RESERVED_APP_SEGMENTS = [
  "api",
  "creator",
  "decks",
  "dev",
  "internal",
  "library",
  "login",
  "progress",
  "_next",
] as const;

export const STEP_VISUALS_SEGMENT = "step-visuals";
export const SITE_COOKIE_NAME = "site";
export const SITE_QUERY_PARAM = "site";

const STEP_VISUALS_SITE: SiteId = "puckle";

export type SiteRouteDecision =
  | { kind: "pass" }
  | { kind: "notFound" }
  | { kind: "rewrite"; pathname: string }
  | { kind: "setSite"; site: SiteId };

type DecideInput = {
  host: string | null | undefined;
  pathname: string;
  method: string;
  siteCookie?: string | null;
  siteQuery?: string | null;
};

export function decideSiteRoute({ host, pathname, method, siteCookie, siteQuery }: DecideInput): SiteRouteDecision {
  const isSafeMethod = method === "GET" || method === "HEAD";
  if (isSafeMethod && !isProductionHost(host) && isSiteId(siteQuery)) {
    return { kind: "setSite", site: siteQuery };
  }

  const firstSegment = pathname.split("/")[1] ?? "";

  if (firstSegment === "sites") return { kind: "notFound" };
  if ((RESERVED_APP_SEGMENTS as readonly string[]).includes(firstSegment)) return { kind: "pass" };

  const site = resolveSite({ host, siteCookie });

  if (firstSegment === STEP_VISUALS_SEGMENT) {
    return site === STEP_VISUALS_SITE ? { kind: "pass" } : { kind: "notFound" };
  }

  return { kind: "rewrite", pathname: `/sites/${site}${pathname === "/" ? "" : pathname}` };
}
