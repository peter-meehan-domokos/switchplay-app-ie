# Three-Site Public Website — Engineering Plan (Approved)

**Status:** **Approved — ready for implementation.** All decisions (Q1–Q12, R1–R5, D1–D8) are approved; there are no open approval requests. **Nothing has been implemented, changed, deployed or committed.** Production domain/DNS/Vercel changes are **not** part of the code implementation and require the separate cutover approval described in §8.
**Supersedes (but does not replace):** [multisite-engineering-plan-draft.md](./multisite-engineering-plan-draft.md)
**Spec:** [multisite-specification.md](../../design/sites/multisite-specification.md)
**Evidence base:** repository inspection (Next.js 16.2.6, `proxy` convention from `node_modules/next/dist/docs`), read-only `gh` and `vercel` CLI queries, and `curl` against the live switchplay.ie.

Document conventions: **[AGREED]** = approved requirement/decision. **[IMPLEMENT]** = approved technical approach to be built. Any new question discovered during implementation will be reported, not silently decided.

---

## 1. Summary

One Next.js app, one repo, one Vercel project, standard GitHub → Vercel deployment. Three independent public websites live in `src/app/sites/{strat17,puckle,switchplay}/`. A small `src/proxy.ts` rewrites a request on a domain to that site's folder, so `puckle.co/contact` is served by `src/app/sites/puckle/contact`. Application routes (`/login`, `/decks`, `/api/*` …) are never rewritten. Each site has its own pages, components, CSS, images, form validation and form API handlers; shared code is limited to a short, explicit infrastructure list enforced by an automated test.

The authenticated application is protected by (a) changing almost none of its files, (b) an automated diff-allowlist check, (c) before/after automated comparison of existing test suites, built route table, built CSS and screenshots. The **only** application-adjacent change is the reduced login branding in §4.6 (the `/login` page only), implemented as optional props that default to today's behaviour. The logged-out embedded login screens, the eight application pages that use them, the root layout and the authenticated application are explicitly **not** changed and will continue to show Switchplay branding until a later phase.

---

## 2. Agreed requirements and decisions [AGREED]

| Ref | Decision |
|---|---|
| Q1 | Move existing public pages into the Strat17 folder. **Unknown hosts default to Puckle.** |
| Q2 | Local subdomains + `?site=` cookie override for LAN/iPhone/previews. **Override must not work on the three production domains.** On non-production hosts `?site=` sets the cookie and **redirects to the same URL without the parameter**, so the first visit renders the right site; this also applies to reserved routes such as `/login` without otherwise changing how they are handled. |
| Q3 | Apex domains canonical; `www` redirects to apex. Check existing Vercel config; document required changes. |
| Q4 | Forms, validation, handlers and business logic **separate per site by default**. Share only with a convincing case. **No site identifiers on submissions.** Do not build the Puckle student/parent signup now. |
| Q5 | **Reduced scope (supersedes earlier wording).** Only these login changes are made: (1) `/login` shows the correct brand for the domain; (2) login error messages show that domain's support email, via an optional `email` prop on `SupportErrorMessage` preserving its default; (3) `/login` title set correctly (T1: `/login` only); (4) the header "Step Visuals" link on `/login` appears for Puckle only; (5) authentication, sessions, cookies, permissions, redirects and login behaviour are unchanged. |
| Q5-out | **Explicitly out of scope:** `EmbeddedAuthScreen` and the eight application pages using it; the root layout (no site-aware metadata, no dynamic rendering); logged-out embedded login screens and the authenticated application (they keep Switchplay branding, including some browser titles and support messages, until a later phase). No change to application appearance, styling or functionality. |
| Q6 | Separate login session per domain (host-only cookie, as today). |
| Q7 | Leave unused original public-site components in place; no cleanup. |
| Q8 | Every public page uses its own site's name throughout (no cross-references). Contact: Puckle `info@puckle.co`, Switchplay `info@switchplay.ie`, Strat17 `info@strat17.com`. Report complications before implementation. |
| Q9 | `/dev/*` untouched and outside site routing. |
| Q10 | Per-site titles, descriptions and social metadata. |
| Q11 | **No footer markers.** Local subdomains and the override identify sites. (Supersedes the draft plan.) |
| Q12 | Automated protection against imports between site implementations. |
| — | `/step-visuals` is served only on Puckle (404 elsewhere); not copied. |
| R1 | Styling independence with a clear website/app styling boundary (see §4.5). |
| R2 | Application must be protected by automated tests/verification, not manual testing by you. |
| R3 | A page can exist on one site only (e.g. `puckle.co/tuition`; 404 on the others). |
| R4 | Separate business logic/validation by default; shared only for genuinely generic infrastructure. |
| R5 | Keep the standard GitHub → Vercel workflow, existing repo and project; no extra projects/pipelines. Manual Vercel/DNS steps documented separately; no production domain/DNS changes without approval. |

---

## 3. Repository findings

### 3.1 Route inventory

| Route | Class | Plan |
|---|---|---|
| `/`, `/contact`, `/privacy` | Public site | Move to `sites/strat17`; copy to `puckle`, `switchplay` |
| `/step-visuals` | Puckle only | Untouched; proxy returns 404 on other domains |
| `/login` | Application | Only the reduced branding change in §4.6 |
| `/decks`, `/library`, `/creator`, `/progress`, `/internal/*`, `/dev/*`, `/api/*` | Application | Untouched, never rewritten |
| `/api/public/{contact,early-access,creator-interest}` | Public backend | Per-site copies (§4.4); originals left in place (Q7) |

