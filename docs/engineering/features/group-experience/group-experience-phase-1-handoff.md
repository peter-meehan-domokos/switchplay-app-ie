# Group Experiences — Phase 1 implementation handoff

**Date:** 29 October 2026  
**Branch/baseline:** `feat/group-experience`, `2ff6388`  
**Scope:** The final authorization's **Implement Phase 1 Only** amendment. Phases 2–3 and all later feature work remain unimplemented. Review this handoff before giving new authorization for Phase 2.

**Result:** All approved Phase 1 acceptance criteria passed. Implementation and verification are complete; stop before Phase 2.

## Implementation

Personal learning continues to use the existing authoritative `users.cardsData` record for each user/CardTemplate. No universal migration, parallel personal store or group-owned learning record was introduced.

The new pure learning module projects completion and confidence against explicitly supplied immutable Card content. Stable Step IDs determine correspondence; ordering does not. Missing selected Steps receive `todo`/`null` defaults. Obsolete Step values remain stored and reappear when projecting a version that contains them. Reconciliation preserves the union of known values. Duplicate records, duplicate Step values and malformed values fail rather than masquerading as unstarted learning.

Projection output is constructed from an allowlist: Card identity, selected version, completion and confidence only. Tests, media, reflections, Info attachments, chats, personal target dates and personal adoption fields are excluded. A narrow repository aggregation retrieves only the selected owner's learning fields, excluding unrelated Cards and private personal fields before reusable mutation code receives the result. Card IDs are treated as literal values in that aggregation.

The reusable transaction primitives materialize one missing personal record and update only the selected completion/confidence field plus `updatedAt`. Existing personal APIs retain their working-context authorization and canonical version resolution, then call these primitives. Writes to a Step missing from the stored arrays append that stable Step without replacing another value or changing personal adoption. Mongo transaction retries protect concurrent first materialization and cross-version writes.

These helpers and context keys **do not authorize access**. Future Phase 2 callers must authorize the authenticated actor, membership, perspective and canonical selected version within the appropriate transaction/fence before calling them. There is no group route or runtime group caller in this implementation.

## Client boundaries

- Typed context keys distinguish viewer, experience, perspective, inspected subject, Card and selected version. Personal learning ownership remains keyed by user/CardTemplate.
- The existing mixed personal presentation cache rejects explicitly supplied experience contexts and foreign-owner payloads. Future group DTOs need their own allowlisted cache; the personal cache is not repurposed for inspection.
- Successful own completion/confidence/date acknowledgements invalidate the owner's learning presentation and notify existing summary subscribers. Existing working reads already check epochs/work revisions; mounted personal controllers also capture their owner session generation.
- Clearing a user's cache advances the session generation. A late acknowledgement from the previous session cannot refresh that session's state; a previously mounted controller cannot repopulate the cleared cache.
- Work tracking has a separate optional experience-contribution namespace for future uploads/edits. Shared personal learning omits that namespace and continues to share barriers across Decks. Existing personal callers retain their API behavior.
- No group views, perspective switcher, navigation controls or scheduling UI were added. The existing browser harness directory is named `phase2`; running that harness is regression verification, not implementation of Group Experiences Phase 2.

## Scheduling and retained assignment foundations

Experience-style materialization always uses a null personal target date, including when canonical Card content supplies a suggested date. Existing rows and dates remain untouched. Ordinary personal Deck first-open still uses its current suggested-date/cadence rules and may initialize a previously unset date later.

An optional `users.retainedCardAssignments` array records `{cardTemplateId, version}` references, deduplicated by CardTemplate with the highest genuinely adopted version and deterministic identity ordering. It contains no learning values or authorization grants. Personal composition assignment/open seeds it. Before a personal Deck update or owner republication removes Cards, the previous adopted composition is recorded, including legacy memberships that have no references yet. Explicit personal Card adoption and publisher auto-adoption advance an already recorded reference; another creator merely publishing a newer version does not.

No new collections or indexes were required. The additive field is created lazily inside existing transactions; no fixtures, migrations or writes touched production Atlas. Existing readers tolerate its absence. The Framework reader and UI do **not** consume it yet: that integration is Phase 5. Future group assignment/lifecycle metadata remains work for Phases 2–3. The reference shape and pure merge policy are available for that work now.

