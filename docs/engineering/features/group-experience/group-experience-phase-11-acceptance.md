# Phase 11 — Integrated acceptance excluding Info Cards

> **Historical configuration superseded, 5 November 2026:** `SWITCHPLAY_GROUP_EXPERIENCES_ENABLED` and `GROUP_MEDIA_PRIVATE_PROVIDER_VERIFIED` have been removed. Any disabled-feature behaviour, environment assignments or certification requirements below record the earlier implementation, not current setup instructions. Group functionality uses normal permissions; provider tests are verification rather than a runtime certificate. Bucket/delivery configuration is unchanged. The18 Group indexes must exist before deploying the flag-free build against Atlas. See the [current gate-removal handoff](group-experience-gate-removal-handoff.md).

**Status — 5 November 2026:** automated non-Info acceptance and targeted fixes are complete. Physical iPhone acceptance is pending. All Phase11 changes remain uncommitted on `feat/group-experience`; baseline `9a7eb86`. No deployment, live-provider operation, persistent-database migration or Info Card work was performed.

## A. Coverage

| Journey | Executed coverage |
| --- | --- |
| Creation and shared administration | Create from an eligible published Library Deck through Add as Group; Admin-only phase2 and Alice; Follower-only Aoife and Bob; defaults, settings rename, peer policy, role removal, denied former access, follower removal/rejoin and retained values. Two Admins use the same Group and collective reflection. |
| Perspectives and privacy | Group/self/authorised inspection, remembered Card and face, comparison grid/scroll/vertical traversal, read-only foreign learning, removed/revoked subjects, late foreign responses and fail-closed access leases. Backend tests also cover dual roles, former-member snapshots and legitimate retained assignments. |
| Learning, confidence and dates | Independent Group/personal values, raw follower aggregates, skipped/unstarted/invalid states, date privacy on both faces, permission-specific signal tooltips, touch/mouse interception and normal flipping outside signals. Delayed first and subsequent confidence writes retain owner thumbnails and Card layout. |
| Progress and assessment histories | Real Framework/Area/Item table, Group/self/foreign views, scope and safe origin labels, Group versus personal assessment storage, lost-response reconciliation, revisions, all-skipped states, current permissions and stale-history rejection. Mobile and desktop coverage uses the existing live Progress fixture. |
| Media | Real mock-provider upload/attachment, filenames and By/In metadata, exact sources and Gallery selection, bounded older pages, Media Centre metadata rails, equal eye/eye-off tracks, owner deletion, Admin visibility-only removal, foreign/private exclusions, post-leave owner access and context changes. Switching accounts/reloading preserves the same contribution identity and hidden state. |
| Reflections | Personal/current-Group-only previews with Add/Save/Delete and retained all-origin history; shared collective note, second Admin conflict and subsequent safe edit; read-only follower; attributed visible-member carousel, manual wrap, no timer or moderation control; fixed geometry, three-line truncation, touch and delayed-response isolation. |
| Published updates | Real Creator publication adds a Card between two existing Cards. Publisher is not a Group member; Alice administers a Group she did not author. Group remains on its adopted version until explicit review/Update. Follower Group view and Admin individual view receive no control. Cancel, committed-but-lost response and exact retry, retained selected Card, reload/account changes, new defaults and both original Cards are checked. Separate Card-level Update is also adopted without changing Personal pointers. |

These journeys join real application handlers, disposable MongoDB and mocked media providers. The new integrated browser tests use fresh Deck/Card/Group IDs, not resets of the founder review Group. Existing regression suites provide narrower concurrency, privacy, delivery and corrupt-data coverage rather than duplicating those tests in every journey.

## B. Results and actual commands

All selected functional cases have a successful run after the fixes below. This is **not** a claim that the initial combined browser invocation passed unchanged: it had53 passes and4 failures; the causes and successful follow-ups are recorded below. No failing assertion or privacy requirement was weakened.

