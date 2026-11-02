# Phase 5.5–5.6 — Contextual Progress and presentation handoff

## Resume here

Branch `feat/group-experience`. Commission started with a clean tree at `33297bc`, the founder commit preserving the approved plan/5.0 preview after 5.4. No model change: GPT-6.1 Sol / Extra High remained appropriate.

**5.5 complete:** `76064aa26117d048acea081ed5d254bc968d32ac` — `feat (group experience): integrate contextual progress navigation`.

**5.6 complete and verified.** This handoff belongs to its separate implementation commit. On resumption inspect Git log/status and do not duplicate either checkpoint commit. Next is the requested physical iPhone visual review, then explicit founder authorisation for **5.7**. No production deployment, data access, provider changes or feature enablement is authorised.

5.6 subject: `feat (group experience): complete progress presentation and skipped states`. Its eventual hash is the commit containing this final handoff; a commit cannot embed its own hash. The final response supplies the verified hash. Retrieve it with:

```sh
git log -1 --format='%H %s' --grep='^feat (group experience): complete progress presentation and skipped states$'
```

## Implemented 5.5 architecture

- Existing top-right Group Deck menu exposes **Progress** to every current member; **Group…** remains Admin-only. Normal `/progress` is **My Progress**, with no Group roster. `/group-experiences/:experienceId/progress` fixes one authorised Group for the visit.
- Active followers, including dual-role Admins, default to **My Progress in Group**. Admin-only members default to **Group**. Other permitted active followers appear alphabetically, without duplicating self; non-wrapping arrows disable at the ends. All roster pages must agree on actor, experience, structure/adoption/access revisions, with a final authority check and total-count validation.
- The shared Framework table stays mounted during subject/mode changes. Framework/Area expansion, scroll and valid destination/return state remain separate from data authority. Sticky controls have reserved mode space; a pending new subject never inherits the prior subject payload.
- Resources expire after the server authority lease, poll visible pages every four seconds, and invalidate/revalidate on focus, re-entry and visibility changes. Denied access returns safely to My Decks. Foreign histories never enter `workingCardStore`.
- Named experience destinations remain distinct when several Groups use the same Deck. Personal Framework destinations explicitly select self. Group destinations preserve the current permitted subject and fixed Group scope. Outside content can use existing public Library browsing without assignment or widening Group learning/history scope. Retained-only evidence creates no historical working link.
- Return state captures actor/experience, valid Card, front/back orientation, focus and perspective. Router search parameters are used during soft navigation; reading `window.location` too early had captured the outgoing URL. Existing AppShell scene synchronization was extended without changing Card layout or animation.

### New read routes and reused contracts

- `GET /api/group-experiences/:experienceId/progress-navigation`: bounded, revision-consistent active roster pages, capabilities, Group name, active count and current follower status.
- `GET /api/group-experiences/:experienceId/frameworks/:frameworkId/destinations`: scope-authorised named Group Deck/Card destinations; public-only outside browsing.
- Fixed Group Progress page reuses existing authenticated entry and Group feature controls. 5.4 summary/history endpoints remain authoritative for metrics, safe origin labels, ownership, capabilities, revisions and lease expiry.
- No new collections, schema migration or index changes. Existing Group indexes/replica-set transactions remain prerequisites.

## Implemented 5.6 presentation and mutation integration

### Table and touch comparisons

Reuse `ProgressShell` / `FrameworkProgressTable`, preserving the accepted four columns and existing assessment symbols. **Group scores | Player averages** changes completion/confidence in the same cells; Group-owned Tests stay identical in both modes. Individual perspectives show their scoped personal Tests and no metric comparison controls. Mode selection survives player switches within the mounted visit.

Comparisons use one non-modal portal anchored to the tapped cell. Completion shows pooled follower completion plus full doing/done wording; confidence shows pooled average and capability-authorised extrema. Reverse mode reveals Group-owned values. Popovers dismiss on outside pointer, Escape and incompatible authority/context changes, follow scrolling, clamp/flip at screen edges, and do not affect table flow. Accessible button names include the actual value or explicit skipped meaning. Numeric button minimum height fits the established row/padding geometry; desktop/mobile row tops and heights are asserted unchanged across perspectives.

