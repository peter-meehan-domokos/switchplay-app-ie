# Phase 5.7 — Consolidated regression and acceptance handoff

## Status / Resume here

**Complete and founder accepted on 2 November 2026. All Phase 5 checkpoints (5.1a–5.7) are complete.** The founder approved the final physical iPhone review of Group/individual Progress, assessment histories and realistic fixtures, Item/Area strikethrough, navigation, popovers and visual presentation. No further visual approval is required.

Branch `feat/group-experience`. The working tree was clean at finalisation: `71428cc17317a8ac43e8fd5923b0862d775b25b6` already contains the implementation, fixtures, styling and acceptance tests recorded below; `fcf0e91` already contains the approved architecture/reflection documentation and Group settings menu refinement. Preserve both commits. This finalisation commit records acceptance and closes the handoff/plan only; it does not repeat completed implementation or verification.

Next action: stop after the finalisation commit and handoff. The separately planned `groupCardState` → `groupCardData` rename and Phase 6 require their own commissions. No rollout, provider operation or future-phase implementation is implied.

## Work completed

- Added `tests/phase2/group-progress-acceptance.browser.ts`, four real-API browser cases across Chromium and WebKit. The tests create isolated Groups in the existing disposable fixture, retaining the main Galway review dataset.
- A Group Item assessment Add commits through the actual API, but its first response is deliberately lost. The client replays the same command, producing one event/one revision increment while the personal Item list remains exactly unchanged.
- A valid foreign history response is held while the subject is removed; revalidation closes the modal, removes that subject from the picker, falls back to self, denies fresh foreign reads and rejects the delayed result. Removing the viewer next returns My Decks and denies Group reads, while the owner's normal personal Progress/history remains accessible.
- Reran cumulative scope, lifetime eligibility, version projection, assessment provenance/history/storage/retry, policy/fence/removal/adoption/destination and relevant personal/Library/Info regressions. Verified main-derived Card geometry and accepted presentation in both engines; production and optimized builds passed.
- The initial consolidated acceptance run required no application fix. Subsequent separately authorised fixture, Item/Area strikethrough and browser-test refinements are recorded below and committed in `71428cc`. Calculations, ownership, permissions and Card geometry remain unchanged. Option B, future reflection UX and the groupCardState name remain as previously approved/current respectively.

## Current verification results

| Selection | Actual result | Log |
| --- | --- | --- |
| Focused unit/calculation/history/client selection | 111 passed, 0 failed | `/tmp/group-progress-5-7-unit.log` |
| 19-file cumulative disposable Mongo integration selection | 215 passed, 0 failed, 0 skipped | `/tmp/group-progress-5-7-integration.log` |
| Main-reference geometry, Chromium/WebKit | 24 passed, 0 failed | `/tmp/group-progress-5-7-geometry.log` |
| Existing real-API live Progress/presentation cases | All 13 pre-existing cases passed unchanged within the initial 17-case run | `/tmp/group-progress-5-7-browser-live.log` |
| New acceptance cases after test-only correction | 4 passed, 0 failed, Chromium/WebKit | `/tmp/group-progress-5-7-acceptance-final.log` |
| Personal/Group/navigation/Card/Library/Info browser selection | All 43 scenarios passed: initial 42 passed; one missing-fixture invocation rerun correctly and passed | `/tmp/group-progress-5-7-browser-regressions.log`, `/tmp/group-progress-5-7-info-final.log` |
| Optimized fixture build plus actual Chromium runtime | Build passed; 8 passed, 0 failed | `/tmp/group-progress-5-7-optimized.log` |
| Standard production build, checked-in Framework catalogue/Turbopack | Passed compile, TypeScript and 45/45 static pages | `/tmp/group-progress-5-7-build.log` |
| Final `npx tsc --noEmit --incremental false` | Passed | `/tmp/group-progress-5-7-typecheck.log` |
| New-test lint, `--max-warnings 0` | Passed, zero warnings | `/tmp/group-progress-5-7-lint.log` |
| Cumulative focused lint | 76 explicit Phase 5/new-test TS files, zero errors; one existing no-img-element warning at unchanged `DeckFrontContents.tsx:17` | `/tmp/group-progress-5-7-lint-cumulative.log` |

