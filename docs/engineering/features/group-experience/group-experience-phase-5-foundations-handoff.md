# Phase 5 foundations — checkpoints 5.1a through 5.3

## Resume here

**Status, 1 November 2026:** all five commissioned checkpoints are implemented and verified. This handoff is included in the fifth implementation commit. Stop before **5.4**; no Group Progress UI, navigation or later checkpoint is authorised by this commission.

Branch: `feat/group-experience`. Starting HEAD: `a6f2e32`. Exactly one implementation commit belongs to each checkpoint:

| Checkpoint | Commit | Exact subject |
| --- | --- | --- |
| 5.1a | `26e43ed31b9dec6a36b3f3a94ce35fc4e3495ad2` | `feat (group experience): establish framework progress scope` |
| 5.1b | `80a622713ad11deaad7ae759f1abef78a7e49a14` | `feat (group experience): retain lifetime framework learning` |
| 5.2a | `51d7b1b1e6d055995b2c3fa460bc1086578bcd9a` | `feat (group experience): preserve assessment provenance` |
| 5.2b | `9da4ca22d073020d3e11206a81715483ff14cda9` | `feat (group experience): enable personal assessments in groups` |
| 5.3 | The commit containing this final handoff; obtain its hash with the command below | `feat (group experience): persist group assessments and retained sources` |

```sh
git log -1 --format='%H %s' --grep='^feat (group experience): persist group assessments and retained sources$'
```

A commit cannot contain its own hash. The final response supplies the verified fifth hash without creating a sixth documentation commit. On resumption inspect this record, Git status/log and the current authoritative plan; do not repeat completed checkpoints or duplicate commits.

The founder decisions **P5-Q1** (retained Group source management) and **P5-Q2** (later Group Deck Progress entry/default/Back behaviour) are approved. The authoritative engineering plan is updated in the working tree, preserving its substantial pre-existing uncommitted work; it is deliberately excluded from these implementation commits. Do not reopen those decisions or interpret their approval as permission to implement 5.5 now.

## Implemented architecture

### 5.1a — Scope, evidence and explicit states

`frameworks/scope.ts` defines personal versus fixed Group contexts, resolved adopted Card identities/versions, Framework Item intersections, partial coverage and deduplicated Area unions. Detached selections and retained assignments are not current Group composition. A resolved input containing conflicting versions fails as an integrity issue; it does not silently apply personal lifetime version selection.

Direct personal Item tests remain eligible on configured Items even without Cards. Group direct Item targets require current mapped coverage. Assessment-only live source evidence follows the subject-owned history chain, records dependencies and detects missing/duplicate/cyclic sources. Mapping ancestry alone grants no history, personal learning or navigation rights.

`progressState.ts` distinguishes outside, incomplete, empty, all-skipped, unstarted, in-progress and done using actual observations. All skipped has no eligible denominator; rounded 100% does not establish explicit completion. This semantic foundation does not change existing Card/Deck rendering; approved skipped indicators remain 5.6.

`groupCapabilities` derives read/write/inspection capabilities from the actual current member and Group policy. Confidence extrema are Admin-only, including when peer inspection is enabled. Context, subject ownership and permission remain separate.

### 5.1b — Personal lifetime learning and history

`lifetimeEligibility.ts` unions active/archived personal Deck composition, retained personal references, current active-Follower Group assignments and frozen member references after removal or loss of follower status. Admin-only membership adds no current personal learning. A departed member never inherits later changes to the former Group.

Exact CardTemplate identities are deduplicated, retaining original/fork identities and selecting the highest legitimately adopted version via the existing retained-reference merge. New publications alone never advance it. The Framework calculation and title/history readers consume that selected version without overwriting CardData adoption pointers, dates, private content or learning values.

A legitimately never-opened Group-only Card has virtual todo/null learning and empty tests, without a write. Missing required ordinary records, duplicates or invalid data remain incomplete. A known unmapped missing Card does not poison unrelated Items. Existing direct Item history survives independently of Card eligibility.

### 5.2a — Compatible assessment targets and provenance

The conceptual target is exactly `{cardTemplateId}` or `{frameworkItemId}`. Existing personal storage and compatible API source shapes remain: `cardsData.tests` and `users.itemTests`, whose legacy `itemId` is adapted at the boundary. Item IDs are globally validated by existing configuration contracts; no redundant Framework identity is stored per assessment.

New results have optional additive provenance containing authenticated `enteredByUserId`, `entryMethod`, nullable `groupExperienceId` and nullable `deckTemplateId`. Existing immutable server-owned `createdAt` is entry time; the editable assessment date remains separate. New manual results are stamped on the server. Updates, retries and history transformations preserve the original provenance and creation time.

