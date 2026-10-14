# Phase 7 — Connected acceptance and Phase 8 handover

Date: 13 October 2026.
Status: **Phase 7 complete — acceptance passed and approved.**

Scope: final verification of the Progress functionality delivered in Checkpoints 1–4,
plus the approved incomplete-history presentation refinement. No production access,
migration, deployment or real-provider operations. The Checkpoint 4 baseline is
`38af548`; the approved Checkpoint 5 changes were committed as `06c5466`.

## Delivered behaviour and connected acceptance

| Behaviour | Permanent coverage |
| --- | --- |
| Authenticated Progress, ordered Framework/Area/Item hierarchy, learner-scoped session expansion and independent title/chevron controls | `progress-client.test.ts`, `phase2/progress.browser.ts`, `phase2/item-navigation.browser.ts` |
| Configured-mapping clickability, including missing mapped Cards; unmapped titles remain subdued while Tests cells remain usable | `frameworks.test.ts`, `phase2/item-navigation.browser.ts` |
| Adopted active/archived membership eligibility, fork ancestry, independent originals/forks, deduplication and raw weighted metrics | `frameworks.integration.ts`, `framework-readers.integration.ts`, Area/Item browser journeys |
| Blank, zero, all-skipped 100% and unavailable scores; saved work refreshes on return | `frameworks.test.ts`, `phase2/progress.browser.ts`, `phase2/area-navigation.browser.ts`, connected Item working journey |
| Direct Item CRUD without memberships, combined source-attributed assessments, original-source edits, live indicator refresh and retained conflict input | `assessments.integration.ts`, `framework-readers.integration.ts`, `phase2/progress.browser.ts`, `phase2/assessment-ui.browser.ts` |
| Complete/incomplete histories with and without readable results; known-result ordering and deduplication | `assessment-history.test.ts`, `progress-client.test.ts`, `framework-readers.integration.ts`, four-case Progress browser acceptance |
| Area sections, matching counts/ranking, explicit restore, placement/count refresh and restore-then-open recovery | Area destination integration tests, `phase2/area-navigation.browser.ts`, `phase2/area-library.browser.ts` |
| Complete public-set discovery, Progress-only membership exclusion, canonical Library privacy and unchanged main-Library availability | `area-library.integration.ts`, `phase2/area-library.browser.ts` |
| One/multiple Cards and Deck contexts, original/fork identity, static Card fronts, targeted personal/public versions and no standalone destinations | `item-destinations.integration.ts`, `phase2/item-navigation.browser.ts` |
| Stale access/publication/adoption, actor switching, obsolete responses and read-only browsing | Framework/destination integration tests; Progress, Area, Item, Library and working-update browser suites |
| Same Back to Progress placement, preserved Framework/expansion/scroll, Creator origin and ordinary navigation | `phase2/area-library.browser.ts`, `phase2/area-navigation.browser.ts` |
| Card-back bordered + Test, focus-only interaction, gestures, media/date/signal geometry and existing Creator/Library flows | `phase2/assessment-ui.browser.ts`, presentation/private Deck/Library/Creator/working-update browser suites; existing component tests |

Area selection preserves a working Deck's active Card. Item selection first shows
static Card fronts, then opens the selected Card directly or offers visual Deck
choices inside the same modal. Archived entry requires Restore and open; Library
entry opens the existing canonical Library interface without importing content.
Back to Progress refreshes saved figures and restores session context.

The existing Item journey now completes a Step through the focused working Card,
waits for persistence and verifies refreshed 33% Item completion after returning.
Responsive coverage also checks the 5% selection-Card scaling, centring, 12px header
spacing, 8px caption spacing, vertical scrolling and internal Back focus/scroll.

## Acceptance corrections

- **Approved presentation decision:** incomplete Item histories keep normal ticks/dots
  or + Test and add a small non-interactive bottom-right !. Ticks/dots mean the latest
  three **known readable** results, not a guaranteed latest three overall. The Item
  modal shows ! Some assessment history may be missing., keeps readable rows and
  retains normal authorised Add/Edit/Delete. Complete histories have no warning.
- **Projection boundary:** compact Framework assessments select the latest readable
  events from the existing deduplicated, newest-first history. Incomplete state,
  nullable total and issue diagnostics remain intact. The full-history certainty
  projection and Card-back assessment treatment are unchanged. The Progress client
  accepts partial readable indicators while rejecting malformed or duplicated source
  events. No mapping, metric, storage, permission or inheritance rules were relaxed.
- **Browser fixture race:** two Back-to-Progress checks initially failed when a late
  fixture callback fulfilled a route already handled during teardown. Tests now wait
  for destination readiness before screenshots/focus checks and settle network work
  before unregistering fixture routes. Errors are not swallowed and navigation,
  geometry, privacy and return-context assertions remain intact. All three responsive
  Back-to-Progress cases passed afterward.

No additional application navigation or calculation defect required correction.

## Verification results

