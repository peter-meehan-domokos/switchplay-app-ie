# Loading Architecture V3 — Checkpoint 4 handoff

Checkpoint: coordinated refresh, resume and introduction preparation. Branch: `feat/group-experience`. Starting tree was clean at `ea692cb`. Implementation and automated verification are complete. Automated Checkpoint 4 exit criteria are met; physical iPhone review remains pending. This document was saved incrementally during the work. Checkpoint 5, deployment, media-security work, thumbnail warming and perspective animation changes are excluded.

## 1. Implementation and ownership

### One active Group refresh owner

The retained `groupResource` owns one watcher-counted clock and the Group focus/pageshow/visibility/connectivity handlers. Multiple consumers share the same work. Last-view unmount stops view activity without disposing accepted data or submitted writes. Hidden/offline views stop polling; authority freshness still expires. Background follower preparation retains its existing foreground/save/playback priority rules.

| Operation | Behaviour |
|---|---|
| Active mutable read | Approximately every four seconds, covering the selected perspective across all Cards. Compatible in-flight reads are shared. |
| Narrow authority read | Intervening two-second tick, only when a compatible content check has not satisfied freshness. Slow content requests can renew independently. |
| Authority lease | Existing five seconds from **request start**, not response arrival. No indefinite trust, session-marker variable or authentication lifetime change. |
| Group media/reflection previews | Existing retained domain controllers receive batched accepted data; their component-owned Group timers/focus fetches are removed. |
| Open Gallery/Media Centre | Existing cursor-based controllers subscribe to the resource clock. Their additional protected page requests remain necessary for the visible Gallery/management page. |
| Personal-only controllers | Existing appropriate domain refresh behaviour remains; Personal shell resume requests share one pending batch. |

The new protected `/api/group-experiences/[experienceId]/refresh` uses a snapshot transaction. It checks actor, membership, selected-subject policy, publication visibility and exact access/adoption/structure revisions. It batches learning, exact newest-five/count media windows and authorised reflection feeds. Group-only aggregates use narrow learning fields and existing arithmetic. It does not reload canonical instructional bodies, every follower perspective or full media histories. Large notes use the existing bounded transport/fragment validation, without truncation or content caps.

The existing explicit template Update review remains separate: it checks availability of newly published versions on entry/focus and does not automatically adopt them. It is not another recurring mutable-data poll. Existing server-side save/adoption checks remain authoritative.

Unchanged resource data/page/feed references are retained. Changed source sections still reconcile through the Checkpoint 1 stamps, lanes and domain controllers. Older responses cannot replace newer optimistic edits; independent valid sections are accepted. G changes do not invalidate F. Dirty F repair joins a scheduled mutable read only if its capture includes the dirty dependency; an older pending snapshot cannot hold the repair hostage or undo a newer aggregate result. The approved `…` treatment remains limited to affected displayed aggregates.

### Resume, revocation and return

Focus, pageshow, visibility and online events coalesce into a current-session check and protected refresh. Temporary network/identity-service failure keeps complete accepted Cards read-only. A successful check restores permitted editing; confirmed session denial/account mismatch clears retained protected data and shell projections. Group membership denial clears the Group. Confirmed inspection/scope changes retire foreign domain resources immediately, preserve permitted primary content and obtain a complete current composition. Older authority failures cannot cancel newer valid grants; known revision floors reject stale repair responses.

Prepared read-only Card/perspective navigation stays local during temporary unreachability; it does not enqueue offline navigation writes. Warm Group entry uses the existing protected actual-open operation and retained complete data. Changed composition falls back to the composed reader; a removed saved Card uses the existing valid-Card entry fallback. A completely discarded Safari page still loads afresh.

Personal resume concurrently fetches the existing preparation and membership endpoints, then performs **one current-actor check after both responses**. This replaces two trailing identity checks without reusing an earlier identity observation. A 503 is not misclassified as a confirmed account change. The check is covered by a deterministic cookie-change test and browser failure/recovery tests.

### Introduction intent and actual opening

The existing DeckGrid starts player loading first, then asynchronously signals read-only preparation. My Decks routes this intent to the existing Group resource or a small Personal preparation-request map. Completed data and compatible pending requests are reused; no general cache framework or prefetch scheduler is added. Preparation is scoped to actor and selected/adopted composition, and invalidated on account clearance.

