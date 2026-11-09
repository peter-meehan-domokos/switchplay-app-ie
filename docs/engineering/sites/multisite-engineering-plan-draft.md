# Three-Site Public Website — Draft Engineering Plan

**Status:** Draft for approval. Nothing has been implemented.
**Spec:** [multisite-specification.md](../../design/sites/multisite-specification.md)
**Basis:** Inspection of the repository (Next.js 16.2.6; `proxy` file convention read from `node_modules/next/dist/docs`).

---

## 1. Summary of recommendation

1. Keep **one Next.js app**. Put each public site in its own folder: `src/app/sites/strat17/`, `src/app/sites/puckle/`, `src/app/sites/switchplay/`. Each folder holds that site's pages, header, footer, layout, forms, CSS modules and images.
2. Route by domain with **one small `src/proxy.ts`** that maps the host to a site and *rewrites* public paths (e.g. `puckle.co/contact` → `/sites/puckle/contact`). Visitors still see `/contact`. App routes (`/login`, `/decks`, `/api/*` …) are never rewritten.
3. **Do not edit any existing application, login or shared file** except the three public pages being moved. The current `src/components/public-site/*` stays exactly where it is, because the **login page and `PublicAuthLayout` import it**. The site folders get *copies*.
4. `/step-visuals` stays where it is, is served **only on `puckle.co`** (404 on the other two, as agreed), and is not copied.
5. Every site page ends with a plain `<div>` showing the site name (requested for distinguishing copies).

No feature flags, no per-site config objects, no `if (site === …)` in components.

---

## 2. Findings from the repository

### 2.1 Route inventory (classification)

| Route | Classification | Notes |
|---|---|---|
| `/` ([page.tsx](../../../src/app/page.tsx)) | **Public site – copy ×3** | Hero, how-it-works, creator section, early-access + creator-interest forms. Uses `HomePage.module.css`. |
| `/contact` | **Public site – copy ×3** | Contact/support form. |
| `/privacy` | **Public site – copy ×3** | Privacy policy; mentions "Switchplay" ~6 times and `info@switchplay.ie`. |
| `/step-visuals` | **Puckle only – do not copy** | Unauthenticated lab; `robots: noindex`. Linked from the public header ("Step Visuals"). |
| `/login` | **Application – do not touch** | Uses `PublicLayout` + `PublicHeader` + `AuthScreen`. |
| `/decks`, `/library`, `/creator`, `/progress`, `/internal/info-maths`, `/dev/*` | **Application – do not touch** | `/dev/*` assumed application/dev tooling (see Q9). |
| `/api/auth/*`, all other `/api/*` | **Application – do not touch** | |
| `/api/public/contact`, `/early-access`, `/creator-interest` | **Public-site backend (shared for now)** | Write to MongoDB collections `contactSupportSubmissions`, early-access, creator-interest. No email sending. |

Only three public pages exist (home, contact, privacy), plus `/step-visuals`. There is no About page, sitemap, robots file or `not-found` page.

### 2.2 Public-site code today

- `src/components/public-site/`: `PublicLayout`, `PublicHeader`, `PublicFooter`, `PublicButton`, `CreatorSection`, `HowItWorksSection` (incl. `FollowerInterestSection`), `EarlyAccessForm`, `CreatorInterestForm`, `ContactSupportForm`, `PublicPhoneInput`, plus their CSS modules (~2,400 lines in total).
- `src/components/brand/SwitchplayBrandLink` renders the header brand ("SWITCH**PLAY**", Space Grotesk). It contains a **commented-out STRAT17 variant** that shows the intended typography. It is **also used by `EmbeddedAuthScreen`** (application pages) so it must not be edited.
- `PublicHeader` is an async server component calling `getCurrentUser()`; it shows "Open App" (`/decks`) or "Log in" (`/login`), "Join", "Contact" and "Step Visuals".
- Styling is almost entirely **CSS modules**. The `--sp-site-*` design variables are defined in `PublicLayout.module.css` (scoped to the public shell), so copied modules stay self-contained. `globals.css` (4,798 lines) is shared with the app; I have not yet proven that no global selector affects public pages (see §6, test T9).

