# Group Experiences — removal of administrative environment gates

> **Storage decision superseded, 5 November 2026:** Deployment Checkpoint 1 replaces the historical dedicated Group bucket with the existing `CLOUDFLARE_R2_USER_DATA_BUCKET_NAME` (`path-user-data`), retaining the Group namespace and all contribution permissions/lifecycle rules. The18 Group indexes have now been provisioned in Atlas `switchplay`. Original execution records below remain historical. See the [current deployment handoff](group-experience-deployment-checkpoint-1-handoff.md).

**Implemented and verified, 5 November 2026.** Work on `feat/group-experience`, baseline `225f957`, initially clean. Remove `SWITCHPLAY_GROUP_EXPERIENCES_ENABLED` and `GROUP_MEDIA_PRIVATE_PROVIDER_VERIFIED` only. All changes remain uncommitted pending founder approval. Bucket choice, protected-media configuration, provider operations, ownership and delivery remain unchanged. No Atlas, Vercel or Cloudflare configuration/data writes were performed.

Runtime removals and affected tests are implemented. Tests-first provider/route assertions failed against the old gates; after removal,14/14 focused provider/route tests passed (`/tmp/group-gate-removal-unit.log`). The seven-suite disposable MongoDB selection passed104/104 (`/tmp/group-gate-removal-integration.log`). All references to the removed variables, the `groupsEnabled` prop and obsolete verification error are absent from `src`, `scripts` and `tests`.

Current specification updated and eight historical handoffs/plans explicitly marked superseded. TypeScript and targeted lint passed, including the added Progress entry/Back assertions in the existing integrated browser journey. The actual configured default production build (`npm run build`, Next16.2.6 Turbopack) passed in `/private/tmp/switchplay-group-gates-fv7ohdzz`, without copied environment files or database credentials (`/tmp/group-gate-removal-build.log`). No bundler/configuration change was necessary. Existing Library/My Decks regression passed1/1 with no seeded Groups (`/tmp/group-gate-removal-library.log`); the full-app disposable fixture now explicitly provisions empty Group indexes.

Fresh Chromium/WebKit selection **passed 6/6** (`/tmp/group-gate-removal-browser.log`,5.8m): complete club journey in both engines including Library creation, both roles entering and returning from Group Progress, shared/individual notes, media ownership/hiding, management and revocation; explicit Deck/Card updates and preservation; own Group upload/history/deletion. The task-owned export `/private/tmp/switchplay-group-gates-browser-v1ivhhs_` ran on loopback4195. Its database and all provider assets were disposable/mocked; no removed variable was assigned by the new runner. Only that task-owned runner was stopped after verification; the original4192 and4191 review services/records were not changed or reset.

Final application/harness byte comparisons match both verified exports; `git diff --check` and the runtime/test reference scan passed. No unresolved test failure or product decision remains for gate removal. Next: founder approval before committing, then the separately commissioned media-architecture decision. The 18 Group indexes remain required **before deploying the flag-free build against Atlas**; they were not provisioned here. Only disposable test databases were provisioned.

## Implementation

- Group HTTP entry uses normal authentication and current permissions, without an availability switch. My Decks always retrieves authorised Group tiles; Library always offers Add as Group with its existing navigation/pending checks. Remove the obsolete `groupsEnabled` prop rather than replacing it with a constant.
- Group Progress and reflection routes retain actor binding, current membership/role checks, scope validation and revisions. Collective reflections still accept only Save; removal of the availability condition does not permit other collective operations.
- Provider configuration no longer requires a manual-test attestation. Missing genuine configuration still fails, including the unchanged protected-media requirement, credentials and dedicated bucket. Obsolete verification error handling is removed; the existing configuration-error response handles protected-media misconfiguration.
- No bucket, object key, upload proof/metadata, Stream signed-URL behavior, provider cleanup, owner history, Group sharing, image streaming or Personal media behavior is changed.
- Full-app disposable fixtures create Group indexes regardless of whether they seed Groups. Existing fixture scenario selectors remain test-data selectors only; they do not control application availability. Existing review fixtures and persisted actions are preserved.

## Exact changed-file inventory

Application:

- `src/lib/groupExperiences/http.ts`
- `src/lib/groupExperiences/media/providers.ts`
- `src/lib/groupExperiences/media/http.ts`
- `src/app/decks/page.tsx`
- `src/app/library/page.tsx`
- `src/app/library/[deckTemplateId]/page.tsx`
- `src/app/group-experiences/[experienceId]/progress/page.tsx`
- `src/app/api/reflections/route.ts`
- `src/components/library/LibraryShell.tsx`

Harness/tests:

