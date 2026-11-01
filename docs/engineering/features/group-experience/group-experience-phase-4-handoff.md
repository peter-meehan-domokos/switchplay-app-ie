# Group Experiences — Phase 4 implementation handoff

**Date:** 30 October 2026  
**Branch:** `feat/group-experience`  
**Status:** Initial slice and iPhone refinements accepted and committed in baseline `cccb0ba`. Checkpoint 8 creation/settings is implemented, uncommitted, and automated verification passed; its form awaits physical iPhone review. See the Checkpoint 8 handoff below. Earlier sections preserve the initial-slice execution record, including `39aa33aaba824c550cbe82fc8efe9e422157a94e`. Organisations planning work remains untouched.

**Authority:** [Phase 4 product specification](../../../design/features/group-experience/group-experience-phase-4-spec.md), especially P12/P15, and [dedicated engineering plan](group-experience-phase-4-engineering-plan.md). The original record covers checkpoints 1–7 and 9. The separately authorised atomic creation/settings follow-up covers Checkpoint 8. Phases 5–10 remain excluded.

## Implemented architecture and checkpoints

1. **Neutral-skipped calculations:** `classifyProgress` distinguishes eligible observations, explicit completion and partial work independently of percentage. Group Step/Card/Deck metrics and frozen-snapshot readers exclude all-skipped scopes. Personal percentage presentation still returns 100 for all-skipped, but that never proves completion. Personal Deck labels and Framework destination tiles use exact completion. Framework read-state `complete` continues to mean available data; Framework arithmetic is unchanged. Group tiles calculate completion over the entire Deck even when content is paged.
2. **Visibility and selection:** default-Off peer policy; admins inspect active followers regardless of this setting. Active followers inspect active peers only On. All peer inspection is read-only, with no private sources. Removed snapshots remain admin-only. Group-first, case-insensitive alphabetical identities use a username/user-ID cursor. Selection restore validates current role, policy and active subject; otherwise Admin → Group, Follower → self.
3. **Transport and client:** selected public canonical content is distinct from personal/group learning. Owner dates use a separate server-side Mongo allowlist for the authenticated viewer. Foreign reads never fetch a whole personal CardData and redact it. One mounted resource coalesces loads, verifies viewer/structure/adoption/epoch across pages and masks peers without a live five-second lease. Refresh every four seconds while visible, and revalidate on focus/pageshow/visibility return. Fresh requests always check current server authority. Unmount aborts requests and discards data; no global foreign cache.
4. **Presentation:** explicit experience Card/Deck variants, existing Step bars, same-line eligible doing/done counts, paired G/F confidence and per-Step back markers. Only Group admins or the personal owner receive learning controls. Owner date/lock is separate from foreign learning. Back signal controls reuse the established passive/editable signal primitives; no fake personal tests, media or reflections are created.
5. **Entry and continuity:** feature-gated My Decks tiles show experience names in existing attribution position and normal categories. Tiles always summarise Group learning. `/decks?openExperience=…` opens one adapter/scene. Physical identity uses viewer/experience/Card, while security/data identity also includes subject and version. Perspective changes preserve active Card, face, scene and placed stack. On adoption, scene and preference writes derive a currently selected Card; a removed remembered ID cannot revive historical navigation. An empty adopted composition collapses focus/comparison state.
6. **Ordinary picker:** named compact identity, approved Group/self options and authorised All followers upward list. Selection exchanges the whole stack and stays in ordinary mode. Group-only identity is noninteractive.
7. **Focused comparison:** three-column native-scroll grid at 38% of visual viewport, separate from the keyed focused Card and Card gestures. Selection keeps it open; Card traversal preserves selection/scroll; collapse restores position; focus exit collapses it. Separate short perspective transform layers preserve existing traversal/flip transforms and respect reduced motion. Static SVG definitions and unchanged identity contents are memoised. Focused signal rows retain their SVG nodes while read-only handlers/roles and gesture identity change; the exchange wrapper preserves/composites the existing 3D faces.
9. **Verification and fixture harness:** real authenticated HTTP routes, disposable replica-set fixtures and isolated browser/phone server. No temporary management UI.

## API, persistence and permissions

New routes, all behind the existing group feature flag, actual session authentication, checked viewer header and `private, no-store` responses:

| Method / path (prefix `/api/group-experiences`) | Contract |
| --- | --- |
| `GET /tiles?after=…` | Current authorised assignments, Group summaries and first content page; 30 experiences/page. |
| `GET /:id/presentation?cardOffset=…` | Adopted public content, Group learning, optional own learning/date, roles and restored selection; 20 Cards/page. |
| `GET /:id/perspectives?after=…&limit=…&cardOffset=…` | Active permitted identities plus narrow learning matrix; default 30 followers, maximum 100/page; 20 Cards/page. Off returns only self to a follower. |
| `GET /:id/aggregates?cardOffset=…` | Group and active-follower Step/Card aggregates, 20 Cards/page. |
| `PATCH /:id/settings` | Admin-only `{operationId, expectedStructureRevision, allowFollowerInspection}`; exact replay receipt and structural CAS. |
| `PATCH /:id/navigation` | Current member `{accessEpoch, expectedStructureRevision, selection?, activeCardId?}`; validates every supplied identity/Card. |

Existing metadata GET now includes current policy and validated selection. Existing Card/perspective GETs apply the same active-peer policy. Management roster and removal snapshot permissions are unchanged. Existing learning PATCH routes retain their ownership contracts.

Additive optional fields: experience `allowFollowerInspection` (absent means false); member `lastPerspective`. Existing member `activeCardId` is reused. No collections, indexes, destructive migrations, background jobs or universal personal-data migration are added. Existing group/foundation index prerequisites still apply; the isolated harness provisions them only in its own database.

Settings changes use existing structural receipts and actor/follower fences; navigation fences the actor and selected subject without an experience-wide click lock. Client navigation writes serialize/coalesce so a slow earlier click cannot overwrite the last remembered selection. Learning writes capture original owner, Card, stable Step, version and access epoch. Per-field lanes, optimistic rollback and the existing personal-work barrier protect shared learning. Disposing a view cancels reads but allows already queued scalar saves to finish against their captured actor/Card/version/epoch; actual server authorisation still controls every write. Responses never repopulate a disposed view; personal writes invalidate only the authenticated owner's existing working Card cache.

## Corrected semantics and privacy evidence

For a Step, done/doing/todo contribute to the eligible denominator; skipped contributes to neither numerator nor denominator. At Card/Deck scope classify each follower's selected non-skipped Steps: nonempty/all done → done; otherwise any done or inProgress → doing; only todo → unstarted; empty/all skipped → ineligible. Rounded 100 never establishes completion. Confidence uses raw valid readings, independent of skipped progress, rounding once at the end. Zero eligible counts are hidden; zero active followers omits F; active/no readings shows a dash.

Coverage includes 12 followers (`3/11 doing · 2/11 done`), differing Step denominators, mixed/empty/all-skipped, rounded-100 with remaining todo, admin-only/dual roles, removed followers, historical snapshots, independent confidence, private sentinels and foreign query inspection. Later personal activity cannot change frozen snapshots. Framework eligibility foundations from Phase 3 remain intact; Phase 5 eligibility/calculation integration is deferred.

Revocation cannot erase downloaded bytes. Fresh unauthorised requests fail immediately; expiry/failure/focus loss hides cached peers. A delayed final authority check cannot renew a lease from its response time. Remote policy changes and offline verification are tested through real browser APIs as well as isolated controller tests.

## Verification commands and results

All database fixtures use owned `MongoMemoryReplSet` databases. No production Atlas or live Cloudflare verification was run. Logs named below are local execution evidence, not committed artefacts.

```sh
node --import tsx --test --test-concurrency=1 tests/group-experience.test.ts tests/group-experience.integration.ts tests/group-experience-api.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-perspectives.integration.ts tests/group-experience-capacity.integration.ts tests/shared-learning.integration.ts tests/update-adoption.integration.ts tests/personal-lifecycle.integration.ts tests/card-reuse.integration.ts tests/framework-readers.integration.ts tests/assessments.integration.ts tests/personal-info-cards.integration.ts
```

**154 passed, 0 failed** (`/tmp/group-phase4-regression-final.log`). Covers prior-phase concurrency/privacy, personal adoption/lifecycle/reuse, Framework readers, assessments and Info Cards.

```sh
node --import tsx --test --test-concurrency=1 tests/group-experience-perspectives.integration.ts tests/group-experience-capacity.integration.ts
```