Actual entry joins useful pending preparation, then performs the existing protected opening/date initialisation. For Personal entry, the server resolves current membership/content and compares the exact adopted Deck/Card identity before skipping redundant preview/assessment retrieval. Changed composition uses a complete read. Retained domain controllers remain the writable source owners. Stale or locally invalidated retained Personal previews are repaired in the background without clearing the Card.

Preparation does not set `openedAt`, initialise dates, mark instructional progress or record an introduction view. Existing introduction-view semantics and the seven-Card media/video preparation window are preserved. V3 deferred new `viewedAt` persistence/analytics; none is introduced here. No speculative Gallery image/video downloads or thumbnail decoding is added. The Library already receives canonical introduction/Card media references; it receives no new speculative Personal/Group preparation, collection pagination or viewport prefetch behaviour.

## 2. Measurements

All new results below use disposable local fixtures. They are **not hosted Vercel/Atlas performance**, physical Safari timings or promises about slow-network latency. The existing review database and real Cloudflare media were not used or mutated.

### Matched refresh/request comparison

Optimized local six-Card Group; Admin focused back face; two-second settling period, then a 12-second measurement window. One baseline and four completed after samples per engine at this writing. Individual results are preserved rather than treated as a statistical guarantee.

| Engine | Baseline background GETs | Coordinated GETs, runs 1 / 2 / 3 / 4 | Player save → Admin F, baseline | Coordinated runs 1 / 2 / 3 / 4 |
|---|---:|---:|---:|---:|
| Chromium | 23 | 6 / 6 / 6 / 6 | 2,280 ms | 2,281 / 2,330 / 2,270 / 2,279 ms |
| WebKit | 23 | 6 / 6 / 6 / 6 | 2,322 ms | 2,332 / 2,298 / 2,277 / 2,272 ms |

Baseline: 12 authority, three presentation, three perspectives, three aggregate and two reflection reads. After: three mutable refreshes and three narrow authority reads. **17 fewer GETs, approximately 74%, with cross-user updates still observed in about 2.3 seconds.** This is save-request-to-semantic-DOM-update, not physical input-to-paint. The 15-second media timer fell outside the original window, so additional media-poll savings are not claimed. Open Gallery pages may legitimately add requests.

### Database and payload findings

Protected warm refresh with 600 disposable contributions across six Cards:

| Selected perspective | MongoDB commands | Response JSON bytes | Individual local samples |
|---|---:|---:|---:|
| Group | 17 | 28,670 | Approximately 51–60 ms |
| Me | 15 | 23,954 | Approximately 44–49 ms |
| Inspected follower | 15 | 23,277 | Approximately 45–48 ms |

Counts include transaction/cursor operations. No `listIndexes`, `listCollections`, inserts, updates or deletes occurred in these reads. Full canonical bodies and complete roster perspectives are absent. Existing long owner-history/long-reflection/100-member preparation coverage also passes. These samples establish reduced work and exact projection equivalence, not regional database RTT.

## 3. Automated verification

| Verification | Result |
|---|---|
| Full unit suite, `npm run test:unit` | **623 passed** |
| Scoped TypeScript, `npx tsc --noEmit -p /tmp/cp2-typecheck.json` | Passed; source, tests and scripts, excluding ignored diagnostic output |
| Targeted ESLint, all 34 changed/new TypeScript files | Passed |
| New refresh + existing initial/follower preparation MongoDB integration | **20 passed** |
| Existing perspective/management/lifecycle/media/reflection/collection integration | **96 passed** |
| Introduction/video-window/signal visibility/null/rollback Playwright specs | **43 passed** |
| Existing Group boundaries/perspective browser fixtures | **12 passed** |
| Complete-loading, Deck boundaries, focused gestures, perspective preparation, CP4 lifecycle, retention and motion mobile suite | 52 passed; four new lifecycle setup assertions required correction; one legacy Personal motion case skipped by its existing fixture gate. Fresh corrected lifecycle rerun recorded below. |
| Fresh optimized CP4 lifecycle rerun after final race/account-clearance guards | All **16 cases passed** across the corrected 16-case run (14 passes) and final two Personal cases, Chromium and WebKit |

