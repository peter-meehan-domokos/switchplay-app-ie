# Group Card data naming change

> **Historical configuration superseded, 5 November 2026:** `SWITCHPLAY_GROUP_EXPERIENCES_ENABLED` and `GROUP_MEDIA_PRIVATE_PROVIDER_VERIFIED` have been removed. Any disabled-feature behaviour, environment assignments or certification requirements below record the earlier implementation, not current setup instructions. Group functionality uses normal permissions; provider tests are verification rather than a runtime certificate. Bucket/delivery configuration is unchanged. The18 Group indexes must exist before deploying the flag-free build against Atlas. See the [current gate-removal handoff](group-experience-gate-removal-handoff.md).

## Status / Resume here

**Complete and verified, 3 November 2026.** Source naming, guarded migration utility, disposable migration tests and affected regressions are complete on `feat/group-experience`, starting from clean `4fe0104`. No persistent database was modified and no review/development process was stopped. There is no existing persistent Group collection to migrate in the inspected Atlas database. Phase 6 remains outside scope. Stop after the focused rename commit; any future non-disposable cutover requires explicit target-specific approval.

## Scope

- Mongo namespace `groupCardState` → `groupCardData`.
- Type `GroupCardState` → `GroupCardData`.
- Constant `GROUP_COLLECTIONS.states` → `GROUP_COLLECTIONS.cardData`.
- Repository `states()` → `cardData()`; update readers, fixtures, test mocks and direct collection references.
- The document shape, Group ownership, personal storage, learning/assessment calculations, permissions, revisions, APIs and UI are unchanged. Keep the `group_learning_identity` unique `(experienceId, cardTemplateId)` index name/definition.
- Provisioning and initial readiness refuse a legacy namespace (`GROUP_CARD_RENAME_REQUIRED`) instead of creating or accepting parallel writable storage. No automatic migration or dual writes.

## Database inventory — read-only, 2 November 2026

The sole local `.env.local` configures production-mode Atlas host `cluster0.oc5abhg.mongodb.net`, database `switchplay`; ordinary local development therefore uses that configured persistent database unless an isolated harness overrides it. No separate development database configuration was found. Deployed environment configuration was not independently obtained.

With founder-authorised existing credentials, read-only `listDatabases`, `listCollections`, and conditional Group count/index inspection found:

- `switchplay`: neither `groupCardState` nor `groupCardData` exists. No `groupExperiences`, `groupExperienceMembers`, Group receipts/removal, media or reflection collections exist either. No Group records/indexes currently require a persistent rename.
- Accessible non-system `sample_mflix` is a sample database, not an application target; it likewise has no Group collections. No sample documents were read or modified.
- No non-disposable writes, provisioning or migration were performed. No persistent namespace was abandoned or duplicated.

Group Phases 1–5 handoffs record disposable `MongoMemoryReplSet` suites/review fixtures and no production provisioning/fixture writes. Current absence agrees with those records. It cannot prove that no historical write ever occurred: no database audit history was queried or assumed. The only confirmed current production interaction in this rename task is the authorised read-only inventory. Inventory log: `/tmp/group-card-rename-persistent-inventory.jsonl` (no credentials or personal records).

Disposable integration databases use generated `switchplay_test_*` names on runner-owned local replica sets; review/browser databases use generated `switchplay_phase2_browser_*` names. Updated fixtures freshly provision `groupCardData`. Existing independently running old-code disposable review snapshots remain untouched and can be recreated when next commissioned.

## Explicit migration utility

`scripts/rename-group-card-data.ts` and `scripts/migration/groupCardDataRename.ts` provide inspect/plan/execute/verify. This is a small offline namespace rename, not a migration platform. No automatic environment loading or fallback to application credentials. Use dedicated `GROUP_CARD_RENAME_URI`, `GROUP_CARD_RENAME_DB`, and (production) `GROUP_CARD_RENAME_HOST` variables; never paste credentials into tracked files or logs.

