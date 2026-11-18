import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { isPrelaunchMode, prelaunchAccessFor, prelaunchAccessList } from "../src/lib/prelaunch";
import { classifyPrelaunchPath, decidePrelaunchRoute, PRELAUNCH_REWRITE_PATH } from "../src/lib/sites/prelaunchRouting";
import { buildPrelaunchLayout, audienceOf, TUITION_ENQUIRY_HREF } from "../src/app/sites/puckle/lib/prelaunchLayout";
import { guardianLayoutFor } from "../src/components/onboarding/onboardingLayout";
import { joinPrelaunchNotice } from "../src/app/sites/puckle/lib/joinPrelaunchNotice";
import { buildMembershipJoinLayout, initialJoinFlowState, initialJoinFormState, withChoice } from "../src/app/sites/puckle/lib/membershipJoinLayout";

const ON = { PUCKLE_PRELAUNCH_MODE: "1", PUCKLE_PRELAUNCH_ACCESS: " Peter@Puckleup.com ,student1@example.com,, STUDENT2@example.com  " };

test("mode is on only for exactly 1; 0, absent and anything else are off", () => {
  assert.equal(isPrelaunchMode({ PUCKLE_PRELAUNCH_MODE: "1" }), true);
  assert.equal(isPrelaunchMode({ PUCKLE_PRELAUNCH_MODE: " 1 " }), true);
  for (const value of ["0", "", "true", "yes", "2", undefined]) assert.equal(isPrelaunchMode({ PUCKLE_PRELAUNCH_MODE: value }), false, String(value));
  assert.equal(isPrelaunchMode({}), false);
});

test("the access list is trimmed, lower-cased, may hold several addresses, and may be empty or absent", () => {
  assert.deepEqual(prelaunchAccessList(ON), ["peter@puckleup.com", "student1@example.com", "student2@example.com"]);
  for (const value of ["", "   ", ",,", undefined]) assert.deepEqual(prelaunchAccessList({ PUCKLE_PRELAUNCH_ACCESS: value }), [], String(value));
  assert.deepEqual(prelaunchAccessList({}), []);
});

test("an account on the list is normal, anyone else is pre-launch, case and whitespace are ignored", () => {
  assert.equal(prelaunchAccessFor({ site: "puckle", email: "peter@puckleup.com" }, ON), "normal");
  assert.equal(prelaunchAccessFor({ site: "puckle", email: "  PETER@PUCKLEUP.COM " }, ON), "normal");
  assert.equal(prelaunchAccessFor({ site: "puckle", email: "student2@example.com" }, ON), "normal");
  assert.equal(prelaunchAccessFor({ site: "puckle", email: "stranger@example.com" }, ON), "prelaunch");
  assert.equal(prelaunchAccessFor({ site: "puckle", email: "peter@puckleup.com.evil.com" }, ON), "prelaunch");
  assert.equal(prelaunchAccessFor({ site: "puckle", email: "xpeter@puckleup.com" }, ON), "prelaunch");
  for (const email of [null, undefined, ""]) assert.equal(prelaunchAccessFor({ site: "puckle", email }, ON), "prelaunch");
});

test("an empty or absent list exempts nobody, and mode off ignores the list entirely", () => {
  for (const list of ["", undefined]) assert.equal(prelaunchAccessFor({ site: "puckle", email: "peter@puckleup.com" }, { PUCKLE_PRELAUNCH_MODE: "1", PUCKLE_PRELAUNCH_ACCESS: list }), "prelaunch");
  for (const mode of ["0", undefined]) assert.equal(prelaunchAccessFor({ site: "puckle", email: "stranger@example.com" }, { PUCKLE_PRELAUNCH_MODE: mode, PUCKLE_PRELAUNCH_ACCESS: ON.PUCKLE_PRELAUNCH_ACCESS }), "normal");
});

test("Switchplay and Strat17 are never in pre-launch mode", () => {
  for (const site of ["switchplay", "strat17"] as const) assert.equal(prelaunchAccessFor({ site, email: "stranger@example.com" }, ON), "normal");
});

