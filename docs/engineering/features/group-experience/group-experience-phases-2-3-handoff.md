# Group Experiences — Phases 2 and 3 handoff

**Status:** Both phases completed, acceptance checks passed, and implementation committed separately on `feat/group-experience`. Stop before Phase 4. No deployment, live database/index changes, provider configuration changes or real-participant enablement occurred.

The authority for this work is the subsequent **Implement Group Experiences Phases 2 and 3** commission. The earlier Phase 1-only amendment and its handoff describe the previous delivery boundary. The approved [engineering plan](group-experience-engineering-plan.md) remains the architecture and later-phase specification.

> **30 October 2026 supersession:** Phase 4 corrects the historical all-skipped/rounded-100 follower classification documented below. Earlier passing tests describe the former implementation; the current contract excludes skipped progress observations and uses exact statuses. Personal percentage presentation and stored snapshot values are preserved.

## 1. Commit history and scope

| Delivery | Commit | Subject |
| --- | --- | --- |
| Existing Phase 1 baseline | `d68bd4c` | `feat (group data): Add shared learning foundations for Group Experiences Phase 1` |
| Phase 2 | `eedccd2e4a8912cc615129a97a255f63ce5db0ed` | `feat: implement group experience foundation and learning` |
| Phase 3 | `226235f3be6290931d0d1d9d5eceb55bdc80579c` | `feat: implement group adoption and membership lifecycle` |

This handoff is delivered in a subsequent documentation-only commit named `docs: add group experience phases 2 and 3 handoff`. Neither implementation commit is amended. The repository was clean at the start; Phase 1 was already committed. Its learning, scheduling and retention primitives were inspected and reused, with no changes to Phase 1 application source.

Phase 2 adds experience identity, assignment metadata, independent roles, narrow personal learning reads/writes, group-owned scalar learning, aggregates and authenticated APIs. Phase 3 adds group-controlled adoption, removal snapshots, rejoin behaviour, retained eligibility references and deterministic lifecycle concurrency coverage. There are no new components, screens or user interactions.

## 2. Persistence, indexes and authority

| Collection | Purpose | Required indexes |
| --- | --- | --- |
| `groupExperiences` | Name, immutable Deck identity, adopted Deck version, retained Card selections, creator/create operation, structural/adoption revisions and admin count | Unique `group_identity` on experienceId; unique `group_create_receipt` on creatorUserId + operationId |
| `groupExperienceMembers` | Independent admin/follower roles, access epoch, write fence, assignment/navigation metadata, lifetime retained Card references and latest removal manifest | Unique `group_member_identity` on experienceId + userId; `group_admin_entries` on userId + isAdmin + experienceId; `group_assignments` on userId + followerStatus + experienceId; `group_roster` on experienceId + followerStatus + userId |
| `groupCardState` | Independent group completion/confidence values keyed by stable Step identity | Unique `group_learning_identity` on experienceId + cardTemplateId |
| `groupOperationReceipts` | Actor-scoped structural command hash and committed revision for exact retries | Unique `group_operation_identity` on experienceId + actor + operationId |
| `groupRemovalLearning` | Latest permitted removal snapshot, split by Card and bound to a manifest generation | Unique `group_removal_identity` on experienceId + userId + cardTemplateId |

The first four collections/index sets are Phase 2. Removal storage and the member removal manifest are Phase 3. Index creation is explicit through `createGroupExperienceIndexes`; routes check readiness and return unavailable when prerequisites are missing. They do not install indexes or create schema at import time. Disposable fixtures exercise provisioning and readiness; no production provisioning was run.

All APIs are disabled unless `SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=1`. This work does not set that value in deployment or local configuration. Tests temporarily set it inside their isolated process and restore the prior value. Disabled routes return 503. Actual route authorization uses the existing authenticated actor, never a caller-supplied user identity. Responses, including errors, use `Cache-Control: private, no-store` and `Vary: Cookie`; an optional viewer header must match the authenticated actor.

Creation pins an exact current public published Deck/Card manifest and assigns registered users without creating follower-specific CardData. A creator is an admin; other requested admins have equal permissions. Admin and follower roles are independent. Admin-only users do not contribute personal learning to follower aggregates; dual-role users count once. Final-admin protection combines transactional role changes, member fences and structural revision/admin-count checks. Template ownership or an unrelated application role does not confer experience access.

