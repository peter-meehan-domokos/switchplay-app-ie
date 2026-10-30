# Group Experiences — Phase 4 initial slice handoff

**Date:** 30 October 2026  
**Branch:** `feat/group-experience`  
**Status:** Initial slice implemented and automated gates passed; awaiting physical iPhone review. No changes committed.  
**Authority:** [Phase 4 product specification](../../../design/features/group-experience/group-experience-phase-4-spec.md), especially P15, and [dedicated engineering plan](group-experience-phase-4-engineering-plan.md). Checkpoints 1–7 and 9 only. Checkpoint 8 and Phases 5–10 remain excluded.

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

The following is the complete **62-file** working-tree inventory, including the test-only optimized-build configuration and ignore entry. No unexpected files changed. The specification and dedicated plan were already untracked at the beginning of the resumed implementation and have been preserved/updated. Generated test artefacts remain ignored; no commits were made.

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

## QUESTIONS and stopping point

No unresolved product decision is currently required for the authorised slice. Stop for iPhone visual/interaction review, then seek the subsequent creation/settings instruction. No commits or later-phase implementation are authorised.