test("path classification: learning pages and every other API are restricted; account, auth, public and parental approval stay open", () => {
  for (const path of ["/decks", "/library", "/library/abc", "/progress", "/creator", "/creator/new", "/creator/info-cards/x"]) assert.equal(classifyPrelaunchPath(path), "restricted-page", path);
  for (const path of ["/api/decks-data", "/api/decks-data/shared", "/api/library/decks", "/api/creator/drafts", "/api/card-templates/x", "/api/deck-templates", "/api/frameworks", "/api/info-cards", "/api/media/protected",
    "/api/users", "/api/items-data/x/tests", "/api/account/public-publishing", "/api/accountx", "/api/authx/login", "/api/publicity", "/api"]) assert.equal(classifyPrelaunchPath(path), "restricted-api", path);
  for (const path of ["/api/auth/login", "/api/auth/logout", "/api/auth/me", "/api/auth/email-verification", "/api/auth/password-reset/request", "/api/public/puckle/membership", "/api/public/puckle/early-access",
    "/api/public/puckle/tuition-context", "/api/account/onboarding", "/api/account/parental-approval", "/api/account-actions/parental-approval", "/api/account-actions/password-reset"]) assert.equal(classifyPrelaunchPath(path), "open", path);
  for (const path of ["/", "/join", "/contact", "/privacy", "/login", "/login/forgot-password", "/step-visuals", "/decksx", "/libraryx"]) assert.equal(classifyPrelaunchPath(path), "open", path);
});

test("route decision: only a signed-in non-exempt member is redirected or blocked", () => {
  assert.deepEqual(decidePrelaunchRoute({ pathname: "/decks", access: "prelaunch" }), { kind: "rewrite", pathname: PRELAUNCH_REWRITE_PATH });
  assert.deepEqual(decidePrelaunchRoute({ pathname: "/api/decks-data", access: "prelaunch" }), { kind: "blockApi" });
  assert.deepEqual(decidePrelaunchRoute({ pathname: "/api/auth/login", access: "prelaunch" }), { kind: "pass" });
  assert.deepEqual(decidePrelaunchRoute({ pathname: "/decks", access: "normal" }), { kind: "pass" });
  assert.deepEqual(decidePrelaunchRoute({ pathname: "/decks", access: null }), { kind: "pass" });
  assert.deepEqual(decidePrelaunchRoute({ pathname: "/api/decks-data", access: null }), { kind: "pass" });
});

