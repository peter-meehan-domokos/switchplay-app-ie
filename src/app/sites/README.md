# Public websites

Three independent public websites share this one Next.js app: `strat17` (strat17.com), `puckle` (puckle.co) and
`switchplay` (switchplay.ie). They started as exact copies of the original public website and are meant to diverge.

## How a request reaches a website

`src/proxy.ts` (logic in `src/lib/sites/siteRouting.ts` and `siteResolver.ts`) maps the host to a site and rewrites
public paths: `puckle.co/contact` is served by `src/app/sites/puckle/contact/page.tsx`. The browser URL does not change.

- Application routes are never rewritten: `api`, `creator`, `decks`, `dev`, `internal`, `library`, `login`, `progress`.
  They are listed in `RESERVED_APP_SEGMENTS`. **Adding a new top-level folder under `src/app` requires adding it to that
  list**; `tests/site-independence.test.ts` fails otherwise.
- `/step-visuals` is the application's Step Visuals lab and is served on Puckle only (404 elsewhere).
- `/sites/*` cannot be requested directly (404).
- Any other path is rewritten to `/sites/<site>/<path>`. **To add a page to one website only, create
  `src/app/sites/<site>/<path>/page.tsx`.** The other websites return 404 for that path automatically.

## Local development and previews

- `http://strat17.localhost:3000`, `http://puckle.localhost:3000`, `http://switchplay.localhost:3000` (Chrome/Firefox;
  Safari may need hosts entries).
- On any other host (`localhost`, a LAN IP for iPhone testing, `*.vercel.app` previews) visit once with
  `?site=strat17|puckle|switchplay`. The proxy sets a `site` cookie and redirects to the clean URL. Without it, those
  hosts show Puckle. The override is ignored on the three production domains (and their `www` variants).

## Rules that keep the websites independent

- Each website folder holds its own pages, components, CSS modules, brand text (`siteInfo.ts`), form validation (`lib/`)
  and images (`public/images/sites/<site>`). Its form handlers are in `src/app/api/public/<site>/` and write to that
  website's own collections (`<site>ContactSupportSubmissions`, `<site>EarlyAccessSignups`,
  `<site>CreatorInterestSubmissions`) in the existing `switchplay` database.
- A website may import only its own files plus `@/lib/mongodb`, `@/lib/auth` and `@/lib/phoneCountries` and npm packages.
  Never import from another website. Copy instead of sharing.
- Styling lives in CSS modules only: no global CSS imports and no unscoped `:global` rules. The only shared styling is
  the application's `globals.css` reset/body rules and the phone-input library CSS imported by the root layout; do not
  edit them for website work.
- A website must not mention another website's name or domain.
- These rules are enforced by `tests/site-independence.test.ts`.
- To diverge a form, edit that website's copy only (component, `lib/` validation and API handler).

## Tests

- `npm run test:unit` includes routing and independence tests.
- `npm run test:integration` includes `tests/site-forms.integration.ts` (handlers against an in-memory MongoDB).
- `npm run test:sites` runs HTTP checks against a running production build: `npm run build`, `npx next start -p 3011`, then
  `SITES_BASE_URL=http://localhost:3011 npm run test:sites`.

## Known, accepted limitations

- Logged-out application screens (`/decks`, `/library`, `/creator/*`, `/progress`) and the authenticated application still
  show Switchplay branding on every domain; only `/login` is branded per domain.
- The original `/api/public/*` handlers and `src/components/public-site/*` components are unused by the websites and are
  intentionally left in place (the login page still uses `PublicLayout`, `PublicHeader` and `PublicFooter`).
