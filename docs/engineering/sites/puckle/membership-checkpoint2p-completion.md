# Puckle membership — checkpoint 2P completion

14 November 2026. Builds on Phase 2 commit `2e488c6` on `site/puckle`. Implements the expressly authorised public-publishing exception in engineering plan sections 2, 3.5 and 6. This is not a deployment or public-registration launch approval.

## Functionality and boundaries

Public Card, Deck and Info Card version creation now requires the current database grant `users.permissions.publicPublishing: true`. This includes subsequent versions of public content and Copy's automatic publication into a clean public destination Deck. Private creation, staging visibility, private publication, private forks, learning and existing ownership/content rules remain unchanged.

The shared guard performs a conditional user write (`publicPublishingRevision` increment) inside the publication transaction, before the version insert and after existing validation/reference locks. It serialises with a founder's direct Mongo grant/revoke update. If revocation wins after an earlier snapshot, Mongo retries and the current false grant denies publication; a plain cached/JWT/snapshot-only permission read is not used. Existing public versions remain public and unchanged after revocation. Regrant permits the next publication without logging in again.

Missing, false, null, string, numeric and array-shaped grants fail closed. Mongo's dotted equality can match arrays, so the guard also checks that permissions is an object and publicPublishing is a scalar boolean. Teacher, isAdmin and parental approval are not alternative grants. Existing committed receipt recovery returns its prior result without creating a version or incrementing the guard.

Copy denial rolls back all its transactional changes, including draft/reference/reuse markers and publication receipts. It does not silently downgrade public content. Its existing error surface explains that this Copy requires public-publishing approval, nothing was copied, and private destinations remain available. Existing Card/Deck and Info Card feedback likewise retains edits/drafts and explains the permission requirement. No buttons, visibility controls, navigation or editors were redesigned.

## Exact source changes

Existing approved runtime files:

1. `src/lib/cards/repository.ts`: one public-only guard in publishCard; one in publishDeckInSession (also used by Copy).
2. `src/lib/infoCards/repository.ts`: one public-only guard before InfoPublication insertion.
3. `src/components/creator/creatorPublicationPresentation.ts`: one specific error message.
4. `src/components/info-cards/infoCardErrors.ts`: one specific error message.
5. `src/components/creator/CreatorCopyTo.tsx`: one specific denial branch before generic destination feedback.

Phase 1 foundation extended: `src/lib/userPermissions.ts`, retaining its types/false-default factory/validator and adding the server transaction guard. No changes to authentication runtime, publication Route Handlers, learning models, Library, media, global CSS, group functionality, `/api/users` or `seed:user`.

New tests: `tests/public-publishing-permissions.integration.ts`, `tests/phase2/public-publishing-permissions.browser.ts`.

Existing message tests extended: `tests/creator-publication-presentation.test.ts`, `tests/info-card-errors.test.ts`.

Existing trusted fixture declarations updated, without changing their learning assertions:

- `tests/assessments.integration.ts`
- `tests/card-corrections.integration.ts`, `card-forks.integration.ts`, `card-foundation.integration.ts`, `card-reuse.integration.ts`, `card-review-regressions.integration.ts`
- `tests/creator-foreign-session.integration.ts`, `creator-lifecycle.integration.ts`, `creator-visibility.integration.ts`
- `tests/info-card-attachments.integration.ts`, `info-cards-api.integration.ts`, `info-cards.integration.ts`, `info-cards-release.integration.ts`
- `tests/library-entry.integration.ts`, `library-read-models.integration.ts`, `personal-lifecycle.integration.ts`, `phase2.integration.ts`, `update-adoption.integration.ts`
- `scripts/test-phase2.ts`: explicitly trusted disposable browser fixtures; interactive review metadata now includes the generated loopback Mongo URI for safe manual grant/revoke testing. This is an ignored local test artifact, not an application/admin endpoint.

Documentation: this completion record and the persistent `membership-phase2-2p-HANDOFF.md`. Approved specification/plan/review are unchanged.

## Database and operations

No collection/index migration or production backfill is added or run. Only owned disposable replica sets were changed by tests. No live users, permissions, credentials or content were altered.

The founder's approved operational field is the scalar boolean `permissions.publicPublishing`. For a separately reviewed exact account, use a targeted `$set` of that path to true (grant) or false (revoke), checking matchedCount is one. Do not replace the user/permissions document, change isAdmin, or reset the internal publicPublishingRevision counter. No API, UI or approval workflow manages grants.