### 2.3 Authentication boundary

- Session cookie: `httpOnly`, `path=/`, `sameSite=lax`, **no `domain` attribute**, so it is host-only. A login on `puckle.co` is therefore separate from one on `strat17.com`, and cookies never leak between the three domains. This works with no change, but users must log in separately per domain (see Q6).
- Login, redirect and `returnTo` logic use relative paths only (`getSafeReturnTo`), so they work on any domain.
- `/login` and the app are reachable on **all three domains** (the proxy does not touch them). The login screen will keep showing the existing "SWITCHPLAY" brand on every domain (see Q5).

### 2.4 Hard-coded references

- `SUPPORT_EMAIL = "info@switchplay.ie"` in `components/support/SupportErrorMessage.tsx` (also used by the app's `CreatorDragLab` and `AuthScreen`).
- Root `layout.tsx` metadata: title "SWITCHPLAY — …", template `%s | SWITCHPLAY`. Home page also sets OpenGraph `siteName: "SWITCHPLAY"`. Contact/privacy copy says "Switchplay".
- No absolute site URLs found in app code (other than Cloudflare URLs unrelated to this work). All internal links are root-relative, so they work under any domain.
- `next.config.ts` has `allowedDevOrigins: ["192.168.1.38"]` for phone testing over Wi-Fi.
- `vercel.json` has no domain, redirect or rewrite config.

### 2.5 Forms and APIs

All three forms `fetch` same-origin relative endpoints (`/api/public/...`), so they work unchanged on any domain. Validation lives in `src/lib/publicContactSupport.ts`, `publicCreatorInterest.ts`, `publicEarlyAccess.ts` and is imported by both the form (client) and the API route (server). Submissions record **no site identifier**, so after the split the database cannot tell which site a submission came from (see Q4).

### 2.6 Assets

The home page uses only `public/images/hero/hero-illustration8.png` and `public/images/other/second-illustration.png` (~2 MB each). Other images in `public/images` are not used by the public pages. Static assets are shared URLs, so editing one file would change all three sites.

---

## 3. Recommended structure

```
src/
  proxy.ts                         # host → site rewrite (new, ~60 lines)
  app/
    page.tsx, contact/, privacy/   # REMOVED after copying (see 3.1)
    HomePage.module.css            # REMOVED after copying
    step-visuals/                  # unchanged, Puckle only via proxy
    sites/
      strat17/
        layout.tsx                 # nested layout: site metadata only (no <html>)
        page.tsx  HomePage.module.css
        contact/page.tsx (+css)
        privacy/page.tsx (+css)
        components/                # copies of everything in public-site/ the pages use
          SiteHeader, SiteFooter, SiteLayout, forms, sections, PublicPhoneInput, CSS modules
        brand.tsx                  # this site's brand link (no conditionals)
      puckle/    (same shape, brand "puckle", header keeps "Step Visuals" link)
      switchplay/ (same shape)
public/images/sites/{strat17,puckle,switchplay}/   # copies of the 2 hero images
```

Rationale: Next.js cannot have three pages at the same URL in different route groups, so a rewrite to a real per-site path segment is the simplest way for three folders to own the same public URLs. The folder name is the only "configuration".

### 3.1 What happens to the original public pages

The original `src/app/page.tsx`, `contact/`, `privacy/` and `HomePage.module.css` are used only by the public site. Once copied, I recommend **moving (git mv) them into `sites/strat17/`** and making Strat17 the default site for unknown hosts. That avoids a fourth, orphaned copy. The login page and `PublicAuthLayout` still need `src/components/public-site/{PublicLayout,PublicHeader,PublicFooter}`, so **those and their CSS stay in place untouched**. The remaining public-site files (forms, sections, phone input, button) become unused after the move and can be deleted in the same change *or left for a later cleanup* (see Q7).

### 3.2 Shared vs site-specific

**Stays shared (not copied):** `lib/mongodb`, `lib/auth` (`getCurrentUser`), `lib/phoneCountries`, root `layout.tsx` and `globals.css`, `react-phone-number-input` CSS, Vercel Analytics, favicon, `SupportErrorMessage` (used by the app), the `/api/public/*` handlers and `lib/public*.ts` validation (for Phase 1 only — see below), and everything in the application.

**Copied per site:** pages, layout, header, footer, brand link, sections, three forms (UI + client validation wiring), phone input wrapper, CSS modules, the two images, site `layout.tsx` metadata, the SUPPORT_EMAIL constant used by that site's pages.

**Independence risk of the shared items and mitigation:**

| Shared item | Risk if changed | Mitigation |
|---|---|---|
| `/api/public/*` + `lib/public*.ts` | A validation or storage change for one site changes all | Spec allows sharing in Phase 1. **Rule (documented in the site README):** before diverging a form, copy its handler + validation to a site-specific endpoint (e.g. `/api/public/puckle/...`) and point only that site's form at it. No code change needed now. |
| `globals.css` | Global selectors affect all sites and the app | Do not edit for site work; site styles go in the site's CSS modules. |
| Root `layout.tsx` | Global metadata/fonts | Sites override metadata in their own nested layout. |
| `SupportErrorMessage` | Used by app too | Do not edit for site-specific wording; copy if needed. |
| `lib/phoneCountries` | Low (pure data/util) | Leave shared. |

---

## 4. Domain routing

### 4.1 `src/proxy.ts` behaviour

1. Read `Host`; lower-case; strip port and a leading `www.`.
2. Map to a site: `strat17.com` → `strat17`, `puckle.co` → `puckle`, `switchplay.ie` → `switchplay`. A plain lookup object, no config system.
3. **Pass through untouched** (no rewrite) for anything that is not a public-site path. The public set is a hard-coded list: `/`, `/contact`, `/privacy`. App paths (`/login`, `/decks`, `/library`, `/creator`, `/progress`, `/internal`, `/dev`, `/api`, `/_next`, assets) are never matched. Using an explicit allow-list of public paths (rather than a block-list of app paths) guarantees new application routes cannot be accidentally captured. Adding a public page later = add it to the list.
4. Public path match → `NextResponse.rewrite` to `/sites/<site><path>`.
5. `/step-visuals` (and sub-paths): pass through when site is `puckle`; otherwise return a 404.
6. Direct requests to `/sites/*` return 404 (prevents duplicate URLs and accidental cross-site viewing).
7. Matcher excludes `_next/static`, `_next/image`, images and favicon so the proxy does no work for assets.
8. Unknown hosts (e.g. `*.vercel.app` previews, `localhost`) → default site `strat17`, unless the dev/preview override applies.

`www` handling: the proxy treats `www.x` as `x` so it never breaks. The **canonical redirect (www → apex)** is simplest to do in the Vercel dashboard (domain settings, a 308 redirect) — no code, see §7. Recommend **apex as canonical**.

### 4.2 Local development and previews

- **Primary:** `http://strat17.localhost:3000`, `http://puckle.localhost:3000`, `http://switchplay.localhost:3000`. Chrome/Firefox resolve `*.localhost` automatically; cookies stay separate per subdomain; `npm run dev` unchanged. The proxy maps by checking whether the host *starts with* the site name when it ends with `.localhost` (needs Chrome/Firefox; Safari may need `/etc/hosts`).
- **iPhone / Vercel previews / IP addresses** cannot use subdomains. Recommend a tiny override **active only when `NODE_ENV !== "production"` or the host is not one of the three production domains**: visiting `?site=puckle` sets a `site` cookie and rewrites accordingly (cookie keeps it sticky through navigation and refresh). On the real domains the override is ignored. About 10 lines; no feature flag or config.
- `allowedDevOrigins` in `next.config.ts` may need `*.localhost` added (to be verified during implementation; that file is shared but the change is dev-only).
- Vercel previews: `*.vercel.app` hosts use the `?site=` override. (Alternative: assign the three domains to a preview branch in Vercel — manual.)

---

## 5. Items needing special handling / issues found

1. **Overlap between public and application code.** `PublicLayout`/`PublicHeader` are used by `/login`. Resolution: leave originals in place; copy for sites (§3.1). **No application behaviour change.**
2. **Header link to `/step-visuals`.** The copied `strat17` and `switchplay` headers must **omit** the "Step Visuals" link (otherwise it 404s). This is the only intended visible difference besides the brand and footer marker. `puckle` keeps it.
3. **Header "Open App"/"Log in" links** go to `/decks` and `/login` on the same domain: these work as today. Nothing to change.
4. **Login page brand** stays "SWITCHPLAY" on all domains (out of scope, app). Visitors who click "Log in" from puckle.co see Switchplay branding on the login screen. Flagged for your decision (Q5).
5. **Metadata/SEO:** copied pages would otherwise say "SWITCHPLAY" in title/OG on every site. Recommend each site's pages set their own title/OG `siteName` (plain strings in that site's copy). No sitemap/robots currently exist; none added. `/sites/*` is blocked from direct access so no duplicate-content URLs.
6. **Copy text** (privacy policy, "Switchplay" mentions, support email) is left as-is in Phase 1 per the spec ("do not rewrite content"). The privacy page on Puckle/Strat17 will still name Switchplay; this is expected but worth knowing (it is a legal text; see Q8).
7. **Cookie/session isolation:** separate login per domain (§2.3).
8. **Static images** duplicated (≈4 MB × 3) so each site can change images independently.
9. **`generateMetadata`/analytics:** `<Analytics />` is in the root layout and counts all three domains together (see Q10).
10. **Edge/runtime:** `proxy.ts` runs on the Node runtime in Next 16; it must not import DB/auth code. It only inspects the URL and headers.