| Check | Actual result / local log |
| --- | --- |
| Focused unit/controller selection below | **73/73 passed**, `/tmp/phase11-unit.log`. |
| Final client/settings selection, including3 new refresh-race cases | **16/16 passed**, `/tmp/phase11-refresh-race-unit.log`; overlaps the earlier selection. |
| Disposable MongoDB integration selection below | **141/141 passed**, zero failed/skipped, `/tmp/phase11-integration.log`. |
| Explicit repeatable index provisioning and missing-index denial | **1/1 passed**, `/tmp/phase11-indexes.log`; fresh disposable MongoDB. |
| Combined Group/media/reflection/motion browser selection | Initial **53/57 passed**; after affected reruns, all **56 functional cases** have passed across Chromium/WebKit. The remaining case is the separately executed optimized performance benchmark. `/tmp/phase11-browser-full.log`. |
| Media geometry follow-up | **2/2 passed**, `/tmp/phase11-media-followup.log`. |
| Final integrated club and publication journeys | **4/4 passed** in Chromium/WebKit, `/tmp/phase11-browser-final-journeys.log`. |
| Stronger publication journey, recording different data on both original Cards and adopting a Card update | **2/2 passed**, `/tmp/phase11-all-cards-update.log`. |
| Optimized native comparison benchmark | **1/1 passed**,50 trusted interactions after5 warmups; **64ms p95** next paint against100ms limit. `/tmp/phase11-optimized-final.log`. |
| Existing Gallery/media collection/iPhone download-share simulations | **44/44 passed**, Chromium/WebKit, `/tmp/phase11-media-viewer.log`. |
| Live scoped Progress/history acceptance | **12/12 passed**, Chromium/WebKit with mobile/desktop cases, `/tmp/phase11-progress-browser.log`. |
| Final TypeScript | **Passed**, `/tmp/phase11-types.log`. |
| Targeted ESLint | **Passed**, `/tmp/phase11-lint.log`. |
| Synchronized isolated production Webpack build | **Passed**, compile, Next TypeScript,48 static pages and build traces; `/tmp/phase11-production-build.log`. No database credentials copied. |
| Actual LAN mobile WebKit probe | **Passed**, `/tmp/phase11-phone-verification.log`; Admin review/Cancel, follower exclusion and read-only collective note, publisher403, preserved original Group. Pending Deck update was not accepted. |

Unit/controller command:

```sh
node --import tsx --test --test-concurrency=1 \
  tests/group-experience.test.ts tests/group-experience-client.test.ts \
  tests/group-experience-perspectives.test.ts tests/group-management-client.test.ts \
  tests/group-framework-metrics.test.ts tests/group-progress-navigation.test.ts \
  tests/group-assessment-client.test.ts tests/group-personal-assessment-client.test.ts \
  tests/media-collection-client.test.ts tests/media-collection-operations.test.ts \
  tests/media-collection-delivery.test.ts tests/media-centre-metadata.test.ts \
  tests/reflection-presentation.test.ts tests/group-media-providers.test.ts \
  tests/group-media-routes.test.ts
node --import tsx --test tests/group-experience-client.test.ts tests/group-management-client.test.ts
```

MongoDB command (each fixture owns its disposable database):

```sh
node --import tsx --test --test-concurrency=1 --test-skip-pattern='[Ii]nfo' \
  tests/group-experience-management.integration.ts \
  tests/group-experience-lifecycle.integration.ts \
  tests/group-experience-perspectives.integration.ts \
  tests/group-experience-api.integration.ts \
  tests/group-framework-progress.integration.ts \
  tests/group-assessments.integration.ts \
  tests/group-personal-assessments.integration.ts \
  tests/group-media.integration.ts tests/media-collection.integration.ts \
  tests/group-reflections.integration.ts tests/group-experience-capacity.integration.ts
node --import tsx --test --test-name-pattern='index provisioning' tests/group-experience.integration.ts
```

Browser commands:

```sh
PHASE11_REVIEW_INFO=/private/tmp/switchplay-phase10-test/phase2-test-results/review-server.json \
  npx playwright test --config playwright.phase11.config.ts
# Same command with each focused follow-up:
# --grep 'own Group history'
# --grep 'club journey|published Deck adds'
# --grep 'published Deck adds'

npx playwright test --config playwright.media-collection.config.ts \
  media-viewer.browser.ts media-collection.browser.ts ios-video-download.browser.ts

# Executed in the owned, synchronized /private/tmp/switchplay-phase11-optimized export:
node --import tsx scripts/test-phase2.ts --group-experiences --optimized \
  group-experience-motion.browser.ts --grep '50 loaded comparisons' --reporter=line
node --import tsx scripts/test-phase2.ts --group-progress-live \
  group-progress-live.browser.ts group-progress-acceptance.browser.ts --reporter=line
```

Final static/build commands:

```sh
npx tsc --noEmit
npx eslint src/components/group-experiences/GroupUpdateControls.tsx \
  src/components/group-experiences/GroupExperienceDeck.tsx \
  src/components/group-experiences/groupResource.ts \
  src/components/group-experiences/groupManagementClient.ts \
  tests/group-experience-client.test.ts \
  tests/phase2/group-integrated-acceptance.browser.ts \
  tests/phase2/media-ux.browser.ts playwright.phase11.config.ts
# In synchronized /private/tmp/switchplay-phase10-build, with no copied .env files:
MONGODB_URI='' MONGODB_DB='' node node_modules/next/dist/bin/next build --webpack
git diff --check
```

The optimized export's default Turbopack build initially refused its external node_modules symlink. Its temporary harness copy was pointed at the existing Webpack build; the root harness/configuration was not changed. The initial192ms dev-server performance result is not an optimized acceptance result. The unchanged native benchmark subsequently passed at64ms. The broad browser configuration now leaves that benchmark to the optimized runner rather than measuring development JSX.

The media layout assertion originally sampled during the existing680ms Card flip; it now polls the same non-overlap condition after the flip. The new creation journey now waits for the existing createdGroup redirect before navigating. These are test timing corrections, not application geometry/gesture changes. Some disposable Mongo shutdowns required their own child-process kill fallback; tests passed and no unrelated service was stopped.

Local capacity evidence:20 followers,3 Admins,12 Cards;100 summary reads after5 warmups, **55.76ms p95** against300ms;200 scalar writes, **192.54ms p95** against500ms; summary8,053bytes, combined bootstrap95,940bytes, active-Card batch7,963bytes. All transactions committed on their first attempt in this run. Existing indexed roster query-plan and bounded paging assertions passed. These are local disposable measurements, not same-region staging or iPhone-network measurements. Index installation/required-index protections use existing disposable fixtures; no live index changes were performed.

## C. Confirmed defects and narrow fixes

1. **Group Update controls were missing.** Existing Group review/adopt APIs implemented versioning, authority and retries, but the Group scene did not wire the approved controls. `GroupUpdateControls.tsx` now reuses the existing UpdateButton and dialog, queries only Group endpoints and displays controls only for a verified current Admin in Group perspective. It uses captured reviewed commands, pending-work waits/locks and the same operation ID on ambiguous retries. Both Deck and Card adoption revalidate the Group; no automatic publication adoption or Personal pointer mutation. The pre-fix new-Card test failed at the missing control; both browser engines now pass the complete workflow.
2. **A committed settings/adoption change could falsely appear unfinished.** A poll started before the successful write could own the coalesced resource load, so its older structure revision could not verify the acknowledged save. `groupResource.revalidate(minimumStructureRevision)` now finishes that load and makes at most one fresh read if needed. Both settings and adoption require at least the committed revision. Three deterministic controller cases cover a stale initial authority read, stale final read and true revocation; revoked authority still purges data and returns failure. The management result type exposes its already-returned structureRevision; no backend/schema change was needed.

Published update preservation is asserted on **both original Cards**: distinct personal/Group progress and confidence, member and collective notes, media sources/records, target dates and capabilities. A middle insertion retains the remembered Card identity. The new Card starts todo, null confidence, empty notes and no media. Group confidence remains based on existing valid readings; completion can decrease because the eligible Step denominator grows. A later Card update preserves Step values and leaves the Personal Deck/Card adoption versions unchanged.