- `scripts/test-phase2.ts`
- `tests/group-experience-api.integration.ts`
- `tests/group-assessments.integration.ts`
- `tests/group-personal-assessments.integration.ts`
- `tests/group-framework-progress.integration.ts`
- `tests/group-media-providers.test.ts`
- `tests/group-media-routes.test.ts`
- `tests/phase2/deck-menu.browser.ts`
- `tests/phase2/group-integrated-acceptance.browser.ts` — existing club journey now enters Group Progress and returns through Back as both Admin and follower.

Current documentation:

- `docs/engineering/features/group-experience/group-experience-engineering-plan.md` — current availability/configuration rule, predeployment indexes and removal of obsolete entry-disable/rollback instructions. Dedicated bucket and delivery remain unchanged pending the separate architecture decision.
- `docs/engineering/features/group-experience/group-experience-gate-removal-handoff.md` — this record.

Historical documents with a prominent supersession note, retaining original results/commands:

- `group-experience-phases-2-3-handoff.md`
- `group-experience-phase-4-engineering-plan.md`
- `group-experience-phase-4-handoff.md`
- `group-experience-phase-5-7-handoff.md`
- `group-card-data-rename-handoff.md`
- `group-experience-phase-6-handoff.md`
- `group-experience-phase-7a-handoff.md`
- `group-experience-phase-11-acceptance.md`

All historical paths are in `docs/engineering/features/group-experience/`. Remaining literal variable names occur only in the current removal decision/this handoff and explicitly superseded historical documentation. No references remain in application source, scripts or tests. Historical commands are not current environment setup instructions.

## Commands and verification

```sh
node --import tsx --test tests/group-media-providers.test.ts tests/group-media-routes.test.ts
node --import tsx --test --test-concurrency=1 \
  tests/group-experience-api.integration.ts tests/group-experience-management.integration.ts \
  tests/group-assessments.integration.ts tests/group-personal-assessments.integration.ts \
  tests/group-framework-progress.integration.ts tests/group-media.integration.ts \
  tests/group-reflections.integration.ts

PHASE11_REVIEW_INFO=/private/tmp/switchplay-group-gates-browser-v1ivhhs_/phase2-test-results/review-server.json \
  npx playwright test --config playwright.phase11.config.ts \
  --grep 'club journey|published Deck adds|own Group history'

# In isolated /private/tmp/switchplay-group-gates-fv7ohdzz, with no seeded Groups:
node --import tsx scripts/test-phase2.ts deck-menu.browser.ts --grep 'Library menu supports' --reporter=line

npx tsc --noEmit
npx eslint src/lib/groupExperiences/http.ts src/lib/groupExperiences/media/providers.ts \
  src/lib/groupExperiences/media/http.ts src/app/decks/page.tsx src/app/library/page.tsx \
  'src/app/library/[deckTemplateId]/page.tsx' \
  'src/app/group-experiences/[experienceId]/progress/page.tsx' src/app/api/reflections/route.ts \
  src/components/library/LibraryShell.tsx scripts/test-phase2.ts tests/group-media-providers.test.ts \
  tests/group-media-routes.test.ts tests/group-experience-api.integration.ts \
  tests/group-assessments.integration.ts tests/group-personal-assessments.integration.ts \
  tests/group-framework-progress.integration.ts tests/phase2/deck-menu.browser.ts
npx eslint tests/phase2/group-integrated-acceptance.browser.ts

# In the isolated export, without copied .env files or database credentials:
MONGODB_URI='' MONGODB_DB='' SWITCHPLAY_DATABASE_MODE=production NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1 npm run build
git diff --check
```

Actual results: **14/14** provider/route tests, **104/104** disposable MongoDB tests, **1/1** ordinary Library/My Decks browser test, **6/6** Chromium/WebKit cases, TypeScript, targeted lint and default Turbopack production build passed. Tests-first failures are in `/tmp/group-gate-removal-red.log`; successful logs use `/tmp/group-gate-removal-{unit,integration,library,browser,types,lint,browser-lint,build}.log`. MongoDB emitted its existing occasional owned-child shutdown fallback warning; all integration assertions passed. The full repository suite and real-provider operations were not run: this is a targeted removal with unchanged delivery architecture, verified through affected and cross-feature regressions.

## Deployment boundary and next work

The18 required Group indexes must exist before this flag-free build is deployed against Atlas: My Decks now always reads Group entries, even for a user with no Groups. Requests retain readiness checks and never provision them. This task performs no Atlas index setup and no persistent writes. Only normal disposable test fixtures create indexes.

`CLOUDFLARE_R2_GROUP_MEDIA_BUCKET_NAME` and the distinct-bucket check are retained. `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA`, Personal media and actual provider access checks are unchanged. Real provider testing remains ordinary verification; it is not represented by an environment certificate. No Cloudflare/Vercel configuration, live assets, deployment or push is authorised by this task.

The media-architecture decision can proceed independently after these removals are verified. No new product choice is introduced. Keep all changes uncommitted until founder approval.
