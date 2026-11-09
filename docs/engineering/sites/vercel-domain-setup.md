# Vercel, DNS and domain setup for the three websites

**Status:** documentation only. **None of these steps has been performed.** Each requires separate explicit approval at the
cutover. The code (see [multisite-engineering-plan.md](./multisite-engineering-plan.md)) works without them: until they are done,
the sites are reachable only on Preview deployments (using `?site=`) and on the existing switchplay.ie.

## What merging the code to `main` does by itself

`main` deploys to production automatically (existing GitHub → Vercel workflow, project `switchplay-app-ie`, no `vercel.json` change).

- `switchplay.ie` / `www.switchplay.ie` keep working and are served from the Switchplay site folder (same content, titles and
  email as before). `/login` now shows the per-domain brand (Switchplay there).
- Unknown hosts, including the `switchplay-app-ie.vercel.app` alias, show Puckle.
- **Live Switchplay forms start writing to the new `switchplay…` collections** (`switchplayContactSupportSubmissions`,
  `switchplayEarlyAccessSignups`, `switchplayCreatorInterestSubmissions`); the legacy collections (`contactSupportSubmissions`,
  `earlyAccessSignups`, `creatorInterestSubmissions`) stop receiving new records and are left untouched. Check that nothing outside
  this repository (Atlas views/exports, scripts, manual processes) reads the legacy collection names before merging.
- `puckle.co` and `strat17.com` are not attached to the project, so they are not publicly reachable yet.

## Manual steps (cutover)

1. Add `puckle.co`, `www.puckle.co`, `strat17.com`, `www.strat17.com` to the existing Vercel project `switchplay-app-ie`
   (the Vercel account currently lists only `switchplay.ie`). Set DNS per Vercel's instructions at each registrar/DNS provider
   (at least one of these appears to use Cloudflare DNS: use DNS-only, not proxied, records unless you decide otherwise).
2. Canonical domains are the **apex** domains. For every domain set the apex as primary and redirect `www.` → apex (308) in the
   Vercel domain settings.
3. **Reverse the existing Switchplay setting.** Today `switchplay.ie` redirects (307) to `www.switchplay.ie`. Make
   `switchplay.ie` primary and redirect `www.switchplay.ie` → `switchplay.ie`. Session cookies are host-only, so users logged in
   on `www.switchplay.ie` must log in again; existing `www` links redirect; search engines re-index. Do it at the cutover, ideally off-peak,
   after Preview verification.
4. Environment variables are shared (same project); no new variables are expected. Confirm Production still has the existing
   `MONGODB_*`, auth and Cloudflare variables.
5. Create or verify the mailboxes (or forwards): `info@puckle.co`, `info@strat17.com`, `info@switchplay.ie`.
6. If previews are used for iPhone testing, check Vercel Deployment Protection settings. On previews and LAN hosts use `?site=`.

## Pre-launch gates (per domain, before public launch)

- Privacy policy accuracy verified for that site (the policy text names the site and its contact address; confirm the legal
  entity/controller wording is correct).
- Mailbox for that domain works.
- Smoke test on the live domain: `/`, `/contact`, `/privacy`, each form (use a test submission and then check the site's own
  collections), `/login`, direct load and refresh of each page, and that `puckle.co/step-visuals` works while
  `strat17.com/step-visuals` and `switchplay.ie/step-visuals` return 404.

## Cutover order

Add domains to the project → verify domains → switch DNS → apply canonical redirects → smoke test each domain → announce.

## Known limitations

- `migration:phase8 --verify` (historical, one-off tooling) will report `UNEXPECTED_COLLECTIONS` once the new collections exist.
  See the note at the end of [../phase-8-preparation.md](../phase-8-preparation.md).
- Logged-out application screens and the authenticated application still show Switchplay branding on every domain; only `/login`
  is branded per domain. All three websites share the same favicon.
- Form submissions carry no site identifier; each site is distinguished only by its own collections.
