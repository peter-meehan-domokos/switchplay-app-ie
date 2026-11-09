import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { config, proxy } from "../src/proxy";
import { normaliseHost, resolveSite } from "../src/lib/sites/siteResolver";
import { decideSiteRoute, RESERVED_APP_SEGMENTS } from "../src/lib/sites/siteRouting";

const productionHosts = [
  ["strat17.com", "strat17"],
  ["puckle.co", "puckle"],
  ["switchplay.ie", "switchplay"],
] as const;

test("resolves production domains, www variants, ports and case", () => {
  for (const [host, site] of productionHosts) {
    assert.equal(resolveSite({ host }), site);
    assert.equal(resolveSite({ host: `www.${host}` }), site);
    assert.equal(resolveSite({ host: host.toUpperCase() }), site);
    assert.equal(resolveSite({ host: `${host}:3000` }), site);
    assert.equal(resolveSite({ host: `${host}, example.com` }), site);
  }
});

test("resolves <site>.localhost development hosts", () => {
  assert.equal(resolveSite({ host: "strat17.localhost:3000" }), "strat17");
  assert.equal(resolveSite({ host: "puckle.localhost:3000" }), "puckle");
  assert.equal(resolveSite({ host: "switchplay.localhost" }), "switchplay");
});

test("does not match lookalike hosts and defaults unknown hosts to Puckle", () => {
  for (const host of ["evilpuckle.co", "puckle.co.evil.com", "xswitchplay.ie", "strat17.com.au", "", null, undefined, "localhost:3000", "192.168.1.38:3000", "foo.vercel.app"]) {
    assert.equal(resolveSite({ host }), "puckle", String(host));
  }
  assert.equal(normaliseHost("WWW.Puckle.CO:443"), "puckle.co");
});

test("site cookie applies only off the production domains", () => {
  assert.equal(resolveSite({ host: "localhost:3000", siteCookie: "switchplay" }), "switchplay");
  assert.equal(resolveSite({ host: "foo.vercel.app", siteCookie: "strat17" }), "strat17");
  assert.equal(resolveSite({ host: "localhost:3000", siteCookie: "evil" }), "puckle");
  for (const [host, site] of productionHosts) {
    assert.equal(resolveSite({ host, siteCookie: "puckle" === site ? "strat17" : "puckle" }), site);
    assert.equal(resolveSite({ host: `www.${host}`, siteCookie: "puckle" === site ? "strat17" : "puckle" }), site);
  }
  assert.equal(resolveSite({ host: "strat17.localhost", siteCookie: "puckle" }), "strat17");
});

test("rewrites public paths to the site folder, including site-only pages", () => {
  for (const [host, site] of productionHosts) {
    assert.deepEqual(decideSiteRoute({ host, pathname: "/", method: "GET" }), { kind: "rewrite", pathname: `/sites/${site}` });
    assert.deepEqual(decideSiteRoute({ host, pathname: "/contact", method: "GET" }), { kind: "rewrite", pathname: `/sites/${site}/contact` });
    assert.deepEqual(decideSiteRoute({ host, pathname: "/privacy", method: "GET" }), { kind: "rewrite", pathname: `/sites/${site}/privacy` });
    assert.deepEqual(decideSiteRoute({ host, pathname: "/tuition/year-3", method: "GET" }), { kind: "rewrite", pathname: `/sites/${site}/tuition/year-3` });
  }
});

test("application routes pass through untouched on every host", () => {
  const paths = ["/login", "/decks", "/library", "/library/abc", "/creator/new", "/creator/edit/x", "/progress", "/internal/info-maths", "/dev/maths-fonts", "/api/auth/login", "/api/public/puckle/contact", "/_next/data/x.json"];
  const hosts = ["strat17.com", "www.puckle.co", "switchplay.ie", "localhost:3000", "puckle.localhost:3000", "foo.vercel.app"];
  for (const host of hosts) for (const pathname of paths) {
    assert.deepEqual(decideSiteRoute({ host, pathname, method: "GET" }), { kind: "pass" }, `${host}${pathname}`);
    assert.deepEqual(decideSiteRoute({ host, pathname, method: "POST" }), { kind: "pass" }, `POST ${host}${pathname}`);
  }
  assert.ok(RESERVED_APP_SEGMENTS.includes("login"));
});