```sh
node --import tsx scripts/rename-group-card-data.ts --help
node --import tsx scripts/rename-group-card-data.ts --inspect --mode disposable
node --import tsx scripts/rename-group-card-data.ts --plan --mode disposable --file /private/tmp/group-card-rename-plan.json
node --import tsx scripts/rename-group-card-data.ts --execute --mode disposable --file /private/tmp/group-card-rename-plan.json --confirm DATABASE_NAME --writers-stopped
node --import tsx scripts/rename-group-card-data.ts --verify --mode disposable --file /private/tmp/group-card-rename-plan.json
```

Plan creation reads MongoDB and creates an exclusive mode-0600 local plan file, with database/from/to, hashed collection UUID/options/index definitions, record count and exact BSON-aware document digest. No record contents, provenance IDs or URI are written into the plan. Hashes detect drift, not malicious plan tampering; operator authorisation and custody remain required.

Execution verifies the plan and source snapshot, uses same-database `rename(..., { dropTarget: false })`, then verifies the new namespace and unchanged snapshot. Both namespaces, any pre-existing target (including empty), source drift, wrong database and invalid plans fail closed. A lost-response retry acknowledges only the exact already-renamed collection/snapshot. Neither namespace means nothing to migrate; fresh provisioning is separate. Extra indexes/options and retained assessment data remain unchanged. No copying, dropping, merging or rewriting records.

For any newly identified persistent legacy database, obtain explicit target-specific approval before execution. Stop/drain only the clients actually using that target; obtain a backup, plan while quiescent, execute with `--mode production --confirm switchplay --writers-stopped --backup-confirmed`, verify, then start the new build. Production validation reuses the existing explicit Atlas host/database rules. All old clients must remain stopped during cutover; there is no mixed-version dual-write support. These flags acknowledge operator prerequisites, not automatic proof of a backup or stopped writers.

Rollback also requires approval and stopped/drained clients: create a fresh `--plan --reverse` from current `groupCardData`, execute it and verify before starting the old application. This preserves any newer writes. Never restore an old backup over current data or auto-repair both namespaces. No persistent cutover is currently needed in the inspected target.

## Verification results

| Check | Actual result |
| --- | --- |
| Focused Group/metrics/preview/provenance units | 14 passed |
| Combined six-file integration selection | 76 cases: 75 passed; one early-loaded assessment test mock still named `states` failed |
| Corrected scalar-projection test rerun | 1 passed, retaining the exact projection assertions |
| Final migration integration suite | 10 passed, including resumed real learning/assessment writes after rename and unchanged personal records |
| Real live Group Progress/histories, Chromium and WebKit, mobile/desktop | 14 passed |
| Original fixture-only preview, Chromium and WebKit, including direct collection checks | 5 passed |
| Final `tsc --noEmit --incremental false` | Passed |
| Targeted lint on all 17 changed/new TS files, zero warnings allowed | Passed |
| Standard `npm run build`, Next 16.2.6/Turbopack | Passed compilation, TypeScript and 45/45 static pages |
| `git diff --check` and old-name source inventory | Passed; old namespace references remain only in migration/refusal tests and guards |

The final tests cover 77 distinct integration cases across the original selection, targeted correction and additional migrated-repository case; this is not a claim of a single 77-case green invocation. First TypeScript caught the Mongo driver metadata overload and two string-named mocks. Both mocks and the overload were corrected without weakening assertions. The corrected scalar test passed independently; the lifecycle mock was corrected before its worker loaded. The full final migration file reran all ten cases successfully. No failing assertion remains unresolved.

MongoMemoryServer emitted graceful-stop timeout/forced-child-cleanup warnings, and browser tools emitted the existing NO_COLOR/FORCE_COLOR warning. No persistent server or database was substituted. No full repository suite, new physical-device review, provider operation, production provisioning or deployment was needed/performed for this naming-only change.