The browser totals above do not count the duplicated initial lost-response passes as additional scenarios. The optimized cases intentionally re-exercise production compilation/runtime, not another dev pass. The entire repository suite and new real-provider operations were not needed/run. This is current verification, not inherited handoff results.

### Exact commands

```sh
node --import tsx --test tests/frameworks.test.ts tests/framework-progress-scope.test.ts tests/group-framework-metrics.test.ts tests/group-progress-preview.test.ts tests/group-progress-navigation.test.ts tests/group-assessment-client.test.ts tests/group-personal-assessment-client.test.ts tests/assessment-provenance.test.ts tests/assessment-history.test.ts tests/assessment-history-client.test.ts tests/assessment-client.test.ts tests/assessments.test.ts tests/progress-client.test.ts tests/area-destinations.test.ts tests/presentation-foundation.test.ts tests/personal-history-projection.test.ts tests/group-experience.test.ts tests/group-experience-client.test.ts tests/group-experience-perspectives.test.ts

node --import tsx --test --test-concurrency=1 tests/framework-lifetime.integration.ts tests/framework-readers.integration.ts tests/frameworks.integration.ts tests/assessments.integration.ts tests/assessment-provenance.integration.ts tests/group-personal-assessments.integration.ts tests/group-assessments.integration.ts tests/group-framework-progress.integration.ts tests/group-progress-destinations.integration.ts tests/group-experience.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-management.integration.ts tests/group-experience-perspectives.integration.ts tests/area-destinations.integration.ts tests/item-destinations.integration.ts tests/personal-lifecycle.integration.ts tests/card-reuse.integration.ts tests/personal-info-cards.integration.ts tests/info-card-attachments.integration.ts

node node_modules/@playwright/test/cli.js test --config playwright.phase2.config.ts group-progress-main-geometry.browser.ts --output phase2-test-results/phase5-7-geometry

node --import tsx scripts/test-phase2.ts --group-progress-live group-progress-acceptance.browser.ts group-progress-live.browser.ts group-progress-review.browser.ts
node --import tsx scripts/test-phase2.ts --group-progress-live group-progress-acceptance.browser.ts

node --import tsx scripts/test-phase2.ts --group-progress progress.browser.ts group-progress-navigation.browser.ts assessment-ui.browser.ts group-experience-motion.browser.ts group-counts-confidence.browser.ts group-progress-preview.browser.ts deck-menu.browser.ts personal-info-cards.browser.ts --grep 'progress.browser.ts|group-progress-navigation.browser.ts|assessment-ui.browser.ts|group-experience-motion.browser.ts|group-counts-confidence.browser.ts|group-progress-preview.browser.ts|deck-menu.browser.ts|empty pouch creates'
node --import tsx scripts/test-phase2.ts --info-cards personal-info-cards.browser.ts --grep 'empty pouch creates'

npx tsc --noEmit --incremental false
npx eslint --max-warnings 0 tests/phase2/group-progress-acceptance.browser.ts
git diff --check
```

Cumulative lint used this explicit source selection, with filenames recorded in `/tmp/group-progress-5-7-lint-files.json`:

```python
import subprocess
files = subprocess.check_output([
    "git", "diff", "--name-only", "a6f2e32..fcf0e91", "--", "src"
], text=True).splitlines()
files = [p for p in files if p.endswith((".ts", ".tsx"))]
files += ["tests/phase2/group-progress-acceptance.browser.ts"]
subprocess.run(["npx", "eslint", "--max-warnings", "1", *files], check=True)
```

