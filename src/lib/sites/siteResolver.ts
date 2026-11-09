export const SITE_IDS = ["strat17", "puckle", "switchplay"] as const;

export type SiteId = (typeof SITE_IDS)[number];

export const DEFAULT_SITE: SiteId = "puckle";

const PRODUCTION_HOSTS: Readonly<Record<string, SiteId>> = {
  "strat17.com": "strat17",
  "puckle.co": "puckle",
  "switchplay.ie": "switchplay",
};

export function isSiteId(value: unknown): value is SiteId {
  return typeof value === "string" && (SITE_IDS as readonly string[]).includes(value);
}

// Lower-cases, takes the first value of a forwarded list, and drops any port, trailing dot and leading "www.".
export function normaliseHost(host: string | null | undefined): string {
  const first = (host ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  const withoutPort = first.replace(/:\d+$/, "").replace(/\.$/, "");
  return withoutPort.startsWith("www.") ? withoutPort.slice(4) : withoutPort;
}

export function isProductionHost(host: string | null | undefined): boolean {
  return Object.hasOwn(PRODUCTION_HOSTS, normaliseHost(host));
}

type ResolveSiteInput = {
  host: string | null | undefined;
  siteCookie?: string | null;
};

// Production domains and <site>.localhost always win; the cookie only applies to other hosts.
export function resolveSite({ host, siteCookie }: ResolveSiteInput): SiteId {
  const normalised = normaliseHost(host);
  if (Object.hasOwn(PRODUCTION_HOSTS, normalised)) return PRODUCTION_HOSTS[normalised];

  const localLabel = normalised.endsWith(".localhost") ? normalised.slice(0, -".localhost".length) : null;
  if (isSiteId(localLabel)) return localLabel;

  return isSiteId(siteCookie) ? siteCookie : DEFAULT_SITE;
}