### Existing assessment editor

- Progress history opts into the approved date/context lines. Safe labels come from server projections: Personal, independently authorised Group name, Other group, Unknown. Long names truncate within the existing date cell. Existing personal Card-modal defaults remain unchanged.
- Self uses the shared personal assessment storage/queue through captured valid Group transport. Legitimate self-owned inherited sources outside current Group Cards retain existing owner-source edit rights. Foreign personal histories remain read-only.
- Group-owned edits use the existing Group Card/Item APIs. `groupClient.ts` validates actual actor, experience, owner, exact source/target and revision; work is namespaced by actor/experience/source within existing PersonalWork rather than entering personal queues/store.
- Commands and originating transport are captured before asynchronous work. HTTP-compatible `clientId()` and request-preparation guards prevent a synchronous exception from stranding pending UI. Group writes and recovery reads have bounded timeouts. After a lost response the exact original command is reconciled by the server; a redacted Group list cannot safely fabricate immutable Add provenance. Existing conflict, retry, discard and cancellation semantics remain.
- Group Tests cannot be opened while the selected subject summary is unavailable. This fixes a real race in which a click during the switch opened and immediately discarded the modal.
- Existing Card-targeted rows remain editable/deletable through Progress history. The established Add test action creates direct Item results. No new Group Card header controls, historical browser or Card assessment UX was invented.

### Explicit skipped and outside states

- Personal Framework calculation results now expose shared `observationState`; all-skipped completion is null plus `skipped`, independent of confidence/Tests. Existing low-level percentage helper compatibility remains internal.
- Personal, Group and eligible aggregate Framework cells display small **skip** only for actual nonempty all-skipped observations. Outside Items have exceptionally faint placeholders and a light title strike; outside Areas have placeholders without a heading strike. Empty, todo, unavailable and outside states are distinct and described accessibly.
- The Card completion strip changes **paint and semantic label only** for all-skipped state, retaining dimensions, transforms, placement and touch controls. Covers personal, Group-owned and self/inspected player Cards in ordinary/focused surfaces.
- An all-skipped nonempty Deck front omits its visible percentage while reserving its existing layout slot and preserving confidence/counts. Group tile skip state comes from the full selected composition, never only the first page. Mapped Deck destinations carry the same state.
- No Step layout, progress interaction, G/F confidence, signal control, Card/Deck gesture or comparison-grid design was changed. Main-reference geometry assertions/tolerances were not altered.

## Fixture isolation and operational review

`--group-progress-live` creates a **separate real-API dataset** using existing disposable Mongo infrastructure. It contains varied learning and actual compatible Group-owned assessment records, personal/cross-context/legacy origins, partial/outside Items and explicit skip examples. Original Galway/Phase 4 fixtures are preserved and included in the review mapping. The original `--group-progress` 5.0 static preview remains separate, usable and unchanged in its assessment-storage isolation.

A generated Framework catalogue under ignored `phase2-test-results` replaces the catalogue only in this harness build. Webpack substitution requires the existing disposable/browser-test gates plus the validated generated path. Normal development/production and checked-in Framework configuration retain their existing compiler/catalogue. Generated test tsconfig explicitly uses repository baseUrl. No production or shared database URI is used; optimized compilation receives no database URI, and only runtime receives the owned disposable URI. Providers remain mocked.

After the 5.6 commit, start a fresh review process on a free port; earlier review servers on 4181–4183 must remain untouched:

```sh
SWITCHPLAY_REVIEW_PORT=4184 node --import tsx scripts/test-phase2.ts --dev --lan --group-progress-live
```

The runner prints actual LAN addresses and a direct live Group Progress URL. `phase2-test-results/review-server.json` records the new runner/app PIDs, active addresses and fixture IDs; verify these rather than using stale values. Login **phase2 / local-test-only** (Admin-only) or **other / local-test-only** (active follower). Use Overview → Progress for complete My Progress; open Galway Progress review → existing Deck menu → Progress for fixed Group learning. The final response supplies verified live URLs.