**Before deployment:** Phase 7 must assign reviewed permissions to existing shared accounts, preserving genuinely trusted users. Missing grants deny public publication immediately if this code is deployed. No blanket legacy grant or inference from teacher/admin/account age has been introduced. Public Join remains absent and closed.

## Verification

- `npm run test:unit`: **487 passed, 0 failed**.
- `npm run test:integration`: **381 passed, 0 failed, 0 skipped**. Full repository integration suite, including the final 17 permission tests, security, private learning, Card/Deck/Info publication, Copy/forks/receipts, library, media and personal-data regressions. All database mutations used disposable local replica sets.
- `node --import tsx --test --test-name-pattern='grants/revocation|unapproved learner' tests/public-publishing-permissions.integration.ts`: **3 passed, 0 failed**, additionally verifying corrected visibility assertions and unapproved private forks.
- `npm run test:phase2 -- public-publishing-permissions.browser.ts card-reuse.browser.ts`: **9 passed**.
- `npm run test:phase2 -- --info-cards info-cards-authoring.browser.ts membership-security.browser.ts`: **31 passed**.
- `npm run test:phase2 -- creator-visibility.browser.ts public-publishing-permissions.browser.ts`: **14 passed**, including the final two Card/Deck Creator denial tests. Browser total: **49 distinct journeys / 54 successful executions**, with five permission journeys repeated in the final run. Real Next/Chromium with real disposable MongoDB, local captured security email and existing mocked media transports.
- `npm run typecheck`: passed after final additions.
- `npm run lint`: **0 errors, 6 pre-existing unrelated warnings**. Final changed Info release fixture also passed targeted ESLint.
- `git diff --check`: passed.

Initial focused run: 14 passed/2 failed because the new test passed a scalar ID to the existing array-based publishedSnapshot reader; corrected the assertion. Initial typecheck caught an excess-property error in a test fixture; corrected the fixture without changing PersonalUser. An old Info media release fixture gained an explicit trusted account before public publishing. The final full suite includes these corrections and passes. No runtime permission defect was bypassed to make checks pass.

Evidence includes database revocation winning against an already-open publication snapshot for each of Card/Deck/Info, public Copy rollback, malformed array grants, private first publication/personal entry, private forks from public sources, direct HTTP enforcement across all three site contexts, regrant without login, unchanged prior public content and receipt-only recovery. Browser tests exercise existing mobile-width layouts at 375/390px, public confirmation/multi-item ordering, local edits, media, focus and session recovery.

No physical iOS/Android device, production deployment/build comparison or live provider test was run for this checkpoint. Those are not represented by Chromium viewport testing. No public Join end-to-end journey exists yet.

## Checkpoint assessment

Checkpoint 2P meets its approved implementation and automated acceptance criteria and is ready for manual review. There are no unresolved test failures, additional runtime changes requiring approval or new product questions. Existing-account reviewed permission preparation remains Phase 7 and is mandatory before production enforcement; it was not performed here. Phase 2 remains committed separately as `2e488c6`; this record belongs in the separate tested 2P commit. Stop after that commit, without starting Phase 3.

## Manual review after the tested commit

Use a disposable environment only. `npm run dev:phase2 -- --info-cards` starts the existing local review server; `phase2-test-results/review-server.json` gives baseURL, generated mongoUri and database. Both `phase2` and `other` are explicitly trusted test accounts with password `local-test-only`. Data disappears when the runner stops. Never substitute `.env.local`/Atlas for this check.

1. As `phase2`, create and publish private Card/Deck/Info Card content; check personal learning still opens normally.
2. Using only that runner's loopback database, review the `phase2` account and set `permissions.publicPublishing` to false. Keep the browser signed in. Try public publication for all three content types: expect approval feedback and retained edits.
3. Set the same fixture grant true. Publish publicly; then revoke and try another version. Expect denial, while previously published content remains visible to `other` in Library.
4. Prepare a clean public destination Deck while granted. Revoke, then Copy a published Card into it: expect explicit approval feedback and no appended Card/version. Copy to a private destination should still work.
5. Regrant and retry publication. Check mobile-width error messages, dialogs and local edits. Public Join is not available at this checkpoint and is not part of manual verification.

No push, merge, deployment, Phase 3, existing-user backfill or permission-management tool is authorised by this completion record.