## Four final plan corrections

The [engineering plan](group-experience-engineering-plan.md) incorporates the corrections throughout its contracts, phase scopes and acceptance criteria:

1. **Framework:** Lifetime legitimate assignment eligibility survives personal/group Deck removal and follower departure. Deduplicate the CardTemplate and use the highest version actually adopted by an eligible current or retained assignment, never an unadopted publication. Read current learning from personal CardData. References grant no removed Deck/group navigation. Phase 5 acceptance criteria include these cases.
2. **Media:** Prefer logical tombstoning followed by a short best-effort provider deletion for an exclusively allocated group contribution, with durable pending/failure state and idempotent retry. No queue/worker service. Shared Info/legacy assets are excluded from physical purge. Cleanup may remain pending until another request/operator retry. Existing test cleanup demonstrates R2/Stream delete primitives; production adapters and reliability tests remain Phase 6. Q3 records the provisionally approved one-hour signed Stream lifetime, immediate denial of fresh grants after revocation, and the outstanding private-origin/provider verification gates. No provider code/configuration was changed or exercised against live assets.
3. **Dates:** No group cadence or suggested-date initialization of personal deadlines. Preserve existing dates and ordinary personal scheduling. The Phase 1 transaction helper and automated checks enforce this foundation; later group contracts must reuse it.
4. **Reflections:** Immutable original `createdAt` descending, with deterministic tie-breaks; edits change `updatedAt`/revision without moving carousel position. Phase 10 includes the Alice Monday/Bob Tuesday/Alice Wednesday edit regression and preserves the specified carousel, ownership and moderation behavior. No reflection UI was implemented.

## Complete changed-file inventory

Paths are relative to the repository root. There are **17 deliverable files: 8 modified application files, 4 new application files, 3 new tests and 2 documentation files**. The plan already existed as an untracked input; it is listed as updated rather than newly authored for this phase.

| File | Change |
| --- | --- |
| `src/lib/cards/learning.ts` | New explicit-version projection, allowlisted learning fields, validation and obsolete-Step reconciliation. |
| `src/lib/cards/learningContext.ts` | New typed presentation identity and shared personal learning-owner keys. |
| `src/lib/cards/personalLearning.ts` | New internal transaction-only materialization and narrow mutation primitives; experience scheduling safeguard. |
| `src/lib/cards/retainedAssignments.ts` | New reference type and deterministic max-adopted-version merge. |
| `src/lib/cards/model.ts` | Optional retained-assignment metadata on the existing personal user type. |
| `src/lib/cards/repository.ts` | Narrow storage projection; existing personal mutation delegation; transactional assignment retention on assignment/open/adoption/publication. |
| `src/lib/cards/readModels.ts` | Existing personal working projection reuses explicit selected-content learning projection. |
| `src/lib/cards/updateAdoption.ts` | Existing Card reconciliation reuses the stable-ID learning union. |
| `src/lib/cards/workingCardStore.ts` | Personal-cache owner/context checks, learning invalidation and session generations. |
| `src/lib/cards/personalWork.ts` | Optional isolated contribution namespace; shared personal barriers preserved. |
| `src/lib/deckMutations.ts` | Learning acknowledgement invalidation and queued/late response session checks. |
| `src/components/decks/useWorkingDeck.ts` | Mounted owner-session guard when accepting personal presentation data. |
| `tests/shared-learning.test.ts` | 7 pure projection, integrity, retention, context, cache and queue tests. |
| `tests/shared-learning-client.test.ts` | 2 acknowledgement/invalidation/session tests. |
| `tests/shared-learning.integration.ts` | 9 disposable-replica materialization, concurrency, privacy, scheduling, rollback and retained-reference tests. |
| `docs/engineering/features/group-experience/group-experience-engineering-plan.md` | Four corrections, approved Q1/Q3 policies and Phase 1 stopping point. |
| `docs/engineering/features/group-experience/group-experience-phase-1-handoff.md` | This implementation record and review handoff. |

No API routes, provider settings, package/dependency files, test harness configuration or index definitions changed. No commits, branch switches or deployment were performed. Generated build/browser artifacts are ignored outputs, not source changes.