---

## 6. Implementation sequence

1. **Baseline:** record current behaviour (`npm run typecheck`, `npm run test:unit`, Playwright screenshots of `/`, `/contact`, `/privacy`, `/login`, `/decks` desktop + mobile).
2. Create `src/app/sites/strat17/` by **moving** the existing home/contact/privacy pages and **copying** the required `public-site` components, CSS modules, brand link (STRAT17 variant from the commented block) and the two images into it. Re-point imports to the site's own folder.
3. Add site `layout.tsx` (metadata) and the footer marker `<div>` (site name) to each page's layout/footer.
4. Duplicate the strat17 folder to `puckle/` and `switchplay/`; change only: brand link, metadata strings, footer marker, "Step Visuals" link (kept for puckle, removed for the others), image paths.
5. Add `src/proxy.ts` (§4.1) and the dev/preview override (§4.2).
6. Add a short README in `src/app/sites/` explaining the rules (independence, the "copy endpoint before diverging forms" rule, how to add a public page = folder + proxy list).
7. Tests (§8), then manual checks (desktop, mobile, iPhone).
8. Document manual Vercel/DNS steps (§7). No DNS changes made.

Rough size: ~3 near-identical folders (~2,500 lines each, mostly copied), one ~80-line proxy. The only edits to existing non-site files are: removal of the moved pages, and possibly `allowedDevOrigins`.