Build used an isolated source export at `/private/tmp/switchplay-group-card-rename-build-vqn4542e` with local dependency hardlinks, no `.env.local`, empty database credentials and fixture flags disabled. The application working-tree build output and all unrelated servers/worktrees remained untouched. Browser harnesses created their own fresh disposable databases and terminated only their own children. Existing phone review snapshots still use their own old-code disposable datasets; they were not migrated or restarted.

Exact verification commands:

```sh
node --import tsx --test tests/group-experience.test.ts tests/group-framework-metrics.test.ts tests/group-progress-preview.test.ts tests/assessment-provenance.test.ts
node --import tsx --test --test-concurrency=1 tests/group-card-data-rename.integration.ts tests/group-experience.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-perspectives.integration.ts tests/group-assessments.integration.ts tests/group-framework-progress.integration.ts
node --import tsx --test --test-name-pattern='scalar Group learning queries exclude' tests/group-assessments.integration.ts
node --import tsx --test tests/group-card-data-rename.integration.ts
node --import tsx scripts/test-phase2.ts --group-progress-live group-progress-live.browser.ts group-progress-review.browser.ts
node --import tsx scripts/test-phase2.ts --group-progress group-progress-preview.browser.ts
npx tsc --noEmit --incremental false
npx eslint --max-warnings 0 src/lib/groupExperiences/assessments.ts src/lib/groupExperiences/indexes.ts src/lib/groupExperiences/model.ts src/lib/groupExperiences/progressReads.ts src/lib/groupExperiences/repository.ts scripts/migration/groupCardDataRename.ts scripts/rename-group-card-data.ts tests/group-card-data-rename.integration.ts tests/group-assessments.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-perspectives.integration.ts tests/group-experience.integration.ts tests/group-framework-progress.integration.ts tests/helpers/groupProgressLiveReview.ts tests/helpers/groupProgressReview.ts tests/phase2/group-progress-preview.browser.ts tests/phase2/group-progress-review.browser.ts
git diff --check
# Build only in the isolated export described above:
SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= PHASE2_BROWSER_TEST=0 SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=0 NEXT_TELEMETRY_DISABLED=1 npm run build
```

Logs: `/tmp/group-card-rename-{unit,integration,scalar-final,migration-final,browser-live,browser-preview,typecheck-final,lint-final,build}.log`. The final CLI help wording additionally clarifies that only clients of the target database must be drained; no test expectation depends on that prose.

## Changed files and boundaries

- Five application files: `src/lib/groupExperiences/{model,indexes,repository,assessments,progressReads}.ts`.
- Two new migration files: `scripts/rename-group-card-data.ts`, `scripts/migration/groupCardDataRename.ts`.
- One new disposable migration integration file: `tests/group-card-data-rename.integration.ts`.
- Mechanical consumer/mock/namespace updates in `tests/group-{assessments,experience,experience-lifecycle,experience-perspectives,framework-progress}.integration.ts`, `tests/helpers/{groupProgressReview,groupProgressLiveReview}.ts`, `tests/phase2/{group-progress-preview,group-progress-review}.browser.ts`.
- Engineering plan §6 and active collection references, plus this handoff. Historical handoffs/review analysis and Organisations work are preserved.

The tree was clean at the start: the founder had already committed Phase 5 completion documentation as `4fe0104`. No pre-existing work was overwritten or incorporated unintentionally. The rename does not change schemas, APIs, UI, privacy, ownership, learning/assessment semantics or Phase 5 acceptance. No Phase 6/media/reflection work was started.

## Outstanding operations / QUESTIONS

No product decision or known test failure blocks the source rename. No persistent collection migration remains outstanding in the inspected environment. Deployment settings beyond the locally configured Atlas target were not available/assumed; inventory any additional identified persistent target before rollout. Future Group production enablement still needs its existing explicit index provisioning, deployment and safeguarding/operational gates. This naming commission did not enable Group functionality in production.