Database tests own disposable MongoDB replica sets. Two MongoMemoryServer shutdowns required the library SIGKILL fallback after passing tests; no persistent database was involved. Initial oversized transport testing found and fixed a paging-header issue; the final exact long-note roundtrip passes.

The first broad 57-case mobile run passed 52 cases and skipped the legacy Personal motion case because its separate fixture marker was absent. Four new identity-service resume cases assumed that earlier tests had not changed the saved active Card; trace evidence showed legitimate three/zero-preview Cards before any simulated outage. Those tests now explicitly select the media-rich first Card (and valid Group return geometry). Personal additionally inspects the visible focused back face: its front-facing Deck stack intentionally does not subscribe the hidden back face to the media viewer. The first corrected build passed all Group cases; the Personal assertion was refined to match this existing mounted-view contract. The focused rerun then exposed an over-broad request-count assertion: Personal publication Update reviews still make their own protected version reads/current-actor checks, outside the shell batch. The final test asserts exactly one shell preparation read and one membership read; the deterministic batch unit test separately proves the single trailing identity check. Group still asserts one coalesced resume identity check. No publication-review authorisation was removed. No application behaviour was changed to satisfy these setup assertions. The existing eight Personal/Group Deck-boundary cases, Personal focused-signal cases and complete-loading/retention cases ran independently of the skipped legacy case. The native Chromium 50-switch Event Timing check passed: 72 ms p95 versus its existing 100 ms limit in this local sample. WebKit gesture automation uses simulated pointer movement; native Chromium touch and physical Safari are distinguished.

Two existing isolated Playwright harnesses initially could not bundle imported font assets. Their test-only esbuild configuration now supports the imported TTF/WOFF/WOFF2 assets; all 43 tests then ran and passed. This does not change application fonts, thumbnail preparation or UI.

The optimized browser runner builds production Next/React with the existing scoped TypeScript configuration. The unrestricted workspace build has the known ignored `phase2-test-results/deployment-checkpoint-1/inventory.ts:46` AWS SDK `CORSRules` typing limitation. That file and application build configuration remain untouched. Scoped production build evidence must not be described as a passing unrestricted workspace build.

## 4. Physical iPhone review — pending

Existing source-review server, port 4184, uses its existing disposable review database and mock media providers. Confirmed the existing app process remained alive and copied/byte-verified only the 27 changed/new application source files into its existing checkout. No restart or reseed occurred; the existing review database is preserved. Reload Safari once to replace the old in-memory client resource. Read-only smoke checks after copying: auth endpoint returns the expected anonymous **401**; login page returns **200**. The server does not require restarting. No review data reset or reseed is authorised or needed. Physical Safari verification remains pending; automated WebKit is not physical Safari.

Group address (plain text):

http://192.168.1.38:4184/decks?openExperience=f66732d3-81b1-4cf6-993a-0890a45c1e91

Personal address (plain text):

http://192.168.1.38:4184/decks?openDeck=5b6b9f88-cb9d-43d7-a396-83838b7e1bc4

Use `phase2` / `local-test-only` for the Admin, and `Aoife Kelly` / `local-test-only` for a follower. Reload Safari once after the source update, then:

1. Open all six Cards, focus/flip/swipe both ways, inspect reflections/media and switch among already prepared perspectives. Check that the complete Card and established gesture boundaries remain stable.
2. Put Safari in the background, return, and briefly turn connectivity off/on. Known media/reflections should remain; unavailable verification may disable edits, then recover. Leave/reopen the Deck and revisit a prepared follower.
3. On another browser/device, save follower confidence/progress and watch the Admin F aggregate update within a few seconds. Change collective G separately; F must not be spuriously invalidated. Check pending-save `…`, rollback/retry and immediate reflection feedback.
4. Use an existing Deck with an introduction: play it, enter early, and confirm playback/entry remain usable and do not duplicate loading. The preserved phone fixture may not include a playable introduction; automated fixtures explicitly cover Personal and Group video decoding plus held metadata preparation. Do not alter review content just to add this case.
5. Confirm logout/account switching clears protected Cards. Check permitted versus read-only follower actions. Automated disposable tests exercise role/member/visibility/adoption revocations; do not revoke real review memberships just for this check.

