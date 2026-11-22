import assert from "node:assert/strict";
import { request } from "node:http";
import { test } from "node:test";

// Requires a running server: SITES_BASE_URL=http://localhost:3011 node --import tsx --test tests/sites-http.check.ts
// (npm run build && npx next start -p 3011). Host headers select the website, exactly as the real domains do.
const baseUrl = process.env.SITES_BASE_URL;
const skip = baseUrl ? false : "set SITES_BASE_URL to a running build to run the HTTP checks";

type Reply = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

function get(path: string, host: string, extraHeaders: Record<string, string> = {}): Promise<Reply> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "GET", headers: { host, ...extraHeaders } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

// `title` is the all-caps brand in the on-page header link and the /login title. `metaName` is the name as written in the page metadata
// (title suffix and og:site_name), and `homeTitle` is the exact homepage <title>; Puckle's are mixed case, the other two use the all-caps brand.
const sites = [
  { host: "strat17.com", name: "Strat17", title: "STRAT17", metaName: "STRAT17", homeTitle: "STRAT17 — The unofficial way to get there.", email: "info@strat17.com", others: ["switchplay", "puckle"] },
  { host: "puckleup.com", name: "Puckle", title: "PUCKLE", metaName: "Puckle", homeTitle: "Puckle — Unpickle your maths.", email: "hello@puckleup.com", others: ["switchplay", "strat17"] },
  { host: "switchplay.ie", name: "Switchplay", title: "SWITCHPLAY", metaName: "SWITCHPLAY", homeTitle: "SWITCHPLAY — The unofficial way to get there.", email: "info@switchplay.ie", others: ["puckle", "strat17"] },
] as const;

// Puckle's "Step Visuals" menu link is hidden for now (SHOW_STEP_VISUALS_LINK in src/app/sites/puckle/components/PublicHeader.tsx); the
// /step-visuals page itself still works on Puckle only. Set this to true when that link is shown again.
const STEP_VISUALS_LINK_SHOWN = false;

const visibleText = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

for (const site of sites) {
  for (const variant of [site.host, `www.${site.host}`]) {
    test(`${variant}: public pages render with the ${site.name} identity, directly and on refresh`, { skip }, async () => {
      for (const path of ["/", "/contact", "/privacy"]) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const reply = await get(path, variant);
          assert.equal(reply.status, 200, `${variant}${path}`);
          const text = visibleText(reply.body).toLowerCase();
          // The Puckle homepage names Switchplay on purpose: the teacher profile credits it as the founder's project and quotes testimonials about it.
          const permitted = site.name === "Puckle" && path === "/" ? ["switchplay"] : [];
          for (const other of site.others.filter((name) => !permitted.includes(name))) assert.ok(!text.includes(other), `${variant}${path} must not mention ${other}`);
          assert.ok(text.includes(site.name.toLowerCase()), `${variant}${path} should name ${site.name}`);
          assert.match(reply.body, new RegExp(`aria-label="${site.title} home"`), `${variant}${path} header brand`);
        }
      }
      const contact = await get("/contact", variant);
      assert.ok(contact.body.includes(`mailto:${site.email}`), "contact email");
      assert.ok(!contact.body.includes('href="/step-visuals"') || site.host === "puckleup.com", "Step Visuals link only on Puckle");
      assert.equal((await get("/", variant)).body.includes('href="/step-visuals"'), STEP_VISUALS_LINK_SHOWN && site.host === "puckleup.com");
    });
  }

  test(`${site.host}: titles, descriptions and social metadata use ${site.name}`, { skip }, async () => {
    const home = (await get("/", site.host)).body;
    assert.ok(home.includes(`<title>${site.homeTitle}</title>`), "homepage title");
    assert.ok(home.includes(`property="og:title" content="${site.homeTitle}"`), "homepage og:title");
    assert.ok(home.includes(`name="twitter:title" content="${site.homeTitle}"`), "homepage twitter:title");
    assert.match(home, new RegExp(`property="og:site_name" content="${site.metaName}"`));
    const contact = (await get("/contact", site.host)).body;
    assert.match(contact, new RegExp(`<title>Contact and support \\| ${site.metaName}</title>`));
    assert.match(contact, new RegExp(`name="description" content="Contact ${site.name} for support`));
    const privacy = (await get("/privacy", site.host)).body;
    assert.match(privacy, new RegExp(`<title>Privacy Policy \\| ${site.metaName}</title>`));
  });

  test(`${site.host}: /login shows ${site.name} branding and the right support email`, { skip }, async () => {
    const login = await get("/login", site.host);
    assert.equal(login.status, 200);
    assert.match(login.body, new RegExp(`<title>Sign in \\| ${site.title}</title>`));
    assert.match(login.body, new RegExp(`aria-label="${site.title} home"`));
    assert.match(login.body, new RegExp(`<p class="eyebrow">${site.name}</p>`));
    assert.equal(login.body.includes('href="/step-visuals"'), STEP_VISUALS_LINK_SHOWN && site.host === "puckleup.com");
  });

  test(`${site.host}: /sites/* is not directly reachable and /step-visuals is Puckle-only`, { skip }, async () => {
    for (const path of ["/sites/puckle", "/sites/strat17/contact", "/sites/switchplay/privacy"]) {
      assert.equal((await get(path, site.host)).status, 404, path);
    }
    assert.equal((await get("/step-visuals", site.host)).status, site.host === "puckleup.com" ? 200 : 404);
    assert.equal((await get("/tuition", site.host)).status, 404, "a page that exists on no website is a 404");
  });
}

