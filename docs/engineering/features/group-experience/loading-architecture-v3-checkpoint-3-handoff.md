# Loading Architecture V3 — Checkpoint 3 handoff

Status: Checkpoint 3 implementation and automated verification complete, included in its separate checkpoint commit. Physical iPhone acceptance remains pending. Baseline: `b85eac4` on `feat/group-experience`, clean starting tree. Checkpoint 2 physical iPhone acceptance was confirmed by the user. The committed login-default correction and Deck interaction-boundary correction are preserved.

Scope: primary Group/Me preparation, permitted follower batch preparation, scoped retained readiness and existing picker/list/grid integration. No Checkpoint 4 refresh/resume/introduction consolidation, deployment, media-security work or animation changes.

Approved interaction contract: complete initial perspective; immediate navigation/flip within every prepared perspective; immediate ready-perspective selection. Only the existing V3 one-time primary Loading and All followers Loading/error/retry boundaries apply. Keep the existing Card mounted while preparing another view.

## Progress and implementation evidence

- Read V3 and Checkpoint 2 handoff; inspected retained Group resource, composed reader, domain media/reflection controllers and existing picker/grid.
- Initial Me/inspection readers now retrieve only selected learning. Group still calculates F from narrow learning records; it does not prepare follower media/reflections for entry. Group/Me follow-ups hydrate existing retained domain controllers without changing navigation.
- Added authorised batched current-Group follower projections, exact media windows/reflections and scope-checked bounded continuations. Normal 16–20 followers × six Cards fits one query slice/response; larger operations continue with at most 128 Card/subject projections per query slice and 2,500,000 serialized bytes per response. These are transport budgets, not membership/content limits. Individual giant JSON entries fragment and reassemble exactly with digest checks. Primary composed responses also page when necessary; only the initial POST records an actual opening.
- Resource follow-up work shares compatible in-flight requests, preserves source-specific optimistic changes, publishes follower readiness together and retains interrupted pages. Account/scope changes reject late results. Already prepared Group views remain ready during R1 aggregate reconciliation.
- Existing picker, unfocused list and focused comparison grid are wired to complete readiness. Pending primary selection preserves the current Card and uses Loading in the picker; follower bodies show Loading followers or error/retry until the complete permitted set is ready.
- A small view-owned idle-start hook prepares Group, then applicable Me, then permitted follower sets up to the approved 20-follower automatic trigger. Existing foreground state (gestures, transitions, dialogs, playback and pending work) gates new starts. No refresh timer consolidation or introduction preparation is included.

## Verification

Verification in progress. All mutation tests use disposable fixtures. No Atlas or real media data was modified. The previous temporary phone fixture was found unavailable; replacement details are recorded below.

- Final full unit run: **603 passed**. Source tests include shared primary/follower work, paused-page source ordering, in-flight saves, G versus F, already-prepared Group selection during R1 reconciliation, revoked/account scopes and pending versus failed foreground work. Scoped TypeScript and targeted lint pass.
- New integration cases passed exact equivalence against existing authorised single-subject media/reflection feeds, Shared/Private permissions, no opening writes, 600-attachment windows, 100 members and oversized reflection fragmentation/source change.
- Relevant MongoDB integration run: **80 passed** (complete Card preparation/heavy owner histories, follower preparation, perspective permissions, management, media and reflections).
- Existing comparison/permission browser suites, using their intended non-media disposable fixture: **12 passed**. Two stale expiry expectations were updated to the already approved retained read-only policy; confirmed server denial still removes foreign content.
- Both engines passed all six existing complete-all-Card/both-face checks, with post-mount metadata reads blocked. Existing matched warm-opening measurement cases also passed.
- The initial broad browser invocation mixed older non-media tests with the renamed/removed media fixture, causing expected fixture failures. Concurrent runners also collided in their shared Playwright artifact directory. These are not counted as passing checks. Final focused browser verification is serial; see final results below. A test that swiped immediately during comparison collapse was corrected to wait for the existing animation, without changing application motion.
- Standard `MONGODB_URI='' npm run build`: application compiles successfully; unrestricted TypeScript remains blocked by the pre-existing ignored `phase2-test-results/deployment-checkpoint-1/inventory.ts:46` AWS SDK `CORSRules` union error. That diagnostic file and build configuration are untouched. The existing scoped optimized harness build passes. Final read-only smoke checks on the new phone server returned complete six-Card Admin Group and follower Me responses plus HTTP 200 follower batches for both accounts.

