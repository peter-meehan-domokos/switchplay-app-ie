# Puckle membership — Phase 2 completion

Implemented 14 November 2026 on `site/puckle`, building on Phase 1 commit `19718b7`. This record covers shared account security/email only. Public Join, publishing enforcement, parental decisions and onboarding are not delivered by this checkpoint.

## Implemented

- Core new-credential validation: case-sensitive trimmed 3–30 character usernames, trimmed/lowercase email, at least 12 Unicode password characters and no more than bcrypt's 72 UTF-8 bytes. Existing login never applies these new-registration rules. Hash cost 12.
- Pre-generated account ID, prepared hash and signed version-zero session before persistence; transaction-only insertion with empty cardsData/decksData/sharedDeckData, ordinary account metadata and publicPublishing false. The caller must consume email proof and insert its site profile in the same transaction; there is no public account-creation route. Duplicate-key classification never signs into or overwrites another account.
- Six-digit challenges with keyed digests, flow/email binding, ten-minute expiry, atomic five-wrong-attempt limit, resend replacement/cooldown and a single verified proof reusable until consumed or expired. Verification stores no credentials/student draft and creates no user/profile. Existing email receives owner guidance with the same visible handle/result shape.
- Shared recipient limits (3/hour, 5/day, 60-second cooldown) and requester limit (10/hour), using expiring atomic counters. Limits are shared between verification/reset and ready for later parental mail. Denied requests conservatively consume window budget.
- Thirty-minute reset links: explicit POST, single use, account/email/version bound, transactionally update only passwordHash/passwordChangedAt/sessionVersion and consume outstanding reset capabilities. Legacy accounts can recover without new verification metadata. No automatic target login or unrelated browser logout.
- Version-zero legacy sessions remain compatible. Login signs the version captured with the checked password hash; reset races cannot issue a valid new-version session using old credentials. AuthUser, cookie name/lifetime/security options and login error/response contracts remain unchanged. Auth database queries project only needed fields.
- Trusted per-site email configuration, bounded Resend HTTP transport and disposable-only loopback fixture transport. Sanitised pending/sent/failed/unknown outcomes are persisted. Acceptance by the transport is not inbox delivery; unknown/failed reset sends preserve a neutral response.
- Analytics-free HTML Route Handler action document with fragment removal, lexical-memory token, explicit reset submission, no token cookies, CSP nonce, no-store and no-referrer. Two tabs have independent token state. Request UI lives under `/login/forgot-password`; AuthScreen has its recovery link only, without Phase 6 notifications.

## Files

Existing runtime files modified:

- `src/lib/auth.ts`
- `src/app/api/auth/login/route.ts`
- `src/components/auth/AuthScreen.tsx`

Existing test infrastructure modified: `scripts/test-phase2.ts` (membership collection preparation in disposable DB, loopback email capture, configuration and token-log assertion).

New runtime files:

- `src/lib/accountCredentials.ts`, `accountEmailChallenges.ts`, `accountEmailTemplates.ts`, `accountSecurityHttp.ts`
- `src/lib/emailActionTokens.ts`, `emailRequestLimits.ts`, `passwordRecovery.ts`, `siteEmail.ts`, `emailActionDocument.ts`
- `src/app/api/auth/email-verification/route.ts`
- `src/app/api/auth/password-reset/request/route.ts`
- `src/app/api/account-actions/open/route.ts`, `details/route.ts`, `password-reset/route.ts`
- `src/app/login/forgot-password/page.tsx`
- `src/components/auth/ForgotPasswordForm.tsx`, `AccountRecovery.module.css`

New tests: `tests/account-email-verification.test.ts`, `tests/account-security.integration.ts`, `tests/phase2/membership-security.browser.ts`.

Documentation: this record and `membership-phase2-2p-HANDOFF.md`. Design specification, engineering plan and independent review remain unchanged. Puckle-only Join/parent templates are deferred until their actual workflows exist; the current templates are shared security messages.

## Database and operational configuration

Only disposable local replica sets were mutated. Reused Phase 1's explicit preparation and existing transaction helper. No new collections/indexes or live preparation/backfill. Exercised accountEmailChallenges, accountEmailActions, emailRequestLimits, optional users security fields and transactional fixture profiles. Challenge/reset cleanupAt equals expiresAt: these flows require no post-expiry renewal lookup. Every operation still checks expiry independently of TTL. Parental evidence/retention remains later work.

Configure outside Git, per deployed environment:

- `SESSION_SECRET`: existing signing secret; do not rotate merely for this change.
- `ACCOUNT_EMAIL_SECRET`: separate random secret of at least 32 bytes for code/counter HMACs.
- `ACCOUNT_EMAIL_PUCKLE_FROM`, `ACCOUNT_EMAIL_SWITCHPLAY_FROM`, `ACCOUNT_EMAIL_STRAT17_FROM`: genuinely verified sender identities, no invented defaults.
- Corresponding `ACCOUNT_EMAIL_<SITE>_ORIGIN`: canonical HTTPS origin, no path/trailing slash. Local HTTP origins are allowed only for loopback/localhost. These produce email links, never request Host input.
- Optional `ACCOUNT_EMAIL_<SITE>_ALLOWED_ORIGINS`: comma-separated explicitly trusted form origins (for reviewed www/preview aliases). Canonical origin remains the email destination; unlisted Origins are rejected.
- `RESEND_API_KEY`; `ACCOUNT_EMAIL_TRACKING_DISABLED=1` only after the operator disables provider open/click tracking for the sender domain. Resend configures tracking at the domain level, not on individual sends: [provider guidance](https://github.com/resend/resend-skills/blob/main/skills/resend/references/sending/overview.md). No account/provider/domain changes were made by this task.
- `ACCOUNT_TRUST_PROXY_IP=1` only if the deployment's ingress overwrites `x-forwarded-for`. Otherwise a conservative shared requester bucket is used; configure ingress before public use. Recipient limits remain independent.

Tests set `ACCOUNT_EMAIL_TEST_ENDPOINT` to their owned loopback server, guarded by the existing disposable database check. Never configure it for production. Fixture messages live in test-runner memory and are discarded at shutdown; no mail is sent externally. The runner's `/emails` fixture is on its separate local fixture port, not an application endpoint.

Failed delivery can be retrieved by authorised database access: filter accountEmailChallenges/accountEmailActions on `delivery.status` (`pending`, `failed`, `unknown`) and identify the challengeId/action `_id`, recipient and attempt/reference while unexpired. Do not log/export message bodies or capabilities. There is no queue or admin interface. Transient cleanup is intentionally short; investigate failures promptly rather than retaining security records indefinitely.

## Tests and evidence

- `npm run test:unit`: **485 passed, 0 failed**.
- `node --import tsx --test tests/account-email-verification.test.ts`: **6 passed, 0 failed**, rerun after final trusted-origin change.
- `node --import tsx --test --test-concurrency=1 tests/account-security.integration.ts tests/shared-membership.integration.ts tests/puckle-enquiry.integration.ts`: **31 passed, 0 failed** (18 security, 8 Phase 1 foundations, 5 existing enquiry).
- `npm run test:phase2 -- membership-security.browser.ts`: **7 passed, 0 failed**. Real Next server, Chromium, disposable MongoDB and local captured transport. Includes existing login/error/cookie/logout contracts across three site contexts; complete recovery on each; old JWT invalidation; explicit action POST/no GET mutation; no token in requested URLs/console/server logs; no action analytics/external requests; two independent tabs; unrelated signed-in account preserved; and a helper-created ordinary account opening `/decks` without a Puckle profile.
- `npm run typecheck`: passed.
- `npm run lint`: passed, **0 errors / 6 existing unrelated warnings**.
- `git diff --check`: passed.

Initial browser run: 3 passed/1 failed because the test explicitly overrode the Cookie header and hid its newly set session. Replaced that fixture with the normal cookie jar; final suite passes. Initial integration needed local socket permission; all successful database runs used owned disposable sets. No product failure was hidden by modifying existing learning code.

No production build/caching comparison, actual provider/inbox acceptance, physical mobile-device testing or full public Join E2E is claimed. Production rendering/mobile-wide comparisons remain Phase 8; full registration is Phase 3. Current action interactions are browser-tested, and existing learning runtime source is unchanged. No actual provider credentials, sender identity or production-origin configuration was inspected or changed.

## Checkpoint and next action

Phase 2 meets its implementation/test checkpoint and is ready for review with simulated email delivery. Real-mail acceptance requires the configuration above and separate authorised testing; no new application-file approval is needed. No unresolved implementation blocker. Do not expose public registration or deploy these changes as a completed membership product.

The user amendment authorises committing this tested checkpoint and then proceeding to 2P. No push, merge, deployment or live-data operation has occurred. Phase 6 auth notifications and all other later workflows remain out of scope here.