Only three public pages exist (no About page, sitemap, robots, `not-found`, `error` or favicon-per-site).

### 3.2 Dependencies between public pages, login and the app

- `PublicLayout`, `PublicHeader`, `PublicFooter` (in `src/components/public-site/`) are used by the **public pages and by `/login`** (also by the unused `PublicAuthLayout`). After the pages move, these three become used **only by login** — they must not be moved or removed.
- `SwitchplayBrandLink` is used by `PublicHeader` **and by `EmbeddedAuthScreen`**, which is shown by application pages (`/decks`, `/library`, `/creator/*`, `/progress`) when the visitor is logged out.
- `AuthScreen` (client component, shared by `/login` and every `EmbeddedAuthScreen`) hard-codes the eyebrow text **"Switchplay"**.
- `SupportErrorMessage` hard-codes `SUPPORT_EMAIL = "info@switchplay.ie"` and a `/contact` link. It is used by `AuthScreen`, `CreatorDragLab` (app) and the three public forms.
- `PublicHeader` has a hard-coded **"Step Visuals" link** and calls `getCurrentUser()`.
- No public-site file imports application UI components; public files import only `lib/auth`, `lib/phoneCountries`, `lib/public*.ts`, `components/support/SupportErrorMessage` and `components/brand/SwitchplayBrandLink`.

### 3.3 Styling architecture

- Public-site styling is **CSS modules** (~800 lines total: layout, header, footer, button, sections, three forms, home, contact, privacy). Design tokens (`--sp-site-*`) are defined inside `PublicLayout.module.css` on `.shell`, i.e. already scoped to the public shell.
- `globals.css` (4,798 lines, imported by the root layout) is the **application's** stylesheet. It contains a universal reset (`* {box-sizing; margin:0; padding:0}`), `body` background/colour/font, `button/input {font: inherit}`, and many app and auth classes (`.auth-*`, `.eyebrow` …). I found **no bare element selectors** (`a`, `p`, `h1` …) that would restyle public markup beyond the reset/body.
- The root layout also imports `react-phone-number-input/style.css` globally; site form modules style its `.PhoneInput*` classes via `.phoneInput :global(…)` (scoped under a module class, so they cannot leak).
- Public CSS modules contain no `:global` rules except those phone-input descendants. `/login`'s module uses `:global(.auth-screen)` (app-side, unchanged).

### 3.4 Auth, cookies and URLs

- Session cookie: `httpOnly`, `path=/`, `sameSite=lax`, **no `domain`** → host-only; sessions are naturally separate per domain. `www.x` and `x` are different hosts for cookies.
- Login/returnTo logic is relative-path only; no hard-coded site URLs in app code. Hard-coded **brand/contact** references: `SUPPORT_EMAIL`, root `layout.tsx` metadata ("SWITCHPLAY"), `AuthScreen` eyebrow, `SwitchplayBrandLink`, home-page metadata/OG, and "Switchplay" copy in public components (≈25 occurrences across home, header, sections, forms, contact, privacy ×6).

### 3.5 Forms and backends

Three forms POST to `/api/public/{contact,early-access,creator-interest}`. Each handler imports a validation module (`lib/publicContactSupport.ts` etc.) that is also imported by the form on the client. Handlers write to MongoDB via `lib/mongodb` (collections `contactSupportSubmissions`, plus early-access and creator-interest collections). **No emails are sent**; `info@…` is display/mailto only. The early-access handler lazily creates a unique partial index and drops a legacy index.

### 3.6 Deployment (read-only evidence)

- GitHub repo `peter-meehan-domokos/switchplay-app-ie`, default branch `main`; GitHub deployments show **Production** from `main` and **Preview** per branch. Single Vercel project `switchplay-app-ie` (framework Next.js, root `.`); `vercel.json` contains only framework/install/build commands (no domains, redirects or rewrites).
- The project's production URL is **`https://www.switchplay.ie`**. `curl` shows **`switchplay.ie` currently 307-redirects to `www.switchplay.ie`** (i.e. today **www is canonical, the opposite of Q3**).
- The Vercel account's domain list contains only `switchplay.ie`. `puckle.co` and `strat17.com` are **not** registered/added in this Vercel account. (DNS for at least one of them appears to be on Cloudflare nameservers; I did not verify further.)
- The directory is not linked to Vercel (`.vercel/` absent). I did not link it or change anything.

---

## 4. Technical implementation [IMPLEMENT]

### 4.1 Folder structure

```
src/
  proxy.ts                           # NEW – host → site rewrite (≈50 lines)
  lib/sites/siteResolver.ts          # NEW – pure host/cookie → site; used by proxy and login only
  app/
    sites/
      README.md                      # NEW – rules for working on sites
      strat17/  puckle/  switchplay/ # each: layout.tsx, page.tsx, contact/, privacy/,
                                     #   components/, lib/ (validation), brand, CSS modules
    api/public/
      strat17/{contact,early-access,creator-interest}/route.ts   # NEW per-site handlers
      puckle/…   switchplay/…
      contact|early-access|creator-interest/   # originals, left in place (Q7)
    page.tsx, contact/, privacy/, HomePage.module.css   # MOVED into sites/strat17 (git mv)
public/images/sites/{strat17,puckle,switchplay}/         # copies of the 2 hero images (~4 MB each set)
```

