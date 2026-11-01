# Phase 5.4 — Scoped Progress and authorised assessment reads

## Resume here

**Complete and verified.** Branch `feat/group-experience`; starting HEAD `0add24337468`. This handoff belongs to the single 5.4 implementation commit. Do not redo 5.1a–5.3 and do not begin 5.5–5.7 without a new commission.

Commit subject: `feat (group experience): add scoped progress and assessment reads`. Resolve the containing commit hash with:

```sh
git log -1 --format='%H %s' --grep='^feat (group experience): add scoped progress and assessment reads$'
```

A commit cannot contain its own hash; the final response reports it after verification. The task-start working-tree hashes are `/tmp/group-progress-5-4-baseline.json`; all eleven pre-existing files were preserved. No partial or documentation-cleanup commit was created.

The uncommitted overarching engineering plan remains the authoritative product/engineering specification. Its stop-before-5.4 notices describe the preceding commission; the current founder commission authorises 5.4 only. P5-Q1/P5-Q2 stay approved. This handoff records actual new implementation status without changing or staging the earlier plan work.

## Implementation and scope reuse

`groupProgressContext` resolves actual viewer membership, a fixed experience, Framework identity, permitted active subject and the current selected content in one Mongo snapshot. It reuses `assertSelection`, current membership validation, `groupCapabilities`, `selectedContent`, canonical mapping reads and **`resolveProgressScope`**. No handler independently reconstructs Item coverage or broadens self scope.

All metrics and assessment histories use that plan's selected versions, partial Item Card sets and deduplicated Area unions. Complete Framework hierarchy is returned, including known outside Items. Invalid content/mapping becomes unknown coverage/incomplete metrics; it is not silently outside. Lazy histories deny unknown/outside sources before querying personal evidence.

`scopedMetrics` consumes **`progressObservationState`**, keeping percentage, exact completion, eligible observations and availability separate. `scopedCohortMetrics` pools observations across active people, deduplicating Cards only within each person's scope. The Framework roll-up uses the mapped union, rather than an average of Area/Item percentages.

- Completion is done eligible Steps / all non-skipped Steps, rounded once.
- Confidence pools valid raw readings, excludes unset readings, and rounds once.
- Skipped Steps may still contribute confidence.
- Admin extrema are min/max of individual calculated scope confidence; unset people are excluded. Non-Admin DTOs omit both extrema fields entirely, including with peer inspection enabled.
- Active/eligible people and exact doing/done classifications are separate from Step counts and rounded percentage. All-skipped is not complete; zero followers is empty, not skipped.
- Group learning and personal learning use separate sources. The strict existing scalar reader remains unchanged. Normal reads are batched. Only on corrupt input does the new adapter isolate failed person/Card projections, preserving unaffected Items while marking scopes containing a failed Card incomplete; it never drops the broken person to improve an average.

No learning writes, materialisation, new storage fields/indexes, schema migrations, UI changes or configuration changes were introduced.

## Assessment architecture and privacy

### Authorised personal evidence

The new assessment-only adapter retrieves the selected player's current relevant Card lists and follows only actual unique `historySourceCardTemplateId` links. It reuses **`resolveAssessmentEvidence`** for traversal classification, deduplication, missing/cyclic/ambiguous/malformed-source detection and the shared-source exposure set. Canonical ancestry never grants personal history access. A later source assessment remains live; no copied or frozen test history is created.

Mongo aggregation projects explicit assessment ID/date/result/createdAt, validated provenance fields, list revisions, Card identity and the server-internal source link. It does not retrieve media, URLs, reflection, chats, private Info associations, target dates, personal adoption pointers or unrelated Card rows. Direct Item queries filter to requested in-scope Item identities before results leave Mongo. Missing root validation is batched through the established scalar integrity reader: legitimate never-opened Group-only roots are empty/read-only; required missing ordinary records remain incomplete. Dangling ancestors never become virtual assignments.

A personal Item includes relevant selected Card evidence plus all of that person's direct Item results, regardless of origin. Unrelated same-Item Cards, siblings, other outside Items and Group-owned events are excluded. Full Card/Item histories are lazy; compact table summaries return count/state and at most three events. Summary construction reads only one selected player's history, never every follower's history.

### Safe response projection

**`authorisedAssessmentOriginNames`** checks independent current viewer membership in each recorded origin Group. Responses use Personal / authorised current Group name / Other group / Unknown. Raw provenance actor, Group and Deck identifiers are omitted. Revoking origin membership changes the next read to Other group without hiding the otherwise authorised assessment.