## D. Remaining concerns and boundaries

- **Acceptance pending:** founder physical iPhone/Safari review of these integrated results and the newly wired Update flow. No commit or completion approval is claimed yet.
- **Existing release prerequisite, separately authorised:** real-provider CORS, protected image-origin/unsigned-video denial and authorised delivery checks remain outside mocked automation. No Cloudflare/Atlas operation, provider configuration change or rollout occurred. Existing Organisation/enrolment/safeguarding suitability gates are unchanged; this report does not certify real-participant enablement.
- **Native device limit:** the verified LAN HTTP origin is not a secure context; navigator.share is unavailable there in WebKit. Download/share policy and fallbacks passed browser simulations, but this environment cannot certify the native iOS share sheet. No HTTPS infrastructure was introduced.
- No known unresolved application failure remains in the executed non-Info selection. The entire repository suite was not run; targeted selections cover the changed Group scene/resource plus relevant learning, Progress, assessment, media and reflection dependencies.
- Info feature suites, UI and branch merge are excluded. Standard TypeScript/build still compile existing application modules; existing Group privacy/purpose-denial assertions are retained, not Info functionality acceptance.
- Reflection moderation UI, former-member reflection deletion UI, new roles/permissions and other deferred features remain backlogged. No new product decision is needed for the fixes above.

## E. Change inventory and preservation

| File | Purpose |
| --- | --- |
| `src/components/group-experiences/GroupUpdateControls.tsx` (new) | Approved Group-only discovery/review/adoption and exact retry UI using existing components/contracts. |
| `src/components/group-experiences/GroupExperienceDeck.tsx` | Wire Deck/Card controls and modal gesture lock; acknowledge settings/adoption through version-aware revalidation. |
| `src/components/group-experiences/groupResource.ts` | Bounded revision-aware refresh after a committed structural operation. |
| `src/components/group-experiences/groupManagementClient.ts` | Type the existing response structure revision. |
| `tests/group-experience-client.test.ts` | Three deterministic refresh/revocation regressions and coherent fixture revisions. |
| `tests/phase2/group-integrated-acceptance.browser.ts` (new) | Complete cross-account club journey and real published Deck/Card adoption/preservation journey. |
| `tests/phase2/media-ux.browser.ts` | Wait for settled flip geometry before the existing non-overlap assertion. |
| `playwright.phase11.config.ts` (new) | Explicit non-Info allowlist, disposable fixture guard, both mobile engines; native benchmark remains separate. |
| `docs/engineering/features/group-experience/group-experience-engineering-plan.md` | Record the non-Info commission and explicit Admin-only Group Update acceptance. |
| This report (new) | Coverage, actual results, defects, gates and review instructions. |

No models, collections, migration, server permission rules, media/reflection components, CSS geometry or provider configuration were changed. The working tree was clean at baseline; all changes above remain unstaged/uncommitted. Existing source commits and unrelated services/worktrees were preserved.

## F. Physical iPhone review

Actual LAN WebKit verification passed against the existing4192 service. Its source has the final four application files; the runner was **not restarted or reseeded**. Database: `switchplay_phase2_browser_404983fca4334e22bd021f102ba536fe`, a disposable in-memory review database. Existing founder actions remain; login/reload does not rebuild fixtures. Added publication-review data uses new IDs only. Metadata `/private/tmp/switchplay-phase10-review/phase2-test-results/phase11-update-review.json`; its setup returns existing metadata rather than recreating records. Service lifetime is the existing runner's lifetime; stopping it discards its in-memory database.

**Update review URL — plain text:**

```text
http://192.168.1.38:4192/decks?openExperience=7bff578a-aeca-4e75-8737-235dcdf33119
```