---

## 7. What is code vs manual

**Code (in this repository):** everything in §3–§6.

**Manual (Vercel/DNS) — documented only, not done by me:**
1. Add `strat17.com`, `puckle.co`, `switchplay.ie` (and `www.` variants) to the existing Vercel project.
2. Configure `www.*` → apex 308 redirects in Vercel domain settings.
3. DNS records at each registrar per Vercel's instructions; **cutover only with your explicit approval**.
4. Confirm environment variables (MongoDB, auth secret, Cloudflare) apply to Production for all domains (same project, so no change expected).
5. Decide whether to give previews the three domains or use `?site=`.
6. Check Vercel Analytics filtering by domain (optional).

---

## 8. Tests

**Automated (unit, `node --test`):**
- T1. Host → site mapping: apex, `www`, ports, uppercase, `*.localhost`, unknown host → default, similar-looking hosts (`evilpuckle.co`) do **not** match.
- T2. Rewrite for each public path on each site; query strings preserved.
- T3. Pass-through: `/login`, `/decks`, `/library`, `/creator`, `/progress`, `/api/...`, `/_next/...` are **not** rewritten on any domain.
- T4. `/step-visuals`: allowed on `puckle`, 404 on the other two; `/sites/*` direct → 404.
- T5. Override honoured only off the production domains.

