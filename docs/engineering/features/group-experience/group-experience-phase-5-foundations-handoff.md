# Phase 5 foundations — checkpoints 5.1a through 5.3

## Resume here

Implementation commission: complete and separately commit 5.1a, 5.1b, 5.2a, 5.2b and 5.3, then stop. Do not implement 5.4, navigation or visible Progress/Card changes. Current branch `feat/group-experience`; starting HEAD `a6f2e32`. 5.1a committed as `26e43ed31b9dec6a36b3f3a94ce35fc4e3495ad2`. 5.1b committed as `80a622713ad11deaad7ae759f1abef78a7e49a14`. 5.2a is complete and verified; commit subject `feat (group experience): preserve assessment provenance`. Confirm that commit before starting 5.2b Group-context personal commands/transport.

Before resuming, inspect Git status/log and this record. Do not repeat completed commits. Pre-existing uncommitted work includes both engineering plans, the independent review and the completed 5.0 scripts/fixtures/browser tests. Keep those out of implementation commits. The authoritative plan receives the two newly approved decision updates in the working tree; preserve its earlier uncommitted content.

Founder decisions: retained Group-owned results remain stored; current Admins can read/edit/delete exact retained sources, never create outside current scope. The future Group Deck Progress action is approved for every member, follower-first default including dual-role Admins; implement only at 5.5, not in this commission. Membership trust/Organisation roles remain deferred.

## Verification record

Read installed Next route-handler documentation: async params and private/no-store HTTP conventions apply. Requested GPT-6.1 Sol / Extra High retained; no model change.

5.1a verification:

- `node --import tsx --test tests/framework-progress-scope.test.ts tests/frameworks.test.ts tests/group-experience.test.ts` — 27 passed, 0 failed (rerun after type guard correction).
- `npx tsc --noEmit --incremental false` — passed. Initial run found an unknown-to-string guard error in the new state validator; corrected before final pass.
- `npx eslint src/lib/frameworks/scope.ts src/lib/frameworks/progressState.ts src/lib/groupExperiences/policy.ts tests/framework-progress-scope.test.ts` — passed.
- `git diff --check` — passed.

5.1b final verification:

- Initial three-file integration run: 26 passed, 1 failed. The failure correctly identified that a missing unmapped personal Card record poisoned unrelated metrics; fixed by keeping known composition separate from invalid selected Card data.
- Six new lifetime integration scenarios rerun after the stored-adoption integrity guard: 6 passed, 0 failed.
- `node --import tsx --test --test-concurrency=1 tests/framework-lifetime.integration.ts tests/framework-readers.integration.ts tests/frameworks.integration.ts` — final rerun 27 passed, 0 failed; log `/tmp/group-experience-5-1b-tests-final.log`.
- `node --import tsx --test tests/frameworks.test.ts tests/framework-progress-scope.test.ts` — 24 passed, 0 failed.
- TypeScript and targeted lint passed after the final fix. An earlier unused-import lint warning was removed.

## Checkpoint log

- 5.1a: complete; pure current-composition/Framework scope, live assessment-only evidence closure, distinct progress states and all-member capabilities. Files: `frameworks/{scope,progressState}.ts`, `groupExperiences/policy.ts`, `tests/framework-progress-scope.test.ts`, this handoff. Scope is not yet connected to Group Progress APIs/UI (5.4+).
- 5.1b: complete. New `frameworks/lifetimeEligibility.ts`; explicit selected version/default inputs in `calculations.ts`; owner summary/Item/Card histories and source titles in `readModels.ts`; six new scenarios in `tests/framework-lifetime.integration.ts`. No source/adoption/private writes. Current and retained own membership evidence are read in the same snapshot. The sandbox socket setup failure was rerun using approved disposable replica-set escalation.
- 5.2a: complete. Additive provenance/conceptual target adapter; server-stamped personal writes, immutable edit/retry origin, provenance-preserving personal/live history, authorised origin-name resolution and safe no-raw-origin projection. Name lookup reuses current membership validation. No UI or foreign read endpoints; raw owner source-list provenance remains owner-only. Files: `assessments/{provenance,provenanceReads,contracts,repository,history}.ts`, `cards/{model,personalHistory}.ts`, `frameworks/readModels.ts`, two provenance test files and this handoff.
- 5.2b: not started.
- 5.3: not started.

## Integration boundary

Later 5.4 adds scoped Group/player metrics and foreign assessment read endpoints; 5.5 adds entry/destinations; 5.6 adds UI/skip indicators; 5.7 does broader integration/handoff. No phone-review server needs to be started for these backend foundations. Tests use disposable Mongo replica sets only.

5.2a verification:

- `node --import tsx --test tests/assessment-provenance.test.ts tests/assessments.test.ts tests/assessment-history.test.ts tests/personal-history-projection.test.ts` — 18 passed, 0 failed.
- `node --import tsx --test --test-concurrency=1 tests/assessment-provenance.integration.ts tests/assessments.integration.ts` — 18 passed, 0 failed.
- Final membership-validation refinement: `node --import tsx --test --test-concurrency=1 tests/assessment-provenance.integration.ts` — 3 passed, 0 failed, including corrupt membership epoch denial.
- `npx tsc --noEmit --incremental false` — passed after final changes.
- Targeted eslint across the eight changed source files and two provenance test files — passed. Final two-file refinement lint and `git diff --check` passed.