## 3. API inventory

All paths below start with `/api/group-experiences`. `:experienceId`, `:cardTemplateId` and `:userId` are route parameters. Body/query contracts reject unrecognised fields. Pagination defaults to 30 with a maximum page size of 100; this is not a membership limit.

| Method and path | Behaviour and permission |
| --- | --- |
| `GET /` | List authenticated actor assignments/admin entries, one descriptor per experience |
| `POST /` | Create named experience from the exact public manifest; creator-scoped operation ID makes retries idempotent |
| `GET /:experienceId` | Current accessible experience metadata and context revisions |
| `GET /:experienceId/members` | Admin-only paginated roster |
| `POST /:experienceId/members` | Admin structural command: add follower, set admin; Phase 3 adds remove follower and rejoin through add follower |
| `POST /:experienceId/open` | Record authorized current Card entry; lazily materialize the active follower actor personal row with a null target date when missing |
| `GET /:experienceId/summary` | Current authorized group and active-follower aggregates |
| `GET /:experienceId/cards/:cardTemplateId` | Explicit group/self/follower perspective; self requires follower role, another follower requires admin; former follower inspection uses the frozen projection |
| `GET /:experienceId/cards/:cardTemplateId/perspectives` | Admin-only paginated lightweight active-follower learning projections |
| `PATCH /:experienceId/cards/:cardTemplateId/personal-learning` | Active follower changes their own completion or confidence using the selected version and access epoch |
| `PATCH /:experienceId/cards/:cardTemplateId/group-learning` | Admin changes independent group completion or confidence |
| `GET /:experienceId/updates?kind=card\|deck&entityId=…&perspective=group` | Phase 3: admin review of latest eligible publication, exact selection/revisions and chronological public update notes |
| `POST /:experienceId/updates` | Phase 3: admin acceptance of the exact review plus operation ID; stale review produces refresh conflict |
| `GET /:experienceId/members/:userId/snapshot` | Phase 3: admin-only permitted historical learning and metrics for a removed follower, bound to removal versions |

Creation/member/adoption retries compare the original command hash. Reusing an operation ID with different intent fails. A successful old structural operation replay returns an acknowledgement or `superseded`; it never reinstates obsolete intent. Current authorization is checked before replay. Update conflicts can return `409`, `refreshRequired` and a fresh review. Learning commands carry the authenticated membership epoch and submitted Card version.

## 4. Shared learning, privacy and aggregation

There remains one authoritative personal CardData per user/CardTemplate. Group assignments and version adoption do not copy personal progress into per-experience follower records. Personal group writes call Phase 1 materialization/mutation helpers and change only the intended learning value and required timestamps. Existing tests, media, reflection, Info Cards, adoption pointers and target dates remain intact. Group-origin materialization always sets an unset initial personal target date to null; ordinary personal Deck scheduling is unchanged.

Foreign reads use database aggregation with explicit nested allowlists for Card identity, Step completion and signal readings. They do not fetch a complete foreign CardData and redact it afterward. Missing personal rows are treated as unstarted only when consistent with the existing personal assignment state; missing or malformed required personal data fails closed. Batches are bounded. No foreign read or snapshot contains personal assessments, test history, media, reflection, Info attachments, target dates or unrelated private history.

Group-owned learning lives only in `groupCardState`. Existing progress/confidence algorithms are reused. Aggregates include active followers only; null readings are excluded, each underlying valid reading has equal weight, and only the final confidence is rounded. Tests include `10,2,2,2 → 4`, empty/unstarted and all-skipped cases, malformed data and dual-role users. No group assessment feature is introduced; assessment implementation and presentation remain in their later phase.

DTO context identities include viewer, experience, structural/adoption revisions and membership epoch. Phase 1 client/cache helpers remain available for the Phase 4 consumer. There is no group UI or new client cache implementation in this delivery.

## 5. Adoption, retained eligibility and lifecycle

Each experience selects its own Card/Deck versions. Reviews and acceptance require current admin authority, the group perspective, eligible public immutable versions and matching structural/adoption revisions. Publication guards prevent a newer publication racing acceptance from being silently adopted without review. Existing Card selections are retained when a Deck removes a Card and reused on reintroduction; a new Card pins its reviewed eligible publication. Adoption changes no ordinary personal pointer, no other experience and no follower personal learning row.

