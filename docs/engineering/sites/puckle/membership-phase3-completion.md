# Puckle membership — Phase 3 completion (Join registration)

14 November 2026, branch `site/puckle`, on top of `0b13fb4`. **Uncommitted, awaiting review.** Public Join is closed on production builds (see Configuration). No push, merge, deployment or live-data operation occurred. Phase 4+ not started.

## Implemented

- `/join` ("Join Puckle.") with in-place choices **I'm here to learn** (default), **I'm a teacher**, **I'm interested in Puckle**. Mobile and **Don't have an email address?** are visible on every choice. Common details survive switching; category fields do not leak across.
- **Student (email)**: first name, username, email, password, DOB (day/month/year, ≥13), course/level map, optional mobile. Code request → code entry → account creation → automatic sign-in → full-document navigation to `/decks`. 13–15 sees private-learning wording; no parental workflow.
- **Teacher (email)**: same verification; optional introduction (blank succeeds); ordinary account; confirmation screen; founder alert.
- **No-email student/teacher**: credentials hidden *and cleared*; mobile required; saved to `puckleJoinContactRequests`; no user/profile/username reservation/password; founder alert; personal-follow-up confirmation.
- **Interested**: contact only (`puckleInterestContacts`); email and/or mobile; unchecked email-updates opt-in recorded with wording version and time; mobile-only disables opt-in with explanation; never an account, even with an email that exists.
- Course map exactly per spec; A-level disables Level, clears it and stores `level: null`; changing course clears incompatible level text; Other/Don't know supported.
- Username-conflict correction reuses the verified proof (no new code). Existing email: same on-screen result, owner receives sign-in guidance, no account created or reused. Changing email invalidates the earlier code; resend has a visible 60 s cooldown.

## Data and security

- Account + profile + proof consumption commit in **one** Mongo transaction (`consumeEmailProof` + `insertAccount` + `puckleMemberships`). Duplicate key 11000 maps to an editable username conflict or neutral email conflict; the transaction rolls back and the proof stays reusable (tested: username conflict, post-verification email conflict, profile-insert failure, concurrent submissions → exactly one account).
- Password hashing and session signing happen before the transaction; a cheap read-only proof check precedes hashing so junk requests cause no bcrypt work. Cookie written only after commit; if it fails the client is told to sign in rather than re-register.
- New users: `cardsData/decksData/sharedDeckData: []`, `permissions.publicPublishing: false`, `isAdmin: false`, `sessionVersion: 0`, `emailVerifiedAt`. Student DOB → `users.safeguarding` (`self-declared`, `ageAssurance: none`); never in the profile. Profile holds no DOB/approval/credential data. The challenge/proof record keeps no registration data.
- Strict field allow-lists reject smuggled authority fields (`permissions`, `isAdmin`, `safeguarding`) and any credential in contact payloads. Origin allow-list, JSON-only, size cap, per-requester contact limit (10/h), honeypot for contact forms.
- Founder alerts: `pending` saved with the source record; `after()` sends post-response; outcomes `sent/failed/unknown` with sanitised references; failure never affects the saved record. Alert text carries name/contact/introduction, never passwords, hashes or DOB.
- Backend public-publishing guard untouched; verified that a new account can publish privately and is refused (403 `PUBLIC_PUBLISHING_FORBIDDEN`) publicly.

## Files

Modified: `scripts/test-phase2.ts`, `src/app/sites/puckle/components/PublicHeader.tsx` (Join → `/join` when open), `src/app/sites/puckle/lib/membershipRegistration.ts` (exports `normaliseMobile`, `EMAIL_PATTERN`; no behaviour change), `src/app/sites/puckle/privacy/page.tsx` (factual "Joining Puckle" section; legal review still required), `src/lib/accountCredentials.ts` (browser-safe byte count), `accountEmailChallenges.ts` (+`hasVerifiedEmailProof`), `accountSecurityHttp.ts` (+optional `maxBytes`), `emailRequestLimits.ts` (+`limitRequesterAction`), `siteEmail.ts` (private-LAN origin allowance only when `ACCOUNT_EMAIL_LAN_REVIEW=1` and the disposable-database guard passes), `userSafeguarding.ts` (+`newSelfDeclaredSafeguarding`), `tests/site-independence.test.ts` (Puckle-only alias allow-list).