Builds ran in `/private/tmp/switchplay-phase5-7-build-v8rv9i3y`, an export of starting HEAD plus the new acceptance test, with snapshot-local dependency directory and no `.env.local`. The standard build used the checked-in catalogue/default compiler; the optimized fixture build used only the existing test-gated catalogue substitution. Existing root `.next`/review services were not rebuilt or stopped.

```sh
cd /private/tmp/switchplay-phase5-7-build-v8rv9i3y
SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= PHASE2_BROWSER_TEST=0 SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=0 NEXT_TELEMETRY_DISABLED=1 npm run build
node --import tsx scripts/test-phase2.ts --optimized --group-progress-live group-progress-live.browser.ts group-progress-acceptance.browser.ts --grep-invert webkit
```

### Investigated failures and limitations

- Initial new revocation checks timed out in both engines because the test attempted the error/incomplete-only Refresh history button on a complete history. Traces showed no removal command was reached. The corrected test awaits the existing four-second refresh poll and retains every revocation/stale-response assertion. Both final cases passed; no production workaround or tolerance increase.
- The initial broader browser command omitted `--info-cards`, so its personal Info case lacked `demo-series-owner` and timed out selecting it. The other 42 cases passed. Rerunning that unchanged case with its required fixture flag passed; no Series/product change or assertion change.
- Initial TypeScript found an optional release callback invocation in the new test; a definite invocation after the awaited capture corrected the test type. Final TypeScript passed.
- Initial standard build snapshot used an external node_modules symlink, which Turbopack rejects outside its filesystem root. Snapshot-local dependencies resolved it; successful regular build used unchanged source/config. First failure log is `/tmp/group-progress-5-7-build-initial.log`.
- Optimized WebKit over plain HTTP remains the previously diagnosed Secure-cookie harness limitation; do not weaken production cookies. WebKit development/mobile acceptance and geometry/presentation passed. Those automated runs did not exercise HTTPS/providers or physical devices; the subsequent founder iPhone acceptance is recorded below.
- Existing NO_COLOR/FORCE_COLOR and the single unchanged image lint warning are recorded, not hidden. No unexplained application failure remains. Performance-capacity microbenchmarks and real-provider checks were not newly commissioned; no new throughput/participant-readiness claim is made.

## Consolidated architecture inventory (existing Phase 5, unchanged by 5.7)

The central `frameworks/scope.ts` and explicit progress-state contracts feed `groupExperiences/progressContext.ts`; Group, active cohort and individual summaries share the same selected-Card/version scope. Personal lifetime eligibility remains a distinct owner computation with maximum legitimately adopted version and retained assignment references. It never widens Group Progress or grants historical working navigation.

Existing Phase 5 contracts/routes consumed by the acceptance tests:

- Normal `/progress` is My Progress; `/group-experiences/:experienceId/progress` fixes one authorised Group. Every current Group member can enter Progress from the Deck menu; Group settings remains Admin-only. Existing current-follower-first defaults include dual roles.
- `GET /api/group-experiences/:experienceId/progress-navigation` and `GET /:experienceId/frameworks/:frameworkId/destinations`: current metadata/capabilities, bounded roster, scoped named destinations and safe return context.
- `GET /:experienceId/frameworks/:frameworkId/summary`: hierarchy/coverage, explicit observation states, Group-owned or individual metrics, raw-weighted follower aggregates and compact assessment summaries. Non-Admins never receive confidence extrema. Framework Area unions deduplicate Cards.
- `GET /:experienceId/frameworks/:frameworkId/{cards/:cardTemplateId|items/:frameworkItemId}/history`: lazy scoped histories for the selected Group/personal owner, legitimate live personal lineage and safe origin labels. Foreign history uses allowlisted database projections, never full personal CardData.
- `GET/POST /:experienceId/cards/:cardTemplateId/personal-tests` and `PATCH/DELETE .../personal-tests/:testId`: authenticated current follower writes their existing personal Card list, materialising a legitimate never-opened row only where needed, without personal Deck membership/date creation.
- `GET/POST /:experienceId/frameworks/:frameworkId/items/:frameworkItemId/personal-tests` and `PATCH/DELETE .../personal-tests/:testId`: scoped direct personal Item lists in the existing user storage. Origin remains the actual initial entry context; foreign inspection never grants mutation.
- `GET/POST /:experienceId/cards/:cardTemplateId/tests`, `PATCH/DELETE .../tests/:testId` and `GET .../assessment-history`: Group-owned Card lists, current-member reads/current-Admin writes, with exact retained-source management but no out-of-scope Add.
- `GET/POST /:experienceId/items/:frameworkItemId/tests`, `PATCH/DELETE .../tests/:testId` and `GET .../history`: corresponding Group-owned direct Item lists. These never merge with personal ownership. Both Group score/average modes continue to show Group-owned Tests.