`src/app/sites/<site>/layout.tsx` is a nested layout (no `<html>`) that sets that site's metadata. A route group cannot be used because three sites need the same URLs, hence a real `sites/<site>` path segment plus an internal rewrite.

### 4.2 Domain routing (`src/proxy.ts`)

`siteResolver` is a pure function: `resolveSite({ host, siteCookie })`.

1. Normalise host: lower-case, strip port, strip leading `www.`.
2. Production domains: `strat17.com`, `puckle.co`, `switchplay.ie` → their site. These **ignore** the override (Q2).
3. `<site>.localhost` → that site (local development).
4. Any other host (localhost, IP, `*.vercel.app`): a valid `site` cookie is honoured; otherwise **default `puckle`** (Q1). (The `?site=` query is handled by the proxy, step 5a, not by `resolveSite`.)
5. Proxy behaviour per request:
   - **5a. `?site=` override (non-production hosts only, runs first, for every matched path including reserved ones):** if the request is `GET`/`HEAD`, the host is not one of the three production domains (or their `www` variants), and `site` is one of the three valid ids, respond with a redirect (307) to the **same URL minus the `site` parameter** (all other query parameters, e.g. `returnTo` on `/login`, are preserved) and `Set-Cookie: site=<id>` (`path=/`, `sameSite=lax`, session-length, `secure` when the request is https; it is a different cookie from the auth session cookie and never touches it). Invalid values are ignored (no cookie, no redirect). On the three production domains the parameter is ignored entirely: no cookie, no redirect, request handled normally. Non-GET requests are never redirected.
   - Reserved prefixes otherwise pass through untouched (the proxy only returns `NextResponse.next()`): `/api`, `/login`, `/decks`, `/library`, `/creator`, `/progress`, `/internal`, `/dev`, `/_next`, and the static-asset matcher exclusion. The matcher therefore must include these paths (for step 5a) even though they are not rewritten.
   - `/step-visuals/*`: pass through on `puckle`, otherwise 404.
   - `/sites/*` requested directly: 404 (prevents duplicate URLs/cross-site peeking).
   - Everything else: rewrite to `/sites/<site><path>`.

**Why "reserved list, rewrite the rest" rather than an allow-list of public paths (R3):** adding `puckle/tuition` then needs only the folder `src/app/sites/puckle/tuition/page.tsx`. On the other domains the rewrite target does not exist, so Next returns 404 naturally. No proxy edit, no per-site route config. The risk of this design is a *new application route being swallowed*; this is closed by a test (T3b) that fails if a top-level folder is added under `src/app/` that is neither `sites` nor in the reserved list.

*Alternative considered:* `fallback` rewrites in `next.config.ts` (no proxy; filesystem routes win automatically). Rejected as primary because the cookie override, the Puckle-only `/step-visuals` rule and the default-host rule become a dense set of `has/missing` regex conditions that are hard to unit test. Offered as a fallback if you prefer a proxy-free approach.

**Local development:** `http://strat17.localhost:3000`, `puckle.localhost`, `switchplay.localhost` (Chrome/Firefox resolve `*.localhost`; Safari may need hosts entries). `npm run dev` is unchanged. `next.config.ts` `allowedDevOrigins` likely needs `*.localhost` added (dev-only, to be confirmed during implementation).
**iPhone / LAN / Vercel previews:** visit once with `?site=puckle`; the proxy sets the cookie and redirects to the clean URL, so the correct site (including on `/login`) renders on that very first visit and persists through navigation and refresh. (Without the redirect, the first request would still render the previous/default site because pages read the cookie from the incoming request.) `<site>.localhost` hosts are resolved by hostname and ignore the cookie.

### 4.3 What is shared vs copied

**Copied per site:** pages, nested layout, header, footer, shell, brand link, sections, three forms, phone-input wrapper, CSS modules (including design tokens), images, form validation modules, form API handlers, support-email constant/error message used by that site, all metadata.

**Shared (explicit allow-list, enforced by test T11):**

| Shared item | Why share | Why it stays appropriate | Change-risk control |
|---|---|---|---|
| `lib/mongodb` (connection) | Pure infrastructure | Unaffected by business divergence | Not edited by site work; app owns it |
| `lib/auth` → `getCurrentUser` (header login state) | Authentication is explicitly out of scope | Same user store across sites | App-owned; site code only reads |
| `lib/phoneCountries` (E.164 formatting, default country from locale) | Generic, stateless utility; Puckle's student/parent form will still need phone normalisation | Contains no business rules | Covered by existing/unit tests; app-owned |
| npm packages (`react-phone-number-input`, `next`, `react`, Motion) | Dependencies | — | — |
| Root layout, `globals.css`, third-party phone CSS (see §4.5) | App foundation | — | Not edited; guarded by T9/T10 |

**Not shared (default separate, per Q4/R4):** `lib/public*.ts` validation, `/api/public/*` handlers, form components, `SupportErrorMessage` copy for sites, collection names, all copy text. I considered sharing the validation modules and rejected it: the contact, early-access and creator-interest rules are exactly what will diverge; the cost of three ~400-line copies is small and keeps each site free to change field lists without touching the others.