### Final browser results and limitations

- **9/9 final optimized focused checks passed**: both Chromium/WebKit early Group selection, normal follower batch/retained switching, error/retry, 100-member on-intent transport and the native 50-switch motion budget.
- **8/8 mobile Deck interaction-boundary cases passed**: Admin Group, follower Me/Group and Personal, both engines, front/back navigation, returning from focus, focused Gallery/reflection actions and passive Deck-mode controls.
- **4/4 fresh-login cases passed**: role defaults and later same-session selection, including WebKit. No login behaviour was changed by this checkpoint.
- The 12 existing non-media perspective/permission cases and 8 complete-first-Card/measurement cases passed in separate relevant runs. One older Personal motion case skips without its unrelated Phase 11 environment marker; Personal is independently exercised in both engines by the complete-loading and Deck-boundary suites.
- Final motion input-to-paint p95: **96 ms** over 50 trusted comparisons, processing p95 21.2 ms. Earlier measurements were 128 ms serial and 272 ms during a contended run; retain this variability as a physical-review concern. No timing threshold, gesture or animation was retuned, and the single passing run is not a promise of consistent device performance.
- With independent metadata requests blocked, both engines selected four ready views and browsed all six inspected Cards with exact three visible authorised Group contributions and current reflections. The fixture also has owner-only/hidden originals: inspection deliberately has fewer entries than Me. Existing timers still attempted nine background metadata requests during each navigation case; their failure did not block or dismantle prepared Cards. CP4 timer consolidation is deferred.
- The 100-member browser fixture has 3 Admins, 98 follower roles including one dual-role Admin, and 100 distinct accounts. Both engines requested no speculative follower batch, paused after one in-flight page when the list closed, resumed to exactly five total requests, then switched three prepared targets with further preparation requests blocked. The Me identity appeared once.

### Browser-local follow-up HTTP samples

These are single `route.fetch` samples against an optimized local app, excluding artificial body holds. They are not hosted latency or statistical speedup claims.

| Operation | Chromium | WebKit | Bytes |
|---|---:|---:|---:|
| Group preparation following complete Me | 121 ms | 74 ms | 71,130 |
| Normal follower batch (15 followers, six Cards; sparse other followers) | 87 ms | 100 ms | 126,196 |
| Large follower pages (five) | 120 / 73 / 64 / 68 / 59 ms | 73 / 95 / 87 / 81 / 96 ms | approximately 723 KiB across pages |

Existing matched optimized warm direct-entry measurements (three samples each): Chromium Personal 422–689 ms, Me 507–544 ms, Group 686–1,162 ms; WebKit Personal 443–509 ms, Me 490–732 ms, Group 605–1,170 ms. These selected-perspective markers are backed by the separate all-Card readiness checks. They do not time every perspective, full-resolution media, an in-app-prepared opening or hosted Dublin execution. No new hosted measurement/deployment was performed.

### Early local measurements

Disposable MongoDB replica set, six Cards, five attachments and a repeated 100-sentence reflection per subject/Card; three warm samples after one excluded cold sample. Includes protected reader, page serialization, Node parse/assembly. These are **not hosted or iPhone timings**.

| Group | Follow-up responses | Commands, including transaction/cursor commands | Total serialized bytes | Total local operation ms (all samples) | Node parse/assembly ms |
|---|---:|---:|---:|---|---|
| 3 Admins + 16 followers, 480 attachments | 1 | 18 | 529,656 | 70.16 / 64.53 / 78.49 | 1.38 / 1.81 / 1.50 |
| 3 Admins + 20 followers, 600 attachments | 1 | 20 | 662,205 | 91.49 / 72.24 / 74.04 | 1.88 / 1.90 / 1.88 |
| 3 Admins + 97 followers, 2,910 attachments | 5 | 98 | 3,215,339 | 536.86 / 694.12 / 589.15 | 9.30 / 14.22 / 10.45 |