Path abbreviations above remain under `/api/group-experiences`. Ordinary personal assessment/history endpoints remain owner-only and source-aware. The complete prior changed-file inventories remain in the foundations, 5.4 and 5.5–5.6 handoffs; this checkpoint does not reimplement those routes.

### Storage, indexes and operations

No 5.7 schema, API, collection, index or provider change is planned. Existing personal Card/direct Item test arrays and their revisions remain in `users`; Group Card tests stay in `groupCardState.tests/testsRevision`, direct Item tests in `groupExperiences.itemTests/itemTestsRevision` with retained exact-source IDs. Optional provenance records actual authenticated entry actor/method/origin plus immutable server `createdAt`; legacy unknowns remain unknown. Safe foreign responses disclose Personal/authorised Group name/Other group/Unknown, never inaccessible origin IDs.

Personal lifetime references remain on the user and Group member records. Existing Group/member/Card/receipt/removal identity indexes and the MongoDB replica-set transaction infrastructure are prerequisites. `createGroupExperienceIndexes` is explicit/idempotent; request paths assert readiness and do not create indexes. Test index installation is not a claim of production provisioning. No `groupCardData` rename, media/reflection rows, migration or source backfill is part of 5.7.

### Release boundaries and rollback

Current automatic enrolment grants inspection under the existing policy; Organisation/adultLeader/acceptance/safeguarding changes remain explicitly deferred, not silently solved by this checkpoint. Small-cohort aggregate inference, the established maximum-version evidence limits and the absence of historical working navigation remain documented limitations. Production flags, provider protection/verification, live index operations and deployment need separate authority. Phase 5 acceptance is not participant rollout approval.

Rollback may disable Group entry while retaining personal data, Group test lists, selections/retention, revisions and access-denial infrastructure. Do not delete learning or contribution/history records to roll back UI, or use an older build that ignores the relevant ownership/projection rules. Phases 6 onward, multiple Decks, Info sharing, media protection/gallery, reflection UX and naming cleanup remain unimplemented and outside this checkpoint.


## Physical iPhone acceptance / review access

The founder completed and explicitly accepted the final physical iPhone review on 2 November 2026. The §9.7 gate is satisfied, covering Group and individual Progress, assessment histories and improved realistic fixtures, Item and Area strikethrough, navigation, popovers and visual presentation. No further visual approval or manual calculation/security/persistence repetition is required.

A source snapshot with the authorised fixture/Area-title/CSS follow-ups is running independently at `/private/tmp/switchplay-phase5-7-phone-_bo23sqi`, using the existing disposable memory Mongo harness and mocked media. Existing ports/services were preserved (4185 was occupied; new review uses 4186). Exact URL/roles are verified separately in the ignored runtime record `phase2-test-results/group-progress-5-7-review-current.json`.

Review URL:

```text
http://192.168.1.38:4186/group-experiences/f3416601-5bdd-45c5-a5a2-018cf0482690/progress?framework=galway-progress-review
```

Credentials: Admin `phase2 / local-test-only`; Aoife follower `phase2-1@example.invalid / local-test-only`.