Foreign inherited sources outside current Group Card identities receive `source: null`, unavailable title, read-only capability and stable opaque SHA-256 row/dependency keys. The hash is a display/cache identity, not an authority or mutation token. Private ancestor IDs never appear in issue objects or exposed-through references. Current Group Card identities are permitted source labels; self can retain existing own-source mutation identities. Foreign personal mutations remain prohibited by the existing owner-only endpoints.

`ScopedAssessmentHistory` explicitly allows a null source, supplies safe origin, row key, source revisions and per-row mutation capability, and preserves readable results when another source is incomplete. Compact histories preserve existing latest-readable-three ordering semantics. No foreign result is placed in the ordinary personal working store; no client/store integration was added.

### Group-owned evidence

The 5.3 Group history loader was extracted into a bounded reusable reader. Existing Group source-list CRUD and retained-source management semantics are unchanged. New current Progress summaries/history use only scope-selected Group Cards/direct Items. Group scores and Player averages share one Group-owned Tests summary, outside both metric objects. Group mode never fetches player test histories.

Removed sources remain persisted and manageable through the existing exact-source Admin routes, but do not appear in current Progress. No history browser or restored navigation was introduced.

## API contracts

All URLs below are GET routes under:

`/api/group-experiences/:experienceId/frameworks/:frameworkId`

| Suffix | Response |
| --- | --- |
| `/summary` | Complete Framework/Area/Item hierarchy, coverage, selected versions, explicit metrics and compact Item tests |
| `/items/:frameworkItemId/history` | Lazy current-scope combined Card/direct Item assessment history |
| `/cards/:cardTemplateId/history` | Lazy legitimate history for one current Card mapped into this Framework |

No `subjectUserId` query means Group ownership. `?subjectUserId=:userId` selects an active personal subject after self/Admin/peer-policy authorisation. Duplicate/unknown query fields, forged actor headers and invalid experience/Framework/target identities are denied. These are data contracts, not permanent Progress navigation or entry-default changes.

Group summaries include `groupScores` and `playerAverages` on each metric scope, with one shared `assessments` object per Item. Player summaries include `player` metrics and that subject's scoped tests. Outside Item assessments are null and never queried. Area Tests remain structurally absent; no new Area assessment model exists.

Responses identify authenticated viewer, experience, Framework, explicit perspective/owner, selected Cards, structure/adoption revisions, viewer access epoch, subject access epoch, Group name, active-follower count and server-derived capabilities. Metric fields include explicit state, observation/eligible/completed-Step counts, percentage, exact completion and independent confidence/readings count. Assessment dependencies preserve list revisions; summary/history hashes provide opaque change tokens.

All data/errors reuse `groupRequest` authentication, existing feature gate, `private, no-store`, `Vary: Cookie` and viewer headers. The entire snapshot has verified-at and five-second expiry timestamps. No new feature flag or production enablement was introduced.

## Revocation and later client integration

An already-running snapshot can finish using its earlier authorised state; its old epochs/revisions and bounded lease remain explicit. A deterministic read/removal test verifies this and immediate denial on subsequent requests. Current viewer/subject membership and peer policy are rechecked on every new read. Origin-name authority is independently re-evaluated too.

5.5–5.6 must key data by viewer + experience + Framework + owner/subject + relevant scope/authority generation, reject late incompatible replies, expire/hide foreign payloads when authority cannot be verified and revalidate on focus/re-entry. Never treat a hash, source ID or provenance label as a permission. No realtime service or remote-erasure claim is introduced.

## Verification record

All persistence tests use runner-owned disposable Mongo replica sets. No production/shared database or application/review server was modified.

### Final commands and results

```sh
node --import tsx --test tests/group-framework-metrics.test.ts tests/framework-progress-scope.test.ts tests/frameworks.test.ts tests/group-experience.test.ts tests/assessment-provenance.test.ts tests/assessments.test.ts tests/assessment-history.test.ts tests/personal-history-projection.test.ts tests/group-progress-preview.test.ts
```

**52 passed, 0 failed, 0 skipped/cancelled.** Log `/tmp/group-progress-5-4-unit.log`.

```sh
node --import tsx --test --test-concurrency=1 tests/group-framework-progress.integration.ts tests/group-personal-assessments.integration.ts tests/group-assessments.integration.ts tests/framework-lifetime.integration.ts tests/framework-readers.integration.ts tests/frameworks.integration.ts tests/assessments.integration.ts tests/group-experience.integration.ts tests/group-experience-perspectives.integration.ts
```

**97 passed, 0 failed, 0 skipped/cancelled.** Log `/tmp/group-progress-5-4-cumulative.log`.

Additional focused command:

```sh
node --import tsx --test --test-concurrency=1 tests/group-framework-progress.integration.ts tests/group-assessments.integration.ts
```

