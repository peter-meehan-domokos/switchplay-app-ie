# Phase 5 foundations — checkpoints 5.1a through 5.3

## Resume here

Implementation commission: complete and separately commit 5.1a, 5.1b, 5.2a, 5.2b and 5.3, then stop. Do not implement 5.4, navigation or visible Progress/Card changes. Current branch `feat/group-experience`; starting HEAD `a6f2e32`. 5.1a implementation and checks are complete; commit subject `feat (group experience): establish framework progress scope`. Verify its commit in Git log before starting 5.1b; do not duplicate it. Next task: lifetime/version evidence in personal Framework readers.

Before resuming, inspect Git status/log and this record. Do not repeat completed commits. Pre-existing uncommitted work includes both engineering plans, the independent review and the completed 5.0 scripts/fixtures/browser tests. Keep those out of implementation commits. The authoritative plan receives the two newly approved decision updates in the working tree; preserve its earlier uncommitted content.

Founder decisions: retained Group-owned results remain stored; current Admins can read/edit/delete exact retained sources, never create outside current scope. The future Group Deck Progress action is approved for every member, follower-first default including dual-role Admins; implement only at 5.5, not in this commission. Membership trust/Organisation roles remain deferred.

## Verification record

Read installed Next route-handler documentation: async params and private/no-store HTTP conventions apply. Requested GPT-6.1 Sol / Extra High retained; no model change.

5.1a verification:

- `node --import tsx --test tests/framework-progress-scope.test.ts tests/frameworks.test.ts tests/group-experience.test.ts` — 27 passed, 0 failed (rerun after type guard correction).
- `npx tsc --noEmit --incremental false` — passed. Initial run found an unknown-to-string guard error in the new state validator; corrected before final pass.
- `npx eslint src/lib/frameworks/scope.ts src/lib/frameworks/progressState.ts src/lib/groupExperiences/policy.ts tests/framework-progress-scope.test.ts` — passed.
- `git diff --check` — passed.

## Checkpoint log

- 5.1a: complete; pure current-composition/Framework scope, live assessment-only evidence closure, distinct progress states and all-member capabilities. Files: `frameworks/{scope,progressState}.ts`, `groupExperiences/policy.ts`, `tests/framework-progress-scope.test.ts`, this handoff. Scope is not yet connected to Group Progress APIs/UI (5.4+).
- 5.1b: not started.
- 5.2a: not started.
- 5.2b: not started.
- 5.3: not started.

## Integration boundary

Later 5.4 adds scoped Group/player metrics and foreign assessment read endpoints; 5.5 adds entry/destinations; 5.6 adds UI/skip indicators; 5.7 does broader integration/handoff. No phone-review server needs to be started for these backend foundations. Tests use disposable Mongo replica sets only.