**Automated (Playwright, existing config):**
- T6. For each site (via `*.localhost` hosts): home shows correct header brand; footer marker shows correct name; links to `/contact` and `/privacy` work; direct load and refresh keep identity.
- T7. Forms render and submit (API mocked) on each site.
- T8. `/login` still renders the unchanged login UI on each domain and logging in still lands on `/decks`.
- T9. **Regression:** pixel/DOM comparison of `/login`, `/decks`, `/library` and `/creator` before vs after (proves no CSS leakage from site code or global CSS).
- T10. Original (current) home page vs each site home page: identical except brand and marker (screenshot diff).
- T11. Structural guard: a test that fails if any file under `src/app/sites/<x>` imports from another site's folder (enforces independence).

**Manual:** desktop (Chrome, Safari), mobile emulation, **real iPhone** via the `?site=` override on the LAN IP; check forms, anchors (`#early-access`, `#creator-interest`), responsive layout, and that a logged-in user still sees "Open App".

---

## 9. Challenges to the specification

1. **"Existing public pages … About page"**: no About page exists. Only home, contact, privacy. Nothing to copy beyond these.
2. **Step Visuals link:** the spec says only the brand should differ, but a public header link to `/step-visuals` must be removed on two sites (the page is Puckle-only). Minimal, necessary deviation.
3. **Login branding on three domains** conflicts with "brand appears on each site" for the login entry point; the spec also says not to change the app. Proposed: leave as-is.
4. **The spec's "domain per site" implies a login per site** (host-only cookies). Acceptable and simplest; flagged for your approval.
5. **Submission data cannot be attributed to a site** unless we add a field. The spec forbids new schema/identifiers for Phase 1, so this is a known limitation until each site gets its own endpoint.

---

## 10. Decisions and questions requiring your approval

| # | Question | Recommendation |
|---|---|---|
| Q1 | Move the existing pages into `sites/strat17/` and default unknown hosts to Strat17 (vs keeping the originals as a fourth copy)? | Move and default to Strat17. |
| Q2 | Use `*.localhost` subdomains locally plus a `?site=` cookie override for iPhone/LAN/Vercel previews (non-production hosts only)? | Yes. |
| Q3 | Apex canonical with www → apex redirect done in the Vercel dashboard? | Yes. |
| Q4 | Keep `/api/public/*` and `lib/public*.ts` shared in Phase 1, with the documented "copy endpoint before diverging" rule? Submissions will not record the originating site. Add an optional `site` field to saved submissions? (That is a small schema change the spec excludes.) | Keep shared; no schema change now. |
| Q5 | `/login` (and header chrome on it) stays "SWITCHPLAY" on all three domains? | Yes (app scope). |
| Q6 | Separate login session per domain is acceptable? | Yes. |
| Q7 | Delete the now-unused public-site form/section components from `src/components/public-site/`, or leave them untouched for a later cleanup? (`PublicLayout/Header/Footer` must stay for login.) | Leave in place for Phase 1 to minimise risk; clean up later. |
| Q8 | Privacy page and other copy still say "Switchplay"/`info@switchplay.ie` on all sites for now — OK? | Yes (spec: no content rewrite), but note it for legal review. |
| Q9 | Are `/dev/*` routes application/dev-only (excluded and never rewritten)? | Assumed yes. |
| Q10 | Change page titles/OG `siteName` per site (invisible to visitors, avoids wrong brand in tabs and shares)? | Yes. |
| Q11 | Footer marker: plain `<div>` at the bottom of each page showing `strat17` / `puckle` / `switchplay` — exact text style OK (lower-case brand names)? | Yes, to be removed later. |
| Q12 | Do you want the structural guard test (T11) preventing cross-site imports? | Yes. |

---

## 11. Risks

- **Large copy diff:** three near-identical folders; mitigated by screenshot diff (T10).
- **Proxy mistakes could affect the app:** mitigated by the allow-list design and test T3.
- **Global CSS leakage** into/out of public pages: mitigated by T9; no global CSS edits.
- **Safari `*.localhost`** resolution: fall back to the `?site=` override.

**No application code, shared component, or CSS used by the application will be modified.** Awaiting approval before any implementation.