Group **Galway U18 movement**, Deck **Basketball movement**. **Alice and Bob are Admins, neither a follower in this Group. Aoife Kelly and Carla are followers, neither an Admin here. phase2 published the source Deck but is not a member of this Group.** In the older Galway U18 review Group, Alice/Bob have their original fixture roles; roles are Group-specific. All passwords: `local-test-only`.

1. Sign in as Alice. The review Group still has two Cards and offers Update on its Group Deck view. Open review and Cancel: no composition change. The first Card already has Group/member notes, progress/confidence and a mocked image; Aoife also has a Personal target date.
2. As Alice, open Update again and accept. **Control the landing** should become Card2 between **Find your balance** and **Finish the pass**. The new Card starts unstarted with no confidence/reflection/media. The existing first Card keeps its saved data. Reload and switch accounts; do not recreate the Group.
3. Sign in as Aoife Kelly. Her default individual view has no Update. Select Group: still no Update; collective reflection is read-only. Her current-Group note opens her editor in her own perspective. As Bob, the same collective note opens for editing; both Admins share it.
4. For the populated eight-media, signal, perspective and existing reflection scenarios, use the original URL below. phase2 is Admin-only and Aoife Kelly is Follower-only there. Test a first unset signal drag, read-only signal swipe, normal outside flip, media count and eye indicators, thumbnail Gallery and Media Centre. Hide one Aoife upload as phase2 and then switch to Aoife: the same item remains in her history with eye-off. Actions persist, so do not expect earlier removals to reset.

**Original review URL — unchanged:**

```text
http://192.168.1.38:4192/decks?openExperience=7facd9be-07ea-4159-ab6a-0d3429773aba
```

Mobile WebKit screenshots, inspected at390×844: `/private/tmp/phase11-review-update-admin-webkit.png`, `/private/tmp/phase11-review-update-dialog-webkit.png`, `/private/tmp/phase11-review-notes-webkit.png`. The LAN probe confirmed v1/two Cards before and after Cancel, follower exclusion, read-only collective note, original Galway U18 still accessible and the publisher denied Group access. It did not confirm adoption in this founder fixture; that is intentionally left available for physical review. Adoption itself already passed on independent automated fixtures.

**12px adjustment point:** `src/components/reflections/reflections.css:23`, selector `.reflection-member-area`, `--reflection-member-offset: 12px`; applied by `bottom: calc(62px + var(--reflection-member-offset))`. Change only12px to8px/16px to move the complete member area. Width130px, right160px (38px corner+102px collective+20px gap), collective width102px/right alignment and its original bottom62px remain unchanged.

## G. Completion recommendation

The implemented non-Info functionality passes the executed integrated checks and is ready for **founder iPhone acceptance**. It is not yet certified for real participant rollout: obtain physical acceptance and complete the existing separately authorised provider/release gates. Do not commit before that acceptance, merge the Info branch, begin another phase, change persistent data or deploy automatically.

On resumption, inspect Git status and this report first. There is no unfinished automated fix or known test failure to redo; next action is the founder review, followed by any specifically approved correction/commit.

<details>
<summary>Historical continuation notes — superseded by the consolidated results above</summary>

## Continuation record

Baseline: `9a7eb86` on `feat/group-experience`, initially clean working tree. Founder authorises non-Info integrated acceptance and targeted defect fixes, with no commit until physical iPhone acceptance. Personal/Group Info Cards and their pending branch are explicitly excluded. No Info implementation, merge or feature tests. Standard repository TypeScript/build still compile the existing application.

Checkpoint 1: specification/handoff/code coverage audit complete. Existing tests cover isolated role/management races, learning projection/aggregation, media ownership/revocation, Progress privacy and Phase10 reflection contracts. Missing continuous browser coverage will connect those behaviors on newly created disposable Groups with separate Admin-only and Follower-only accounts and a second Admin.

Checkpoint 2: focused unit/controller and disposable MongoDB selections are being executed. Results below must reflect actual runs, not inherited handoff passes. No production Atlas/provider access is authorised or needed.

