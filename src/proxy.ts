import { NextResponse, type NextRequest } from "next/server";
import { isPrelaunchMode, prelaunchAccessFor, type PrelaunchAccess } from "@/lib/prelaunch";
import { SESSION_COOKIE_NAME, readSessionToken } from "@/lib/sessionToken";
import { classifyPrelaunchPath, decidePrelaunchRoute } from "@/lib/sites/prelaunchRouting";
import { resolveSite } from "@/lib/sites/siteResolver";
import { decideSiteRoute, SITE_COOKIE_NAME, SITE_QUERY_PARAM } from "@/lib/sites/siteRouting";

/**
 * Pre-launch gate. Only a signed session (verified signature) is trusted for the account email, never a
 * request parameter. No session means the existing sign-in screen or 401 applies, so this only ever narrows
 * what a signed-in, non-exempt Puckle member can reach. Route handlers still authenticate on their own.
 */
async function prelaunchAccess(request: NextRequest): Promise<PrelaunchAccess | null> {
  const { nextUrl, headers, cookies } = request;
  if (!isPrelaunchMode() || classifyPrelaunchPath(nextUrl.pathname) === "open") return null;
  const site = resolveSite({ host: headers.get("x-forwarded-host") ?? headers.get("host"), siteCookie: cookies.get(SITE_COOKIE_NAME)?.value });
  if (site !== "puckle") return null;
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  return session ? prelaunchAccessFor({ site, email: session.email }) : null;
}

export async function proxy(request: NextRequest) {
  const { nextUrl, method, headers, cookies } = request;

  const decision = decideSiteRoute({
    host: headers.get("x-forwarded-host") ?? headers.get("host"),
    pathname: nextUrl.pathname,
    method,
    siteCookie: cookies.get(SITE_COOKIE_NAME)?.value,
    siteQuery: nextUrl.searchParams.get(SITE_QUERY_PARAM),
  });

  switch (decision.kind) {
    case "setSite": {
      const cleanUrl = nextUrl.clone();
      cleanUrl.searchParams.delete(SITE_QUERY_PARAM);
      const response = NextResponse.redirect(cleanUrl, 307);
      response.cookies.set(SITE_COOKIE_NAME, decision.site, {
        path: "/",
        sameSite: "lax",
        secure: nextUrl.protocol === "https:",
      });
      return response;
    }
    case "rewrite": {
      const rewriteUrl = nextUrl.clone();
      rewriteUrl.pathname = decision.pathname;
      return NextResponse.rewrite(rewriteUrl);
    }
    case "notFound":
      return NextResponse.rewrite(new URL("/sites/__not-found__", request.url));
    case "pass": {
      const gate = decidePrelaunchRoute({ pathname: nextUrl.pathname, access: await prelaunchAccess(request) });
      if (gate.kind === "rewrite") {
        const rewriteUrl = nextUrl.clone();
        rewriteUrl.pathname = gate.pathname;
        rewriteUrl.search = "";
        return NextResponse.rewrite(rewriteUrl, { headers: { "Cache-Control": "private, no-store" } });
      }
      if (gate.kind === "blockApi") {
        return NextResponse.json({ error: "This part of Puckle is not open yet.", code: "PRELAUNCH" }, { status: 403, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
      }
      return NextResponse.next();
    }
  }
}

export const config = {
  matcher: ["/((?!_next/|__nextjs|favicon.ico|.*\\..*).*)"],
};