Stop only this newly started runner with Ctrl+C in its terminal, or `kill -TERM <runner PID>` from its new metadata. The runner shuts down its Next process, mock providers and disposable Mongo; data is discarded. Do not kill unrelated listeners.

Human review is for wording, touch comfort, sticky controls/scroll, four-column readability, popover placement, origin-line clarity/truncation, subtle outside/skip treatments and intact Card/Deck appearance. Arithmetic, permissions, persistence and inheritance are automated checks, not manual review requests. Precise new visual weights remain **provisional pending founder acceptance**.

## Actual verification

### 5.5

- `node --import tsx --test tests/group-progress-navigation.test.ts tests/area-destinations.test.ts tests/progress-client.test.ts tests/assessment-history.test.ts tests/group-progress-preview.test.ts` — **26 passed, 0 failed**.
- `node --import tsx --test --test-concurrency=1 tests/group-progress-destinations.integration.ts tests/area-destinations.integration.ts tests/item-destinations.integration.ts` — **19 passed, 0 failed**. Final Group-only rerun: **4 passed**.
- `node --import tsx scripts/test-phase2.ts --group-experiences group-progress-navigation.browser.ts` — **4 passed, 0 failed**. Final Item-destination rerun: **1 passed**.
- TypeScript passed; targeted lint across 29 changed/new TS files passed without warnings; `git diff --check` passed.
- Initial failures resolved: exact test selector, missing public Deck in outside-browse fixture, and actual soft-navigation return URL timing bug. Original Card/back-face assertion retained.

### 5.6

1. `node --import tsx --test tests/group-assessment-client.test.ts tests/assessment-client.test.ts tests/group-personal-assessment-client.test.ts tests/frameworks.test.ts tests/framework-progress-scope.test.ts tests/group-framework-metrics.test.ts tests/group-progress-preview.test.ts tests/presentation-foundation.test.ts tests/group-progress-navigation.test.ts tests/progress-client.test.ts` — **66 passed, 0 failed**. Final transport-only rerun after adding read timeout: **3 passed**.
2. `node --import tsx --test --test-concurrency=1 tests/framework-readers.integration.ts tests/framework-lifetime.integration.ts tests/frameworks.integration.ts tests/group-framework-progress.integration.ts tests/assessments.integration.ts tests/group-assessments.integration.ts tests/group-personal-assessments.integration.ts tests/assessment-provenance.integration.ts` — initially **81 passed, 1 failed**: one superseded all-skipped 100 expectation. Corrected only that expectation to null + skipped; `node --import tsx --test tests/framework-readers.integration.ts` then **17 passed, 0 failed**. All 82 distinct scenarios are covered; the eight-file command was not rerun wholesale after this assertion-only correction.
3. `node --import tsx --test tests/group-experience-perspectives.integration.ts` — **5 passed, 0 failed**, including full-composition allSkipped versus a skipped first page and existing peer-policy protections.
4. `node node_modules/@playwright/test/cli.js test --config playwright.phase2.config.ts group-progress-main-geometry.browser.ts --output phase2-test-results/geometry-artifacts` — **24 passed, 0 failed**, Chromium/WebKit. Unchanged main-derived gaps, row heights, following Step positions, 6px annotation gap, centring, editable 52×24 targets, readonly/zero-count/expanded and personal states.
5. `node --import tsx scripts/test-phase2.ts --group-progress progress.browser.ts group-progress-preview.browser.ts group-experience-motion.browser.ts group-counts-confidence.browser.ts assessment-ui.browser.ts --output phase2-test-results/regression-artifacts` — initially **34 passed, 1 failed**: an old inherited-only label expectation for a previously directly assigned, now retained eligible source. Production history/eligibility functions were unchanged by 5.6. Corrected that exact expectation with an added explicit four-result original-source/own-evidence assertion. All six-result deduplication, original-source editing and persistence checks remain.
6. `node --import tsx scripts/test-phase2.ts --group-progress-live group-progress-live.browser.ts assessment-ui.browser.ts --grep 'actual Group|Group editor|self personal|personal all-skipped|Group-owned and self|Item presentation'` — **9 passed, 0 failed**. Includes the corrected original-source scenario, Chromium/WebKit at 390/1280, row top/height and column preservation, sticky/scroll, touch dismissal, origin truncation/redaction, actual HTTP Group CRUD, self shared Item entry, foreign read-only, personal and Group/self Card/Deck skip states.
7. `node --import tsx scripts/test-phase2.ts --optimized --group-progress-live group-progress-live.browser.ts --grep-invert webkit` — **optimized build passed; 6 browser cases passed, 0 failed**. Compilation, TypeScript and all 45 static pages passed with database URI blank during build.
8. Final integrated navigation regression: **4 passed, 0 failed** (`/tmp/group-progress-5-6-navigation-final.log`). Command: `node --import tsx scripts/test-phase2.ts --group-experiences group-progress-navigation.browser.ts`.
9. `npx tsc --noEmit --incremental false` — passed. Targeted eslint via explicit Python argument list over all 31 changed/new TS files, `--max-warnings 1` — **0 errors, 1 pre-existing no-img-element warning** at unchanged DeckFrontContents line 17. `git diff --check` passed. No formatter or broad cleanup run.