**7 passed, 0 failed** (`/tmp/group-phase4-db-final3.log`), with the later first-page tile-completion correction and transport paging/payload assertions. One owned disposable Mongo child required forced teardown after its graceful-stop timeout; the run exited successfully. No application database was involved.

```sh
node --import tsx --test tests/shared-learning.test.ts tests/shared-learning-client.test.ts tests/working-entry.test.ts tests/update-adoption.test.ts tests/working-updates.test.ts tests/frameworks.test.ts tests/assessments.test.ts tests/personal-history-projection.test.ts tests/personal-media-mutations.test.ts tests/group-experience-client.test.ts tests/group-experience-perspectives.test.ts tests/presentation-foundation.test.ts tests/deck-state-characterisation.test.ts
```

Final unit selection: **91 passed, 0 failed** (`/tmp/group-phase4-unit-complete.log`), after the final static-SVG/identity memoisation. Controller coverage includes coalescing, expiry, stale revisions, account/experience mismatch, offline rollback, ordered navigation and completion of already queued owner-bound saves after view disposal. Presentation coverage includes exact counts, G/F missing values, read-only foreign views, owner dates and physical/security identity separation.

```sh
node --import tsx scripts/test-phase2.ts --group-experiences --optimized group-experience-boundaries.browser.ts group-experience-motion.browser.ts group-experience-perspectives.browser.ts --reporter=line
```

**10 passed, 0 failed, 0 skipped** (`/tmp/group-phase4-acceptance-complete.log`, 50.7 seconds). The ten-case final selection includes actual API/DB authorisation, remote/offline revocation (including an already-open ordinary list), owner and Group progress writes, Group confidence dragging, removed-Card adoption, empty adopted composition, named tiles, restore/defaults, Group/self policy, grid scroll/face/navigation continuity and the loaded comparison budget. The adoption case publishes/reviews/adopts real disposable versions and restores composition afterwards; it verifies removed Card routes deny access.

The `--optimized` mode builds into ignored `.next-phase2-optimized` with no DB connection, then starts the same application against the owned disposable database with mocked providers. It uses **localhost** so browser and API test transport both honour real Secure cookies; authentication code/policy is unchanged. This mode is restricted to loopback, without live-provider checks. Ordinary LAN phone review retains the established development harness. No production configuration or deployment changes are involved.

```sh
node --import tsx scripts/test-phase2.ts --info-cards working-entry.browser.ts working-updates.browser.ts update-adoption.browser.ts presentation-foundation.browser.ts deck-menu.browser.ts personal-info-cards.browser.ts assessment-ui.browser.ts library-entry.browser.ts progress.browser.ts framework-readers.browser.ts --reporter=line
```

**68 passed, 0 failed, 0 skipped** (`/tmp/group-phase4-personal-browser-final2.log`, 6.2 minutes). The shared signal/SVG changes received the additional focused rerun below.

```sh
node --import tsx scripts/test-phase2.ts --info-cards assessment-ui.browser.ts presentation-foundation.browser.ts --reporter=line
env SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=0 PHASE2_BROWSER_TEST=0 PHASE2_OPTIMIZED=0 npm run build
npx tsc --noEmit --incremental false
git diff --check
```

**21 passed, 0 failed** (`/tmp/group-phase4-shared-regression.log`, 3.3 minutes), after the final shared signal/SVG changes. **Default production build passed** with Group Experiences disabled and DB configuration cleared (`/tmp/group-phase4-build-complete.log`). **Standalone TypeScript passed** (`/tmp/group-phase4-types-complete.log`), `git diff --check` passed, and targeted ESLint on all **55** changed TypeScript files returned **0 errors, 1 pre-existing image warning** (`/tmp/group-phase4-lint-complete.log`). Build and standalone TypeScript run sequentially to avoid generated Next-type races. Targeted ESLint covers every changed/untracked TypeScript file; the only earlier warning is the existing `DeckFrontContents` image element.

### Capacity and paint measurements

Local machine: Node v22.14.0, macOS, Intel Core i7-9750H. These are fixture results, not a production latency guarantee.

| Check | Actual | Budget |
| --- | --- | --- |
| 20 followers × 12 Cards, summary JSON | 8,053 bytes | ≤250 KB |
| Combined content/bootstrap + permitted matrix + aggregates | 95,940 bytes | ≤250 KB |
| Active-Card perspective page | 7,963 bytes | ≤100 KB |
| 100 warm summary reads (5 warmups), p95 | 72.6 ms | ≤300 ms |
| 200 writes from 20 independent followers, p95 | 373.0 ms | ≤500 ms |
| Maximum transaction attempts / retried transactions | 1 / 0 | Record distribution |
| 40 × 24 transport | 30 + 10 identities; 20 + 4 Cards | No product cap |
| 50 loaded comparisons, actual input-to-paint p95 | **72 ms** (optimized localhost fixture; 49 reported, one bounded below 16 ms) | ≤100 ms |
| Scene / identity-tile players | 1 / 0 | 1 / 0 |

