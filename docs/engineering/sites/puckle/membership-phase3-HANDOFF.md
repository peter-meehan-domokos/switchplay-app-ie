# Membership Phase 3 handoff — Puckle Join registration

Branch `site/puckle`. Base commit: `0b13fb4` (2P UI refinement). Phases 1, 2, 2P are committed and must not be reimplemented.
Authorisation: Phase 3 only (user message of 14 Nov 2026). **No commit, push, merge, deploy** without explicit approval. No Phase 4+.

## Resume point

> **Status: PHASE 3 COMPLETE AND TESTED; STOPPED FOR MANUAL REVIEW. Nothing committed.** See `membership-phase3-completion.md` for results. iPhone review server: `npm run dev:phase2 -- --info-cards --lan` (output in `phase2-test-results/phone-review.log`, which also prints verification codes). On approval, commit the whole working tree as one Phase 3 commit (subject suggestion: `feat(puckle-membership): phase 3 join registration`). Do not start Phase 4 without a new instruction.

## Architecture decisions (Phase 3)

- Pure layout pipeline `src/app/sites/puckle/lib/membershipJoinLayout.ts` (`buildMembershipJoinLayout`, `withXxx` state helpers) feeds all Join components (project rule: `[Component]Layout.ts`). Components never patch layout output.
- Puckle site code may import only the approved shared aliases (`tests/site-independence.test.ts`). Server orchestration therefore lives in `src/lib/puckleRegistration.ts` / `src/lib/puckleJoinContacts.ts` / `src/lib/founderNotifications.ts`; Puckle route handlers under `src/app/api/public/puckle/` are thin and call them. Narrow allow-list additions were made in the site-independence test.
- Registration kill-switch: Join page, header link and the three APIs are open only when `NODE_ENV !== "production"` or `PUCKLE_JOIN_ENABLED=1` (satisfies "do not expose public registration on a production deployment"). Header keeps `/#early-access` while closed.
- Email verification reuses Phase 2 `/api/auth/email-verification` (request/verify) unchanged. Final registration consumes the proof inside the same Mongo transaction as account + profile insertion (`consumeEmailProof` + `insertAccount` + `puckleMemberships`).
- Session cookie is written only after commit from a pre-signed token. Founder notification via `after()` after commit; status stored `pending` with the source record.
- Student DOB stored in `users.safeguarding` (`dobSource: "self-declared"`, `ageAssurance: {verification: "none"}`); never in `puckleMemberships`.

## Completed (uncommitted working tree)

- Shared helper edits (behaviour-preserving): `accountCredentials.ts` byte count via TextEncoder (browser-safe); `accountSecurityHttp.ts` `securityRequest(request, maxBytes=8192)`; `emailRequestLimits.ts` `limitRequesterAction`; `accountEmailChallenges.ts` `hasVerifiedEmailProof` (read-only pre-check so junk proofs cannot trigger bcrypt); `userSafeguarding.ts` `newSelfDeclaredSafeguarding`; `siteEmail.ts` LAN-origin allowance only when `ACCOUNT_EMAIL_LAN_REVIEW=1` AND disposable DB guard passes (phone review).
- `membershipRegistration.ts`: exported `normaliseMobile`, `EMAIL_PATTERN` (no behaviour change; Phase 1 validator tests still pass).
- New server: `src/lib/puckleRegistration.ts` (registerPuckleMember transaction + HTTP handlers), `puckleJoinContacts.ts`, `founderNotifications.ts`; routes `src/app/api/public/puckle/{membership,join-contact,interest}/route.ts`.
- New Puckle lib: `membershipJoinLayout.ts` (pure layout/validation/payloads), `joinClient.ts`, `joinAvailability.ts` (kill-switch), `memberEmailTemplates.ts`.
- New UI: `join/page.tsx`, `MembershipJoinForm.tsx`(+`.module.css`), `JoinFields.tsx`, `StudentRegistrationForm.tsx`, `TeacherRegistrationForm.tsx`, `InterestRegistrationForm.tsx`; `PublicHeader.tsx` Join link -> `/join` when open.
- `tests/site-independence.test.ts`: Puckle-only alias allow-list (`puckleMemberships`, `accountCredentials`, `puckleRegistration`).
- `scripts/test-phase2.ts`: `PUCKLE_FOUNDER_EMAIL`, LAN origin env, interactive runs print captured emails (so a phone user can read the code).
- Unit tests: `tests/puckle-join-layout.test.ts` (17 pass).

- Added: privacy-page "Joining Puckle" section; `tests/puckle-registration.integration.ts` (19), `tests/phase2/puckle-join.browser.ts` (15).
- **Runner fix (important for any future public-page browser test):** `scripts/test-phase2.ts` used `next dev --hostname 127.0.0.1`, under which Next's proxy rewrites (`/join` -> `/sites/puckle/join`) looped and every public page returned 500 (it had simply never been exercised by earlier phases). It now binds `localhost` with `NODE_OPTIONS=--dns-result-order=ipv4first` (still loopback-only IPv4), `SWITCHPLAY_REVIEW_ORIGINS` also lists `localhost`/`*.localhost`, `ACCOUNT_TRUST_PROXY_IP=1`, `PUCKLE_FOUNDER_EMAIL`.
- Bug found and fixed during browser testing: the in-flight guard `busyRef` was not released after a successful code send (verify submit silently ignored). All paths now release via `release()`.
- Phone field default country follows the browser locale (existing `PublicPhoneInput`, unchanged); tests use `locale: "en-IE"` and national digits.

## Files
See Completed.

## Tests
- `node --import tsx --test tests/puckle-join-layout.test.ts`: 17 pass.
- `tests/site-independence.test.ts`: 8 pass; `tests/puckle-registration-validation.test.ts`: 6 pass.
- `npx tsc --noEmit`: clean at this checkpoint.

## Outstanding
1. `tests/puckle-registration.integration.ts` (transactional creation, proof rules, races, rollback, contacts, notifications).
2. `tests/phase2/puckle-join.browser.ts` (mobile-width journeys; real server; closed-site checks; private publish OK / public forbidden for a new account).
3. Privacy page section; docs completion record `membership-phase3-completion.md`.
4. Full regression runs and iPhone server restart.