No warm metadata commands or insert/update/delete commands occurred. Larger command counts include cursor getMore work; these are not per-follower bootstrap requests. Individual long notes were retained without truncation over multiple bounded responses. Actual hosted page latency and physical iPhone foreground contention remain acceptance measurements.

## Architecture and preserved boundaries

- Initial preparation still uses the approved snapshot transaction. Follow-up pages each independently authorise and read a snapshot; no transaction is held between browser requests. Cross-page authority/manifest/roster scope is checked. Ordinary mutable updates can coexist; fragmented single entries require an exact content digest before concatenation.
- Every foreign projection contains current selected learning, current-Group visible contribution windows and current-Group visible reflections only. It never resolves foreign owner history, hidden originals or private dates. Admin/follower role checks remain server-side.
- Existing retained media/reflection controllers own accepted content. The Group resource retains scalar projections, readiness markers, shared promises and a bounded transport accumulator. No competing complete-Card cache or state framework is added.
- A resumed task keeps its original source read order: previously received pages cannot acquire a newer timestamp and replace newer learning. Existing optimistic fields, queues, rollback, revisions and aggregate dependency handling remain intact. G edits do not invalidate F. A previously complete Group remains immediately selectable during approved post-save R1 reconciliation; an initially unprepared Group still waits for complete correct aggregates.
- `DeckScene` and `FocusedCardView` only expose existing foreground-busy state to the idle starter. No geometry, gesture, motion timing or thresholds change. The separate back-face Deck interaction correction is preserved.
- Existing four-second scalar refresh, two-second narrow renewal, authority expiry and media/reflection polling remain. Their consolidation, resume coordination and introduction preparation belong to Checkpoint 4 and are not implemented.
- No deployment, environment change, real database/index operation, real-service test mutation or review fixture reset occurred; automated mutations and index setup were confined to disposable test databases. Automatic follower work uses the approved <=20 active-follower trigger; larger Groups are fully supported on All followers intent. Full Gallery pages and playback bytes remain on demand.

## Physical iPhone review — pending

The previous review launcher, app and temporary MongoDB were no longer running when checked, and its temporary database directory had disappeared. Its edits could not be recovered from the saved IDs. No reset/delete operation was performed by this checkpoint. The old checkout/log were preserved.

A **separate fresh disposable fixture** now runs from `/tmp/switchplay-cp3-phone-review`, detached from the tool session, on the same available port 4184. Its Group/Deck IDs differ, so use the new URLs below. Keep this server running: stopping its harness discards the temporary database. This is a local review environment, not a hosted deployment. A fresh Safari page load obtains its client bundle.

Group URL (plain text):
http://192.168.1.38:4184/decks?openExperience=f66732d3-81b1-4cf6-993a-0890a45c1e91

Personal comparison URL (plain text):
http://192.168.1.38:4184/decks?openDeck=5b6b9f88-cb9d-43d7-a396-83838b7e1bc4

Accounts: `phase2` / `local-test-only` (Admin, not a follower); `Aoife Kelly` / `local-test-only` (follower). Same Wi-Fi required. Providers remain the existing local mocks, not a live R2/Stream verification.

1. Sign in as phase2 and open Galway U18. Confirm Group is the first view, all Cards have stable content and Deck-mode back-face swipes/taps navigate/focus without opening media or reflection editors.
2. Open All followers before and after focus. Confirm the existing list versus comparison grid is preserved. If preparation is still pending, only the content area shows Loading followers; the current Card remains mounted and usable. Reopen after readiness: no repeated loading screen.
3. Switch rapidly among Aoife, Alice, other followers and Group. Swipe both ways through all six Cards, flip/focus/defocus and repeat. Previously prepared views must have no metadata-dependent pauses or missing sections. Foreign views remain read-only.
4. Sign out, sign in as Aoife and open the Group: Me first. Select Group immediately. If background work is unfinished, the complete current Card stays visible and Loading appears only in the picker until atomic switching. Thereafter Group/Me selection is immediate. Normal background work must not obstruct navigation or editing.
5. Save own progress/confidence and a reflection; switch to prepared Group and back. Confirm immediate saved text, correct G/F behaviour and no loss of unrelated media. The existing approved small aggregate … may appear during genuine post-save reconciliation only.
6. Open/close Gallery and Media Centre while changing Cards/views, then return to My Decks and reopen. Confirm retained content and unchanged interactions. Briefly background Safari and return; retain known content. Broader refresh/resume consolidation remains CP4.
7. Compare the Personal Deck: Card navigation, reflection/media retention, flip/focus and Gallery interactions remain unchanged. Report any perceived animation vibration/jerkiness; no speculative motion retuning was made.