Step values are matched only by stable Step ID. Obsolete stored values remain available if a Step is later reintroduced. A stale learning command can apply only when the submitted eligible public version and currently selected version both contain the specified Step. Removed or substituted Steps fail; position never transfers progress.

Member `retainedCardAssignments` uses the Phase 1 deterministic maximum-version merge. Assignment/adoption/removal records the versions legitimately assigned to that follower. Removing a Card from a Deck or leaving an experience does not erase this reference. A publication alone does not advance it. Retained references grant no access to old group navigation, content endpoints or private learning. The future Phase 5 Framework reader must union eligible personal and group references, deduplicate CardTemplate identity and choose the highest explicitly adopted version. Framework calculation/UI integration is deliberately unchanged here.

Removal transactionally changes membership/access epoch and stores a generation-bound manifest plus allowlisted learning snapshots. It excludes the follower from active aggregates and assignments while preserving personal CardData and existing contribution records. Independent admin authority survives removal of only the follower role. Snapshot failure rolls back membership and receipts together.

Former-follower inspection never reads subsequent live personal learning. Historical metrics use the removal versions. Projection into a newer current Card marks previously absent Cards/Steps as unavailable rather than inventing unstarted history. Missing/corrupt snapshot generations fail closed. Rejoin reuses current personal learning, restores active membership, advances access epoch and does not copy snapshot values back. A later removal replaces the previous removal generation; this is not an unlimited membership history browser. Contribution/audience features remain later work; lifecycle code does not delete their records or invent new recipient relationships.

## 6. Concurrency and proportionality decisions

- Structural changes use existing Mongo transactions, revision comparisons and narrowly scoped member write fences. Scalar writes do not lock the entire experience. There is no global operation lock or background worker.
- Adoption updates active follower assignment/version metadata to preserve eligibility and serialize membership transitions. It never fans out personal CardData initialization or adoption writes.
- Removal snapshots reflect the coherent transactional read. An independent personal-context write after that read may commit separately; the frozen snapshot does not subsequently change. It is not a forensic guarantee of the final millisecond before removal.
- An already-authorized group-state write by another admin can commute with adoption and retain an obsolete Step value as history. A newly authorized write must satisfy the selected-version contract. Membership revocation conflicts through member fences.
- Receipts persist to make retries reliable across later revisions. No cleanup job or retention expiry is introduced.
- Summary reads compute from underlying allowlisted values. One selected Card is sufficient for scalar writes; repeated materialization checks are skipped when the narrow existing row is already available.

These are in-scope implementations of the approved architecture. There is no material ownership or product deviation and no destructive migration.

## 7. Automated acceptance evidence

### Results

| Verification | Result |
| --- | --- |
| Phase 2 final focused domain/repository/API acceptance | **19 passed, 0 failed** |
| Phase 2 final capacity checks | **2 passed, 0 failed** |
| Existing database regressions at Phase 2 | **104 passed, 0 failed** |
| Personal learning/client/progress/assessment unit regression selection | **54 passed, 0 failed** in both phases |
| Final combined Phase 2 + Phase 3 acceptance and existing database regressions | **146 passed, 0 failed, 0 skipped** |
| Final standalone TypeScript check | Passed, exit 0 |
| Final targeted ESLint | Passed, exit 0 |
| Production Next build, credentials cleared | Passed, exit 0; 44 static pages generated |
| Final implementation diff whitespace checks | Passed |

The combined 146 comprises 42 group tests and 104 existing database regressions. The 42 group tests cover 2 domain, 13 foundation integration, 6 API, 2 capacity and 19 lifecycle cases. Existing selections protect shared learning, personal lifecycle, Card reuse, personal adoption, Framework readers, assessments and Personal Info Cards.

Phase 2 acceptance covers duplicate creation, public root/private historical version rejection, membership and role boundaries, template owner without membership, final-admin concurrency, direct API forgery/cross-group denial, nested private sentinels, one authoritative personal row, independent group values, scheduling safeguards and aggregation edge cases.

Phase 3 acceptance adds deterministic barriers around adoption versus Step writes and member addition; removal versus group-origin writes and rejoin; concurrent admin changes; personal adoption versus group learning; and independent personal activity after a removal read. It also verifies duplicate lifecycle/adoption requests, stale versions, obsolete/reintroduced Steps, retained eligibility after Deck removal, frozen former-follower reads, rollback after injected failures and publication races. Tests exercise relevant orderings without sleep-based timing assertions.