test("/step-visuals is served only on Puckle; /sites/* is never directly reachable", () => {
  assert.deepEqual(decideSiteRoute({ host: "puckle.co", pathname: "/step-visuals", method: "GET" }), { kind: "pass" });
  assert.deepEqual(decideSiteRoute({ host: "www.puckle.co", pathname: "/step-visuals/lab", method: "GET" }), { kind: "pass" });
  assert.deepEqual(decideSiteRoute({ host: "localhost:3000", pathname: "/step-visuals", method: "GET" }), { kind: "pass" });
  assert.deepEqual(decideSiteRoute({ host: "localhost:3000", pathname: "/step-visuals", method: "GET", siteCookie: "switchplay" }), { kind: "notFound" });
  for (const host of ["strat17.com", "switchplay.ie", "www.switchplay.ie", "strat17.localhost"]) {
    assert.deepEqual(decideSiteRoute({ host, pathname: "/step-visuals", method: "GET" }), { kind: "notFound" }, host);
  }
  for (const host of ["puckle.co", "strat17.com", "localhost:3000"]) {
    assert.deepEqual(decideSiteRoute({ host, pathname: "/sites/puckle", method: "GET" }), { kind: "notFound" });
    assert.deepEqual(decideSiteRoute({ host, pathname: "/sites/strat17/contact", method: "GET" }), { kind: "notFound" });
  }
});

test("?site= is honoured on non-production hosts only, for GET/HEAD, valid values only", () => {
  assert.deepEqual(decideSiteRoute({ host: "localhost:3000", pathname: "/login", method: "GET", siteQuery: "puckle" }), { kind: "setSite", site: "puckle" });
  assert.deepEqual(decideSiteRoute({ host: "foo.vercel.app", pathname: "/", method: "HEAD", siteQuery: "strat17" }), { kind: "setSite", site: "strat17" });
  assert.deepEqual(decideSiteRoute({ host: "192.168.1.38:3000", pathname: "/decks", method: "GET", siteQuery: "switchplay" }), { kind: "setSite", site: "switchplay" });
  assert.deepEqual(decideSiteRoute({ host: "localhost:3000", pathname: "/login", method: "GET", siteQuery: "evil" }), { kind: "pass" });
  assert.deepEqual(decideSiteRoute({ host: "localhost:3000", pathname: "/api/auth/login", method: "POST", siteQuery: "puckle" }), { kind: "pass" });
  for (const [host] of productionHosts) for (const variant of [host, `www.${host}`]) {
    assert.deepEqual(decideSiteRoute({ host: variant, pathname: "/login", method: "GET", siteQuery: "puckle" }), { kind: "pass" }, variant);
  }
  assert.equal(decideSiteRoute({ host: "puckle.co", pathname: "/", method: "GET", siteQuery: "strat17" }).kind, "rewrite");
});

function request(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(url, { method: init.method ?? "GET", headers: init.headers });
}

test("proxy redirects ?site= to the clean URL with a site cookie, preserving other parameters", () => {
  const response = proxy(request("http://localhost:3000/login?returnTo=%2Fdecks&site=puckle"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost:3000/login?returnTo=%2Fdecks");
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^site=puckle;/);
  assert.match(cookie, /Path=\//i);
  assert.match(cookie, /SameSite=lax/i);
  assert.doesNotMatch(cookie, /Secure/i);
  assert.doesNotMatch(cookie, /Domain=/i);

  const https = proxy(request("https://foo.vercel.app/?site=switchplay"));
  assert.equal(https.headers.get("location"), "https://foo.vercel.app/");
  assert.match(https.headers.get("set-cookie") ?? "", /Secure/i);
});

test("proxy never sets the override on production domains and does not loop", () => {
  for (const host of ["puckle.co", "www.puckle.co", "strat17.com", "switchplay.ie", "www.switchplay.ie"]) {
    const response = proxy(request(`https://${host}/login?site=strat17`, { headers: { host } }));
    assert.equal(response.headers.get("set-cookie"), null, host);
    assert.equal(response.headers.get("location"), null, host);
  }
  const redirected = proxy(request("http://localhost:3000/login"));
  assert.equal(redirected.headers.get("location"), null);
  assert.equal(redirected.headers.get("x-middleware-next"), "1");
});

test("proxy rewrites public paths and leaves reserved routes alone", () => {
  const rewrite = proxy(request("https://puckle.co/tuition", { headers: { host: "puckle.co" } }));
  assert.equal(rewrite.headers.get("x-middleware-rewrite"), "https://puckle.co/sites/puckle/tuition");

  const login = proxy(request("https://puckle.co/login", { headers: { host: "puckle.co" } }));
  assert.equal(login.headers.get("x-middleware-next"), "1");
  assert.equal(login.headers.get("x-middleware-rewrite"), null);

  const notFound = proxy(request("https://strat17.com/step-visuals", { headers: { host: "strat17.com" } }));
  assert.match(notFound.headers.get("x-middleware-rewrite") ?? "", /\/sites\/__not-found__$/);
});

test("proxy matcher skips Next.js internals and files but covers pages, application routes and APIs", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  for (const path of ["/_next/static/chunks/a.js", "/_next/image", "/_next/webpack-hmr", "/__nextjs_original-stack-frames", "/favicon.ico", "/images/sites/puckle/hero-illustration8.png"]) {
    assert.ok(!matcher.test(path), `${path} must not run the proxy`);
  }
  for (const path of ["/", "/contact", "/tuition", "/login", "/decks", "/library/abc", "/api/auth/login", "/step-visuals"]) {
    assert.ok(matcher.test(path), `${path} must run the proxy`);
  }
});