Logs are `/tmp/group-progress-5-5-*.log` and `/tmp/group-progress-5-6-*.log`, with ignored screenshots/traces under phase2-test-results. Exact changed-file inventories below identify the lint selection.

### Investigated failures and environment limits

- Initial live harness could not resolve inherited `@/` imports under generated tsconfig/Webpack; repository baseUrl fixes the harness without changing production configuration.
- Initial new live run: four passed, one subject-switch history click race failed. Disabled Group Tests while authorised summary is unavailable; all final live cases pass without weakened timing/geometry assertions.
- Initial optimized run: six passed, two WebKit login cases failed. Production uses Secure cookies; WebKit does not send those on this plain-HTTP localhost harness. A separate isolated cookie experiment confirmed Chromium sends them and WebKit does not. **Authentication was not loosened.** Full WebKit desktop/iPhone coverage passed in the development HTTP harness. Optimized WebKit HTTPS coverage was not run; the final optimized selection explicitly excludes those two incompatible transport cases.
- Mongo fixture cleanup occasionally logged a SIGINT timeout before its existing SIGKILL fallback. Data remained disposable and all final affected integration tests completed. Playwright emitted existing NO_COLOR/FORCE_COLOR warnings. Neither warning is an uninvestigated product failure.
- No entire repository suite or physical iPhone acceptance is claimed. No new operational infrastructure or production flag changes.

## Privacy, numeric and concurrency evidence

The rerun Group/assessment suites verify active-subject/current-viewer authority, peer On/Off, Admin/follower/dual roles, revoked members, adoption scope, allowlisted foreign projections, safe origin-name disclosure, absent non-Admin extrema, unchanged scalar-only readers and owner-only personal endpoints. Shared source chains remain live/deduplicated; unrelated histories/private fields remain excluded. Group-owned and personal lists never merge ownership.

Raw eligible-Step completion, pooled readings/one final rounding, unequal denominators, skipped confidence independence, empty/zero followers, malformed values and rounded 100 versus exact completion remain covered. Existing transaction rollback, revision conflicts, original provenance/createdAt, lost responses, scope/adoption and membership races remain covered by the persistence suites. New Group client tests assert captured A/B transport, exact retry command and invalid-owner rejection before accepting responses.

## Remaining work and decisions

5.5/5.6 implementation readiness does not mean founder acceptance of the provisional visual treatment. Complete the requested physical iPhone review; refinements require the usual explicit approval. **No material unresolved product question** was found within this commission.

**5.7 is not started or authorised here.** After founder visual acceptance, it can consolidate final cross-context regression/acceptance and release handoff. Production enabling, rollout, provider verification and later Group media/Info/reflection work remain outside this commission. Existing personal Card assessment consumers are not redesigned, and no new historical navigation or permission controls were introduced.