### 4.4 Forms and backend

- Each site gets its own forms, validation module and three handlers at `/api/public/<site>/<name>` (the form `fetch` path points at its own site). Copy-then-edit; no shared "signup framework".
- **Data destination [AGREED, D3]:** with no site identifier allowed, sharing collections would make Puckle and Switchplay submissions indistinguishable and unrecoverable later. Each site's handlers therefore write to **their own MongoDB collections** (e.g. `puckleContactSupportSubmissions`, `switchplayContactSupportSubmissions`, `strat17ContactSupportSubmissions`, and likewise for early-access and creator-interest). Existing collections and records are left untouched (no migration, no deletion, no schema change; collections are created lazily). The existing lazy index logic is copied per collection. Exact names are finalised in implementation, using a `<site>`-prefixed pattern.
- Original `/api/public/*` handlers stay (Q7); they are no longer called by any site.
- The new Puckle student/parent signup is **not** implemented here; the copied creator forms on Puckle are temporary placeholders per spec.

### 4.5 Styling [AGREED, D4]

**Copy (independent per site):** all public CSS modules, including the `--sp-site-*` tokens on each site's `.shell`. Total is ~800 lines, so repeating a foundational change three times is cheap, whereas shared tokens would couple the sites' colours/typography/spacing — exactly what you want free to diverge. The brand font (`Space_Grotesk` via `next/font`) is also per-site.

**Keep shared (proposed, minimal, explicitly listed):**
1. **The root `globals.css` reset + `body` rules** (`* {box-sizing; margin:0; padding:0}`, `body` background/colour/font/line-height, `button, input {font: inherit}` — about 25 lines out of 4,798). Contains nothing brand-specific. Remains appropriate as the sites diverge because each site's `.shell` sets its own background, colour and font and every component is CSS-module styled; the reset only normalises browser defaults.
2. **`react-phone-number-input/style.css`**, imported in the root layout. Third-party library CSS, not ours; sites style it through scoped module overrides.

**Why no further sharing and what protects the shared bits:** neither file is edited for site work. Rule (documented in `sites/README.md`, enforced by tests): site code may not import global CSS and may not use `:global` unless nested under a module class. Because CSS modules are hash-scoped, site styles cannot leak into the application or each other; and a future change to `globals.css`'s reset/body (app-owned) that would visually change a site is caught by the per-site screenshot tests (T10), not by hope.

*Boundary the other way (app → sites):* global class names (`.auth-*`, `.eyebrow`, …) cannot collide because site markup uses only module classes. Site CSS is bundled only on site routes, so no site CSS ships to application routes.

### 4.6 Login branding (Q5, reduced scope) — approved scope

Detailed investigation: [login-branding-engineering-plan-draft.md](./login-branding-engineering-plan-draft.md) (historical; this section supersedes its proposal where they differ).

**Scope [AGREED]:** `/login` only. Brand, support email in login error messages, page title (T1) and Step Visuals link visibility. Nothing else.

**Mechanism [IMPLEMENT]:** one server boundary, `src/app/login/page.tsx`, resolves the site once and passes a `site` id down as an optional prop. No context, no globals, no client-side detection.

```ts
// src/lib/sites/getCurrentSite.ts   (server-only, new, ~8 lines)
export const getCurrentSite = cache(async () => {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return resolveSite({ host: h.get("x-forwarded-host") ?? h.get("host"), siteCookie: c.get("site")?.value });
});
```

It is a thin wrapper over the existing `siteResolver` (the same function the proxy uses), so there is no second identification mechanism. `cache()` lets `generateMetadata` and the page share one resolution per request. A tiny pure table `src/lib/sites/siteBrands.ts` maps each site id to `{ name, titleName, supportEmail, brandLead, brandTail }`; the Switchplay entry reproduces today's strings exactly. This table is login-side data only; the independent site folders keep their own hard-coded copies.

**Files [IMPLEMENT]** — all additions are optional props defaulting to today's output:

| File | Change | Used elsewhere? |
|---|---|---|
| `src/lib/sites/getCurrentSite.ts`, `src/lib/sites/siteBrands.ts` | **New** | — |
| `src/app/login/page.tsx` | Resolve site; pass `site` to `PublicHeader` and `AuthScreen`; `showStepVisualsLink={site === "puckle"}`; add `generateMetadata` returning `title: { absolute: "Sign in \| <TITLENAME>" }` (absolute so the root template does not append `\| SWITCHPLAY`). Redirect/`returnTo`/`getCurrentUser` logic untouched. | Login only |
| `src/components/public-site/PublicHeader.tsx` | Optional `site` (forwarded to the brand link) and `showStepVisualsLink` (default `true`) | Login (and `PublicAuthLayout`, which is unused); public pages stop using it after the move |
| `src/components/brand/SwitchplayBrandLink.tsx` | Optional `site` (default `"switchplay"`): renders lead/tail and `aria-label` from `siteBrands`; default output byte-identical | Also used by **`EmbeddedAuthScreen`**, which passes nothing → unchanged |
| `src/components/auth/AuthScreen.tsx` (client) | Optional `site` prop (default `"switchplay"`): eyebrow text and the email passed to `SupportErrorMessage`. State, `handleSubmit`, fetch, redirect and markup otherwise untouched | Also used by **`EmbeddedAuthScreen`**, which passes nothing → unchanged |
| `src/components/support/SupportErrorMessage.tsx` | Optional `email` prop (default `SUPPORT_EMAIL`); `SUPPORT_EMAIL` export unchanged | Also used by **`CreatorDragLab` (authenticated app)**, which passes nothing → unchanged |