Checkpoint 3: integrated browser journeys plus existing media/reflection mobile Chromium/WebKit regressions; inspect/fix failures without redesign. Tests use the separate automated-test export on4191. Preserve the existing4192 phone runner, its database/IDs and prior actions; no reseeding on login or reload.

Checkpoint 4: final type/lint/isolated production build, coverage/defect/readiness report and manual iPhone journeys. No deployment or commit. Real-provider and physical device verification remain distinct from mocked automation.

## Current boundaries and known release gates

- Latest reflection UI: individual current-context-only notes; collective102px right-aligned note plus130px left-aligned member note,20px gap and12px upward shift; manual member tap/wrap, no Remove/icons/timer. Existing server ownership/moderation permissions are preserved; moderation UI and former-member reflection-deletion UI remain backlogged.
- Offset adjustment: `src/components/reflections/reflections.css`, `.reflection-member-area`, `--reflection-member-offset: 12px` (line23). Change that value alone to8px/16px.
- Existing phone service: `http://192.168.1.38:4192/decks?openExperience=7facd9be-07ea-4159-ab6a-0d3429773aba`, Aoife Kelly or phase2 / `local-test-only`; Follower-only and Admin-only respectively. Verify LAN before final handoff.
- Engineering plan still requires separately authorised real-provider protection/CORS/signed-video verification and physical native download/share acceptance before participant uploads. No live Cloudflare or persistent database operation is performed here. Existing enrolment/Organisation trust limitations are recorded, not silently changed.

## Results

Checkpoint2 results: **73/73 unit/controller tests passed** (`/tmp/phase11-unit.log`); **141/141 disposable MongoDB integration tests passed** (`/tmp/phase11-integration.log`,654.9s), including roles/management/lifecycle, Group API/privacy, scoped Framework progress/assessments, media ownership/pagination/reflections and capacity. Exact file selection is preserved in the final command appendix when complete. No Info feature suites ran. The Group media suite retains its existing purpose-isolation assertions; no Info UI, authoring or integration workflow was exercised.

Checkpoint3 in progress: new `playwright.phase11.config.ts` is an explicit allowlist for non-Info Group acceptance, media and reflection tests on isolated4191. New `group-integrated-acceptance.browser.ts` creates its own published Decks/Groups and uses phase2 (Admin-only), Aoife (Follower-only), Alice (second Admin-only) and Bob (additional follower). Existing4192 review records remain untouched.

Confirmed implementation gap: §12.2 requires Group Card/Deck Update discovery, review and explicit adoption for current Admins in Group perspective. The backend review/adopt API already implements the approved version/permission/concurrency semantics, but `GroupExperienceDeck` never wires an Update affordance. New narrow `GroupUpdateControls` reuses the existing UpdateButton, native application dialog and Group transport; no automatic adoption, Personal update endpoint or versioning redesign. Its focused new-Card regression also checks an Admin who is not the original Deck creator, Cancel, follower/individual-perspective exclusion and preservation of existing learning/media/reflections/dates.

Early new-browser failures were test publisher setup: a Deck cannot prepare publication while Cards remain unpublished. The helper now publishes its new Card drafts before preparing the Deck publication; no application policy was weakened. Browser execution/defect verification remains pending. Next: finish Update control regression/fixes, run both-engine integrated + existing media/reflection selections, then final type/lint/build and actual phone-server review. Do not commit.

Checkpoint3 progress: both new Chromium journeys passed on the first corrected application run (`/tmp/phase11-browser-fix.log`,2/2,2.5m). The pre-fix added-Card test explicitly failed because Update was absent. The first combined journey initially tried to open the Deck menu through an active focused-Card scrim; the test now closes Focused Card first, preserving the accepted interaction rather than changing it. The final update test also exercises a dropped response after the real adoption commit, exact-command Retry, active-Card preservation when inserting into the middle, and the legitimate Deck percentage denominator change. These final additions and WebKit remain to be rerun.

