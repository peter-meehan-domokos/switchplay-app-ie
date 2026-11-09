import { cache } from "react";
import { cookies, headers } from "next/headers";
import { SITE_COOKIE_NAME } from "./siteRouting";
import { resolveSite } from "./siteResolver";

// Resolved once per request; the proxy and /login share the same resolver.
export const getCurrentSite = cache(async () => {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);

  return resolveSite({
    host: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    siteCookie: cookieStore.get(SITE_COOKIE_NAME)?.value,
  });
});