**Not changed:** `EmbeddedAuthScreen`, the eight application pages, `CreatorDragLab`, `PublicAuthLayout`, root `layout.tsx`, `lib/auth`, `/api/auth/*`, `returnTo`, session cookie, any CSS.

**Approx. size:** 2 new files and 5 small edits to existing files (the five in the table above), roughly 40 lines in total.

**Why shared components must change, and how behaviour is preserved:** the login page's brand, eyebrow and error email live inside components that also serve other screens (`SwitchplayBrandLink` and `AuthScreen` → logged-out embedded screens; `SupportErrorMessage` → the authenticated creator UI and public forms). The brief forbids touching `EmbeddedAuthScreen`, so the new behaviour must be opt-in via props. Every other caller passes no new props and renders the same markup as today. This is proved by default-output snapshot tests, a byte-identical golden-HTML comparison of every logged-out embedded route, and an empty diff on `CreatorDragLab` and the eight application pages (§5, §7).

**Accepted consequences (no action proposed):**
- Logged-out embedded screens (`/decks`, `/library`, `/creator/*`, `/progress`), the authenticated application, root metadata (some browser titles) and support messages outside `/login` continue to show Switchplay branding on all domains.
- Because unknown hosts default to Puckle (Q1), `localhost:3000/login` and previews now show **PUCKLE**, while embedded screens on the same host still show Switchplay. (Use `?site=switchplay` for the old look on `/login`.)
- Typography [AGREED, D5]: keep the existing upper-case brand style (`STRAT17`, `PUCKLE`, `SWITCHPLAY`) in website and login headers (each site may redesign it independently later), with title-case eyebrow (`Puckle`) on `/login`.

**Technical notes, none a blocker:**
1. `AuthScreen` is a client component; it receives only a string id and imports the small pure `siteBrands` table (no server-only imports), so no serialisation or boundary issue arises.
2. The login page is already dynamic (`getCurrentUser`/`searchParams`), so reading `headers()`/`cookies()` adds no rendering-mode change; the root layout stays untouched.
3. The `?site=` redirect (§4.2 step 5a) is what makes the override correct on `/login` on first visit; it must run on reserved paths, which the proxy otherwise passes through untouched.

### 4.7 Brand text, contact details and metadata (Q8, Q10)

- Each site's copy uses its own name in header, hero/section copy, image `alt` text, form copy, contact and privacy pages, and its own `SUPPORT_EMAIL` constant (`info@puckle.co`, `info@switchplay.ie`, `info@strat17.com`).
- Each site's `layout.tsx`/page metadata sets title, template, description, Open Graph (`siteName`) and Twitter fields with its own name. Copy text is otherwise unchanged (spec: no content redesign), so descriptions are the current sentences with the brand swapped.
- Automated test T12 scans each site folder and fails if it contains another site's name or domain.
- **Approved handling and pre-launch conditions [AGREED, D6]:**
  1. **Privacy policy:** it names an operator/data controller and contact address. Each site's copy uses that site's name and email mechanically. **Pre-launch gate:** the accuracy of each privacy policy (including the legal entity/controller identity) must be verified before public launch of that domain; this is a launch checklist item, not a code task.
  2. **Mailboxes:** `info@puckle.co` and `info@strat17.com` (and `info@switchplay.ie`) must exist or forward somewhere (manual, outside the repo). **Pre-launch gate:** working mailboxes verified before public launch. Nothing in the code sends email, so no technical dependency.
  3. **Header "Step Visuals" link** exists only in the Puckle copy (Strat17/Switchplay would otherwise show a dead link). This is a necessary, intentional visible difference beyond brand.
  4. `SupportErrorMessage` remains Switchplay-branded for the app; the site copies carry their own version so public pages stay clean.
  5. Per-site favicon/OG image are not in scope; all sites share the current favicon (flagged, not changed). Social previews will carry the correct names but the same favicon.
  6. Strat17 and Switchplay copy still describes the creator/follower product as intended in the spec.

### 4.8 Assets

Copy the two home-page images into `public/images/sites/<site>/` and reference them from each site (independent edits; shared assets would let one change alter all three). Other images in `public/images` are not used by the public pages and are not touched.

---

## 5. Protecting the authenticated application

**Principle:** the app's source stays untouched except the five-file default-preserving login branding change in §4.6 and a dev-only `next.config.ts` origin allowance. `EmbeddedAuthScreen`, the eight application pages, `CreatorDragLab`, the root layout, `lib/auth` and `/api/auth/*` must show **no diff**.