The API suite bundles actual route handlers with the existing esbuild test pattern. Authentication and database connection are fixture boundaries; authorization, contracts and repository operations are real. This is not a browser cookie/session or full end-to-end deployment certification. No UI changed, and Phase 1 browser results are not represented as newly executed here.

### Exact test commands

Phase 2 final focused checks:

```sh
node --import tsx --test --test-concurrency=1 tests/group-experience.test.ts tests/group-experience.integration.ts tests/group-experience-api.integration.ts
node --import tsx --test tests/group-experience-capacity.integration.ts
```

Phase 2 combined regression run:

```sh
node --import tsx --test --test-concurrency=1 tests/group-experience.test.ts tests/group-experience.integration.ts tests/group-experience-api.integration.ts tests/group-experience-capacity.integration.ts tests/shared-learning.integration.ts tests/update-adoption.integration.ts tests/personal-lifecycle.integration.ts tests/card-reuse.integration.ts tests/framework-readers.integration.ts tests/assessments.integration.ts tests/personal-info-cards.integration.ts
```

That initial run produced **124 passed, 1 failed**: the capacity write p95 was 600.633 ms against the 500 ms target. All 104 existing database regressions passed. The write path was narrowed to the selected Card and avoided redundant materialization work for an existing row. The focused 19 checks and both capacity tests then passed before the Phase 2 commit. The final Phase 3 combined run below rechecks the complete selection successfully.

Final Phase 3 combined acceptance/regression command:

```sh
node --import tsx --test --test-concurrency=1 tests/group-experience.test.ts tests/group-experience.integration.ts tests/group-experience-api.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-capacity.integration.ts tests/shared-learning.integration.ts tests/update-adoption.integration.ts tests/personal-lifecycle.integration.ts tests/card-reuse.integration.ts tests/framework-readers.integration.ts tests/assessments.integration.ts tests/personal-info-cards.integration.ts
```

Result: **146/146**, approximately 424 seconds. All Mongo fixtures use disposable `MongoMemoryReplSet` databases; no production Atlas fixture writes occurred.

Unit regression command executed in both phases:

```sh
node --import tsx --test tests/shared-learning.test.ts tests/shared-learning-client.test.ts tests/working-entry.test.ts tests/update-adoption.test.ts tests/working-updates.test.ts tests/frameworks.test.ts tests/assessments.test.ts tests/personal-history-projection.test.ts tests/personal-media-mutations.test.ts
```

Final static/build commands:

```sh
env SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= npm run build
npx tsc --noEmit --incremental false
npx eslint src/lib/groupExperiences src/app/api/group-experiences tests/group-experience.test.ts tests/group-experience.integration.ts tests/group-experience-api.integration.ts tests/group-experience-capacity.integration.ts tests/group-experience-lifecycle.integration.ts tests/helpers/groupExperiences.ts
git diff --check
git diff --cached --check
```

Phase 2 ran the same static checks against its then-existing files, excluding the not-yet-created lifecycle test from the lint command. During final Phase 3 verification, a standalone type check overlapped Next build regeneration and failed because two `.next/types` files disappeared. The build then passed; standalone type checking and lint were rerun sequentially afterward and passed. There is no unresolved compiler failure. An earlier build attempt was not executed when automatic approval review ran out of workspace credits; after usage restoration the build was executed successfully through normal approval review.

Local evidence logs remain under `/tmp/group-phase2-{regression,acceptance-final,capacity-final,unit-regression,build-final}.log` and `/tmp/group-phase3-{regression,unit-regression,build}.log`. They are transient local artifacts, not committed deliverables.

### Capacity evidence

Machine: Node v22.14.0, darwin x64, Intel Core i7-9750H at 2.60 GHz; local single-member wiredTiger replica set. Fixture: 20 followers, 3 admins, 12 Cards; 5 warm-up summary reads, 100 measured reads, 200 writes across 20 concurrent followers. The roster query plan uses `group_roster`.

| Measurement | Phase 2 final | Phase 3 final | Budget |
| --- | --- | --- | --- |
| Summary payload | 6,583 bytes | 6,583 bytes | ≤250 KB |
| Repository summary p95 | 75.934 ms | 41.264 ms | ≤300 ms |
| Scalar write p95 | 218.468 ms | 200.417 ms | ≤500 ms |
| Maximum transaction attempts in scalar workload | 1 | 1 | Report |
| Retried transactions in scalar workload | 0 | 0 | Report |

