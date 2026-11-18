# Membership Phases 6 and 7 handoff

Branch `site/puckle`. Sequence authorised: Phase 6 (onboarding) -> commit -> Phase 7 (existing-account backfill tooling) -> commit -> stop for combined review. No push/merge/deploy, no live DB, no real email, no Phase 8.

## Resume point
> **Phase 6: DONE, committed as c544df2. Do not revisit.**
> **Phase 7: implementation + tests complete; final regression and commit pending. See membership-phase7-completion.md.**

## Phase 6 summary
See `membership-phase6-completion.md`. Key files under `src/components/onboarding/`, `src/lib/onboarding.ts`, `src/lib/authSessionEvents.ts`, `src/app/api/account/onboarding/route.ts`; tests `tests/onboarding-lifecycle.test.ts` (10), `tests/onboarding-status.integration.ts` (5), `tests/phase2/onboarding.browser.ts` (13).

## Phase 7 plan (from engineering plan section 6)
`scripts/backfill-known-puckle-users.ts` + manifest schema/example in docs; dry-run default, `--apply` explicit; per-account transaction; exact `_id` resolution (email/username resolution reported, not auto-applied); permission disposition for EVERY existing account (true only for founder-reviewed trusted ids; false for explicitly reviewed others; refuse unresolved/conflicting); optional DOB/assurance/Puckle profile for selected accounts (welcome ineligible, source unknown, `known-account-backfill` provisioning); `users.membershipBackfill` receipt; drift refusal on rerun; never touch credentials/learning/publicPublishingRevision; tests `tests/known-user-backfill.test.ts` + `.integration.ts`; package.json script; completion record with live review procedure. NO live execution.

## Phase 7 status (final)
Implemented and tested; committed as `feat(puckle-membership): phase 7 existing account preparation` (see `git log`). Files: `src/lib/knownUserBackfill.ts`, `scripts/backfill-known-puckle-users.ts`, `package.json` script, `membership-backfill-manifest.md`, `membership-phase7-completion.md`, tests `tests/known-user-backfill.{test,integration}.ts` and `tests/phase2/backfill-regression.browser.ts`. NOTHING has run against a live database. Next for a human/agent: Phase 8 only after the founder authorises the live read-only assessment and reviews the manifest; no live apply without separate approval.