// Since the Puckle rebrand, the embedded sign-in shown on these application routes is Puckle-branded on every host.
test("logged-out application screens show the Puckle sign-in branding on every host", { skip }, async () => {
  const routes = ["/decks", "/library", "/progress", "/creator/new"];
  for (const { host } of sites) {
    for (const path of routes) {
      const reply = await get(path, host);
      assert.equal(reply.status, 200, `${host}${path}`);
      assert.match(reply.body, /aria-label="PUCKLE home"/, `${host}${path}`);
      assert.match(reply.body, /<p class="eyebrow">Puckle<\/p>/, `${host}${path}`);
    }
  }
});

test("?site= override works on non-production hosts and is inert on production domains", { skip }, async () => {
  const redirect = await get("/login?returnTo=%2Fdecks&site=switchplay", "localhost:3000");
  assert.equal(redirect.status, 307);
  assert.equal(new URL(String(redirect.headers.location), "http://localhost:3000").search, "?returnTo=%2Fdecks");
  const cookie = String(redirect.headers["set-cookie"]);
  assert.match(cookie, /^site=switchplay;/);

  const withCookie = await get("/login", "localhost:3000", { cookie: "site=switchplay" });
  assert.match(withCookie.body, /<title>Sign in \| SWITCHPLAY<\/title>/);
  const home = await get("/", "localhost:3000", { cookie: "site=strat17" });
  assert.match(home.body, /aria-label="STRAT17 home"/);
  assert.match((await get("/", "localhost:3000")).body, /aria-label="PUCKLE home"/, "unknown hosts default to Puckle");

  for (const host of ["puckleup.com", "www.puckleup.com", "strat17.com", "switchplay.ie"]) {
    const reply = await get("/login?site=strat17", host);
    assert.equal(reply.status, 200, host);
    assert.equal(reply.headers["set-cookie"], undefined, host);
    const ignored = await get("/login", host, { cookie: "site=strat17" });
    assert.ok(!ignored.body.includes(host.includes("strat17") ? "NOPE" : 'aria-label="STRAT17 home"'), `${host} ignores the cookie`);
  }
});

test("*.localhost development hosts select the matching website", { skip }, async () => {
  for (const { host, title } of sites) {
    const label = host.split(".")[0];
    assert.match((await get("/", `${label}.localhost:3000`)).body, new RegExp(`aria-label="${title} home"`));
  }
});