// The proxy itself, with real signed sessions.
const saved = { mode: process.env.PUCKLE_PRELAUNCH_MODE, list: process.env.PUCKLE_PRELAUNCH_ACCESS, secret: process.env.SESSION_SECRET };
afterEach(() => {
  for (const [key, value] of [["PUCKLE_PRELAUNCH_MODE", saved.mode], ["PUCKLE_PRELAUNCH_ACCESS", saved.list], ["SESSION_SECRET", saved.secret]] as const) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
const configure = (env: Record<string, string | undefined>) => { process.env.SESSION_SECRET = "unit-test-session-secret"; for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } };
const session = (email: string, secret = "unit-test-session-secret") => new SignJWT({ email, username: "u", sessionVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject("507f1f77bcf86cd799439011").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
const call = async (path: string, options: { email?: string; token?: string; host?: string; method?: string; cookie?: string } = {}) => {
  const token = options.token ?? (options.email ? await session(options.email) : undefined);
  const host = options.host ?? "puckleup.com";
  return proxy(new NextRequest(`https://${host}${path}`, { method: options.method ?? "GET", headers: { host, ...(token ? { cookie: `switchplay_session=${token}` } : {}) } }));
};
const rewritten = (response: Response) => response.headers.get("x-middleware-rewrite");

test("proxy: a signed-in member not on the list is shown the pre-launch page for every learning page", async () => {
  configure(ON);
  for (const path of ["/decks", "/library", "/library/abc", "/progress", "/creator/new"]) {
    const response = await call(path, { email: "stranger@example.com" });
    assert.equal(rewritten(response), `https://puckleup.com${PRELAUNCH_REWRITE_PATH}`, path);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
});

test("proxy: restricted APIs answer 403 PRELAUNCH to that member, for every method, and open APIs pass", async () => {
  configure(ON);
  for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
    const response = await call("/api/decks-data", { email: "stranger@example.com", method });
    assert.equal(response.status, 403, method); assert.deepEqual(await response.json(), { error: "This part of Puckle is not open yet.", code: "PRELAUNCH" });
  }
  for (const path of ["/api/auth/login", "/api/auth/logout", "/api/public/puckle/early-access", "/api/account/parental-approval", "/api/account/onboarding", "/api/account-actions/password-reset"]) {
    const response = await call(path, { email: "stranger@example.com", method: "POST" });
    assert.equal(response.headers.get("x-middleware-next"), "1", path); assert.equal(response.status, 200, path);
  }
});

test("proxy: listed accounts (any case, any spacing) and signed-out visitors pass through unchanged", async () => {
  configure(ON);
  for (const email of ["peter@puckleup.com", "PETER@puckleup.COM", "Student1@Example.com"]) {
    for (const path of ["/decks", "/api/decks-data"]) assert.equal((await call(path, { email })).headers.get("x-middleware-next"), "1", `${email} ${path}`);
  }
  for (const path of ["/decks", "/library", "/api/decks-data"]) assert.equal((await call(path)).headers.get("x-middleware-next"), "1", path);
});

test("proxy: a forged, expired-signature or wrongly signed token confers nothing and the account email is never taken from the request", async () => {
  configure(ON);
  // A token signed with another secret is not a session: treated as signed out (existing 401 / sign-in screen).
  assert.equal((await call("/api/decks-data", { token: await session("peter@puckleup.com", "another-secret") })).headers.get("x-middleware-next"), "1");
  assert.equal((await call("/api/decks-data", { token: "not.a.token" })).headers.get("x-middleware-next"), "1");
  // An allow-listed address in a query string, header or cookie other than the session changes nothing for a real stranger.
  const response = await proxy(new NextRequest("https://puckleup.com/api/decks-data?email=peter@puckleup.com", { headers: { host: "puckleup.com", "x-email": "peter@puckleup.com", cookie: `switchplay_session=${await session("stranger@example.com")}; email=peter@puckleup.com` } }));
  assert.equal(response.status, 403);
});

test("proxy: mode off, an empty list and other websites are all unaffected", async () => {
  configure({ PUCKLE_PRELAUNCH_MODE: "0", PUCKLE_PRELAUNCH_ACCESS: undefined });
  assert.equal((await call("/decks", { email: "stranger@example.com" })).headers.get("x-middleware-next"), "1");
  assert.equal((await call("/api/decks-data", { email: "stranger@example.com" })).status, 200);
  configure({ PUCKLE_PRELAUNCH_MODE: undefined, PUCKLE_PRELAUNCH_ACCESS: ON.PUCKLE_PRELAUNCH_ACCESS });
  assert.equal((await call("/decks", { email: "stranger@example.com" })).headers.get("x-middleware-next"), "1");
  configure({ PUCKLE_PRELAUNCH_MODE: "1", PUCKLE_PRELAUNCH_ACCESS: "" });
  assert.equal(rewritten(await call("/decks", { email: "peter@puckleup.com" })), `https://puckleup.com${PRELAUNCH_REWRITE_PATH}`);
  configure(ON);
  for (const host of ["switchplay.ie", "strat17.com", "www.switchplay.ie"]) for (const path of ["/decks", "/api/decks-data", "/library"]) {
    const response = await call(path, { email: "stranger@example.com", host });
    assert.equal(response.headers.get("x-middleware-next"), "1", `${host}${path}`); assert.equal(response.status, 200);
  }
  // A local review cookie selecting another website is not affected either.
  const cookieSite = await proxy(new NextRequest("http://localhost:3000/decks", { headers: { host: "localhost:3000", cookie: `site=switchplay; switchplay_session=${await session("stranger@example.com")}` } }));
  assert.equal(cookieSite.headers.get("x-middleware-next"), "1");
});

test("public Puckle pages, login and the registration and sign-in APIs are never gated", async () => {
  configure(ON);
  for (const path of ["/", "/join", "/contact", "/privacy", "/login", "/login/forgot-password", "/step-visuals"]) assert.ok(!rewritten(await call(path, { email: "stranger@example.com" }))?.includes("prelaunch"), path);
});

test("layout wording: student, teacher and other audiences, exactly as agreed", () => {
  const student = buildPrelaunchLayout({ category: "student" });
  assert.deepEqual([student.kicker, student.heading, student.lead, student.body, student.followUp.heading, student.followUp.text], ["EARLY ACCESS", "Welcome to Puckle!", "New maths content starts arriving in early December.",
    "You're here from the beginning. Improve your maths and help shape what we create next.", "Want to get started now?", "Maths lessons with Puckle are available today. Or join us for a free introductory session to see how the platform works and discuss your maths."]);
  assert.deepEqual(student.followUp.action, { kind: "enquire", label: "Request a free session", href: TUITION_ENQUIRY_HREF });
  assert.equal(TUITION_ENQUIRY_HREF, "/#early-access");
  const teacher = buildPrelaunchLayout({ category: "teacher" });
  assert.equal(teacher.lead, "New maths content starts arriving in early December.");
  assert.equal(teacher.body, "You're joining us from the beginning, with an opportunity to help shape how Puckle supports teachers and students.");
  const other = buildPrelaunchLayout({ category: undefined });
  assert.equal(other.lead, "We're opening in early December.");
  assert.equal(other.body, "You're joining Puckle at the beginning. We're creating new ways to learn maths, and we'd love you to be part of what comes next.");
  for (const layout of [teacher, other]) {
    assert.equal(layout.followUp.heading, "Thanks for your interest!");
    assert.equal(layout.followUp.text, "We've received your details and will be in touch. In the meantime, if you have more ideas or questions, you're always welcome to contact us.");
    assert.deepEqual(layout.followUp.action, { kind: "email", address: "hello@puckleup.com", href: "mailto:hello@puckleup.com" }); // an email link, never a button or a second form
    assert.equal(layout.parentApproval, null);
  }
  assert.deepEqual(["student", "teacher", "other"], [audienceOf("student"), audienceOf("teacher"), audienceOf("anything")]);
  assert.equal(audienceOf(null), "other");
});

test("layout: the parent section is only for a student who still needs approval, and never says group experiences or implies general approval", () => {
  const approval = (status: string, eligibility = "eligible", canRequest = true) => ({ eligibility, status, canRequest, guardianEmail: status === "pending" ? "m***@example.com" : null, delivery: status === "pending" ? "sent" : null }) as never;
  for (const status of ["not-requested", "pending", "declined", "withdrawn"]) {
    const layout = buildPrelaunchLayout({ category: "student", approval: approval(status) });
    assert.equal(layout.parentApproval?.heading, "Parent or guardian approval", status);
    assert.equal(layout.parentApproval?.text, "Some sharing features require permission from a parent or guardian.");
    assert.doesNotMatch(layout.parentApproval!.text + layout.parentApproval!.heading, /group experience/i, status);
    // The request form keeps the original wording exactly, in pre-launch and normal modes alike.
    assert.deepEqual(layout.parentApproval?.guardian, guardianLayoutFor({ actorId: "", show: true, student: true, approval: approval(status) }, false), status);
  }
  assert.equal(buildPrelaunchLayout({ category: "student", approval: approval("approved", "eligible", false) }).parentApproval, null);
  assert.equal(buildPrelaunchLayout({ category: "student", approval: approval("not-requested", "not-required", false) }).parentApproval, null);
  assert.equal(buildPrelaunchLayout({ category: "student", approval: approval("not-requested", "age-unknown", false) }).parentApproval, null);
  assert.equal(buildPrelaunchLayout({ category: "student" }).parentApproval, null);
  assert.equal(buildPrelaunchLayout({ category: "teacher", approval: approval("not-requested") }).parentApproval, null);
  assert.equal(buildPrelaunchLayout({ category: undefined, approval: approval("not-requested") }).parentApproval, null);
});

test("Join pre-launch wording: student and teacher only, and only in pre-launch mode", () => {
  assert.deepEqual(joinPrelaunchNotice("student"), { heading: "Join Puckle now", text: "New maths content starts arriving in early December. Sign up today to be among the first to use it.",
    tuition: { lead: "Want to get started now?", text: "Maths lessons with Puckle are already available, using our interactive learning platform." } });
  assert.deepEqual(joinPrelaunchNotice("teacher"), { heading: "Join Puckle as a teacher", text: "New maths content starts arriving in early December. Join now to get early access and help shape how Puckle supports maths teaching and learning.", tuition: null });
  assert.equal(joinPrelaunchNotice("interest"), null);
  const layoutOf = (choice: "student" | "teacher" | "interest", prelaunch?: boolean) => buildMembershipJoinLayout(withChoice(initialJoinFormState, choice), initialJoinFlowState, {}, 0, "2026-11-17", prelaunch);
  // The environment decides which student introduction appears; both stay in the code and never show together.
  assert.equal(layoutOf("student").intro, "Join free to learn maths with Puckle's cards and keep track of your progress.");
  assert.equal(layoutOf("student", false).intro, "Join free to learn maths with Puckle's cards and keep track of your progress.");
  assert.equal(layoutOf("student", true).intro, null);
  assert.equal(layoutOf("teacher", true).intro, "Teachers are welcome to explore Puckle and help shape it. You'll get an ordinary account to try things out.");
  assert.equal(layoutOf("interest", true).intro, "Interested in Puckle? Leave your details and we'll send you occasional updates as it develops.");
  assert.equal(layoutOf("student").prelaunchNotice, null);
  assert.equal(layoutOf("student", true)?.prelaunchNotice?.heading, "Join Puckle now");
  assert.equal(layoutOf("teacher", true)?.prelaunchNotice?.heading, "Join Puckle as a teacher");
  assert.equal(layoutOf("interest", true).prelaunchNotice, null);
  assert.equal(layoutOf("teacher", false).prelaunchNotice, null);
});