| Check | Result |
| --- | --- |
| Full unit suite | 332 passed before the final history refinement |
| Final history/client unit coverage | 13 passed, including two new tests; 334 distinct unit cases verified across the runs |
| Disposable-Mongo integration coverage | 256 distinct cases passed; final affected-reader/interrupted-file rerun: 37 passed |
| Full component/E2E suite | 124 passed |
| Connected browser coverage | All 178 scenarios passed across the initial run and resumed/affected-file verification |
| Final focused Item/history visual checks | 5 passed |
| Typecheck | Passed after the final application changes |
| Production build | Passed with `MONGODB_URI` and `MONGODB_DB` explicitly empty; telemetry disabled |
| Lint | Zero errors; six pre-existing warnings |
| Working-tree and staged diff checks | Passed |

The user's requested pause interrupted the full verification processes. The initial
integration run had passed all 256 cases but had not completed process cleanup; its
final file and the changed reader were rerun successfully. The initial browser run
had reached 147 scenarios, including the two fixture failures above. The remaining
and affected files completed with 47 passing scenarios, covering the entire 178-case
inventory without another full-suite run. Counts are distinct coverage, not a claim
that a single uninterrupted final invocation ran every test. Final focused checks
cover the subsequently approved presentation and visual review.

The permanent `npm run dev:phase2` environment remains available. Integration and
connected browser verification used disposable local MongoDB and mocked media.

## Visual inspection and limitations

Chromium viewport-emulated renders were inspected at 320px, 390px and desktop widths:
Progress density, long titles, clickability, Tests cells/warnings, assessment dialogs,
Area Deck fronts, Item Card scaling/captions/spacing and modal scrolling. Working and
Library Back to Progress renders were compared visually as well as by geometry/style
assertions. Keyboard focus, restoration and touch-target checks are automated.

- No physical-device or non-Chromium browser acceptance was performed.
- Real Cloudflare R2 upload, Stream processing, playback and provider failure recovery
  remain outstanding; mocked services do not establish those behaviours.
- Known-result indicators can omit newer unavailable events; the warning communicates
  that limitation. No outcome or chronological placeholder is invented.
- Public discovery scans the complete eligible published set in bounded batches.
  This is proportionate to current scale; production-scale performance was not benchmarked.
- Session storage is optional. Expansion/scroll restoration is best effort when storage
  is disabled or the browser cannot restore the saved position. No continuous cross-tab
  synchronization, standalone working Cards or Framework editing is introduced.
- The sample Maths Framework remains development content with manually configured Card
  identities. Missing IDs legitimately produce diagnostics. No production curriculum
  or development seeding system was substituted.
- User-reported unrelated Library/My Decks/Creator navigation inconsistencies remain
  untriaged Phase 9 work. Progress-dependent routes are covered here; this is not a
  general navigation redesign. The external Google Doc was not accessed or updated.

## Phase 8 technical handover

- **Configuration and summaries:** `src/lib/frameworks/configuration.ts` re-exports the
  shared configuration contracts/access helpers. `hasConfiguredCards` and
  `hasConfiguredAreaCards` mean explicit mappings, not accessible destinations.
  `/api/frameworks`, `/api/frameworks/summary` and `/api/frameworks/[frameworkId]/summary`
  provide ordered metadata and actor-scoped snapshot metrics/compact assessments.
- **Destinations:** `/api/frameworks/[frameworkId]/destinations?areaId=…` or `?itemId=…`
  uses `destinations.ts`, existing canonical ancestry and adopted/public version readers.
  Complete/empty/incomplete responses preserve issues; uncertain totals are null.
  Membership exclusion applies only to Progress's public destinations. Discovery never
  enters personal work or changes adoption/archive state.
- **Assessments:** `/api/items-data/[itemId]/history` returns readable full history,
  original storage identities/revisions and issues. `ItemTestsCell`, `AssessmentModal`
  and existing mutation/invalidation coordination provide the UI. Compact summary
  latestThree may contain known readable events when incomplete; consumers must retain
  the warning. Canonical fork ancestry and actor-scoped personal-history ancestry remain
  separate, and results stay stored at their original personal sources.
- **Presentation/navigation:** `DeckFrontContents`, static `ActiveCardFront`,
  `AreaDeckDialog` and `ItemCardDialog` share established visuals. `progressDeckSelection.ts`
  extends normal working/Library entry with version/access checks; `progressNavigation.ts`
  carries return context. Targeted working entry checks the selected Card version before
  personal writes. Successful restoration is retained if subsequent opening fails.
- **Cutover boundary:** Phase 7 acceptance does not authorise production migration or
  deployment. Phase 8 requires a separately reviewed and explicitly approved cutover
  gate. Existing audit/planning and apply tooling remains restricted to offline/disposable
  local work; there is no production apply mode. Full-data rehearsal and production
  execution remain outstanding. Preserve canonical legacy content, personal back-of-Card
  media and sharing metadata under the agreed migration policy; reset the agreed legacy
  demo learning state. These reset rules are migration-specific, not normal continuity.
- **Recommended gate preparation, not executed work:** review source drift, backups,
  validation, index/deployment ordering and rollback with a concrete rehearsal/runbook;
  resolve production disposition of the sample catalogue and required provider acceptance.
  Keep Phase 9 release fixes separately tracked. Do not copy disposable test fixtures or
  remove Atlas safeguards on the strength of this acceptance report.

Only human-facing review remains for this checkpoint: assess readability and calm visual
hierarchy with the learner's real long titles/captions, and (if available) physical-phone
scrolling, touch feel and keyboard appearance. The automated journeys need no wholesale
manual repetition. No commit or Phase 8 work is included.