The completed physical acceptance covered these approved visuals/touch qualities: sticky selector/four-column readability and arrows; Group scores/Player averages popover placement; Recorded in/date-origin readability; outside Item strikethrough/faint dashes versus skip; Back continuity into the Group Deck. Arithmetic, ownership, persistence, auth, retries and revocation are already automated. Do not add UX or ask for manual calculation/security verification.

Start/restart and stop:

```sh
cd /private/tmp/switchplay-phase5-7-phone-_bo23sqi
SWITCHPLAY_REVIEW_PORT=4186 node --import tsx scripts/test-phase2.ts --dev --lan --group-progress-live
# Stop only this new runner (or Ctrl+C in its terminal):
kill -TERM 10608
```

Restart creates fresh IDs; use the newly printed/verified URL, not the old UUID. No production database/provider configuration or real participant data is used.

## Checkpoint changed-file inventory and commit boundary

- `tests/phase2/group-progress-acceptance.browser.ts` — four new integrated browser acceptance cases.
- `docs/engineering/features/group-experience/group-experience-phase-5-7-handoff.md` — consolidated current evidence, inventory, limitations and continuation.
- `docs/engineering/features/group-experience/group-experience-engineering-plan.md` — narrowly update current 5.7 verification/acceptance status; preserve approved requirements and all future phase boundaries.

Earlier exact implementation inventories remain in [foundations](group-experience-phase-5-foundations-handoff.md), [5.4](group-experience-phase-5-4-handoff.md) and [5.5–5.6](group-experience-phase-5-5-6-handoff.md). Committed sources are independently auditable with `git diff-tree --no-commit-id --name-only -r <hash>`: 26e43ed (5.1a), 80a6227 (5.1b), 51d7b1b (5.2a), 9da4ca2 (5.2b), 0add243 (5.3), 313b86a (5.4), 76064aa (5.5), 974175f (5.6), 8433169 (review refinements). This commission does not amend/recombine those records or include unrelated changes.

## QUESTIONS

None. The founder accepted the final iPhone review and authorised Phase 5.7 finalisation. Remaining operational limitations below do not block Phase 5 completion and do not grant Phase 6, naming-cleanup or rollout authority.

## Follow-up — populated assessment fixtures and Area title treatment (verified and founder accepted)

Founder-authorised fixture amendment: live disposable assessments now use a believable September/October schedule, unequal player activity, Card and direct Item histories, predominantly Galway U18 provenance, Personal origins, and a small explicit legacy/cross-Group sample. The originating second Group has the realistic long name `Galway U14 Regional Basketball Development Squad`; `Other group` remains an existing privacy-redaction label, never a seeded Group name. The original 5.0 static fixture and learning calculations remain unchanged.

The additional founder request applies the existing `progress-outside-title` class to an Area title only when it has Items and every Item is explicitly outside scope. Mixed/in-scope and personal Areas remain unchanged. No assessment calculation, permission, storage or provenance-display application defect was found.

Changed for this follow-up: `tests/helpers/groupProgressLiveReview.ts`, `tests/phase2/group-progress-live.browser.ts`, `tests/phase2/group-progress-review.browser.ts`, `src/components/progress/FrameworkProgressTable.tsx`, and this handoff. The already-approved full-opacity strikethrough colour in `progress.module.css` is preserved, and its stale browser expectation is updated to the approved value.

Verification: seven focused unit tests passed; 29 disposable integration tests passed; TypeScript and focused lint passed. Integration cleanup warned that a Mongo child needed SIGKILL after its SIGINT timeout; all assertions passed. The 18-case Chromium/WebKit run passed 17 and exposed the test navigation race detailed below. All six affected-file cases passed on the final rerun. An earlier run was stopped after the founder changed the fixture naming request; do not count it as a completed run.