A second 40-follower/24-Card fixture passes pagination checks across pages of 30 and 10. Perspective response size is also checked against 100 KB. Deterministic lifecycle contention tests are separate from these latency samples. These measurements do not establish staging/network or production performance.

## 8. Complete changed-file inventory

Paths are relative to the repository root. Phase 2 changed **24 files**; Phase 3 changed **12 files**, including changes to seven files introduced by Phase 2. The final documentation commit adds only this handoff. No dependency, configuration, provider, UI or unrelated source files changed. Generated build/test artifacts are not committed.

### Phase 2 — `eedccd2`

```text
docs/engineering/features/group-experience/group-experience-engineering-plan.md
src/app/api/group-experiences/route.ts
src/app/api/group-experiences/[experienceId]/route.ts
src/app/api/group-experiences/[experienceId]/members/route.ts
src/app/api/group-experiences/[experienceId]/open/route.ts
src/app/api/group-experiences/[experienceId]/summary/route.ts
src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/route.ts
src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/perspectives/route.ts
src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/personal-learning/route.ts
src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/group-learning/route.ts
src/lib/groupExperiences/authorization.ts
src/lib/groupExperiences/contracts.ts
src/lib/groupExperiences/http.ts
src/lib/groupExperiences/indexes.ts
src/lib/groupExperiences/learningReads.ts
src/lib/groupExperiences/model.ts
src/lib/groupExperiences/publicVersions.ts
src/lib/groupExperiences/readModels.ts
src/lib/groupExperiences/repository.ts
tests/group-experience.test.ts
tests/group-experience.integration.ts
tests/group-experience-api.integration.ts
tests/group-experience-capacity.integration.ts
tests/helpers/groupExperiences.ts
```

### Phase 3 — `226235f`

```text
src/app/api/group-experiences/[experienceId]/updates/route.ts
src/app/api/group-experiences/[experienceId]/members/[userId]/snapshot/route.ts
src/lib/groupExperiences/adoption.ts
src/lib/groupExperiences/contracts.ts
src/lib/groupExperiences/http.ts
src/lib/groupExperiences/indexes.ts
src/lib/groupExperiences/lifecycle.ts
src/lib/groupExperiences/model.ts
src/lib/groupExperiences/repository.ts
tests/group-experience-api.integration.ts
tests/group-experience-lifecycle.integration.ts
tests/helpers/groupExperiences.ts
```

### Documentation-only delivery

```text
docs/engineering/features/group-experience/group-experience-phases-2-3-handoff.md
```

## 9. Remaining limits, operational prerequisites and Phase 4 readiness

All approved Phase 2 and Phase 3 automated acceptance criteria passed. No unresolved product or architectural question blocks these backend phases. The backend is ready for the approved design work and subsequent implementation of the early synchronized-perspectives slice.

Before real use, separately authorize and perform live index provisioning/readiness checks, staging end-to-end performance/security checks and feature enablement. A replica-set-capable Mongo deployment is required for the existing transaction infrastructure. Keep the feature disabled until the appropriate implementation and operational gates are complete. No physical-device, production-load or Cloudflare privacy certification is claimed.

Private group image delivery, signed-only video delivery, provider verification and bounded provider deletion are still later work. The approved one-hour lifetime for already-issued signed URLs remains unchanged. There are no group media endpoints or assets enabled here. Framework consumption of retained references and group assessments remain Phase 5; media, Info Card and reflection features remain their later phases. The unchanged personal features continue to use their existing private endpoints.

Phase 4 requires new explicit authorization and approval of the existing planned UX choices: entry/member selection treatment, admin desktop miniature layout, follower mobile perspective switching, shared active Card and front/back orientation, physical Card continuity, initial entry/selection behaviour and minimal loading/prefetching. The UI must also represent frozen historical values and unavailable Steps accurately using the provided contracts. No dashboard, navigation, management interface, Card interaction or later-phase UI was implemented or selected implicitly.

**QUESTIONS:** None requiring a new decision to complete Phases 2–3. Review this handoff and approve the Phase 4 UX before authorizing that implementation. Work stops here.
