# Puckle membership — Phase 1 completion

14 November 2026. Implementation only of Phase 1 in the [engineering plan](membership-engineering-plan.md). Not a launch approval or authorisation for Phase 2/2P.

## Implemented foundations

- Optional shared safeguarding, permissions and future security type declarations in `UserDocument`. Authentication functions, session/JWT behaviour and account DTOs are unchanged.
- Strict date-only parsing, Europe/Dublin calendar dates and derived age, including the March-1 convention for leap-day birthdays in non-leap years. Minimum 13 is enforced only by Puckle student validation.
- Distinct DOB source and independently verified evidence. Shared approval contracts retain the common scope, accepted explanation/version, actor/event history, delivery state, guardian declaration and provenance. No approval decisions or enforcement run here. Final disclosure text is deliberately not invented.
- Backend shared-facts reader with a safeguarding-only projection; no Puckle profile required. Reviewed DOB correction helper uses expected-value conditions, targeted writes and history, invalidating old assurance without changing permissions, approval or learning data. It has no HTTP entry point and is for trusted reviewed operator processes only.
- Explicit boolean permission contract and fresh false-default factory for future accounts. No permission enforcement, assignments or existing-user backfill.
- Puckle profile, no-email contact, interest communication and transient security-record types. Independent contact collections remain distinct; no contact persistence/automatic account creation workflow is activated.
- Pure category/contact/education validators and course-change state helper. No Join controls/pages or credential-validation/authentication flow is added: later account orchestration will combine these Puckle detail validators with Phase 2's shared credential validation. Contact-only inputs reject credentials and authority fields.

## Files

Existing files changed:

- `src/lib/auth.ts`: type-only imports and optional data/security properties.
- `package.json`: `prepare:puckle-membership` command only.
- `tests/site-independence.test.ts`: shared age utility allowance; Puckle profile type allowance restricted to Puckle.

New implementation files:

- `src/lib/age.ts`
- `src/lib/userPermissions.ts`
- `src/lib/parentalApprovalScope.ts`
- `src/lib/userSafeguarding.ts`
- `src/lib/puckleMemberships.ts`
- `src/app/sites/puckle/lib/membershipRegistration.ts`
- `scripts/prepare-puckle-membership.ts`

New tests:

- `tests/shared-safeguarding.test.ts`
- `tests/puckle-registration-validation.test.ts`
- `tests/shared-membership.integration.ts`

This completion record is the only documentation addition. The specification, plan and independent review are unchanged.

## Database preparation

The explicit script prepares these eight collections, reusing existing collections:

| Collection | Requested indexes beyond MongoDB's `_id` index |
| --- | --- |
| users | Unique email and username with simple/binary collation |
| puckleMemberships | Unique userId; createdAt; founderNotification.status + createdAt |
| puckleJoinContactRequests | createdAt; founderNotification.status + createdAt |
| puckleInterestContacts | createdAt; founderNotification.status + createdAt |
| puckleTuitionEnquiries | createdAt; founderNotification.status + createdAt |
| accountEmailChallenges | Unique challengeId; cleanupAt TTL |
| accountEmailActions | Unique tokenDigest; cleanupAt TTL |
| emailRequestLimits | expiresAt TTL |

No arbitrary safeguarding retention period is introduced. Capability validity (`expiresAt`) is distinct from action/challenge cleanup (`cleanupAt`); later workflows must check expiry themselves and supply the reviewed cleanup policy. Users, profiles and contact/history collections have no TTL.

Preparation preflights identity normalisation, duplicate keys, profile identifier types, collection collation and incompatible index definitions before DDL. Compatible existing indexes are reused even under another name. Conflicts are reported without exposing identity values or dropping/repairing anything. There is no import-time/request-time setup. Unexpected failures during DDL can leave a subset of indexes/collections prepared; inspect the reported conflict and rerun after its resolution is authorised. No account or learning records are rewritten.

`npm run prepare:puckle-membership -- --help` is safe and does not connect. Application database configuration/guards are reused, with explicit `--apply` required and an additional confirmation for production configuration. The script loads no env file automatically. These flags are not approval to run against live data.

Only disposable local MongoDB replica sets were used during this implementation. The script was not run against a live database, and no existing real account permissions were assigned.

## Verification

- `npm run test:unit`: 479 passed, 0 failed.
- `node --import tsx --test tests/shared-safeguarding.test.ts tests/puckle-registration-validation.test.ts tests/site-independence.test.ts`: 20 passed, 0 failed, including the final strict-whitespace DOB and narrowed site allowance checks.
- `node --import tsx --test --test-concurrency=1 tests/shared-membership.integration.ts tests/puckle-enquiry.integration.ts`: 13 passed, 0 failed. Covers setup/reuse/rerun/conflicts, duplicate enforcement, contact-independent facts, shared scope, concurrent targeted correction and the five existing enquiry integration tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero errors and six pre-existing warnings in unrelated files.
- Compared transpiled `auth.ts` with HEAD: identical JavaScript after type erasure. No login/logout/session behaviour changes were introduced for any site.

The initial integration attempt was blocked by sandbox socket permissions (`listen EPERM`). The successful rerun used authorised local-port execution for disposable MongoDB only. This was not a product/test assertion failure. Browser/E2E/live email/production build comparisons are not Phase 1 workflows and were not run. The entire unrelated integration suite was not run; the relevant new and enquiry suites were run.

## Checkpoint

Phase 1 is ready for review: models, validation, indexes and targeted-write checks pass; no existing learning runtime file or public route was changed. There are no Phase 1 questions or additional runtime edits requiring approval. Final consent wording and purpose-based retention remain the existing later-phase review inputs, not invented defaults.

No account registration, email, onboarding, publishing restriction, group experience operation or backfill has been implemented. No commit, push, merge or deployment was performed. Stop here pending explicit authorisation for any next phase or commit.