Legacy absent provenance stays unknown. Safe origin labels are **Personal**, the currently authorised originating Group name, **Other group**, or **Unknown**. Name resolution validates actual current membership. The origin projection strips raw actor/Group/Deck provenance identifiers for Group or future foreign DTOs; it is not a substitute for the separate assessment-only allowlist. Owner-only personal source lists can retain their own raw provenance. The date/context UI remains 5.6.

### 5.2b — Personal assessments through Group contexts

The existing personal assessment mutation core now accepts a server-derived Group context inside an existing transaction. New Group personal-test routes resolve the authenticated active follower, current adopted Card or mapped Item, then fence the membership and perform the personal list operation.

A legitimate absent Group-only Card is materialised on Add before list checks, in that same transaction, with no personal Deck membership, target date or scheduling. GET remains read-only. Existing required personal storage is validated before materialisation. Narrow list writes preserve unrelated CardData and history.

The client transport captures the original experience/source/owner before dispatch, retains the same personal mutation queue identity across personal/A/B contexts, verifies response identity and reconciles lost responses against that captured source list. Preparation failures do not strand pending work. Personal assessments remain a single personal event across contexts; foreign writes are denied. Current Group authority is required by Group routes; established owner routes preserve independent retained-source rights.

### 5.3 — Group-owned assessments and retained sources

Group Card state now optionally embeds `tests/testsRevision`. Group Experience optionally embeds `itemTests/itemTestsRevision`, using `frameworkItemId` for direct results. Ownership and Card target are inherited from the parent. No new collection, audit log or broad migration exists. Absent legacy lists/counters are empty/zero; malformed data remains unavailable.

Current Admins mutate; current members read applicable sources. New entries require current adopted Card/mapped configured Item scope. Group-owned histories combine only relevant Group sources and never personal histories. A/B Groups remain independent, including identical result IDs. Dual-role Admins do not accidentally mutate their own personal lists.

After a source leaves scope, stored results remain. Current Admins can read/edit/delete by exact retained source identity, with list guards; ordinary current histories omit removed-only sources and new entries there are denied. Direct Item source IDs are retained as a content-free set (`itemAssessmentSourceIds`) so deleting the final result does not lose exact-source identity or lost-delete retry support. This is not a history browser or content/navigation grant.

Assessment list revisions are independent of Group structure and learning revisions. Adds reuse existing current-Admin member fences, in repository order, to protect validation against another Admin adopting content and against cross-Admin scalar/assessment first-row races. Edits/deletes fence the acting Admin. No new global lock, structural revision increment or background job is introduced. The small Admin cohort is intentionally fenced for new entries only; this adds modest contention but reuses the established lifecycle mechanism.

Lost-response reconciliation uses desired state and immutable Add origin, not an exact operation receipt. Deleted Adds cannot resurrect. Authority loss prevents forbidden acknowledgement reads. Transactions keep first materialisation, narrow list writes and fences together; failures roll back all of them.

Group public list/history/conflict DTOs omit raw provenance identifiers and include explicit Group owner, conceptual target and server capabilities. Scalar Group learning queries now fetch only Card identity, completion and confidence fields, excluding assessment lists/provenance. Current combined histories are separate from retained exact-source management.

## APIs and integration contracts

All new routes retain existing authenticated Group feature gates, actual-actor validation, `private, no-store` and `Vary: Cookie`. No deployment or flag was enabled.

| Owner / target | Source-list URL under `/api/group-experiences/:experienceId` | Operations |
| --- | --- | --- |
| Personal Card | `/cards/:cardTemplateId/personal-tests` | GET, POST; `/:testId` PATCH/DELETE |
| Personal Item | `/frameworks/:frameworkId/items/:frameworkItemId/personal-tests` | GET, POST; `/:testId` PATCH/DELETE |
| Group Card | `/cards/:cardTemplateId/tests` | GET, POST; `/:testId` PATCH/DELETE |
| Group Item | `/items/:frameworkItemId/tests` | GET, POST; `/:testId` PATCH/DELETE |
| Current Group Card history | `/cards/:cardTemplateId/assessment-history` | GET |
| Current Group Item history | `/items/:frameworkItemId/history` | GET |

Personal source compatibility is retained behind the conceptual target adapter. New Group-owned commands use `target`, actual viewer identity, result ID, expected list revision and the existing Boolean result/date semantics. The server resolves provenance and Deck context. Group Item exact-source URLs intentionally omit Framework identity so retained management survives configuration changes; new entries still validate current mapping.

No index changes are needed for embedded lists. Existing Group/Card/member unique indexes and replica-set transactions remain prerequisites; existing Group index provisioning is unchanged. No fixture or migration writes were made to production/shared databases.

Ready for 5.4: pure scope/evidence/state functions; lifetime owner Framework readers; safe provenance projection; self-owned Group assessment transport; independent Group-owned lists/history; current-role capability contracts. The foreign player assessment-only database/read adapter and scoped Group/player Framework metrics are not implemented yet.