| # | Control | Detail |
|---|---|---|
| P1 | **Allow-list diff check** | Script run before finishing: `git diff --name-status main` must show only (a) additions under `src/app/sites`, `src/app/api/public/<site>`, `public/images/sites`, `src/proxy.ts`, `src/lib/sites`, tests, docs; (b) the `git mv` of `page.tsx`, `contact/`, `privacy/`, `HomePage.module.css`; (c) the approved login files (§4.6: `login/page.tsx`, `PublicHeader`, `SwitchplayBrandLink`, `AuthScreen`, `SupportErrorMessage`) and `next.config.ts`. Any other changed file fails the check; in particular `EmbeddedAuthScreen`, the eight pages using it, `CreatorDragLab`, `layout.tsx`, `lib/auth.ts` and `/api/auth/*` must be absent from the diff. Result reported in the PR. |
| P2 | **Existing suites before vs after** | Run `npm run typecheck`, `lint`, `test:unit`, `test:integration`, `test:e2e`, `test:phase2` (the existing harness already logs in via `/api/auth/login` against local data) on baseline `main`, then on the branch; compare pass/fail sets. Suites needing local DB/env that I cannot run are listed explicitly rather than skipped silently. |
| P3 | **Build route table** | Compare `next build` route output before/after: every application route and API route identical; only the moved public routes and new `/sites/*` and `/api/public/<site>/*` differ. |
| P4 | **Built CSS comparison** | For application routes (`/decks`, `/library`, `/creator`, `/progress`, `/login`), compare the CSS files they load (from build manifests) before/after: contents must be identical (hash names excepted). Proves no site CSS reaches the app and `globals.css` is unchanged. |
| P5 | **Screenshots** | Playwright screenshots before/after of `/login` on the Switchplay host, a logged-out embedded screen (`/decks`, `/library`) on **every** host, and — via the existing phase2 harness if the local test DB is available — authenticated `/decks`, `/library`, `/creator`, `/progress`, desktop and mobile (iPhone viewport). Pixel diff must be zero for the embedded/authenticated screens on all hosts and for `/login` on the Switchplay host. |
| P6 | **Default-props tests** | Render tests proving `AuthScreen`, `SwitchplayBrandLink`, `PublicHeader` and `SupportErrorMessage` without the new props output markup identical to today's (snapshots generated from `main`). |
| P7 | **Proxy non-capture test** | Table-driven test that every existing application route/prefix passes through unrewritten on all three domains, the default host and the override (T3). Plus T3b (new top-level app folder must be registered). |
| P8 | **Auth/session unchanged** | `lib/auth.ts`, `/api/auth/*` unmodified (P1) — session cookie remains host-only; an automated check confirms the Set-Cookie attributes via the existing login API test. |
| P9 | **Golden HTML for logged-out application screens** | Capture server-rendered HTML of the eight logged-out embedded routes (`/decks`, `/library`, `/library/<id>`, `/progress`, `/creator/new`, `/creator/edit/<id>`, `/creator/info-cards/new`, `/creator/info-cards/<id>`) on `main` (no database access is needed when no session cookie is sent), then on the branch on **all three hosts and the default host**. After normalising build hashes the HTML must be **byte-identical** (they stay Switchplay-branded by design). Also the Switchplay-host `/login` HTML must be identical to `main` apart from the new `<title>`. |

---

## 6. Implementation sequence

0. **Baselines (on current `main`):** run P2, record P3, P4, P5 artefacts, the P9 golden HTML of `/login` and the eight logged-out embedded routes, default-output snapshots for the four login-chain components (P6), and screenshots of the existing public pages (`/`, `/contact`, `/privacy`) for the later visual-equivalence test (T10).
1. **`siteResolver` + unit tests** (T1, T2, T5).
2. **`proxy.ts`** (host routing, reserved pass-through, `/step-visuals` rule, **`?site=` cookie + redirect on non-production hosts for all paths incl. reserved**) + `allowedDevOrigins` for `*.localhost` (if needed) + proxy tests (T3, T3b, T4, T5, T14).
3. **Strat17 site:** `git mv` home/contact/privacy/`HomePage.module.css` into `sites/strat17`; copy needed components/CSS, validation modules, brand link (STRAT17), images; create per-site API handlers; set site metadata and text; re-point imports to the site's own files only.
4. **Puckle and Switchplay:** duplicate Strat17's folder and handlers; replace name, email, metadata, collection names, image paths; keep "Step Visuals" link only on Puckle.
5. **Login branding (§4.6, reduced scope only):** add `getCurrentSite`/`siteBrands`; edit the five files listed; add login tests (T8, P6, P9). Do not touch `EmbeddedAuthScreen`, the eight pages, or the root layout.
6. **Guard tests:** T11 (imports), T12 (brand strings), CSS rules (T13).
7. **Verification:** P1–P9, T6–T10, T14, manual-equivalent Playwright runs on desktop + iPhone viewport.
8. **Documentation:** `src/app/sites/README.md` (rules, how to add a page/form divergence) and `docs/engineering/sites/vercel-domain-setup.md` (the manual steps in §8).
9. **Report:** diff summary, results of every check, any suite that could not be run.

Estimated change: ~3 near-identical site folders (mostly copied), ~120 lines of new routing/resolver code, and the five small default-preserving login edits (§4.6).

---

## 7. Tests and verification