Physical iPhone acceptance is not represented as complete. The first-preparation Loading states are the previously approved V3 exceptions, not permission for routine waits after readiness.

## Git

Starting commit: `b85eac4`, clean tree on `feat/group-experience`. No unrelated starting changes. This handoff is included in the separate CP3 commit; the final hash is reported in chat (and can be obtained with `git log -1 --format=%H --` this file). No push/merge/deployment or CP4 work.

## Changed-file inventory


- `docs/engineering/features/group-experience/loading-architecture-v3-checkpoint-3-handoff.md` — Checkpoint architecture, verification, measured limitations and physical review handoff.
- `src/app/api/group-experiences/[experienceId]/preparation/followers/route.ts` — Protected coordinated follower preparation GET.
- `src/components/group-experiences/useGroupPreparation.ts` — Small view-owned foreground-aware idle starter.
- `src/lib/groupExperiences/followerPreparation.ts` — Protected snapshot batch projections and bounded query slices.
- `src/lib/groupExperiences/preparationPages.ts` — Client-safe bounded-page contracts and exact fragment assembly.
- `src/lib/groupExperiences/preparationPaging.ts` — Server byte-budget packing, scoped cursors and fragment integrity.
- `src/lib/groupExperiences/primaryPreparationAssembly.ts` — Reconstruct and validate complete primary sections.
- `src/lib/groupExperiences/primaryPreparationPaging.ts` — Bound oversized primary composed responses without content caps.
- `tests/group-follower-preparation.integration.ts` — Exact feed equivalence, permissions, normal/large measurements and long-note integrity.
- `tests/group-followup-resource.test.ts` — Deterministic sharing, priority, pause/resume, newer saves and scope rejection.
- `tests/group-preparation-pages.test.ts` — Exact byte bounds, Unicode round trips and changed source/scope rejection.
- `tests/phase2/group-perspective-preparation.browser.ts` — Mobile primary/follower readiness, interruption/retry and large dual-role Groups.
- `src/app/api/group-experiences/[experienceId]/preparation/route.ts` — Serve bounded primary continuations; GET remains read-only.
- `src/components/decks/DeckScene.tsx` — Expose existing Deck transition/intro activity to background preparation only.
- `src/components/decks/FocusedCardView.tsx` — Expose existing gesture/Step-view activity; preserve all interactions and motion.
- `src/components/group-experiences/GroupExperienceDeck.tsx` — Atomic prepared selection, intent handling, idle preparation and existing list/grid integration.
- `src/components/group-experiences/PerspectiveGrid.tsx` — Existing focused comparison with complete-set loading/error/retry.
- `src/components/group-experiences/PerspectivePicker.tsx` — Approved picker Loading and follower loading/error/retry content.
- `src/components/group-experiences/groupResource.ts` — Scoped deduplicated primary/follower tasks, page retention, complete readiness and source ordering.
- `src/lib/cards/personalWork.ts` — Distinguish in-flight foreground work from retained failed retries.
- `src/lib/groupExperiences/preparation.ts` — Narrow selected learning and Group-only aggregates; preserve actual-open writes.
- `src/lib/mediaCollection/preparation.ts` — Reuse exact shared window formatter for batched per-subject windows.
- `src/lib/reflections/reads.ts` — Reuse current shared semantics for batched authorised inspection feeds.
- `tests/phase2/group-experience-boundaries.browser.ts` — Align expired-check expectations with accepted retained read-only behaviour.