Mock providers do not establish live Cloudflare upload/playback configuration. No new physical gesture/thumbnail issue is declared fixed without physical verification. The separate thumbnail/perspective-animation work remains deferred.

## 5. Scope, limitations and Git

No Card geometry, gesture thresholds, animations, authentication lifetime, provider settings, deployment configuration, feature flags, databases or media architecture changed. No hosted deployment, push or merge was performed. Checkpoint 5 is not started. There is no unresolved automated application failure from these checks; physical Safari playback, resume and update-latency acceptance remains pending. Personal publication Update availability checks remain separate protected reads and are not included in the measured six-request active Group window. Exceptional multi-megabyte notes are transported exactly but still cost bandwidth; no hosted or constrained-network performance gain is asserted.

This handoff is included in the separate Checkpoint 4 commit with subject `feat: coordinate refresh resume and introduction preparation`. Its hash is reported in chat; `git log -1 --format=%H -- docs/engineering/features/group-experience/loading-architecture-v3-checkpoint-4-handoff.md` identifies the containing commit without a self-referential hash. Final inventory and acceptance outcome follow.

## 6. Complete changed-file inventory

35 files: 27 application files, 7 test files and this handoff. All belong to Checkpoint 4; no plan, configuration or ignored diagnostic file is included.

- `docs/engineering/features/group-experience/loading-architecture-v3-checkpoint-4-handoff.md` — Checkpoint implementation, verification, limitations, review instructions and inventory.
- `src/app/api/decks-data/[deckTemplateId]/preparation/route.ts` — Validate optional retained-composition identity on actual Personal entry.
- `src/app/api/group-experiences/[experienceId]/open/route.ts` — Validate optional actual-entry perspective selection.
- `src/app/api/group-experiences/[experienceId]/refresh/route.ts` — Protected narrow mutable refresh and bounded continuation route.
- `src/components/decks/DeckGrid.tsx` — Signal read-only preparation after starting introduction playback.
- `src/components/decks/updateClient.ts` — Share post-read current-actor verification across Personal resume reads; preserve transient-error distinction.
- `src/components/group-experiences/GroupCardBack.tsx` — Pass the resource refresh owner to existing preview/reflection consumers.
- `src/components/group-experiences/GroupExperienceDeck.tsx` — Watch the retained coordinator instead of owning duplicate timers; retain overlays/domain consumers.
- `src/components/group-experiences/groupResource.ts` — Coordinate refresh, authority, resume, inspection withdrawal, retained entry and introduction requests.
- `src/components/layout/AppShell.tsx` — Integrate Personal resume deduplication, account clearance and My Decks introduction intent.
- `src/components/media/CardMediaCentre.tsx` — Use Group refresh owner for existing management pages.
- `src/components/media/CollectionGallery.tsx` — Use Group refresh owner without changing viewer/paging behaviour.
- `src/components/media/useMediaCollection.ts` — Remove Group component polling; register view-owned Gallery pages with the owner.
- `src/components/reflections/ReflectionArea.tsx` — Disable duplicate Group component polls while retaining existing optimistic controller.
- `src/lib/cards/learning.ts` — Reusable narrow Step learning projection, retaining full-content validation for existing callers.
- `src/lib/cards/personalPreparationClient.ts` — Retain and deduplicate read-only introduction work; join protected actual opening.
- `src/lib/cards/preparation.ts` — Reuse compatible previews on real Personal entry without skipping date/open writes.
- `src/lib/cards/preparationIdentity.ts` — Exact adopted Personal Deck/Card composition identity.
- `src/lib/groupExperiences/http.ts` — Expose/validate optional Group opening selection in existing command contract.
- `src/lib/groupExperiences/learningReads.ts` — Use narrow selected Step identities for batched learning reads.
- `src/lib/groupExperiences/presentationReads.ts` — Use narrow selected learning projection for independent aggregate repair.
- `src/lib/groupExperiences/publicVersions.ts` — Verify selected publication and retrieve Step identities without instructional bodies.
- `src/lib/groupExperiences/refresh.ts` — Snapshot mutable learning/aggregate/media/reflection reader and existing bounded transport packing.
- `src/lib/groupExperiences/refreshAssembly.ts` — Client-safe exact continuation assembly.
- `src/lib/groupExperiences/refreshOwner.ts` — Small typed refresh subscription interface.
- `src/lib/groupExperiences/repository.ts` — Protected retained opening selection and narrow collective learning reuse.
- `src/lib/mediaCollection/controller.ts` — Retain unchanged accepted pages, track local freshness and retire confirmed obsolete Group scopes.
- `src/lib/reflections/controller.ts` — Retain unchanged feeds and retire confirmed obsolete inspection/composition scopes.
- `tests/card-video-preparation.spec.ts` — Test harness font-asset bundling support; seven-Card video preparation coverage.
- `tests/deck-intro-playback.spec.ts` — Test harness font-asset bundling support; existing playback tests.
- `tests/group-experience-client.test.ts` — Update expected retained actual-open and confirmed-scope clearance behaviour.
- `tests/group-refresh.integration.ts` — Disposable snapshot equivalence, permissions, G/F, exact long-note paging and no-opening-write tests.
- `tests/group-refresh.test.ts` — Deterministic shared clocks, stale authority/source/save overlap, session failure and retained entry tests.
- `tests/introduction-preparation.test.ts` — Personal pending reuse, failed-read recovery, account clearance and trailing actor batch guard.
- `tests/phase2/group-refresh-resume.browser.ts` — Mobile request/latency measurements, offline/identity recovery, account expiry and playable-introduction lifecycle.