**Unit (`npm run test:unit`, `node --test`)**
- T1 `siteResolver`: apex/`www`/port/case; `<site>.localhost`; lookalike hosts (`evilpuckle.co`, `puckle.co.evil.com`) do not match; unknown → Puckle.
- T2 Rewrite targets for every site/path incl. nested paths and query strings; `puckle.co/tuition` → `/sites/puckle/tuition`.
- T3 App prefixes pass through on all hosts; T3b new top-level `src/app` folders must be reserved or `sites` (fails otherwise).
- T4 `/step-visuals` allowed on Puckle only (including `www.puckle.co` and override-puckle on non-prod); `/sites/*` direct → 404.
- T5 Override cookie: a valid `site` cookie is honoured on `localhost`/IP/`*.vercel.app`; **ignored on all three production domains and their `www` variants**.
- T14 `?site=` proxy behaviour (non-production host): valid value → 307 to the same path with the parameter removed, other query parameters preserved (e.g. `/login?returnTo=%2Fdecks&site=puckle` → `/login?returnTo=%2Fdecks`), `Set-Cookie: site=puckle` (`path=/`, `sameSite=lax`, `secure` only on https), and it also works for reserved routes (`/login`, `/decks`) and public routes; invalid value (`?site=evil`) → ignored, no cookie, no redirect; non-GET/HEAD requests never redirected; no loop (the redirected URL has no parameter); the auth session cookie is never read or written. **Production domains (`puckle.co`, `www.puckle.co`, `switchplay.ie`, `strat17.com` and www variants): `?site=` → no redirect, no cookie, request handled normally.** Reserved routes are otherwise passed through unchanged.
- T11 Import guard: no file under `sites/<a>` or `api/public/<a>` imports from another site, from `components/public-site`, or from anything outside the shared allow-list in §4.3.
- T12 Brand guard: no site folder contains another site's name or domain.
- T13 Style guard: site code has no non-module CSS import; `:global` only nested under a module class.
- P6 default-props tests (`AuthScreen`, `SwitchplayBrandLink`, `PublicHeader`, `SupportErrorMessage`); `siteBrands` test (Switchplay entry equals today's literals; no entry contains another site's name); form validation tests per site (ported from existing behaviour). If `node --test` cannot load CSS-module imports, I will use a test-only stub or cover these through the HTTP/Playwright tests (P9, T8); feasibility confirmed at implementation start.

**Playwright (extend existing config)**, hosts `strat17.localhost`, `puckle.localhost`, `switchplay.localhost` plus the override:
- T6 Home, contact, privacy load directly and on refresh; internal navigation keeps identity; correct brand, title, description and OG tags on each; no other brand/email on the page.
- T7 Each form submits to its own site's endpoint (route mocked) and success/failure states work; anchors (`#early-access`, `#creator-interest`) work.
- T8 `/login` on each host (via `<site>.localhost` and `?site=`): correct header brand text/`aria-label`, correct eyebrow, correct `<title>` (`Sign in | <BRAND>`), Step Visuals link present on Puckle only (and working there); after a failed login attempt (API mocked/failing) the message shows that site's support email; `?site=puckle` on `/login` renders Puckle on the **first** visit. Login behaviour unchanged: identical redirect, `returnTo` handling and `Set-Cookie` attributes (`httpOnly`, `sameSite=lax`, `path=/`, no `Domain`, same name/expiry) compared with `main` via the existing login API test.
- T9 A site-only route returns 404 on the other hosts (use a throwaway fixture page in tests only).
- T10 Visual equivalence: the Switchplay and Strat17 pages vs baseline screenshots of today's pages differ only in the brand/text areas (masked diff); desktop, mobile and iPhone viewport.
- P5 application screenshots (above).

**Acceptance criteria (maps to spec §8 plus decisions)**
1. All three sites open locally via subdomains and via `?site=`; override verifiably inert on the three production domains.
2. Each site shows its own brand/name/email/metadata everywhere; automated scan finds no cross-site names.
3. Pages, forms, handlers, validation, styles and images of one site can change without affecting another; guard tests pass.
4. A page can exist on one site only; other sites return 404.
5. `/step-visuals` works on Puckle only.
6. `/login` shows the correct brand, support email in login errors, title and Step Visuals visibility per domain, with no other behavioural change; logged-out embedded screens, the eight application pages, the root layout and the authenticated application are unchanged (P9 byte-identical, P1 diff allow-list); P1–P9 pass, with any un-runnable suite listed explicitly.
6a. `?site=` sets the cookie and redirects to the clean URL on non-production hosts (including `/login`), and is inert on all three production domains (T14).
7. Standard GitHub → Vercel deployment unchanged (no extra projects, no config beyond §8).
8. Manual Vercel/DNS steps documented; no production changes made.

---

## 8. Deployment, Vercel and DNS

**Two clearly separate workstreams:**

- **Workstream A — code implementation (in scope now).** Everything in §3–§7: a normal branch, pull request and standard GitHub → Vercel deployment (branches → Preview, `main` → Production) using the existing repository and the existing Vercel project. No `vercel.json` change and no extra project/pipeline. Routing by `proxy.ts` is the documented Next.js 16 mechanism [AGREED, D7]: one project serves three domains through one request-rewrite layer, which is standard Next.js/Vercel capability.
- **Workstream B — Vercel/DNS/mailbox changes (NOT part of implementation; each requires separate explicit approval at cutover).** Listed below, documented in `docs/engineering/sites/vercel-domain-setup.md` (written during implementation), and **never performed by the implementation work**.

**Effect of merging Workstream A to `main` (no domain change needed):** `main` deploys to production automatically. After merge, `www.switchplay.ie` / `switchplay.ie` will be served by the proxy from the Switchplay site folder (same content, titles and email as today). Unknown hosts, including the `switchplay-app-ie.vercel.app` alias, show Puckle (Q1). `puckle.co` and `strat17.com` are not attached to the project, so those sites are reachable only via Preview deployments (`?site=`) until cutover. See concern C1 in §9 about form storage at merge time.