Review environment: only the owned port 4186 runner was restarted. Its reused generated Next cache served history 404s after reseeding, so the old cache was moved to `/private/tmp/switchplay-phase5-7-stale-next-20261102` and a clean rebuild in the same snapshot restored successful history reads. The final focused browser rerun passed. These changes are committed in `71428cc`; final physical acceptance is now complete.

Clean-cache LAN verification succeeded with actual loaded histories (not just the modal shell). Current review URL, superseding earlier generated IDs:

```text
http://192.168.1.38:4186/group-experiences/f3416601-5bdd-45c5-a5a2-018cf0482690/progress?framework=galway-progress-review
```

Runner PID 10608, app PID 11214, snapshot unchanged. Player: `phase2-1@example.invalid / local-test-only` (Aoife Kelly); Admin: `phase2 / local-test-only`. On `Movement: foundation`, Aoife has two direct Progress and six Card assessments: three Personal, three Galway U18, one Other group and one legacy Unknown. Group-owned history contains three direct Progress and four Card assessments: six Galway U18 and one explicitly legacy Unknown. Group and player lists are separate. `Movement: control` and `Passing: foundation` provide additional differently populated histories; some other Items have none.

The 18-case browser run passed 17 and exposed an existing WebKit logout test navigation race: the test started its next login/navigation before logout's router refresh completed. The review test now additionally asserts the account menu disappears after logout, before the next iteration. The focused six-case review rerun passed (`/tmp/fixture-browser-review-final.log`); no application logout change. Final TypeScript, focused lint and `git diff --check` passed. The verified changes were subsequently committed in `71428cc` and the founder accepted the final iPhone review. Do not begin another phase.

Exact follow-up checks:

- `node --import tsx --test tests/group-progress-preview.test.ts tests/assessment-provenance.test.ts` — 7 passed.
- `node --import tsx --test --test-concurrency=1 tests/group-framework-progress.integration.ts tests/group-assessments.integration.ts` — 29 passed.
- `node --import tsx scripts/test-phase2.ts --group-progress-live group-progress-live.browser.ts group-progress-review.browser.ts group-progress-acceptance.browser.ts` — 17 passed, 1 WebKit test navigation race; all 12 live/acceptance cases passed.
- `node --import tsx scripts/test-phase2.ts --group-progress-live group-progress-review.browser.ts` after the logout-completion test assertion — 6 passed, covering the failed case and every other affected-file case.
- `npx tsc --noEmit --incremental false`; `npx eslint --max-warnings 0 tests/helpers/groupProgressLiveReview.ts tests/phase2/group-progress-live.browser.ts tests/phase2/group-progress-review.browser.ts src/components/progress/FrameworkProgressTable.tsx`; `git diff --check` — passed.
- An iPhone-sized Chromium LAN probe loaded the real history rows for both logins on the refreshed URL. Logs: `/tmp/fixture-lan-check-final.log`, `/tmp/fixture-unit.log`, `/tmp/fixture-integration.log`, `/tmp/fixture-typecheck-final.log`, `/tmp/fixture-lint-final.log`.

## Finalisation verification and remaining limitations

- Reviewed the clean working tree, current commit contents and previous verification records. All approved source, fixture, styling, architecture and menu-label changes were already committed; none were discarded, restaged or duplicated.
- Finalisation changes only this handoff and the engineering plan to record successful founder acceptance, Phase 5 completion and the accepted wholly out-of-scope Area treatment.
- No implementation changed after the successful checks above, so no test suite/build repetition was necessary. Final documentation checks: inspect the exact diff, check for obsolete acceptance blockers and run `git diff --check` before commit.
- No unresolved Phase 5 acceptance issue remains. Known limitations remain: optimized WebKit over insecure HTTP needs an appropriate secure-cookie harness; existing lint/environment and Mongo cleanup warnings are recorded; membership-trust/safeguarding, production index/provider verification and deployment remain separately gated. Phase 5 completion does not approve participant rollout.
- No Phase 6, media/reflection implementation, schema/database/infrastructure change or collection rename was performed during finalisation.