## Actual automated verification

All database suites used runner-owned disposable Mongo replica sets. Historical handoff results are not treated as reruns.

### Checkpoint gates

- **5.1a:** `node --import tsx --test tests/framework-progress-scope.test.ts tests/frameworks.test.ts tests/group-experience.test.ts` — **27 passed, 0 failed**.
- **5.1b:** `node --import tsx --test --test-concurrency=1 tests/framework-lifetime.integration.ts tests/framework-readers.integration.ts tests/frameworks.integration.ts` — **27 passed, 0 failed** on final run. The six new lifetime cases were also rerun separately: **6/0**. `node --import tsx --test tests/frameworks.test.ts tests/framework-progress-scope.test.ts` — **24/0**.
- **5.2a:** `node --import tsx --test tests/assessment-provenance.test.ts tests/assessments.test.ts tests/assessment-history.test.ts tests/personal-history-projection.test.ts` — **18/0**. `node --import tsx --test --test-concurrency=1 tests/assessment-provenance.integration.ts tests/assessments.integration.ts` — **18/0**. Final origin-authority refinement reran `tests/assessment-provenance.integration.ts`: **3/0**.
- **5.2b:** existing plus initial new assessment integration selection — **20/0**; final `node --import tsx --test --test-concurrency=1 tests/group-personal-assessments.integration.ts` — **8/0**. Focused assessment client/contract/provenance selection — **19/0**. Relevant tests are rerun in the cumulative commands below.
- **5.3:** initial Group integration selection **10/0**. Final `node --import tsx --test --test-concurrency=1 tests/group-assessments.integration.ts` — **14 passed, 0 failed**, including two additional cases added after the cumulative run started. The cumulative run therefore overlaps this final file; do not add the counts as unique coverage.

### Cumulative final checks

```sh
node --import tsx --test tests/framework-progress-scope.test.ts tests/frameworks.test.ts tests/group-experience.test.ts tests/assessment-provenance.test.ts tests/assessments.test.ts tests/assessment-history.test.ts tests/assessment-client.test.ts tests/group-personal-assessment-client.test.ts tests/personal-history-projection.test.ts tests/group-progress-preview.test.ts
```

**59 passed, 0 failed, 0 skipped/cancelled.** Log: `/tmp/group-experience-phase5-cumulative-unit.log`.

```sh
node --import tsx --test --test-concurrency=1 tests/framework-lifetime.integration.ts tests/framework-readers.integration.ts tests/frameworks.integration.ts tests/assessment-provenance.integration.ts tests/assessments.integration.ts tests/group-personal-assessments.integration.ts tests/group-assessments.integration.ts tests/group-experience.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-perspectives.integration.ts tests/shared-learning.integration.ts
```

**112 passed, 0 failed, 0 skipped/cancelled.** Log: `/tmp/group-experience-phase5-cumulative-integration.log`. Final expanded 5.3 rerun: `/tmp/group-experience-5-3-final.log`, **14/0**.

`npx tsc --noEmit --incremental false` passed after final source/test changes. Targeted `npx eslint --max-warnings 0` over all **39** commissioned TypeScript source/test files passed. `git diff --check` passed. Installed Next route-handler docs were consulted for Promise params and private response conventions. The requested model/effort was retained.

### Failures investigated and limitations

- An initial socket-restricted integration launch failed with EPERM; it was rerun with approved permission to create disposable local replica sets. No production database was substituted.
- The first lifetime integration run was **26/1**: a missing unmapped Card incorrectly contaminated unrelated Framework results. The implementation was corrected to distinguish known composition from invalid selected records; existing assertions were preserved. Final readers passed **27/0**.
- Initial TypeScript/lint findings were an unknown-to-string guard, unused import and test-only parameter/helper/variable typing issues. These were corrected before final passing checks; no expectations or privacy protections were weakened.
- Two focused integration runs reported a disposable Mongo child missing its SIGINT shutdown deadline; the harness used its own SIGKILL fallback. Tests completed successfully. No application or phone-review server was stopped or restarted.
- No full repository test suite, production-environment build, browser interaction suite or physical iPhone review was run for these backend-only checkpoints. API handlers were bundled and exercised directly; TypeScript, relevant personal/Framework/Group integration suites and the existing 5.0 fixture unit test passed. Later visible integration requires its own browser/device verification.

## Complete commissioned file inventory

Paths below are relative to the repository. The handoff itself was incrementally updated in every checkpoint commit.

### 5.1a

- `src/lib/frameworks/scope.ts`
- `src/lib/frameworks/progressState.ts`
- `src/lib/groupExperiences/policy.ts`
- `tests/framework-progress-scope.test.ts`
- `docs/engineering/features/group-experience/group-experience-phase-5-foundations-handoff.md`

