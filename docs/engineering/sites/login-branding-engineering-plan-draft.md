# Login Branding — Investigation and Proposed Implementation (Draft)

**Status:** Draft for approval. **Nothing has been implemented or changed.**
**Parent plan:** [multisite-engineering-plan.md](./multisite-engineering-plan.md) §4.6 (this document replaces that section's proposal if approved).
**Depends on:** the `siteResolver` proposed in the parent plan (`src/lib/sites/siteResolver.ts`, pure host/cookie → site id).

---

## 1. Required behaviour and constraints

Every **unauthenticated** login experience shows the brand of the current domain (`puckle.co` → Puckle, `switchplay.ie` → Switchplay, `strat17.com` → Strat17): `/login`, the embedded login screens on application routes, the support email in login-related errors, relevant page titles, and visibility of the Step Visuals header link.

Constraints: smallest practical change; no change to authentication logic, sessions, cookies, permissions, redirects or login behaviour; no login UI redesign; no change to the authenticated application's appearance/behaviour; reuse `siteResolver`; standard React/Next.js (no `window` globals, context providers, feature flags or elaborate abstractions).

---

## 2. Investigation: where branding is hard-coded and who uses it

### 2.1 Component usage trace

| Component | Used by | Authenticated app uses it? |
|---|---|---|
| `components/brand/SwitchplayBrandLink` (server; `next/font`; renders `SWITCH<span>PLAY</span>`, `aria-label="SWITCHPLAY home"`) | `PublicHeader`, `EmbeddedAuthScreen` | **No** |
| `components/public-site/PublicHeader` (async server; has "Step Visuals" link) | `/login`, `PublicAuthLayout` (unused), and today's `/`, `/contact`, `/privacy` (these move to `sites/strat17` and stop using it, per the parent plan) | **No** (after the move, login only) |
| `components/auth/AuthScreen` (**client**; eyebrow `Switchplay`; renders `SupportErrorMessage` on failure) | `/login`, `PublicAuthLayout` (unused), `EmbeddedAuthScreen` | **No** (only shown when logged out) |
| `components/auth/EmbeddedAuthScreen` (server, sync; brand row + `AuthScreen`) | 8 pages, each `if (!user) return <EmbeddedAuthScreen />`: `/decks`, `/library`, `/library/[deckTemplateId]`, `/progress`, `/creator/new`, `/creator/edit/[deckTemplateId]`, `/creator/info-cards/new`, `/creator/info-cards/[infoCardId]` | No — rendered only in the logged-out branch |
| `components/support/SupportErrorMessage` (shows `info@switchplay.ie` + `/contact` link) | `AuthScreen` (login), **`CreatorDragLab` (authenticated creator UI)**, the three public forms | **Yes (one use: `CreatorDragLab`)** |
| `SUPPORT_EMAIL` constant (same file) | `SupportErrorMessage`, `/contact`, `/privacy` | Indirectly |
| `PublicAuthLayout` | nothing (orphaned) | No |

Consequence: **only `SupportErrorMessage` is shared with the authenticated application.** All other files in the login chain are used exclusively by unauthenticated screens.

### 2.2 Hard-coded branding to remove (login experience only)

1. Header brand link text and `aria-label` (`SwitchplayBrandLink`) — on `/login` and on embedded screens.
2. `AuthScreen` eyebrow `"Switchplay"` — on `/login` and on embedded screens.
3. `SupportErrorMessage` email `info@switchplay.ie` — in the login failure message.
4. Header "Step Visuals" link (`PublicHeader`) — a dead (404) link on two of the three domains.
5. Page title: the root layout sets default `SWITCHPLAY — The unofficial way to get there.` and template `%s | SWITCHPLAY`; `/login` and every embedded route inherit it.

### 2.3 Facts that shape the design

- **Every page involved is already dynamic** (they call `getCurrentUser()` → `cookies()`), so reading `headers()` adds no new rendering cost to them. `/login` and the 8 app pages have no nested layouts; only the root layout wraps them.
- The 8 application pages call `<EmbeddedAuthScreen />` with no props from inside server components. An **async** server component can be used the same way (precedent: `PublicHeader` is already async and used in JSX), so those 8 call sites need **no edits** if `EmbeddedAuthScreen` resolves the site itself.
- `AuthScreen` is a client component: it can receive a plain string prop from a server parent; no context, global or client-side detection is needed. Props cross the boundary as serialisable strings.
- `<title>` cannot be set from a component; it needs `metadata`/`generateMetadata` at page or layout level.
- Nothing else in login branding relates to auth: the login form, `/api/auth/login`, `returnTo`, redirects and cookies are untouched by any change below.

---

## 3. Recommended approach

### 3.1 Principle: resolve the site once per request at the server boundary; pass a `site` id down as a prop

Two server boundaries render unauthenticated login UI, so site resolution happens in exactly two places:

- `src/app/login/page.tsx` (a server page; already awaits `searchParams`, `getCurrentUser`).
- `EmbeddedAuthScreen` (becomes an async server component, covering all 8 application pages).

Both call one small helper:

```ts
// src/lib/sites/getCurrentSite.ts   (server-only)
export const getCurrentSite = cache(async () => {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return resolveSite({ host: h.get("x-forwarded-host") ?? h.get("host"), siteCookie: c.get("site")?.value });
});
```

`cache()` (React) de-duplicates within a request, so the two boundaries never resolve twice. It is a thin wrapper over the existing `siteResolver`; it adds **no new identification mechanism**. The resolved value is a literal-union site id (`"strat17" | "puckle" | "switchplay"`) and is passed down as an optional `site` prop. Brand strings come from a tiny pure table:

```ts
// src/lib/sites/siteBrands.ts   (pure; safe to import from client code)
export const siteBrands = {
  strat17:    { name: "Strat17",    titleName: "STRAT17",    supportEmail: "info@strat17.com",    brandLead: "STRAT",  brandTail: "17" },
  puckle:     { name: "Puckle",     titleName: "PUCKLE",     supportEmail: "info@puckle.co",      brandLead: "PUCKLE", brandTail: ""   },
  switchplay: { name: "Switchplay", titleName: "SWITCHPLAY", supportEmail: "info@switchplay.ie",  brandLead: "SWITCH", brandTail: "PLAY" },
} as const;
```

(Exact typography, including whether Puckle is split into lead/tail, is a styling detail to confirm; the Switchplay entry reproduces today's markup exactly.) This table is *login/app-side* data only. The independent site folders keep their own hard-coded copies (parent plan §4.7), so the table does not couple the three websites.

**Default-preserving props:** every new prop is optional and defaults to today's Switchplay output, so any caller that does not pass it (including anything I have not found) renders exactly as now.

### 3.2 Files to change

New (2, both tiny): `src/lib/sites/siteBrands.ts`, `src/lib/sites/getCurrentSite.ts`. (`siteResolver.ts` is already in the parent plan.)

Existing files modified:

| # | File | Change | Used by authenticated app? |
|---|---|---|---|
| 1 | `components/brand/SwitchplayBrandLink.tsx` | optional `site` prop (default `"switchplay"`); render lead/tail and `aria-label` from `siteBrands[site]`. Default output byte-identical to today. | No |
| 2 | `components/public-site/PublicHeader.tsx` | optional `site` (passed to the brand link) and `showStepVisualsLink` (default `true`) | No (after the parent plan's page move) |
| 3 | `components/auth/AuthScreen.tsx` (client) | optional `site` prop (default `"switchplay"`): eyebrow = `siteBrands[site].name`; pass `siteBrands[site].supportEmail` to `SupportErrorMessage`. No change to state, `handleSubmit`, fetch, redirect or markup otherwise. | No |
| 4 | `components/auth/EmbeddedAuthScreen.tsx` | becomes `async`; `const site = await getCurrentSite()`; pass to `SwitchplayBrandLink` and `AuthScreen`. Callers unchanged. | No |
| 5 | `app/login/page.tsx` | `const site = await getCurrentSite()`; pass to `PublicHeader` (`site`, `showStepVisualsLink={site === "puckle"}`) and `AuthScreen`; add `generateMetadata` (title; see §3.3). Redirect/`returnTo` logic untouched. | No |
| 6 | `components/support/SupportErrorMessage.tsx` | optional `email` prop (default `SUPPORT_EMAIL`). **The only file shared with the authenticated app** — see §3.4. | **Yes (`CreatorDragLab`)** |
| 7 | `app/layout.tsx` | **Optional, decision D2** — site-aware default title/template for embedded routes (§3.3). | Global |

**Not changed:** the 8 application pages, `CreatorDragLab`, `PublicAuthLayout`, `lib/auth`, `/api/auth/*`, `returnTo`, cookies, `globals.css`, any CSS module. Total: **2 new files, 5 required small edits (+1 optional)**, each a few lines.

### 3.3 Page titles — the one place where scope is genuinely larger (decision needed)

`<title>` for `/login` is easy; for the **embedded screens it is not**, because those routes get the *same* root title in both logged-out and logged-in states, and a page cannot tell the title mechanism "I rendered the logged-out branch". Options:

| Option | What it does | Cost / risk |
|---|---|---|
| **T1 (recommended minimum)** | `generateMetadata` in `login/page.tsx` only, using `title: { absolute: "Sign in \| {titleName}" }` (absolute, because the root template would otherwise append `\| SWITCHPLAY`). | One file already being edited; no impact on any other route. **Embedded routes keep a Switchplay title** on Puckle/Strat17 (e.g. a logged-out visitor to `puckle.co/decks` sees a `SWITCHPLAY …` tab title). |
| **T2** | Root `app/layout.tsx` `generateMetadata` resolves the site and returns that site's default title and template. Covers `/login` and all embedded screens in one place. | (a) **Changes the tab title of authenticated application pages too, on non-Switchplay domains** (brand-correct, but a visible change to the authenticated app); on `switchplay.ie` strings are identical. (b) Reading `headers()` in root `generateMetadata` makes **every route dynamic**, including currently-static ones (e.g. `/step-visuals`, `/dev/*`); a rendering/caching change, not a visual one. (c) The default host (localhost, `*.vercel.app`) becomes Puckle (Q1), so existing local titles change. (d) Page-level titles such as `Step visuals lab` would correctly get `\| PUCKLE`. |
| **T3** | `generateMetadata` in each of the 8 app pages, calling `getCurrentUser()` to decide whether to brand. | 8 more application files edited and a duplicated auth lookup; most invasive. **Not recommended.** |

**Recommendation:** T1 now. Choose T2 only if you want titles correct on logged-out embedded screens **and** accept that authenticated tab titles and rendering mode change on the non-Switchplay domains. I'd lean towards T2 being acceptable *only* with an explicit approval and the extra regression checks in §5 (P-dyn); it should not be slipped in as part of "login branding". For T2 the Switchplay strings stay exactly `SWITCHPLAY — The unofficial way to get there.` / `%s | SWITCHPLAY`; other sites use brand-only strings (the tagline is Switchplay marketing copy).

### 3.4 Why `SupportErrorMessage` must change, and how existing behaviour is preserved

It is the only login-chain component that the authenticated app also renders (`CreatorDragLab`, publish error). Without a change the login failure message on `puckle.co` shows `info@switchplay.ie`.

- **Change:** add `email?: string` defaulting to `SUPPORT_EMAIL`; use it in the `mailto:` link and text. `CreatorDragLab` passes nothing → identical output.
- **Preservation:** default path untouched; the `SUPPORT_EMAIL` export is unchanged (it is imported by `/contact` and `/privacy`).
- **Test:** render `SupportErrorMessage` with no props and assert markup identical to a snapshot taken from `main`; render with `email` and assert only the address differs. Existing `CreatorDragLab` tests (if any) must still pass; the diff for that file must be empty.
- **Fallback if you prefer zero edits to anything the app uses (decision D3):** do not touch `SupportErrorMessage`; give `AuthScreen` its own ~5-line failure message (a copy of the current wording with the site's address). Cost: wording duplicated in two places (drift risk); benefit: the authenticated app's dependency graph is untouched. I recommend the prop (safer against drift, trivially testable), but both are viable.

### 3.5 `?site=` override interaction (a complication in the parent plan)

Login and embedded pages read the site from the `site` cookie on non-production hosts. If the proxy only *sets* that cookie on the response, **the first request still renders the previous/default site** (the page reads the request's cookie, not the new one). Therefore the proxy, for non-production hosts only, should handle `?site=<site>` with `Set-Cookie` plus a redirect to the same URL without the query (then every later render, including `/login` and app routes, sees the cookie). This also means the proxy must run for reserved paths (pass-through for rewriting, but still handle `?site=`). The parent plan's "reserved paths are untouched" wording should be refined accordingly; behaviour on the three production domains is unchanged (the override is ignored).

---

## 4. Alternatives considered

| Alternative | Verdict |
|---|---|
| **Resolve per component** (each of header, brand link, `AuthScreen`, etc. calls `getCurrentSite()` itself) | Rejected: repeated resolution, and `AuthScreen` is a client component, so it would need a client-side mechanism. |
| **React context provider** in the root layout | Rejected: forbidden by constraints, adds an app-wide provider and makes the root layout dynamic. |
| **Proxy forwards `x-site` request header; pages read it** | Viable but rejected: introduces a second mechanism that must be stripped/overwritten to avoid spoofing and silently depends on the proxy matcher. Calling `siteResolver` directly from `getCurrentSite()` is stateless and has the same result. |
| **Client-side detection from `window.location`** | Rejected: SSR/hydration mismatch, flash of wrong brand, violates the brief. |
| **Pass brand strings (not `site`) down** | Rejected: more props; `site` + the pure table is simpler and keeps `AuthScreen`'s signature minimal. |
| **Copy `AuthScreen`/`EmbeddedAuthScreen` per site** | Rejected: duplicates auth UI (3 copies of login behaviour) and every embedded call site would need editing. |
| **Leave embedded screens Switchplay-branded** (the parent plan's earlier recommendation) | Superseded: your requirement now includes embedded screens, and the async `EmbeddedAuthScreen` covers them with **zero edits to the 8 app pages**. |
| **Resolve site in each of the 8 app pages and pass it in** | Rejected: 8 application files edited for no gain over one component. |

---

## 5. Regression risks and test strategy (no manual testing required)

### 5.1 Risks

| Risk | Likelihood | Control |
|---|---|---|
| Default output of a changed component differs from today (markup, aria-label, class names) | Low | Golden-output tests (A1, A2) |
| `async` `EmbeddedAuthScreen` breaks one of the 8 callers (types, Suspense, streaming) | Low | Typecheck + build + request-level tests (B1) |
| `SupportErrorMessage` change alters `CreatorDragLab` output | Very low | A3, empty diff on `CreatorDragLab` |
| Login behaviour affected (form, redirect, cookies) | Very low (not touched) | P-diff allowlist (C1); existing login API tests; B3 |
| Site resolved incorrectly (www/port/override on prod) | Low | `siteResolver` unit tests from the parent plan (T1, T5) + B2 |
| T2 only: authenticated titles change; routes become dynamic | Moderate if T2 is chosen | B5, route-table check |
| Default host becomes Puckle, changing local/preview login brand from SWITCHPLAY | Certain (by decision Q1) | Documented; B2 asserts it deliberately |
| Server/client boundary: non-serialisable prop | None (string id) | Typecheck |

### 5.2 Tests

**A. Component-level (existing unit runner, `node --import tsx --test`; existing tests already use `react-dom/server`)**
- A1 `SwitchplayBrandLink`: no props → markup identical to a snapshot generated from current `main`; each `site` → expected text/`aria-label`.
- A2 `AuthScreen` (via `renderToStaticMarkup`, initial state): default → identical to snapshot; each `site` → eyebrow differs only. `PublicHeader` default (incl. Step Visuals link present) identical; with `showStepVisualsLink={false}` only that link is absent.
- A3 `SupportErrorMessage`: default identical; with `email` only the address differs; `SUPPORT_EMAIL` export unchanged.
- A4 `siteBrands`: all three sites have non-empty strings; Switchplay entry equals today's literals; no entry contains another site's name.
- Note: components import CSS modules, which `node --test` cannot load; if no loader is present I will use a tiny test-only stub (in the test setup, not the app) or cover these via B instead. I'll confirm feasibility at the start of implementation.

**B. Request-level / browser (Playwright against `next dev`/`next start`, no database needed for logged-out routes)**
- B1 **Golden HTML for the default site:** capture the server-rendered HTML of `/login` and of the 8 embedded routes on current `main` (unauthenticated; no DB access because `getCurrentUser()` returns early without a cookie), then on the branch with the **Switchplay** host (`switchplay.localhost`). Normalise build hashes. Expect **byte-identical HTML**. This is the main protection: it proves the logged-out application screens are unchanged for Switchplay.
- B2 For `puckle.localhost` and `strat17.localhost`: assert on `/login` and all 8 embedded routes that the brand link, `aria-label`, eyebrow and failing-login message email are correct, that **no** "Switchplay"/other-site string appears in the login chrome, and that the Step Visuals link appears on Puckle only (and its target works on Puckle, 404 elsewhere). Also assert the production-domain override is inert (via `siteResolver` tests, since production hosts cannot be reached locally).
- B3 **Login behaviour unchanged:** on each host, submit the existing login API flow (existing `phase2` harness already posts to `/api/auth/login`); assert identical redirect, `Set-Cookie` attributes (`httpOnly`, `sameSite=lax`, `path=/`, no `Domain`, same name/expiry) and `returnTo` handling compared with `main`.
- B4 Title check: `/login` title per site (T1). Under T2: also embedded routes.
- B5 (T2 only) authenticated titles per host; route table shows only expected static→dynamic changes; `/step-visuals` still renders.
- B6 Screenshots of `/login` and one embedded route, default site vs `main` baseline (desktop + iPhone viewport): zero pixel diff for Switchplay; per-site screenshots reviewed by diff against Switchplay showing only the brand text region differs.

**C. Process checks**
- C1 Allow-list diff: the changed set must equal the files in §3.2 (plus the parent plan's allow-list). Any other changed app file fails the check; `CreatorDragLab.tsx`, the 8 app pages, `lib/auth.ts`, `/api/auth/*`, `globals.css` must show **no diff**.
- C2 `npm run typecheck`, `lint`, `test:unit`, `test:integration`, `test:e2e`, plus `test:phase2` where the local harness runs; compare pass/fail with `main`. Any suite I cannot run will be listed explicitly.
- C3 `next build` route table and built CSS for `/login`, `/decks`, `/library`, `/creator`, `/progress` compared with `main`: CSS identical (no CSS file is changed by this work).

---

## 6. Expected scope

- **New:** 2 tiny library files (+ the parent plan's `siteResolver`).
- **Edited:** 5 existing files (`SwitchplayBrandLink`, `PublicHeader`, `AuthScreen`, `EmbeddedAuthScreen`, `login/page.tsx`) + `SupportErrorMessage` (the one app-shared file) + optionally root `layout.tsx` (T2).
- **Roughly 40–60 lines** of changes in total; no CSS, auth, session, cookie, redirect, API or database change; the 8 application pages are untouched.

## 7. Complications summary

1. **Titles on embedded screens** can't be fixed without touching a global (root layout) and, with it, authenticated tab titles and static/dynamic rendering (§3.3). This is the one unexpected cost.
2. **`SupportErrorMessage` is shared with the authenticated creator UI**; the only app-shared edit (§3.4).
3. **`?site=` first-request problem** requires the proxy to redirect after setting the cookie and to run on reserved paths too (§3.5). The parent plan should be adjusted.
4. **Authenticated application still carries Switchplay wording elsewhere** (e.g. `CreatorDragLab` error email, other in-app strings). That is intentionally out of scope here ("do not change the authenticated application"), but a Puckle user *after* login will still see some Switchplay text. Flagged for your awareness.
5. **Default host is Puckle** (Q1), so local `localhost` and `*.vercel.app` login screens change from SWITCHPLAY to PUCKLE unless `?site=switchplay` is used.
6. `PublicHeader` is also used by the public pages **until** the parent plan's move; the changes are default-preserving so ordering of the work does not matter.

## 8. Decisions requiring approval

| # | Decision | Recommendation |
|---|---|---|
| D1 | Approve the design: resolve once at `login/page.tsx` and async `EmbeddedAuthScreen`; pass `site` as an optional prop; `siteBrands` table; edits to the 5 files above. | Approve. |
| D2 | Page titles: T1 (login only), T2 (root layout; also changes authenticated titles on non-Switchplay hosts and makes all routes dynamic), or T3. | T1 now; T2 only on explicit approval. |
| D3 | `SupportErrorMessage`: optional `email` prop (touches an app-shared file, default-preserving) vs. a separate message inside `AuthScreen` (no app-shared file touched, duplicated wording). | Optional prop. |
| D4 | Step Visuals link visibility on the login header: shown on Puckle only (default host Puckle also shows it). | Approve. |
| D5 | Proxy refinement: handle `?site=` by cookie + redirect on non-production hosts, for all paths including reserved ones. | Approve. |
| D6 | Brand typography on the login header: existing upper-case style (`STRAT17`, `PUCKLE`, `SWITCHPLAY`), eyebrow in title case (`Puckle`). | Approve. |
| D7 | Accept that post-login application screens still contain Switchplay wording for now. | Accept. |

No code, configuration or deployment has been changed, and nothing has been committed.
