import { NextResponse, type NextRequest } from "next/server";
import { decideSiteRoute, SITE_COOKIE_NAME, SITE_QUERY_PARAM } from "@/lib/sites/siteRouting";

export function proxy(request: NextRequest) {
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
    case "pass":
      return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/|__nextjs|favicon.ico|.*\\..*).*)"],
};