These three pre-existing untracked source documents were preserved byte-for-byte:

- `docs/design/features/group-experience/original-requirements-prompt.md` — SHA-256 `c6d1efcbc104d17d6a64d9db7f9a1940edcbc92989adced0fca3ac76d9c6467b`.
- `docs/engineering/features/group-experience/group-experience-engineering-plan-draft.md` — SHA-256 `f7209e6b1afc447a1c5b5826731e8b38a9e7d1662f9fcdaebf426696a418fcc1`.
- `docs/engineering/features/group-experience/group-experience-independent-review.md` — SHA-256 `222c299fb8586d731d68770bdf930d500bcbd4a7041fd9c5ebe66cb4b181ae7b`.

## Automated verification

Database commands use test-owned `MongoMemoryReplSet` instances and disposable database names. Browser commands use the existing disposable seeded application and mock providers. Database/browser commands needed sandbox escalation for local sockets/processes. No real participant data or provider assets were involved.

The final focused Phase 1 suite contains **18 new tests**, all passing: 7 pure, 2 client and 9 database. Regression selections overlap with the focused suites; counts below must not be added as unique-test totals.

| Executed selection | Result |
| --- | --- |
| Unit/client/regression selection below | **76 passed, 0 failed**, no skips. |
| Adoption/lifecycle/reuse database selection below | **51 passed, 0 failed**, no skips; included the initial 8-test Phase 1 database suite. |
| Privacy/Framework/assessment database selection below | **60 passed, 0 failed**, no skips; included the initial 8-test Phase 1 database suite. |
| Final focused shared-learning database rerun | **9 passed, 0 failed**, no skips; includes the final literal-ID regression. |
| Existing update-adoption browser selection | **4 passed, 0 failed**. |
| Existing working-updates browser selection | **11 passed, 0 failed**. |
| TypeScript and changed-file ESLint | Both exit **0**. |
| Production build with database variables empty | Exit **0**. |
| `git diff --check` | Exit **0**. |

Exact commands:

```sh
node --import tsx --test --test-concurrency=1 tests/shared-learning.test.ts tests/shared-learning-client.test.ts tests/update-adoption.test.ts tests/working-updates.test.ts tests/working-entry.test.ts tests/personal-history-projection.test.ts tests/personal-media-mutations.test.ts tests/frameworks.test.ts tests/assessments.test.ts tests/assessment-history.test.ts tests/assessment-client.test.ts tests/assessment-history-client.test.ts tests/card-reuse.test.ts

node --import tsx --test --test-concurrency=1 tests/shared-learning.integration.ts tests/update-adoption.integration.ts tests/personal-lifecycle.integration.ts tests/card-reuse.integration.ts

node --import tsx --test --test-concurrency=1 tests/shared-learning.integration.ts tests/personal-info-cards.integration.ts tests/framework-readers.integration.ts tests/assessments.integration.ts

node --import tsx --test --test-concurrency=1 tests/shared-learning.integration.ts

node --import tsx scripts/test-phase2.ts update-adoption.browser.ts --reporter=line

node --import tsx scripts/test-phase2.ts working-updates.browser.ts --reporter=line

npx tsc --noEmit --incremental false

npx eslint src/components/decks/useWorkingDeck.ts src/lib/cards/model.ts src/lib/cards/personalWork.ts src/lib/cards/readModels.ts src/lib/cards/repository.ts src/lib/cards/updateAdoption.ts src/lib/cards/workingCardStore.ts src/lib/deckMutations.ts src/lib/cards/learning.ts src/lib/cards/learningContext.ts src/lib/cards/personalLearning.ts src/lib/cards/retainedAssignments.ts tests/shared-learning.test.ts tests/shared-learning-client.test.ts tests/shared-learning.integration.ts

env SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= npm run build

git diff --check
```

Additional earlier checks passed: shared-learning/update-adoption/working-updates units **23/23**, and shared-learning-client/shared-learning/working-entry/personal-media-mutations units **13/13**. They overlap with the 76-test selection.