**28 passed, 0 failed** before the last scoped-error refinement. A standalone rerun of `tests/group-framework-progress.integration.ts` passed **15/0** (`/tmp/group-progress-5-4-progress-final.log`). Final guard/demotion assertions were verified with:

```sh
node --import tsx --test --test-concurrency=1 --test-name-pattern='self, Admin|Group-only virtual' tests/group-framework-progress.integration.ts
```

**2 passed, 0 failed, 0 skipped/cancelled** (`/tmp/group-progress-5-4-final-guards.log`). The cumulative suite covers the final source; this focused run additionally verifies the last test-only Admin-demotion assertions. These selections overlap; do not add their counts as unique tests.

`npx tsc --noEmit --incremental false` passed. `npx eslint --max-warnings 0` over the eleven TypeScript files listed below passed after final source changes. `git diff --check` passed. Installed Next route-handler documentation was read; routes use Promise params and existing authenticated private-response conventions.

No full repository suite, build or browser/iPhone presentation run was performed. This checkpoint changes backend data APIs only; actual handlers are bundled and exercised directly by integration tests. Navigation and presentation/device checks belong to the separately authorised later checkpoints.

### Coverage and investigated failures

Tests cover partial Items, raw Area/Framework unions, unequal denominators and confidence weighting, independent skipped confidence, all-todo/empty/all-skipped/malformed states, no followers, rounded 100 without exact completion, valid version selection and untouched personal adoption, all role/peer-policy combinations, dual roles, revocation and snapshot generations. Assessment cases cover live inherited history parity, shared-source deduplication, direct Item origins, unrelated/sibling exclusion, unknown/redacted provenance, retained-source exclusion, malformed source chains, Group/personal ownership separation and unchanged scalar-only APIs.

The projection test inspects actual aggregate results before response transformation, asserting private sentinel fields/URLs/dates and arbitrary event fields never leave Mongo. It traps full personal-user reads and verifies Group summaries do not query follower test lists. HTTP tests exercise actual summary/Item/Card handlers, forged subjects/Frameworks/targets, viewer-header conflicts, no-store headers, five-second leases and absent non-Admin extrema.

One cumulative Mongo fixture child exceeded its SIGINT shutdown deadline; the harness used its own SIGKILL fallback. The suite passed and no application/review service was touched.

Initial new-test failures were fixture/typing issues: omitted existing settings operation ID, a history link set to undefined that Mongo serialised as malformed null, and TypeScript union narrowing/helper annotations. They were corrected without weakening existing assertions or privacy protection. The corrupt-Card isolation scenario was added during final review before committing.

## Changed-file inventory

All paths relative to the repository:

1. `src/lib/groupExperiences/progressContext.ts` — new snapshot scope/authority contract.
2. `src/lib/groupExperiences/progressMetrics.ts` — raw scoped/cohort metrics and explicit states.
3. `src/lib/groupExperiences/progressAssessments.ts` — narrow personal evidence loader and safe history DTOs.
4. `src/lib/groupExperiences/progressReads.ts` — summary/lazy-history orchestration.
5. `src/lib/groupExperiences/progressHttp.ts` — existing Group HTTP boundary/query adapter.
6. `src/lib/groupExperiences/assessments.ts` — reusable existing Group history loader; CRUD unchanged.
7. `src/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/summary/route.ts`.
8. `src/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/items/[frameworkItemId]/history/route.ts`.
9. `src/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/cards/[cardTemplateId]/history/route.ts`.
10. `tests/group-framework-metrics.test.ts` — pure numeric/state regressions.
11. `tests/group-framework-progress.integration.ts` — scope/privacy/API/snapshot regressions.
12. This handoff.

## Preserved work and remaining checkpoints

All eleven pre-existing working-tree files were SHA-256 checked and remain byte-for-byte unchanged. They include both modified engineering plans, `scripts/test-phase2.ts`, independent Phase 5 review and untracked 5.0 scripts/fixtures/tests. They must stay outside the 5.4 commit. The overarching plan's approved decisions remain authoritative and uncommitted; the new handoff supplies current execution status for the next agent. No documentation cleanup commit is needed.

5.5 will consume the response identities, metadata, roles/capabilities and summaries for approved entry, perspective/destination and Back integration. 5.6 will consume metric/coverage states, compact tests, lazy safe histories and list/mutation capabilities for the existing table/editor, popovers and skipped rendering. 5.7 remains the later integrated regression/visual acceptance and final handoff. None was begun.

No genuine product decision or architecture blocker is currently identified. 5.5 is technically ready for a new explicit commission; no 5.5 work was begun. Existing membership-trust and operational rollout gates remain unchanged.