### 5.1b

- `src/lib/frameworks/lifetimeEligibility.ts`
- `src/lib/frameworks/calculations.ts`
- `src/lib/frameworks/readModels.ts`
- `tests/framework-lifetime.integration.ts`
- The shared foundations handoff.

### 5.2a

- `src/lib/assessments/contracts.ts`
- `src/lib/assessments/provenance.ts`
- `src/lib/assessments/provenanceReads.ts`
- `src/lib/assessments/repository.ts`
- `src/lib/assessments/history.ts`
- `src/lib/cards/model.ts`
- `src/lib/cards/personalHistory.ts`
- `src/lib/frameworks/readModels.ts`
- `tests/assessment-provenance.test.ts`
- `tests/assessment-provenance.integration.ts`
- The shared foundations handoff.

### 5.2b

- `src/lib/assessments/contracts.ts`
- `src/lib/assessments/repository.ts`
- `src/lib/assessments/client.ts`
- `src/lib/groupExperiences/assessmentContext.ts`
- `src/lib/groupExperiences/personalAssessments.ts`
- `src/lib/groupExperiences/personalAssessmentHttp.ts`
- `src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/personal-tests/route.ts`
- `src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/personal-tests/[testId]/route.ts`
- `src/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/items/[frameworkItemId]/personal-tests/route.ts`
- `src/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/items/[frameworkItemId]/personal-tests/[testId]/route.ts`
- `tests/group-personal-assessment-client.test.ts`
- `tests/group-personal-assessments.integration.ts`
- The shared foundations handoff.

### 5.3

- `src/lib/groupExperiences/model.ts`
- `src/lib/groupExperiences/repository.ts`
- `src/lib/groupExperiences/assessmentContext.ts`
- `src/lib/groupExperiences/assessmentContracts.ts`
- `src/lib/groupExperiences/assessments.ts`
- `src/lib/groupExperiences/assessmentHttp.ts`
- `src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/tests/route.ts`
- `src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/tests/[testId]/route.ts`
- `src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/assessment-history/route.ts`
- `src/app/api/group-experiences/[experienceId]/items/[frameworkItemId]/tests/route.ts`
- `src/app/api/group-experiences/[experienceId]/items/[frameworkItemId]/tests/[testId]/route.ts`
- `src/app/api/group-experiences/[experienceId]/items/[frameworkItemId]/history/route.ts`
- `tests/group-assessments.integration.ts`
- The shared foundations handoff.

### Existing working-tree material preserved outside the commits

Already modified at task start: the overarching engineering plan, Phase 4 engineering plan and `scripts/test-phase2.ts`. Already untracked: the independent Phase 5 review, `scripts/review-group-progress.ts`, `tests/fixtures/groupProgress{,Adapter,Harness}` files, `tests/group-progress-preview.test.ts`, `tests/helpers/groupProgressReview.ts` and `tests/phase2/group-progress-preview.browser.ts`.

The overarching plan received only relevant founder-decision/current-foundation status and actual endpoint updates on top of its existing content; the whole file stays uncommitted to avoid including earlier work. Every other pre-existing modified/untracked file was SHA-256 checked against the task-start record and is byte-for-byte unchanged. Existing commits, Organisations work, Card components/styles and browser fixtures were preserved. No branch switch, reset, stash, rebase or broad staging command was used.

## Remaining work and readiness

- **5.4:** integrate the scope plan into scoped Group/individual/cohort Framework metrics and safe foreign personal assessment reads. Build the narrow assessment-only live-history reader, safe source/title redaction and raw weighted Item/Area aggregates; enforce current peer policy and Admin-only extrema. Existing scalar APIs continue excluding tests.
- **5.5:** implement approved every-member Group Deck Progress entry, follower-first defaults, separate normal My Progress, experience destinations and authorised Back/return-state continuity. No such navigation was implemented here.
- **5.6:** connect existing table/history/editor presentation to the new contexts, capabilities and transports; add approved mode switch, touch popovers, date/context origin line and explicit outside/skipped indicators without disturbing accepted geometry. Group-owned client queue/history UI integration remains here, with explicit Group owner identity; personal transport is already context-bound.
- **5.7:** perform integrated privacy/concurrency/navigation/geometry regression and visual/device review; consolidate final Phase 5 handoff. Do not infer this coverage from the backend-only checks above.

**5.4 is technically ready for a new authorised commission; no concrete product/architecture blocker was found.** Q1/Q2 are settled. Provisional visual acceptance, Organisation/trust safeguards, production rollout gates and legacy assignments with no reliable historical evidence remain as already documented; no historical backfill or rollout was attempted. No QUESTIONS require founder approval for the completed foundations.