**Workstream B — manual tasks (separately approved cutover):**
1. Add `puckle.co`, `strat17.com` (+ `www.` variants) to project `switchplay-app-ie`, and set DNS at the registrar/DNS provider per Vercel's instructions (apparently Cloudflare for at least one domain — to be verified at that time; if proxied via Cloudflare orange-cloud, Vercel recommends DNS-only).
2. **Reverse the existing Switchplay canonical [AGREED, D2]:** currently `switchplay.ie` → 307 → `www.switchplay.ie`. Set `switchplay.ie` as primary and redirect `www.switchplay.ie` → apex (308) in the Vercel dashboard. Consequences to accept at cutover: (a) sessions are host-only, so users logged in at `www.switchplay.ie` must log in again at `switchplay.ie`; (b) existing `www` links redirect; (c) search engines re-index. Apply only at the cutover, ideally off-peak and after Preview verification.
3. For `puckle.co` and `strat17.com`: apex primary, `www` redirecting to apex.
4. Confirm Production env vars apply (same project, no new variables expected).
5. Create/verify mailboxes or forwards for `info@puckle.co`, `info@strat17.com`, `info@switchplay.ie`.
6. Check Vercel Deployment Protection on previews if iPhone testing of preview URLs is needed.
7. **Pre-launch gates (before public launch of each domain):** privacy-policy accuracy verified for that site (§4.7); mailbox working; smoke test of homepage, contact, privacy, forms and `/login` on that domain.
8. Cutover sequence (after approval, after Preview verification): add domains → verify → switch DNS → apply canonical redirects → smoke test each domain. Until then `www.switchplay.ie` continues as configured today.

---

## 9. Technical concerns

No blocker, and no approved decision is contradicted. Points to be aware of (all accepted or handled in the plan):

- **C1 — Switchplay form storage changes at merge time (consequence of D3, needs your awareness, not a change of decision).** Because `main` deploys automatically, the live switchplay.ie forms will start writing to the **new** Switchplay collections from the moment this is merged and deployed, while the legacy collections (`contactSupportSubmissions`, `earlyAccessSignups`, `creatorInterestSubmissions`) stop receiving new records. I found no reader of these collections in the repository (only the writing handlers, and `tests/phase8.integration.ts`, which hash-compares legacy `earlyAccessSignups` against a backup and is unaffected by new collections). **Anything outside the repository that reads those collections (Atlas views/exports, scripts, manual checks) will miss new Switchplay submissions.** Implementation will document the new collection names in the PR and `sites/README.md`; please confirm no external consumer depends on the legacy collection names before merging to `main`.
- **C2 — Default-to-Puckle (Q1):** `localhost`/`*.vercel.app` show Puckle, and `/login` there shows PUCKLE while the out-of-scope embedded screens still show Switchplay. Accepted.
- **C3 — Login branding touches shared components** (`SwitchplayBrandLink`, `AuthScreen`, `SupportErrorMessage`) via opt-in props with identical default output; protected by P1, P6, P9 (§4.6).
- **C4 — Shared global reset/body CSS** (~25 lines) could affect all sites if the app team edits it; mitigated by per-site screenshot tests and the rule that it is not edited for site work (§4.5).
- **C5 — Reserved-list routing** relies on T3b to stay safe as the application grows (§4.2).
- **C6 — Authenticated visual regression** depends on the local test database/harness being runnable; if not, I will report it and rely on P2–P4, P6, P7, P9 (CSS-bundle, route-table and golden-HTML comparisons need no database).
- **C7 — Dev-only `next.config.ts` change** (`allowedDevOrigins` for `*.localhost`) is the only shared config touched; to be confirmed necessary during implementation.

---

## 10. Decisions log (all approved)

| # | Decision | Status |
|---|---|---|
| D1 | Login branding, reduced scope: `/login` only (brand, support email via optional `SupportErrorMessage` `email` prop, T1 title, Step Visuals link on Puckle only). `EmbeddedAuthScreen`, authenticated pages and root layout unchanged; all authentication behaviour preserved. | **Approved** |
| D2 | Apex domains canonical, including reversing the existing `www.switchplay.ie` configuration, applied only at the separately approved cutover. | **Approved** |
| D3 | Separate MongoDB collections per website; existing records and collections untouched. | **Approved** |
| D4 | Independent CSS and design tokens per site; only the minimal shared global reset/body rules and third-party phone-input CSS retained; authenticated application protected from styling regressions. | **Approved** |
| D5 | Uppercase brand names in website headers for now; independently redesignable later. | **Approved** |
| D6 | Each site's correct name and email; privacy-policy accuracy and working mailboxes verified before public launch. | **Approved** (launch gate) |
| D7 | `proxy.ts` routing with independent site-specific pages and protected application routes. | **Approved** |
| D8 | Original unused public form handlers and components left in place. | **Approved** |

**Scope reminder:** this phase delivers three independent websites with their existing copied forms. The new Puckle student/parent signup process is **not** part of this phase.

**Next step:** implementation per §6, beginning with baselines. No code, configuration, deployment or DNS has been changed to date.