The overarching engineering plan, independent review, original 5.0 fixtures, production Framework configuration and Organisations work are unchanged by this commission. Starting user commit 33297bc already contained the formerly uncommitted planning/preview files; none was reverted or discarded. Only the narrowly scoped handoff and inventory below belong to these two implementation commits.

## Complete changed-file inventory

### 5.5 — 31 files

- `docs/engineering/features/group-experience/group-experience-phase-5-5-6-handoff.md`
- `src/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/destinations/route.ts`
- `src/app/api/group-experiences/[experienceId]/progress-navigation/route.ts`
- `src/app/group-experiences/[experienceId]/progress/page.tsx`
- `src/components/assessments/AssessmentModal.tsx`
- `src/components/assessments/AssessmentSymbols.tsx`
- `src/components/assessments/useAssessmentHistory.ts`
- `src/components/decks/DeckMenu.tsx`
- `src/components/group-experiences/GroupExperienceDeck.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/progress/AreaDeckDialog.tsx`
- `src/components/progress/FrameworkProgressTable.tsx`
- `src/components/progress/GroupProgressView.tsx`
- `src/components/progress/ItemCardDialog.tsx`
- `src/components/progress/ItemTestsCell.tsx`
- `src/components/progress/ProgressShell.tsx`
- `src/components/progress/groupProgressDisplay.ts`
- `src/components/progress/groupProgressResource.ts`
- `src/components/progress/progress.module.css`
- `src/components/progress/progressDeckSelection.ts`
- `src/lib/frameworks/destinations.ts`
- `src/lib/frameworks/progressNavigation.ts`
- `src/lib/groupExperiences/progressClient.ts`
- `src/lib/groupExperiences/progressDestinations.ts`
- `src/lib/groupExperiences/progressNavigationReads.ts`
- `tests/group-progress-destinations.integration.ts`
- `tests/group-progress-navigation.test.ts`
- `tests/phase2/group-progress-navigation.browser.ts`
- `tests/phase2/group-progress-preview.browser.ts`
- `tests/phase2/helpers/groupProgressRoutes.ts`
- `tests/phase2/progress.browser.ts`

### 5.6 — 34 files

- `docs/engineering/features/group-experience/group-experience-phase-5-5-6-handoff.md`
- `next.config.ts`
- `scripts/test-phase2.ts`
- `src/app/globals.css`
- `src/components/assessments/AssessmentModal.tsx`
- `src/components/assessments/useAssessmentHistory.ts`
- `src/components/decks/CardSemanticAnchors.tsx`
- `src/components/decks/DeckFrontContents.tsx`
- `src/components/decks/DeckScene.tsx`
- `src/components/decks/deckFrontPresentation.ts`
- `src/components/decks/presentation.ts`
- `src/components/group-experiences/groupPresentation.ts`
- `src/components/progress/FrameworkProgressTable.tsx`
- `src/components/progress/GroupProgressView.tsx`
- `src/components/progress/ItemTestsCell.tsx`
- `src/components/progress/groupProgressDisplay.ts`
- `src/components/progress/progress.module.css`
- `src/lib/cards/personalWork.ts`
- `src/lib/frameworks/calculations.ts`
- `src/lib/frameworks/destinations.ts`
- `src/lib/frameworks/progressClient.ts`
- `src/lib/groupExperiences/presentationReads.ts`
- `tests/framework-readers.integration.ts`
- `tests/frameworks.test.ts`
- `tests/group-experience-perspectives.integration.ts`
- `tests/phase2/assessment-ui.browser.ts`
- `tests/phase2/progress.browser.ts`
- `tests/presentation-foundation.test.ts`
- `src/components/progress/ComparisonPopover.tsx`
- `src/components/progress/progressComparisons.ts`
- `src/lib/assessments/groupClient.ts`
- `tests/group-assessment-client.test.ts`
- `tests/helpers/groupProgressLiveReview.ts`
- `tests/phase2/group-progress-live.browser.ts`