New: `src/lib/puckleRegistration.ts`, `puckleJoinContacts.ts`, `founderNotifications.ts`; `src/app/api/public/puckle/{membership,join-contact,interest}/route.ts`; `src/app/sites/puckle/join/page.tsx`; `components/{MembershipJoinForm,JoinFields,StudentRegistrationForm,TeacherRegistrationForm,InterestRegistrationForm}.tsx` + `MembershipJoinForm.module.css`; `lib/{membershipJoinLayout,joinClient,joinAvailability,memberEmailTemplates}.ts`; tests `tests/puckle-join-layout.test.ts`, `tests/puckle-registration.integration.ts`, `tests/phase2/puckle-join.browser.ts`; this record and `membership-phase3-HANDOFF.md`.

## Configuration

- `PUCKLE_JOIN_ENABLED=1` opens Join on a production build (page, header link and APIs). Unset = closed (`/join` 404, header keeps `/#early-access`). Dev/test are open. **Do not set before Phase 7 permission review and Phase 8 verification.**
- `PUCKLE_FOUNDER_EMAIL` (founder alert recipient). Sender/origin/provider variables are the Phase 2 ones. `ACCOUNT_TRUST_PROXY_IP=1` only behind an ingress that overwrites `x-forwarded-for`, otherwise all requesters share one limit bucket (10 code requests/h and 10 contact submissions/h site-wide).
- Operational retrieval: list `puckleMemberships` (teachers), `puckleJoinContactRequests`, `puckleInterestContacts` by `createdAt`; filter `founderNotification.status` in `pending|failed|unknown`.

## Tests

| Command | Result |
| --- | --- |
| `node --import tsx --test tests/puckle-join-layout.test.ts` | 17 pass |
| `npm run test:unit` | 504 pass, 0 fail |
| `npm run test:integration` (full) | 400 pass, 0 fail, 0 skip (381 prior + 19 new) |
| `npm run test:phase2 -- puckle-join.browser.ts` | 15 pass (390px, real Next + disposable Mongo + captured mail) |
| `npm run test:phase2 -- membership-security.browser.ts creator-visibility.browser.ts card-reuse.browser.ts library-entry.browser.ts` | 22 pass |
| `npm run test:phase2 -- public-publishing-permissions.browser.ts` (own run) | 15 pass |
| `npm run typecheck`; `npm run lint` | pass; 0 errors, 6 pre-existing warnings |
| `git diff --check` | clean |

Not run: production build/caching comparison (needs Atlas), real email provider, physical iPhone, `--info-cards` browser suites (runner change affects all browser suites but five unrelated suites exercised it), Switchplay/Strat17 page rendering beyond 404/refusal checks. When `public-publishing-permissions` was batched after `membership-security` in one runner it failed 15/15 because the latter resets the shared `phase2` password; it passes alone. Existing batching hazard, not a regression.

Issues found and fixed during testing: (1) the in-flight guard stayed set after a successful code send, so verification silently did nothing — now released in one place; (2) the earlier runner could not render any public page (see below); (3) lint purity/escaping fixes.

**Runner finding:** `next dev --hostname 127.0.0.1` makes Next's proxy rewrites loop, so every public Puckle/Switchplay/Strat17 page returned 500 under `scripts/test-phase2.ts`. No earlier phase exercised them. The runner now binds `localhost` with IPv4-first DNS (still loopback only) and lists `localhost` in the dev origins.

## Resume / next

Phase 3 ready for manual iPhone review. Unstarted by instruction: Phase 4 (tuition integration), 5, 6, 7, 8.

## Addendum — final UI refinements (after manual iPhone review)

- A-level hides the whole Level field (label and select); `level: null` unchanged. Other courses show it again with their options.
- "I'm interested in Puckle" is an occasional-updates sign-up: intro "Interested in Puckle? Leave your details and we'll send you occasional updates as it develops.", button **Keep me updated**, no checkbox, optional "What brings you to Puckle?" (the separate message field was removed). Submitting with an email records `communication {emailUpdates: true, source: "join-interest-form", wordingVersion: "puckle-updates-signup-v1", recordedAt}`; mobile-only records `emailUpdates: false` (follow-up only, no SMS marketing). Server derives this; a client-supplied `emailUpdates` is rejected. Unsubscribe route stated in confirmation and privacy page: email the support address. No mailing-list tooling.
- Under-16 wording replaced with the agreed shorter version.
- Welcome screen after student registration: unchanged pending a decision on duration (it currently shows only until the browser finishes navigating to /decks; there is no timer).
- Focused tests re-run: layout/validation/site-independence 31 pass, registration integration 19 pass, Join browser 15 pass, typecheck and lint clean.