The final paint instrument runs the optimized local fixture at a 390×844 viewport and uses trusted browser inputs and native [W3C Event Timing](https://www.w3.org/TR/event-timing/), taking the maximum event duration per interaction. Native values have 8 ms granularity; unreported inputs below the 16 ms threshold receive a conservative 16 ms bound. A calibration input verifies the observer works. Five fixed excluded warm-up inputs prepare both views and wait for initial Card/grid geometry to settle, followed by **all 50 measured switches**, without choosing samples by latency. The 100 ms limit is unchanged. Motion-file diagnostic tracing is disabled to avoid measuring screenshot/DOM capture; other functional files retain traces. The fixture asserts the same scene, stack, Card and signal-SVG nodes survive.

### Failures investigated and resolved during verification

- Old skipped/rounded-100 expectations were replaced with exact eligibility/completion assertions. Personal numeric display is preserved.
- Inline counts exposed legacy focused-strip offsets/negative margins; group-only overrides centre the actual strip and preserve its dimensions/hit area.
- One owner-save selector clicked the enclosing Step-detail row. Anchoring the accessible-name match targets the real progress button; assertions were retained.
- The first combined personal browser run had 60 passes, two failures and six unexecuted cases. The canonical bundler failure reproduced on committed HEAD in a temporary isolated copy: newer shared Info imports required CSS-module/font output and made the old module-import prohibition obsolete. The repaired in-memory fixture keeps real components, forbids private controllers and retains zero-API-request assertions. Unchanged 390/1440 geometry baselines and all seven presentation cases pass. The Info Cancel-focus case passed all 11 Info tests and the final combined 68-case run without Info application changes.
- Early paint checks varied/exceeded budget. Profiling identified development JSX construction and unnecessary graphic recreation. The retained solution caches static SVG definitions/identity contents, preserves signal nodes across capability changes with a separate gesture identity, and composites the exchange layer with `preserve-3d`/`will-change`. Existing Motion layout behaviour is retained. Native warm measurements on optimized fixtures replace the old programmatic double-frame proxy; earlier timing results are not interchangeable with the final metric. The real production cookie policy remains intact.
- The optimized gesture test initially attempted vertical traversal during the existing 680 ms flip lock. It now waits out that unchanged contract; `data-face` means the flip started, not that gestures are unlocked.

## Deliberate simplifications and remaining review

- Initial display waits for a consistent, fully paged permitted matrix before exposing prepared choices. This is simpler than progressive subject readiness and avoids identity/data mismatch. Later visible refreshes currently reload bounded content/learning pages as well as authority; no per-follower HTTP calls, long-lived shared cache or new fetching library. Larger deployments may justify separating unchanged canonical refreshes after measurement.
- Short perspective motion acts on the existing physical object immediately with the matched identity/values. No outgoing private snapshot or second live scene is retained. Exact depth/diagonal feel is subject to iPhone review. Chromium emulation does not certify Safari touch or viewport behaviour.
- Existing personal all-skipped numeric presentation is preserved; explicit completion labels are corrected. No unrelated Framework calculation change.
- Existing personal/group media, Info, reflections and assessments are deliberately absent in this learning-only adapter except the owner date. Typed deferred source markers and comments document their separate ownership; later phases add the agreed composition. Canonical instructional content remains public/adopted.
- No Add as Group, Group… modal, directory selector, removed-history UI, new deadlines, providers, dashboards or production flag changes. Creation/settings follows accepted phone refinement and needs its own authorisation; Phase 5 follows that acceptance.

## iPhone review

The isolated review server is running at **[http://192.168.1.38:4181/decks](http://192.168.1.38:4181/decks)**, harness PID **64754**. Verified via that actual LAN address: main page HTTP 200, disposable admin and follower login HTTP 200, selected content/owner-date presentations HTTP 200, forbidden peer read HTTP 403. Clean Admin → Group and Follower → self defaults were also verified after refreshing the fixtures. The server owns a disposable database; production data and provider configuration are untouched. This LAN server uses development mode; optimized performance verification is loopback-only.

| Fixture | Experience ID |
| --- | --- |
| Galway U18 — peers On | `4e63f505-6e2c-485f-a8f8-2be5ed34d4ef` |
| Galway development — peers Off | `94fc23cb-2ffe-41cb-8c64-964bebe3a494` |
| Empty squad | `30492eb6-8ca3-477c-895b-2c9912d41739` |
| No Cards yet | `0ac61348-af36-47b2-a315-c4dc73f7bb37` |

The harness command is:

```sh
node --import tsx scripts/test-phase2.ts --dev --lan --group-experiences
```

It creates a new disposable database each launch and writes ignored `phase2-test-results/review-server.json` with actual URL/PIDs/fixture IDs. Data is discarded on shutdown. Admin `phase2`, follower `other`; password for both `local-test-only`. Fixtures include peer-visible Galway U18 (15 active followers), peer-hidden Galway development sharing the same Deck, Empty squad and No Cards yet. No real participant media.

Use the same Wi-Fi as this Mac. Current stop command: `kill -TERM 64754`. If launched in a foreground terminal later, Ctrl+C also stops it. A restart reseeds everything with new IDs; inspect `phase2-test-results/review-server.json` for the new URL/PID. Current log: `/tmp/group-phase4-phone-review-final.log`.

Phone review steps (visual/interaction judgement, not repeating API assertions):

1. Sign in as `phase2`, open Galway U18 from My Decks. Use the compact identity → All followers ordinary list and compare a few people. Flip the Deck front/back; assess the short whole-stack upper-left/depth cue and placed-Card coherence.
2. Focus a Card, open All followers, then compare Group, Alice, Bob and later names. Assess the three-column grid, selected/subdued tiles, long-name truncation, diagonal exchange and whether the main Card remains readable above it.
3. Scroll the identity grid, then traverse Cards vertically from the main Card. Assess native touch scroll ownership and continuity. Tap the exposed Deck outside the Card, refocus and assess collapse/re-entry motion.
4. Look at the front count-row legibility, G/F visual balance and matching back markers/signals. The fixture includes unset and skipped states; exact numeric correctness is already automated.
5. Use `other` for an owner view, including Galway development's compact Group/self choices and private date indication. Assess touch comfort and visual distinction; permissions are already verified automatically.
6. Exercise Safari address-bar changes/orientation and reduced motion for viewport fit, dismissal space and calm movement. Record any visual refinements for the authorised iPhone-review step.

Automated tests cover permissions, values, persistence and object identity; this review concerns actual Safari visual/physical interaction feel. No manual testing is requested as a substitute for failed automation.

## Changed-file inventory

The following is the complete **62-file Group Experience implementation inventory captured before the user checkpoint commit**, including the test-only optimized-build configuration and ignore entry. The status prefixes describe that earlier working tree, not the current repository status. The specification and dedicated plan were already untracked at the beginning of implementation and were preserved/updated. Generated test artefacts remain ignored. The user subsequently committed these files in `39aa33aaba824c550cbe82fc8efe9e422157a94e`, alongside two Organisations documentation files outside this implementation inventory. Those unrelated files and the following Organisations-only commit have been left untouched.

```text
 M .gitignore
 M docs/engineering/features/group-experience/group-experience-engineering-plan.md
 M docs/engineering/features/group-experience/group-experience-phases-2-3-handoff.md
 M next.config.ts
 M scripts/test-phase2.ts
 M src/app/decks/page.tsx
 M src/components/cards/ActiveCardFront.tsx
 M src/components/cards/StepItem.tsx
 M src/components/cards/StepList.tsx
 M src/components/decks/BackCardFaceContent.tsx
 M src/components/decks/CardSemanticAnchors.tsx
 M src/components/decks/DeckFrontContents.tsx
 M src/components/decks/DeckScene.tsx
 M src/components/decks/FocusedCardView.tsx
 M src/components/decks/PulseFieldSignal.tsx
 M src/components/decks/deckFrontPresentation.ts
 M src/components/decks/motion/deckMotion.ts
 M src/components/decks/presentation.ts
 M src/components/layout/AppShell.tsx
 M src/lib/frameworks/destinations.ts
 M src/lib/groupExperiences/model.ts
 M src/lib/groupExperiences/readModels.ts
 M src/lib/groupExperiences/repository.ts
 M src/lib/progress.ts
 M tests/frameworks.test.ts
 M tests/group-experience-api.integration.ts
 M tests/group-experience-capacity.integration.ts
 M tests/group-experience-lifecycle.integration.ts
 M tests/group-experience.integration.ts
 M tests/group-experience.test.ts
 M tests/phase2/presentation-foundation.browser.ts
 M tests/presentation-foundation.test.ts
?? docs/design/features/group-experience/group-experience-phase-4-spec.md
?? docs/engineering/features/group-experience/group-experience-phase-4-engineering-plan.md
?? docs/engineering/features/group-experience/group-experience-phase-4-handoff.md
?? src/app/api/group-experiences/[experienceId]/aggregates/route.ts
?? src/app/api/group-experiences/[experienceId]/navigation/route.ts
?? src/app/api/group-experiences/[experienceId]/perspectives/route.ts
?? src/app/api/group-experiences/[experienceId]/presentation/route.ts
?? src/app/api/group-experiences/[experienceId]/settings/route.ts
?? src/app/api/group-experiences/tiles/route.ts
?? src/components/group-experiences/ConfidencePair.tsx
?? src/components/group-experiences/GroupCardBack.tsx
?? src/components/group-experiences/GroupExperienceDeck.tsx
?? src/components/group-experiences/PerspectiveExchange.tsx
?? src/components/group-experiences/PerspectiveGrid.tsx
?? src/components/group-experiences/PerspectivePicker.tsx
?? src/components/group-experiences/group-experience.css
?? src/components/group-experiences/groupClient.ts
?? src/components/group-experiences/groupPresentation.ts
?? src/components/group-experiences/groupResource.ts
?? src/lib/groupExperiences/identities.ts
?? src/lib/groupExperiences/navigation.ts
?? src/lib/groupExperiences/policy.ts
?? src/lib/groupExperiences/presentationReads.ts
?? tests/group-experience-client.test.ts
?? tests/group-experience-perspectives.integration.ts
?? tests/group-experience-perspectives.test.ts
?? tests/helpers/groupReviewFixture.ts
?? tests/phase2/group-experience-boundaries.browser.ts
?? tests/phase2/group-experience-motion.browser.ts
?? tests/phase2/group-experience-perspectives.browser.ts
```

## Resumption verification — 31 October 2026, before visual-refinement authorisation

- Confirmed branch `feat/group-experience`, HEAD `2d9be477f8319b54dbbaeedbbe15fc28c23c1523` and a clean working tree before this handoff update. The only difference between the user checkpoint `39aa33aaba824c550cbe82fc8efe9e422157a94e` and HEAD is the unrelated Organisations engineering-plan draft. Both commits and all Organisations documentation are preserved; no application or test changes were needed on resumption.
- Inspected the retained execution logs supporting the passing test counts, build, TypeScript and lint results above. These are results from the completed implementation runs, not newly rerun suites. No application changes occurred after those runs; repeating the full suites was unnecessary.
- The existing isolated server survived the interruption. Rechecked the actual LAN URL on 31 October: `/decks` returned 200, both disposable account logins returned 200, both authenticated presentations returned 200 with the expected viewer identity, and the peer-hidden foreign Card request returned 403. Saved defaults remain Admin → Group and Follower → self. Harness PID `64754` and the fixture IDs above remain current.
- Only this handoff was updated during resumption. No code, tests, live configuration, feature enablement, staging or commits were performed. The next step is physical iPhone review, not checkpoint 8 or Phase 5 implementation.

## Approved Card visual refinements — 31 October 2026

The subsequent physical iPhone review authorised a narrow presentation correction. The original implementation and Organisations commits are preserved. These refinements remain uncommitted for user inspection.

### Changes and rationale

- `GroupCardBack` no longer appends numerical confidence to each Step heading. The top Card-level G/F pair, Step titles, progress markers/counts, signal graphics and the existing shared signal gesture/editing code remain. Specification P9 explicitly supersedes the earlier per-signal G/F requirement.
- The front Group row uses a 24px visible bar column and a 6px gap, with a contained 24px row in both ordinary and Focused views. `StepProgressStrip` has an opt-in adjacent layout; the original personal default is unchanged. End alignment places the existing 52×24px button's spare 28px into the empty left gutter, so its right edge ends with the visible bar instead of covering counts. No negative margin or per-view offset is added. The previous Group top/margin compensation is removed. The fixed inner grid track prevents intrinsic button width from expanding the visible column.
- Passive Group learning rows now reserve the same 24px height as editable rows. This is the narrow layout adjustment needed to contain the existing target vertically and preserve bar/count geometry across modes; Card dimensions and scene/gesture transforms are unchanged. Browser tests verify all three Steps remain hittable and descriptions/counts remain outside the target at 320/390/1440px, including the expanded comparison view.
- Front and back counts retain 8px/400 typography and use neutral metadata `#aeb5c1`. Shared personal/Group Card confidence uses that colour and weight 500, retaining `0.8rem`, centring and G/F superscripts. Removing the assessment-dependent back override gives the same intrinsic confidence size/colour/weight with or without assessments; the existing back layout scale remains unchanged. Date metadata, signal controls and other typography are not restyled.
- No backend, schema, index, ownership, privacy, aggregate, persistence or later-phase functionality changed.

### New and adjusted verification

`group-experience-visual.browser.ts` measures the gap from the actual visible strip, normalises for physical Card scaling, and checks vertical centring in ordinary, editable/read-only Focused and grid-expanded views. Nine hit-test points cover each complete 52×24px target; geometry checks exclude instructional copy and counts. A trusted click in the invisible left portion saves progress. A count tap remains a Step-detail action and never sends a learning mutation. Both faces retain a single header G/F pair, no Step-heading pair, three signal graphics and the neutral count colour. A fixture mounts the real shared header with/without assessment props; existing connected assessment browser cases also verify the real personal Deck path.

```sh
node --import tsx --test tests/group-experience.test.ts tests/group-experience-perspectives.test.ts tests/group-experience-client.test.ts tests/presentation-foundation.test.ts tests/shared-learning.test.ts tests/shared-learning-client.test.ts tests/deck-state-characterisation.test.ts tests/assessments.test.ts

node --import tsx --test --test-concurrency=1 tests/group-experience-perspectives.integration.ts tests/shared-learning.integration.ts tests/assessments.integration.ts

node --import tsx scripts/test-phase2.ts --group-experiences --optimized group-experience-visual.browser.ts group-experience-boundaries.browser.ts group-experience-motion.browser.ts group-experience-perspectives.browser.ts --reporter=line
```

Results: **53 unit checks passed** (`/tmp/group-phase4-visual-unit.log`), **29 integration checks passed** (`/tmp/group-phase4-visual-integration.log`) and **15 Group browser checks passed** (`/tmp/group-phase4-visual-browser-final.log`), with zero failures/skips in those final runs. The Group browser command also completed an isolated optimized build. The unchanged 50-switch next-paint gate passed at **48ms p95**, retaining the same scene/stack/Card/signal nodes. These are local Chromium measurements, not a physical Safari latency guarantee.

The first Group browser run found four failures caused by an implicit grid track expanding to the button's intrinsic width. Explicitly fixing the track to 24px resolved them; the final 15-case run passed. The old boundary assertion measured from the button edge, so it was corrected to measure the visible strip instead.

```sh
node --import tsx scripts/test-phase2.ts --info-cards working-entry.browser.ts working-updates.browser.ts presentation-foundation.browser.ts assessment-ui.browser.ts --reporter=line
node --import tsx scripts/test-phase2.ts --info-cards assessment-ui.browser.ts --grep 'connected assessments|quiet back metadata' --reporter=line
```

The first personal browser run passed 29/33 cases (`/tmp/group-phase4-visual-personal-browser.log`). Three failures asserted the superseded assessment-only confidence colour/size/weight; those expectations now assert neutral/500/0.8rem while retaining the date metadata, collision and target checks. One unrelated timing failure compared a read-only baseline before the normal reload/open recency write had finished. The test now awaits the actual Deck-open POST before taking that baseline, keeping the full-user equality assertion intact; application code is unchanged. The targeted recheck passed **4/4**, zero failures/skips (`/tmp/group-phase4-visual-personal-recheck.log`, 2.6 minutes). Thus all 33 distinct selected personal browser cases have passing coverage across the original run and the affected-case recheck; this is not a claim of a new uninterrupted 33/33 run. No unexplained failures remain. Existing geometry baselines, collision checks, private-source controls, media/signal interactions and lifecycle assertions remain intact.

Targeted ESLint on all seven changed TypeScript files returned **0 errors and 0 warnings** (`/tmp/group-phase4-visual-lint-final.log`). Browser tooling printed its existing `NO_COLOR`/`FORCE_COLOR` warning; no application change was made for terminal colour configuration.

```sh
npx eslint src/components/cards/StepItem.tsx src/components/cards/StepProgressStrip.tsx src/components/group-experiences/GroupCardBack.tsx tests/group-experience-perspectives.test.ts tests/phase2/group-experience-boundaries.browser.ts tests/phase2/group-experience-visual.browser.ts tests/phase2/assessment-ui.browser.ts
env SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=0 PHASE2_BROWSER_TEST=0 PHASE2_OPTIMIZED=0 npm run build
npx tsc --noEmit --incremental false
git diff --check
```

The default production build passed with the group feature disabled and DB configuration cleared (`/tmp/group-phase4-visual-build.log`). Standalone TypeScript passed after the build (`/tmp/group-phase4-visual-types-final.log`). This is a local build only, not a deployment or feature enablement. The final inventory contains exactly the 12 files below, zero staged files and no unexpected changes; HEAD remains `2d9be477f8319b54dbbaeedbbe15fc28c23c1523`.

### Review environment and current file inventory

The original LAN server and database are preserved: **http://192.168.1.38:4181/decks**, PID **64754**, with the same Galway U18/follower fixture IDs listed above. The actual LAN page and updated CSS were fetched successfully after this refinement; the served stylesheet includes the adjacent-row layout. Both disposable logins and authenticated presentations returned 200. No fixture reseeding or production enablement occurred. Credentials remain `phase2` / `local-test-only` and `other` / `local-test-only`; stop with `kill -TERM 64754`.

The final post-build LAN availability check also returned HTTP 200. All approved refinement acceptance checks have passing coverage; physical Safari visual/tactile acceptance remains the user review step.

Review only the visual/tactile changes: the bar/count proximity through ordinary → Focused → expanded comparison; comfort of the progress target and neighbouring instruction taps on Safari; neutral count/confidence hierarchy without smaller confidence numbers; and the quieter back headings with unchanged signal graphics. Values, permissions, persistence and mathematical semantics are automated checks, not manual review requests.

Current refinement inventory (12 files, including the preserved pre-existing handoff edit):

```text
docs/design/features/group-experience/group-experience-phase-4-spec.md
docs/engineering/features/group-experience/group-experience-phase-4-engineering-plan.md
docs/engineering/features/group-experience/group-experience-phase-4-handoff.md
src/app/globals.css
src/components/cards/StepItem.tsx
src/components/cards/StepProgressStrip.tsx
src/components/group-experiences/GroupCardBack.tsx
src/components/group-experiences/group-experience.css
tests/group-experience-perspectives.test.ts
tests/phase2/assessment-ui.browser.ts
tests/phase2/group-experience-boundaries.browser.ts
tests/phase2/group-experience-visual.browser.ts
```

## Progress geometry corrected against main — 31 October 2026

This record supersedes the earlier refinement's equal-height passive/active rows and universal back-confidence-size statements. The latest user instruction makes the existing personal presentation on `main` authoritative. The earlier specification/engineering-plan edits are preserved; only this handoff is updated under this correction's documentation permission.

### Reference and test-first evidence

- Inspected `main` at **`cbffc8d58bd23f129548a113fc15beaebac33725`** through `git show`, without switching branches. Compared it with committed Phase 4 **`2d9be477f8319b54dbbaeedbbe15fc28c23c1523`** and the uncommitted incorrect refinement. HEAD remains the latter commit; Organisations work is unchanged.
- Added `tests/phase2/group-progress-main-geometry.browser.ts` before implementation. It compiles the real Step components and complete corresponding CSS from the pinned Git revisions in memory; no application server, account or database is involved. The same Card 2 Step content, intrinsic 252px Card, viewport and scale are used for each comparison. Local Git history containing both reference commits is a prerequisite for this developer/browser suite.
- Its first valid pre-fix run reported **16 expected failures / 8 passes** across Chromium and WebKit (`/tmp/group-progress-main-red.log`). Existing personal/ordinary individual geometry passed; Group and focused inspected-follower discrepancies failed. Assertions cover description bounds, visible bar top/centre/gap, progress flow height, all following Step positions/heights, count alignment and target geometry. No tolerances or personal baseline files were relaxed.
- Added the missing individual heading-value assertion before restoration: **1 failed / 4 passed** (`/tmp/group-progress-heading-red.log`). Changed the assessment-font expectation before restoring it; the targeted browser case failed as expected (`/tmp/group-progress-confidence-red.log`).

### Additional approval and exact correction

Removing only the unconditional 24px height would still allow roughly 10px-high count text to enlarge main's 3px ordinary progress row. The user explicitly approved a **Group-only non-flowing annotation anchored 6px to the visible bar**, with main-derived slots and the existing target preserved. This approval resolved the instruction's section 4 gate before front implementation proceeded.

| Source/rule | Incorrect refinement | Corrected behaviour |
| --- | --- | --- |
| `ActiveCardFront` → `StepList` → `StepItem` | Layout chosen by aggregate-object presence, so inspected followers missed it | Explicit `experienceProgress` presentation flag for all non-static Experience Cards; personal default path remains unchanged |
| `StepProgressStrip` experience branch | Adjacent wrapper always 24px high | Ordinary 24×3px visual slot; Focused slot reproduces main's 24px control box, existing -5px flow margin and -4px painted adjustment, including read-only views without creating a button |
| `.group-step-learning` | In-flow grid with text contributing row height | Plain block containing the main-derived progress slot; counts do not size the row |
| Experience visual anchor/counts | Count text in a separate grid column | Counts are an absolute annotation at bar width + 6px, vertically centred on the 3px visual anchor; no flow contribution |
| Editable Experience target | Button carried visible bar and determined adjacent row geometry | Separate real 52×24px button at main's original vertical bounds, ending at the bar's right edge; spare 28px extends left, clear of counts; same click handler/label |
| Existing hover/press/entry effects | Descendant-only selectors | Added narrowly scoped sibling-selector alternatives using the exact same existing values/durations so the separate visual anchor keeps established control feedback |
| Individual back heading | Number/dash fallback removed with Group G/F field | Restored original individual `Math.round(reading)`/dash and 11px heading treatment; Group Step-level G/F remains absent |
| Assessment-specific back confidence | `.8rem` inherited after exception deletion | Restored original `.64rem`; neutral `#aeb5c1` and weight 500 remain inherited; front and non-assessment `.8rem` sizes unchanged |

The -5px margin and -4px painted adjustment are recovered main values, not new compensating offsets. Personal progress CSS values and default rendered controls are unchanged. Read-only Experience progress reproduces the focused owner's **appearance**, not editing authority. Counts are outside the button's DOM, so their taps remain Step-detail taps. Signal controls, data, permissions, calculations, Card dimensions/padding, content, scene transforms and animation orchestration are unchanged.

### Four-way geometry evidence

WebKit values below are intrinsic Card pixels for Step 1, using identical two-line Card 2 content. Chromium matches the same gaps/flow contract, with its own fractional text metrics. Step 2 adds its existing 0.5px copy-gap difference. The focused main reference is an editable personal Card; read-only Group/individual views reproduce that visual geometry with no editing control.

| Presentation | main reference gap | Committed Group baseline gap | Incorrect refinement gap | Corrected gap |
| --- | --- | --- | --- | --- |
| Ordinary Group | 4 | 7.5 | 14.5 | **4** |
| Focused Group admin | 10.5 | 14.5 | 14.5 | **10.5** |
| Focused Group read-only | 10.5 | 7.5 | 14.5 | **10.5** |
| Focused Bob, Card 2 | 10.5 | 0 | 0 | **10.5** |
| Own editable follower, Focused | 10.5 | 10.5 | 10.5 | **10.5** |
| Existing personal ordinary / Focused | 4 / 10.5 | 4 / 10.5 | 4 / 10.5 | **4 / 10.5** |

Main and corrected ordinary progress consume **3px** in layout. Main's Focused target box is **24px** but consumes **19px** after its existing bottom margin; corrected Experience slots consume the same **19px**, regardless of edit authority. Visible bar dimensions remain **24×3px**. Bar top/centre relative to the Step match main: **32 / 33.5px ordinary**, **38.5 / 40px Focused** for WebKit's 28px description box. Layout and painted coordinates are therefore checked separately.

Following Step tops relative to Step 1:

| Presentation | main | Committed Group | Incorrect refinement | Corrected |
| --- | --- | --- | --- | --- |
| Ordinary Group | 0, 54, 106.5 | 0, 59, 117 | 0, 73, 145 | **0, 54, 106.5** |
| Focused Group admin | 0, 68, 135 | 0, 73, 145 | 0, 73, 145 | **0, 68, 135** |
| Focused Bob | 0, 68, 135 | 0, 54, 106.5 | 0, 54, 106.5 | **0, 68, 135** |

Ordinary-to-Focused differences are main's existing design, not forced into a single height. Expanded comparison changes only the existing outer scale; tests normalise that scale and compare the same intrinsic geometry. The six-pixel count gap and count/bar centring pass in each applicable state, including zero eligible observations with hidden counts. The original personal geometry snapshots are unchanged.

### Verification completed for the correction

```sh
npx playwright test --config playwright.phase2.config.ts group-progress-main-geometry.browser.ts --reporter=line
node --import tsx --test tests/group-experience.test.ts tests/group-experience-perspectives.test.ts tests/group-experience-client.test.ts tests/presentation-foundation.test.ts tests/shared-learning.test.ts tests/shared-learning-client.test.ts tests/deck-state-characterisation.test.ts tests/assessments.test.ts
node --import tsx scripts/test-phase2.ts --group-experiences --optimized group-experience-visual.browser.ts group-experience-boundaries.browser.ts group-experience-motion.browser.ts group-experience-perspectives.browser.ts --reporter=line
```

- **24/24 main-reference geometry cases passed**, Chromium and WebKit (`/tmp/group-progress-main-green.log`, 31.2 seconds), with the original strict 0.1 intrinsic-pixel comparisons. Matrix includes ordinary/focused, Group editable/read-only, Bob/Card 2, own follower, existing personal, zero-eligible counts and expanded scale.
- **54/54 unit checks passed** (`/tmp/group-progress-corrections-unit-final.log`), including restored individual heading numbers/dashes, Group-only absence of Step G/F, private-data exclusions and existing personal presentation.
- **16/16 actual Group browser cases passed** (`/tmp/group-progress-corrections-browser.log`, 1.2 minutes), including the new real Card 2/Bob ordinary/focused/grid test, subsequent Step spacing, 320/390/1440px editable/read-only alignment, target hit testing, progress saves, signal editing/persistence, revocation/privacy, selection, face/traversal and comparison continuity. Loaded 50-switch paint gate passed at **56ms p95**, with the same scene/stack/Card/signal objects.
- The separately executed heading/font restoration browser selection passed **4/4** (`/tmp/group-progress-restorations-browser.log`) before the final combined regressions. Red-run failures above are intentional pre-implementation evidence, not passing acceptance.

```sh
node --import tsx scripts/test-phase2.ts --info-cards working-entry.browser.ts working-updates.browser.ts presentation-foundation.browser.ts assessment-ui.browser.ts --reporter=line
node --import tsx --test --test-concurrency=1 tests/group-experience-perspectives.integration.ts tests/shared-learning.integration.ts tests/assessments.integration.ts
env SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=0 PHASE2_BROWSER_TEST=0 PHASE2_OPTIMIZED=0 npm run build
npx tsc --noEmit --incremental false
npx eslint src/components/cards/ActiveCardFront.tsx src/components/cards/StepList.tsx src/components/cards/StepItem.tsx src/components/cards/StepProgressStrip.tsx src/components/group-experiences/GroupCardBack.tsx tests/group-experience-perspectives.test.ts tests/phase2/group-progress-main-geometry.browser.ts tests/phase2/group-experience-visual.browser.ts tests/phase2/assessment-ui.browser.ts tests/phase2/group-experience-boundaries.browser.ts
git diff --check
```

The complete personal browser selection passed **33/33** in one run (`/tmp/group-progress-corrections-personal.log`, 4.5 minutes), including unchanged personal geometry baselines, assessments/media/signals, working entry/adoption, gestures and source/persistence regressions. Integration regressions passed **29/29** (`/tmp/group-progress-corrections-integration.log`). The default production build passed (`/tmp/group-progress-corrections-build.log`) with DB configuration cleared and the group feature disabled. Targeted lint on all ten changed TypeScript files passed with **zero errors/warnings** (`/tmp/group-progress-corrections-lint.log`). No unexplained application test failures remain; no pre-existing assertions were weakened or tolerances increased.

Standalone TypeScript passed after the build (`/tmp/group-progress-corrections-types.log`). Final diff validation passed. Inventory checks confirmed exactly 15 working-tree files, zero staged files, unchanged HEAD/main references and no unexpected files. The earlier specification, engineering-plan and boundary-test changes retain their pre-task Git blob hashes. No commits, deployments, provider configuration or production enablement were performed.

### Scope inventory for this correction

Directly changed application files: `src/app/globals.css`, `src/components/cards/{ActiveCardFront,StepList,StepItem,StepProgressStrip}.tsx`, `src/components/group-experiences/GroupCardBack.tsx`, `src/components/group-experiences/group-experience.css`.

Directly changed tests: `tests/group-experience-perspectives.test.ts`, `tests/phase2/assessment-ui.browser.ts`, `tests/phase2/group-experience-visual.browser.ts`, new `tests/phase2/group-progress-main-geometry.browser.ts`. Only this handoff is newly edited documentation. Prior uncommitted specification/engineering-plan edits and the earlier boundary-test measurement correction remain preserved. The complete working tree therefore contains **15 files**, rather than attributing all prior changes to this correction. No fixtures, snapshot baselines, harness/configuration files, Organisations documents or existing commits changed.

```text
docs/design/features/group-experience/group-experience-phase-4-spec.md
docs/engineering/features/group-experience/group-experience-phase-4-engineering-plan.md
docs/engineering/features/group-experience/group-experience-phase-4-handoff.md
src/app/globals.css
src/components/cards/ActiveCardFront.tsx
src/components/cards/StepItem.tsx
src/components/cards/StepList.tsx
src/components/cards/StepProgressStrip.tsx
src/components/group-experiences/GroupCardBack.tsx
src/components/group-experiences/group-experience.css
tests/group-experience-perspectives.test.ts
tests/phase2/assessment-ui.browser.ts
tests/phase2/group-experience-boundaries.browser.ts
tests/phase2/group-experience-visual.browser.ts
tests/phase2/group-progress-main-geometry.browser.ts
```

### Preserved iPhone review

The existing **http://192.168.1.38:4181/decks** review server was verified after the source changes: HTTP 200, updated anchor/count CSS served, and both disposable logins/presentations returned 200. PID remains **64754**; Galway U18 ID remains **`4e63f505-6e2c-485f-a8f8-2be5ed34d4ef`**. No server restart, fixture reset or reseed was performed. Credentials and stop instructions above remain valid.

Refresh Safari and assess Card 2 / Control the movement in Bob's ordinary, Focused and expanded comparison views. Compare the comfortable description/bar relationship and successive Step spacing with main. Then assess Group counts beside those same bar positions, progress-target comfort, restored individual back readings/dashes and the original assessment-back confidence size. Automated checks already cover measurements, editing, permissions and persistence; physical review is for Safari rendering and touch feel.

## Raw counts and quiet Group confidence — 31 October 2026

Only the three subsequently approved presentation refinements are included in this record. The main-reference progress geometry above remains locked; no positioning CSS, progress-slot implementation, Card padding, scaling, gesture, permission or calculation changes were made.

### Exact presentation changes

1. `StepItem.tsx`: the existing non-flowing front annotation now contains only doing and done integers separated by two non-breaking spaces, for example `3  2`. Its existing class, 6px right-hand anchor, neutral 8px/400 styling, eligibility condition and hit testing are unchanged. No denominator, visible wording, punctuation or tooltip was added. Calculated eligible denominators remain unchanged internally.
2. `GroupCardBack.tsx`: existing Group heading children are reordered to title → raw count pair → progress marker. Existing individual readings/dashes remain after the marker. No heading, marker or signal CSS was changed. Tests verify title bounds, heading vertical position/height, marker vertical position/dimensions and signal graphic bounds remain identical to the prior ordering; only the explicitly requested metadata/marker horizontal order changes. Existing accessibility descriptions are retained, with no new labels or tooltips.
3. `ConfidencePair.tsx` plus the Group-only call in `CardSemanticAnchors.tsx`: optional `groupCard` opts actual Group headers into quiet paint and persistent G/F positions. Default consumers retain their exact previous classes, F-presence rule and styling. The existing root class is unchanged; a `data-group-card` style marker scopes the new CSS. Personal and inspected-individual confidence branches do not opt in.
4. `group-experience.css`: three new, Group-Card-only selectors subdue G/F identifiers to opacity .3, hide only the missing dash's ink while preserving its original character advance, and draw a neutral .5px-high, .5em-wide line at opacity .25. The line is an absolutely painted pseudo-element; no slot width/height, gap, font size, numeric weight/colour or wrapper element is added. Existing count, heading and progress rules are unchanged.

The user explicitly selected **existing centring, 12px gap and per-state widths**, rather than fixed-width slots. Existing two-slot footprints vary naturally with content (approximately 40.05px for `7G 4F`, 45.73px for one missing value, 51.42px for both missing in Chromium at the intrinsic font size). Each corresponding footprint is preserved, not forced equal. As expressly requested, a zero-follower Group Card now retains both G and F positions with missing marks; the legacy/default component still omits F with zero followers. This appearance policy does not introduce or recalculate a confidence value.

### Scope and preservation evidence

- `src/app/globals.css`, `StepProgressStrip.tsx`, `ActiveCardFront.tsx` and `StepList.tsx` retain their exact pre-task Git blob hashes. The 24-case main-reference geometry test file is unchanged, including all assertions/tolerances.
- Front ordinary description gaps remain **4 / 4.5 / 4px**, Focused gaps remain **10.5 / 11 / 10.5px**, ordinary/Focused flow remains **3 / 19px**, count gap remains **6px**, and the editable target remains **52×24px**. Existing main-relative following Step positions and expanded-grid scaling pass unchanged.
- All four confidence combinations are exercised: both set, G-only, F-only and both missing, plus two-digit and valid zero values. Tests compare Group and legacy per-state rectangles, centring, 12px gap and numeric styles in ordinary/Focused-scale front/back fixtures. Empty paint is checked independently of layout; zero-followers persistent slots are checked separately from legacy behaviour.
- Back formatting/order tests exercise `6  7`, `2  3` and `0  16` in passive/focused real back components, with no wrapping/overlap. They reconstruct only the previous approved count text/order in a private test document to compare the surrounding unchanged geometry. They do not alter application fixtures or relax a baseline.

### Verification commands and results

```sh
node --import tsx --test tests/group-experience.test.ts tests/group-experience-perspectives.test.ts tests/group-experience-client.test.ts tests/presentation-foundation.test.ts tests/shared-learning.test.ts tests/shared-learning-client.test.ts tests/deck-state-characterisation.test.ts tests/assessments.test.ts
npx playwright test --config playwright.phase2.config.ts group-counts-confidence.browser.ts group-progress-main-geometry.browser.ts --reporter=line
node --import tsx scripts/test-phase2.ts --group-experiences --optimized group-experience-visual.browser.ts group-experience-boundaries.browser.ts group-experience-motion.browser.ts group-experience-perspectives.browser.ts --reporter=line
```

**55 unit checks passed** (`/tmp/group-raw-counts-unit-final.log`). The combined standalone run passed **28/28** (`/tmp/group-raw-counts-geometry-serial.log`, 38 seconds): 24 unchanged main-reference cases and four new Chromium/WebKit count/confidence cases. The actual Group application suite passed **16/16** (`/tmp/group-raw-counts-app.log`, 1.2 minutes), including the updated exact front text assertion, progress saves/hit testing, signal interactions, Bob/Card 2, perspective/scene continuity and the unchanged 50-switch paint budget (**64ms p95**).

Pre-implementation red tests exposed two missing behaviours in the unit selection and all four new browser cases as expected (`/tmp/group-raw-counts-unit-red.log`, `/tmp/group-raw-counts-browser-red.log`). An intermediate implementation added a root style class that broke the existing exact-class assertion; the original class contract was restored and a scoped data attribute used instead, without weakening that assertion. One parallel browser run ended with 27 passes and a trace-artifact `ENOENT` on context close because two runners shared the artefact directory. The logged geometry in that case matched; the identical suite passed 28/28 when run sequentially. No application or harness fix, tolerance increase or assertion removal was used for that tooling failure.

Final unit confirmation passed **55/55** after adding assertions that the real front/back Group headers opt into the scoped treatment (`/tmp/group-raw-counts-unit-complete.log`). The four new browser cases were also rerun after expanding their matrix to ordinary/Focused scales, both faces, all four missing/set combinations, two-digit values and valid zeros: **4/4 passed** (`/tmp/group-raw-counts-focused-final.log`, 14.5 seconds). The main-reference test file and application implementation did not change after the 28-case passing run.

```sh
npx playwright test --config playwright.phase2.config.ts group-counts-confidence.browser.ts --reporter=line
node --import tsx scripts/test-phase2.ts --info-cards working-entry.browser.ts working-updates.browser.ts presentation-foundation.browser.ts assessment-ui.browser.ts --reporter=line
env SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=0 PHASE2_BROWSER_TEST=0 PHASE2_OPTIMIZED=0 npm run build
npx tsc --noEmit --incremental false
npx eslint src/components/cards/StepItem.tsx src/components/group-experiences/GroupCardBack.tsx src/components/group-experiences/ConfidencePair.tsx src/components/decks/CardSemanticAnchors.tsx tests/group-experience-perspectives.test.ts tests/phase2/group-experience-perspectives.browser.ts tests/phase2/group-counts-confidence.browser.ts
git diff --check
```

Personal regressions passed **33/33** (`/tmp/group-raw-counts-personal.log`, 4.6 minutes). The default build passed with database configuration cleared and Group Experiences disabled (`/tmp/group-raw-counts-build.log`); standalone TypeScript passed afterwards (`/tmp/group-raw-counts-types.log`). Final targeted lint passed with **0 errors / 0 warnings** (`/tmp/group-raw-counts-lint-complete.log`). Browser tooling retains its existing terminal colour warning. No unexplained application failures remain.

The review environment was preserved and verified: **http://192.168.1.38:4181/decks**, PID **64754**, same Galway U18 fixture ID. Actual LAN page, both account logins and authenticated presentations returned 200; the new quiet CSS was served. No restart/reseed was performed. Admin `phase2`, follower `other`, password `local-test-only` for both. Refresh Safari and review compact front numbers on the right, reordered back metadata, and quiet marks/identifiers on Group Cards with missing confidence. Mathematics, permissions, saving and geometry are automated checks; physical review is for legibility and visual/touch feel.

### Files attributable to these three refinements

```text
src/components/cards/StepItem.tsx
src/components/decks/CardSemanticAnchors.tsx
src/components/group-experiences/GroupCardBack.tsx
src/components/group-experiences/ConfidencePair.tsx
src/components/group-experiences/group-experience.css
tests/group-experience-perspectives.test.ts
tests/phase2/group-experience-perspectives.browser.ts
tests/phase2/group-counts-confidence.browser.ts (new)
docs/design/features/group-experience/group-experience-phase-4-spec.md
docs/engineering/features/group-experience/group-experience-phase-4-handoff.md
```

All earlier working-tree edits remain preserved. The existing engineering-plan, Organisations documents, commits, fixtures, main geometry tests and review-server data were not rewritten. No commit is authorised or created. The product specification is updated only for raw front/back counts, the requested back order and the clarified quiet/persistent Group G/F presentation.

The complete current working tree has **19 files**: the ten listed for this task plus nine preserved earlier edits (`src/app/globals.css`, `ActiveCardFront.tsx`, `StepList.tsx`, `StepProgressStrip.tsx`, the Phase 4 engineering plan, `assessment-ui.browser.ts`, `group-experience-boundaries.browser.ts`, `group-experience-visual.browser.ts`, and `group-progress-main-geometry.browser.ts`). Final inventory checks found no unexpected files, zero staged files, unchanged HEAD and unchanged locked geometry-file hashes.

## QUESTIONS and stopping point

No unresolved product decision is currently required for the authorised slice. Stop for iPhone visual/interaction review, then seek the subsequent creation/settings instruction. No commits or later-phase implementation are authorised.

## Checkpoint 8 — Atomic Group creation and settings handoff

This section supersedes earlier Checkpoint 8 deferrals and sequential/partial-save recommendations. The accepted Card/perspective implementation is baseline `cccb0ba`; this follow-up is uncommitted on `feat/group-experience`. Automated verification is complete. Physical iPhone review of the new form remains for the user. No Phase 5 or later feature was implemented.

### Implemented workflow

- Published, available Library Decks expose **Add as Group** only when the existing server feature flag is enabled. Existing Edit and personal Add/Open actions keep their relative order and behaviour.
- One isolated full-screen native modal handles creation and editing. It contains Group name, independent Admin/Follower selections, an alphabetical registered-user directory without search, selected-identity Cards, and the default-Off peer-visibility switch. The creator is initially and obligatorily an Admin on creation, never implicitly a Follower. Zero followers and dual roles are supported.
- All selections remain local until Create/Save; Cancel performs no mutation. The directory reuses the existing authenticated `/api/users` minimal identity projection. A per-actor resource deduplicates in-flight requests, reuses successful results, checks the current session and supports explicit retry. Later shells can preload the same resource without changing the form.
- Creation returns to My Decks, without opening the Group. A verified assigned Group ID in `createdGroup` promotes only that new entry; every other personal/Group entry retains its relative order. The promotion persists within the mounted My Decks shell, without a new global sorting policy or database ordering field.
- Admins receive **Group…** in the existing Group Deck menu. Initial metadata, every roster page and a final metadata read must share a structure revision. Removed memberships are not displayed as a history browser; only current roles populate the form.
- Confirmed Save revalidates the existing Group resource and keeps the same Deck scene, valid Card, face and perspective. A settings-specific perspective capture survives transient peer-cache purging and a changed role default. Existing picker, grid, Card rendering and animation code is unchanged.
- Confirmed loss of final access disposes Group resources, immediately removes its cached tile and returns to My Decks, then refreshes assignments. Lost acknowledgements keep the modal mounted even if authority polling notices self-removal first.

### Atomic API and persistence contract

New `PATCH /api/group-experiences/:experienceId/management` requires:

```json
{
  "operationId": "unique-per-submitted-intent",
  "expectedStructureRevision": 0,
  "name": "Galway U18",
  "adminIds": ["registered-user-id"],
  "followerIds": [],
  "allowFollowerInspection": false
}
```

Unknown/missing fields, invalid names/IDs/booleans and unavailable selected users are rejected. ID lists are deduplicated and sorted before hashing. At least one final Admin is required. Creator status supplies no implicit authority when editing.

`manageExperience` owns one existing snapshot/majority MongoDB transaction. It authenticates the actual Admin, checks the expected structural revision, computes role differences, fences the actor/affected memberships (and active followers when policy changes), then applies narrow role changes and existing lifecycle rules. Removal snapshots, retained assignment references, rejoin metadata, name/policy/admin count, one revision increment and one operation receipt all share the same session. An error at any stage aborts everything. Existing public membership/settings methods are not called from inside this transaction because they each own an independent transaction.

Existing collections, unique indexes and `GroupExperience.allowFollowerInspection` are reused. No new collection/index, destructive migration, provider call, personal CardData migration, background job or whole-roster deletion is introduced. Existing member/settings/adoption API contracts remain unchanged.

Creation accepts optional `allowFollowerInspection` in its existing transaction, defaulting to false. Omitted policy retains the historical creation-command hash, so legacy retries remain valid. Creator union into Admins and explicit Follower selection are preserved. Responses add `hasAccess`; an exact old creation acknowledgement after loss of access returns only actor/experience/outcome/access information.

Management receipt replay is deliberately separate from the existing replay helper. After HTTP session/actor binding, it looks up only this actor's exact operation and verifies its management-specific command hash **before** requiring current Group authority. It returns only `viewerUserId`, `experienceId`, the original committed `structureRevision`, `outcome` and current `hasAccess`. This allows recovery after self-demotion/removal without returning Group content, roster or renewed permission. A new operation still requires current Admin authority; another actor cannot acknowledge this receipt. Later mutations do not cause the old operation to execute again or masquerade as current Group state.

The client sends one POST or PATCH, never a sequence of independently committed commands. Network errors/5xx are uncertain outcomes, not proof of rollback. Freeze the exact submitted command and operation ID for Retry; do not navigate or allow edits/Cancel to pretend it was unsubmitted. Every Retry goes back through authenticated receipt acknowledgement, including after a confirmed commit followed by a failed refresh or later revocation. Definitive validation/revision errors leave draft selections intact. No automatic rebasing or overwrite of newer Admin edits occurs.

### Verification — commands and actual results

All database work below used owned local disposable replica sets. The original LAN review process was retained, not restarted or reseeded. Temporary Groups created by browser tests remain disposable; Galway U18 and the existing named fixtures were preserved.

```sh
node --import tsx --test --test-concurrency=1 tests/group-experience-management.integration.ts tests/group-experience-api.integration.ts
```

**24 passed, 0 failed** (`/tmp/group-checkpoint8-db.log`). Includes whole-form success; failure injection at member/snapshot/experience/receipt stages; creation rollback; invalid/incomplete commands; zero final Admin rejection; competing Admin edits; stale adoption; self-demotion/removal; exact parallel retries; lost creation acknowledgement; rejoin/live learning preservation; both deterministic removal-versus-learning orderings; real HTTP authentication, actor binding and restricted receipt replay.

The earlier broader command also executed the unchanged repository/lifecycle/projection suites:

```sh
node --import tsx --test --test-concurrency=1 tests/group-experience-management.integration.ts tests/group-experience-api.integration.ts tests/group-experience.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-perspectives.integration.ts
```

The three existing suites contributed **38 passing checks**. That initial overall run was **58 passed / 2 failed**: the new API test changed a shared fixture before existing API tests used it. Its fixture is now restored after the test; the complete API suite passed in the final 24-check run above. One initial management fixture attempted to publish unchanged content (`NO_UNPUBLISHED_CHANGES`); it now publishes an actual reordered-Step version and passes. An earlier broad run needed forced teardown of an owned Mongo child after its graceful timeout; no application database was involved.

```sh
node --import tsx --test tests/group-management-client.test.ts tests/group-experience-client.test.ts tests/group-experience-perspectives.test.ts tests/library-ui.test.ts tests/library-entry.test.ts tests/library-read-models.test.ts tests/presentation-foundation.test.ts
```

**40 passed, 0 failed** (`/tmp/group-checkpoint8-unit.log`). Directory coalescing/cache/session/retry, complete/mixed-revision roster loading and isolated entry promotion supplement the existing resource, privacy, confidence and presentation assertions.

```sh
node --import tsx scripts/test-phase2.ts --group-experiences group-management.browser.ts group-experience-perspectives.browser.ts group-experience-motion.browser.ts library-entry.browser.ts deck-menu.browser.ts --grep-invert '50 loaded comparisons'
```

**22 passed, 0 failed** (`/tmp/group-checkpoint8-browser-final.log`). Includes the new form workflow plus existing picker entry/exit, Group/self policy, stack/face/traversal continuity, personal archive, touch menu and Library add/restore behaviour. The loaded-comparison performance benchmark was not rerun; no animation code changed. The exact Library menu expectations now include Add as Group when the flag is enabled; the original expectations remain exact with the flag Off.

The final additional workflow/geometry run used the preserved disposable review server:

```sh
PHASE2_GROUP_FIXTURE="$(node -p 'JSON.stringify(require("./phase2-test-results/review-server.json").groupReview)')" PHASE2_BASE_URL=http://127.0.0.1:4181 node node_modules/@playwright/test/cli.js test --config playwright.phase2.config.ts group-management.browser.ts group-progress-main-geometry.browser.ts
```

**33 passed, 0 failed** (`/tmp/group-checkpoint8-continuity.log`): nine current workflow cases and all **24 unchanged main-reference geometry cases across Chromium/WebKit**. Covers directory failure/retry retaining the draft; whole-form creation and cancellation; zero followers; dual roles; stale draft preservation; non-default follower/Card 2/back-face/physical-scene retention; self-demotion with valid Group perspective; exact lost-response recovery; and later revocation between commit and refresh. No geometry expectation or tolerance was changed.

```sh
node --import tsx scripts/test-phase2.ts deck-menu.browser.ts library-entry.browser.ts
```

**7 passed, 0 failed** with Group Experiences disabled (`/tmp/group-checkpoint8-feature-off.log`). Confirms the existing personal menu and Library contracts remain intact.

```sh
PHASE2_GROUP_FIXTURE="$(node -p 'JSON.stringify(require("./phase2-test-results/review-server.json").groupReview)')" PHASE2_BASE_URL=http://127.0.0.1:4181 node node_modules/@playwright/test/cli.js test --config playwright.phase2.config.ts --browser webkit group-management.browser.ts --grep 'Library Create|zero-follower Group|lost Save response'
```

**3 passed, 0 failed** (`/tmp/group-checkpoint8-webkit.log`): creation/Cancel/cache/order, atomic settings/context retention, and lost-response self-removal. This supplements, rather than replaces, physical Safari review.

An initial attempt to run DB-dependent Library/menu files directly against the review URL was refused by `assertDisposableDatabase` because their owning database environment was absent: 14 passed, 2 setup failures, 5 not run. They were rerun using the owning harness above. A subsequent flag-On menu run initially retained the old two-item expectation; the assertion was updated specifically for the approved third action and passed, with flag-Off coverage unchanged. Final verification has no unexplained failures. Browser logs contain the existing NO_COLOR/FORCE_COLOR environment warning.

```sh
env SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=0 PHASE2_BROWSER_TEST=0 PHASE2_OPTIMIZED=0 npm run build
npx tsc --noEmit --incremental false
```

**Production build passed**, database access cleared and Group flag Off (`/tmp/group-checkpoint8-build-final.log`). **Standalone TypeScript passed** after the build (`/tmp/group-checkpoint8-types.log`). Targeted ESLint passed for all **19 changed TypeScript files**, with no warnings/errors. `git diff --check` passed. No production configuration, deployment, provider access or feature enablement was performed.

### Complete changed-file inventory — Checkpoint 8 only

Documentation:

- `docs/design/features/group-experience/group-experience-phase-4-spec.md`
- `docs/engineering/features/group-experience/group-experience-phase-4-engineering-plan.md`
- `docs/engineering/features/group-experience/group-experience-phase-4-handoff.md`

Backend:

- `src/app/api/group-experiences/[experienceId]/management/route.ts` (new)
- `src/lib/groupExperiences/management.ts` (new)
- `src/lib/groupExperiences/contracts.ts`
- `src/lib/groupExperiences/model.ts`
- `src/lib/groupExperiences/repository.ts`

UI and client resources:

- `src/app/library/page.tsx`
- `src/app/library/[deckTemplateId]/page.tsx`
- `src/components/library/LibraryShell.tsx`
- `src/components/decks/DeckMenu.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/group-experiences/GroupExperienceDeck.tsx`
- `src/components/group-experiences/GroupManagementForm.tsx` (new)
- `src/components/group-experiences/group-management.css` (new, modal-only selectors)
- `src/components/group-experiences/groupManagementClient.ts` (new)
- `src/components/group-experiences/userDirectory.ts` (new)

Tests:

- `tests/group-experience-management.integration.ts` (new)
- `tests/group-management-client.test.ts` (new)
- `tests/group-experience-api.integration.ts`
- `tests/phase2/group-management.browser.ts` (new)
- `tests/phase2/deck-menu.browser.ts`

No Card front/back, progress/confidence, existing global CSS, perspective picker/grid, learning arithmetic, gesture/animation, media, Info Card, assessment, reflection or Organisations source file changed. Existing commits, branch and other worktrees were preserved. No staging or commit was performed.

### iPhone review and remaining boundaries

Verified LAN creation entry (HTTP 200):

`http://192.168.1.38:4181/library/b0d10e0f-17b9-4a90-b3fb-7aafd6fbe4a3`

My Decks: `http://192.168.1.38:4181/decks`. Sign in as **phase2 / local-test-only** (Admin); **other / local-test-only** remains the follower review account. This is the original disposable process, PID **64754**, with its existing named fixtures. Stop it when finished with `kill -INT 64754`.

Physical review should assess the full-screen modal, keyboard/name field, touch comfort of independent role checkboxes and the visibility switch, alphabetical-directory and selected-Card scrolling, Create-to-My-Decks transition, and Group… Save/Cancel closing back into the existing Card context. Mathematical, permission, persistence, concurrency and retry checks above do not need manual repetition.

Directory caching and drafts/pending commands are in-memory, not a cross-tab/offline outbox. A revision conflict deliberately retains the draft and rejects Save; Cancel/reopen loads a fresh baseline rather than silently merging another Admin's edits. Removal cost scales with removed followers × selected Cards inside one transaction; no split commits or background cleanup were added. Existing group index provisioning and the feature flag remain operational prerequisites. No real participant enablement is authorised. Removed-follower history UI and all Phase 5–10 features remain deferred. No material product question remains; review Checkpoint 8 on iPhone before any subsequent phase.

Reproducible targeted lint command (19 TypeScript files; no output errors or warnings):

```sh
node --input-type=module <<'NODE'
import {execFileSync} from 'node:child_process';
const files=[...new Set(execFileSync('git',['ls-files','--modified','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n'))].filter(file=>/\.tsx?$/.test(file));
execFileSync('node',['node_modules/eslint/bin/eslint.js',...files],{stdio:'inherit'});
console.log(`Lint passed for ${files.length} changed TypeScript files.`);
NODE
git diff --check
```