Initial attempts were investigated rather than counted as passes: sandboxed Mongo startup failed because local listening sockets were forbidden; the first unrestricted integration run exposed an invalid public Card fixture title, fixed in the new test fixture; an early TypeScript discriminant error was fixed in the context union. The sandboxed Turbopack build stalled and was stopped, then the identical database-disabled build passed outside the sandbox. No application validation was weakened to accommodate a fixture. One successful regression run reported forced termination of a lingering disposable Mongo child after its shutdown grace period; all assertions completed and the runner exited 0.

Local output logs are in `/tmp/group-experience-phase-1-{unit,db,privacy-db,final-learning-db,browser,working-browser,build-unrestricted}.log`. These are temporary execution evidence, not committed deliverables or prerequisites for understanding this handoff.

## Phase 1 acceptance evidence

| Approved criterion | Evidence/status |
| --- | --- |
| One authoritative personal record under competing materialization | Four concurrent selected-version initializations leave one row; the aborted first mutation leaves none. Passed. |
| Explicit-version projections share stable personal values | Three immutable versions reorder/replace Steps and project one completion/confidence map; shared Step values agree. Passed. |
| Obsolete values survive adoption and writes | Reconciliation preserves obsolete IDs; concurrent writes to old/new Steps preserve both values; adoption regressions pass. Passed. |
| Private content and unrelated fields are preserved/excluded appropriately | Allowlist key assertions/private sentinels; narrow storage query; exact before/after comparison preserves tests, reflection, Info IDs, media, chats, dates and adoption. Existing privacy regressions pass. |
| Context-aware safe client boundaries | Distinct viewer/subject/experience/version keys; rejection of group/foreign cache inputs; old epochs/sessions rejected; isolated contribution failures and shared learning barriers. Passed. |
| Narrow personal learning mutations | Concurrent completion/confidence writes survive without replacing private fields or changing the adoption pointer; selected-version Step validation and rollback pass. |
| Target-date safeguards | Experience materialization leaves null despite suggested date; existing date preserved; ordinary personal first-open scheduling unchanged. Passed. |
| Retained Framework foundations | Highest-adopted deduplication; old personal composition retained before follower/owner Deck updates remove it; newer unadopted publication ignored; removed working navigation/mutation rejected. Passed. Group lifecycle and Framework reader integration remain later-phase work. |
| Duplicate/corrupt learning fails safely | Duplicate rows, duplicate Step entries, invalid readings/completion and unknown Steps fail without destructive repair. Passed. |
| Relevant existing regressions | Unit, database, both browser selections, type/lint/build checks pass. All approved Phase 1 acceptance criteria passed. |

## Decisions, limitations and Phase 2 readiness

The implementation keeps the existing embedded personal records and transaction infrastructure. It adds no collection, compound index, migration or cleanup service. Narrow field updates preserve private data without copying a broad CardData snapshot into a future group write. Context/cache foundations are explicit but do not invent a group backend or UI early.

Retained assignment references are compact evidence, not a historical Card browser. They are captured from legitimate server-resolved assignments and prior adopted compositions. Assignments already removed before any such evidence was recorded cannot be truthfully reconstructed from arbitrary orphan CardData alone. No speculative bulk backfill was performed. Current-only Framework summaries retain their existing behavior until Phase 5 consumes this evidence.

The cache still stores the existing personal-only mixed presentation record. Future experience read models must use separate allowlisted DTOs/caches and connect successful shared-learning writes to the invalidation primitive; they must not send private personal Card layouts into an inspected-subject cache. This phase establishes and tests that boundary without creating unused group storage/UI.

No production-scale performance claim, full test-suite certification, physical-device certification or real Cloudflare privacy certification is made. The relevant automated regression selections are recorded above. Provider deletion remains a future bounded-cleanup implementation, with no guarantee of eventual purge absent a retry. The one-hour previously issued link window remains the approved limitation.

The projection, mutation, scheduling, cache identity and retention foundations are available for Phase 2. Phase 2 must still build and test actual group identity, membership, equal admin roles, assignments, group-owned learning and adversarial foreign read/write authorization. Phase 3 must implement adoption/removal fences and snapshots. Neither phase has begun. Phase 4 UX and operational rollout gates remain unchanged.

## QUESTIONS requiring approval

No unresolved product or architectural decision blocks Phase 1. The next approval is the user's review of this handoff and **new explicit authorization for Phase 2**. Stop here; passing tests do not authorize progression.