Local capacity evidence from the newly executed repository suite:20 followers/3 Admins/12 Cards,100 warmed summary reads; p95 summary55.76ms,200 scalar writes p95 192.54ms, zero retries in this run; summary8,053bytes, combined bootstrap95,940bytes, active-Card batch7,963bytes. This is local disposable MongoDB evidence, not a same-region staging or device/network measurement.

Performance harness correction: the initial combined run included the existing native Event Timing budget in a development server and measured192ms p95. The Phase4 accepted measurement explicitly requires the optimized localhost fixture, not development JSX. Functional motion checks remain in the both-engine selection; the unchanged50-switch/100ms benchmark is rerun separately using the existing optimized harness. This is a test-environment mismatch, not evidence yet of an application regression; no performance threshold is weakened and no speculative refactor/cache is added.

Broad browser selection is still running (`/tmp/phase11-browser-full.log`, exec session93455):57 initial cases. Chromium full published-Deck journey passed including Cancel, lost-response/exact Retry, non-creator Admin, middle insertion/remembered Card, all preserved records and expected Deck denominator change. Initial failures under investigation/corrected in tests only: media geometry asserted during the existing680ms flip (`expect.poll` now waits for the same settled non-overlap condition); WebKit started navigation immediately after the creation HTTP response, racing the app's required `createdGroup` redirect (now explicitly awaited). These affected cases will be rerun after the broad selection; no Card layout/navigation rules are changed for either harness issue.

Next operations: complete broad browser results; rerun failed affected cases; run native comparison budget with existing `scripts/test-phase2.ts --group-experiences --optimized group-experience-motion.browser.ts --grep '50 loaded comparisons' --reporter=line` in the owned `/private/tmp/switchplay-phase11-optimized` export, port4194 (no Info flags, loopback-only, own temporary replica set/processes). Root source remains authoritative; synchronize final app files before invoking. Then generic media viewer/download/zoom mocks, final type/lint/isolated build, source-only update of4192, and an additional explicitly seeded-once disposable Deck-update review Group without resetting any existing4192 records. Do not commit or touch providers/persistent DBs.

Checkpoint3 follow-up: initial broad57-case run had53 passes and4 failures (development-only paint benchmark, two unsettled-media-geometry assertions, and the WebKit create/redirect race). Both media follow-ups now pass (`/tmp/phase11-media-followup.log`,2/2) with the exact same no-overlap assertion polled after the existing flip. WebKit follow-up then reached settings Save and exposed a **real client refresh race**: HTTP management commit200 succeeded, but `resource.load()` coalesced a poll started before that commit and falsely showed “Saved, but the view could not refresh”.

Targeted second defect fix: `groupResource.revalidate(minimumStructureRevision)` finishes any pre-existing load, then makes one bounded fresh read if it did not verify at least the committed revision. Settings and Group Update acknowledgements use it. Current identity/role/adoption checks and fail-closed behavior remain; no server data/permission changes. `ManagementResult` now types its already-returned structure revision. Three deterministic controller cases cover the stale first authority read, the stale final authority read and actual revocation; together with existing client/settings tests16/16 passed (`/tmp/phase11-refresh-race-unit.log`). Four final Chromium/WebKit cross-feature/Deck-update journeys are running (`/tmp/phase11-browser-final-journeys.log`, session41484); Chromium club journey passed. Final type/lint run session3817.

Additional phone fixture was explicitly seeded once with new Card/Deck/Group IDs only; original4192 records/actions were not reset/modified. Metadata: `/private/tmp/switchplay-phase10-review/phase2-test-results/phase11-update-review.json` (status ready); reproduction/setup script `/private/tmp/phase11-prepare-update-review.mjs` returns existing metadata instead of recreating it. New URL: `http://192.168.1.38:4192/decks?openExperience=7bff578a-aeca-4e75-8737-235dcdf33119`, Group “Galway U18 movement”, source Deck “Basketball movement”. Source creator phase2 is not a Group member. Group Admins Alice/Bob (neither follows); followers Aoife Kelly/Carla. All passwords `local-test-only`. Source Deck v2 adds “Control the landing” between two existing Cards, but this Group remains v1 with recorded Group/member values, one local mocked upload, both reflection types and Aoife's Personal target date. The unadopted Update must remain for founder review; do not click its confirmation during automated phone-server verification. Current4192 source is still unchanged until final fix verification completes.