## 7. Reproduction commands and exit assessment

- Unit: `npm run test:unit` — 623/623.
- MongoDB: `node --import tsx --test --test-concurrency=1 tests/group-refresh.integration.ts tests/card-preparation.integration.ts tests/group-follower-preparation.integration.ts` — 20/20.
- Existing MongoDB regressions: `group-experience-perspectives`, `group-experience-management`, `group-experience-lifecycle`, `group-media`, `group-reflections`, `media-collection` integration files — 96/96.
- Standalone Playwright: `deck-intro-playback`, `card-video-preparation`, `deck-video-preparation`, `signal-confidence`, `signal-readings-null`, `signal-rollback`, `signal-visibility` specs, one worker — 43/43.
- Existing Group permissions/perspective browsers: `node --import tsx scripts/test-phase2.ts --group-experiences group-experience-boundaries.browser.ts group-experience-perspectives.browser.ts` — 12/12.
- Optimized mobile regressions: `node --import tsx scripts/test-phase2.ts --optimized --group-media --complete-loading complete-card-preparation.browser.ts deck-interaction-boundaries.browser.ts focused-signal-arbitration.browser.ts group-perspective-preparation.browser.ts group-refresh-resume.browser.ts loading-retention.browser.ts group-experience-motion.browser.ts`. First broad run: 52 passed, four new setup assertions corrected as described above, one existing fixture-gated skip. The corrected fresh 16-case `group-refresh-resume.browser.ts` run passed 14 cases; the final `--grep 'Personal resume retains'` rerun passed both remaining cases. Across these runs, all 56 applicable cases in the 57-case set have passing evidence; no failing assertion is waived.
- Scoped TypeScript, targeted ESLint (34 TS/TSX files, with the final edited browser file linted again), production optimized build and `git diff --check` passed. The scoped TypeScript configuration extends the repository configuration and includes source/tests/scripts plus generated optimized route types, excluding ignored diagnostics. No build configuration or ignored historical diagnostic was changed to obtain this result.

Automated exit evidence covers shared clocks/pending reads, retained complete content, stale read/save reconciliation, G/F dependencies, exact mutable projections, current permissions/revisions, confirmed expiry/account clearance, temporary offline and identity-service recovery, real decoded introduction playback while preparation is held, no speculative opening writes, genuine entry joining, prepared follower navigation and approved gesture boundaries. The legacy skipped Personal motion case is supplemented by the actual Personal complete-loading, retention, Deck-boundary, native-touch confidence and video tests; physical Safari remains a separate acceptance step.

Final review confirmed all 35 changed files belong to Checkpoint 4. The separate commit includes this handoff. No unrelated uncommitted work existed at the start; final commit hash and clean-tree verification are reported in chat. Stop here for physical review and authorisation; do not start Checkpoint 5.