Final affected acceptance rerun: **4/4 Chromium/WebKit integrated journeys passed** after the version-aware refresh fix (`/tmp/phase11-browser-final-journeys.log`,4.6m). Both complete club lifecycle and explicit non-creator Admin Deck Update pass; settings closes after the acknowledged revision is verified. Both media-spacing follow-ups passed2/2. TypeScript and targeted lint passed on final source. All functional cases from the initial broad selection have now passed; the native paint benchmark remains separate.

Optimized benchmark environment: first attempt failed before tests because default Turbopack rejects the temporary export's external node_modules symlink. The owned export's copy of `scripts/test-phase2.ts` now invokes the same production `--webpack` build used in previous checkpoints; root harness/application configuration is unchanged. Rerun log `/tmp/phase11-optimized-final.log` (inspect actual running exec session/result on resumption). Preserve the100ms assertion and actual native Event Timing sample method. Next: finish that measurement, run the existing generic-media viewer/zoom/download/native-share mocked browser selection, then final isolated production build and actual LAN screenshots without adopting the pending founder review update. No commit.

Optimized native paint acceptance **passed1/1** (`/tmp/phase11-optimized-final.log`):50 trusted comparisons after5 warmups, p95 next paint64ms (≤100ms), processing p95 19.7ms, input-delay p95 1.1ms; same scene/stack/Card/signal SVG preserved. Temporary Webpack optimized build passed, no DB connection during build; harness used its own automatically allocated localhost port and stopped only its own services. No speculative performance refactor was needed.

Existing generic media browser selection **44/44 passed** in Chromium/WebKit (`/tmp/phase11-media-viewer.log`,2.2m): bounded Gallery selection/pages, zoom/swipe, video paused/unmount/retry, inherited exact sources/downloads,320/390/1280px controls, and native-share/download policy simulations. OS share sheet behavior is mocked, not physical iPhone approval; no live provider used or Info Card feature suite executed.

Additional missing cross-feature Progress GUI coverage is executing through the existing isolated live-progress harness (same owned export, no Info flag): `node --import tsx scripts/test-phase2.ts --group-progress-live group-progress-live.browser.ts group-progress-acceptance.browser.ts --reporter=line`, log `/tmp/phase11-progress-browser.log`. It supplies real disposable catalogue/handlers/MongoDB and runs actual scoped table/history/entry/skip/revocation cases. This complements already-passing141 backend cases rather than assuming backend correctness proves UI navigation. Then final ordinary production build/actual LAN verification and consolidated report. No commit.

Final coverage additions passed: live scoped Progress/history suite **12/12** (`/tmp/phase11-progress-browser.log`,2.1m), including both engines/mobile+desktop, sticky controls/touch comparisons, lost-response assessment reconciliation, scope/privacy redaction, revocation/late reads and all-skipped states. The requested update regression was strengthened to store **different learning, media, member/collective reflections and dates on both original Cards**, not just the first. **2/2 Chromium/WebKit passed** (`/tmp/phase11-all-cards-update.log`,1.9m): both original Cards retain exact data after middle insertion; the separate Card-level Update is visible/clickable only in the Admin Group context, preserves Step values, leaves Group Deck version2 and does not advance the Personal Deck/Card pointers from1. No further application defect found in this stronger selection.

Final ordinary production build is running in `/private/tmp/switchplay-phase10-build`, log `/tmp/phase11-production-build.log`; byte comparison confirms all four changed application files match root. No DB credentials/environment copied. Native optimized/source safety, all functional browser cases, unit/controller and DB selections have passed after the recorded fixes/environment corrections; physical phone acceptance and real-provider checks remain distinct. Next: actual LAN review/screenshot without clicking pending Update confirmation, consolidate this report, stop uncommitted for founder iPhone approval.

</details>
