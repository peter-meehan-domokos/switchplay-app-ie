# Loading Architecture V3 — Checkpoint 5 acceptance handoff

Status: authorised local/integration verification complete; hosted measurements are blocked and physical acceptance remains pending. This report was saved incrementally during verification. Branch `feat/group-experience` was clean at `359db88`. Checkpoints 1–4 and both interaction fixes are present. No deployment, push, configuration change or real review-data mutation is authorised or performed.

## 1. Acceptance boundaries and starting evidence

Read the complete V3 plan, all four checkpoint handoffs and the Dublin region comparison. The approved login-default correction takes precedence over V3 wording that predates it: a fresh login enters Admin Group / follower Me; authorised same-session and Progress-return navigation remains supported. R1 permits only affected displayed aggregate slots to show `…` during post-edit reconciliation; collective G and follower F remain independent.

This checkpoint verifies the retained resources, composed complete reads, staged perspectives, coordinated refresh/resume and introduction intent as one system. Existing four-checkpoint results are historical evidence until rerun; no historical local sample is relabelled as a new hosted result. Physical iPhone acceptance remains a separate user activity.

## 2. Hosted deployment availability — blocked

Initial and final authenticated read-only `vercel list switchplay-app-ie --scope peter-meehan-domokos-projects --json` found no V3 deployment. The newest listed deployment is the existing baseline:

- URL: https://switchplay-app-aleirimhm-peter-meehan-domokos-projects.vercel.app
- Git SHA: `4bca8b5be6d307a104308b2702e8de2da2eca4de`, before all V3 checkpoint commits.
- Deployment: `dpl_5NNWNZquEK4gh8Kz7sT7TPgmdAqq`.
- Fresh read-only `vercel inspect ... --json` confirms all **277 Function entries** have `deployedTo: ["dub1"]`.
- Atlas Ireland `EU_WEST_1` is the previously verified baseline; this checkpoint does not change or reprofile Atlas.

This verifies the old deployment inventory, not the region or execution of a nonexistent hosted V3 build. No timed V3 journey is run against that obsolete application. No extra endpoint, deployment or provider configuration is introduced.

**Minimum action:** the user must arrange or explicitly authorise a Preview deployment containing `359db88` or the final Checkpoint 5 descendant, then supply its URL/access. Verify that deployment SHA and its actual Function inventory target Dublin before timing. Existing production/review data must remain unchanged; both genuine entry (which updates `openedAt` and may initialise dates) and cross-user save latency need explicitly approved disposable hosted records rather than the real review Group. The old read-only benchmark blocked all application POST/PATCH requests; using that interception unchanged would block V3 actual entry. Substituting a GET preparation response for POST would measure a different journey and is not represented as actual-opening performance. Image viewing benchmarks do not require an upload CORS change; any later upload acceptance on a new origin needs the existing CORS policy handled separately.

The Dublin historical baseline is current-Card contribution readiness: direct Chromium 2.354 s / WebKit 1.971 s, in-app reopening 1.371 s / 1.151 s, five samples each. V3 all-Card initial-perspective completeness is a different milestone. Both markers must be collected separately when hosted measurement becomes possible. No percentage V3 speedup can presently be calculated honestly.

## 3. Integrated verification results

- Full unit suite **623 passed**, output `/tmp/cp5-unit.log`.
- Sixteen relevant disposable MongoDB integration suites: initial **203 passed / 2 failed**, output `/tmp/cp5-integration.log`. Both failures were late-attached expected-rejection assertions in the pre-existing Info Card concurrency harness; the corrected affected suite passed **17/17** (`/tmp/cp5-info-attachments-final.log`), including both exact conflict assertions. All 205 applicable cases now have passing evidence across the broad run and affected-suite rerun; do not count the 15 repeated passing cases as extra unique tests. No application failure is waived.
- Optimized mobile complete-loading, Deck boundary, signal arbitration, perspective preparation, refresh/resume, retention and fresh-login suites: **58 passed**, zero skipped, output `/tmp/cp5-mobile-integrated.log`.
- Existing standalone introduction/video/signal browser specs: **43 passed** (`/tmp/cp5-specs.log`).
- Existing Gallery, media-viewer and iOS-download simulation suites: **48 passed**, both engines (`/tmp/cp5-gallery.log`).
- Final new acceptance coverage: all **9 cases** have passing evidence after the documented driver corrections; isolated motion **3/3**, including the previously skipped Personal case; matching permission/perspective browsers **12/12**. Full command history below.

No existing phone fixture is reset. Automated runners own their MongoDB replica sets and mocked providers. No tests using an environment Atlas URI or live Cloudflare provider are authorised for mutations.

## 4. Additional acceptance coverage

`tests/phase2/loading-v3-acceptance.browser.ts` adds focused coverage without changing application code or fixtures outside its runner-owned database:

- Three measured complete Group direct entries per engine after a separately reported first observation; historical current-Card predicate recorded separately from all-Card metadata plus scene readiness.
- Three retained in-app returns per engine, separating retained scene readiness from protected actual-open acknowledgement.
- Ten already-prepared follower selections per engine with further preparation blocked; existing physical Card stays mounted.
- Twelve-Card sparse and media-rich Personal Decks, full all-Card projection verification and bidirectional back-face traversal with independent mounted media/reflection feeds blocked.
- Chromium controlled profile (150 ms latency, 1.6 Mb/s down, 0.75 Mb/s up) for three in-app unprepared openings after tiles are ready, followed by full bidirectional navigation. This is a synthetic profile, not a physical 4G/iPhone result. WebKit is not claimed to use Chromium CDP network shaping.

The existing six-Card fixture has one Admin and fifteen active followers; do not label its browser timings as the 3-Admin/16-follower case. Existing disposable integration measurements cover that 19-member case, twenty followers, 600 contributions, heavy owner history and approximately 100 members independently. First observer samples are not proof of a cold Vercel Function.

## 5. Requirement audit — confirmed missing optimisation

**Not met: direct Group URL skips unrelated collection preparation (V3 section 5.1).** `src/app/decks/page.tsx:7` always calls `membershipDTO`, then reads every Group tile page, before returning `AppShell`. It does not branch on a target Group URL. Complete scoped Card preparation subsequently occurs on the client, so this does not weaken permissions or completeness; it retains extra direct-entry work. The existing Dublin baseline has the same collection dependency. No hosted trace currently quantifies its cost on V3.

This checkpoint does not silently alter server entry/Back-to-My-Decks ownership to claim the optimisation exists. A correction needs targeted coverage proving direct entry avoids the collection read and that returning still loads all Personal/Group tiles correctly, including account changes. It is a planned performance gap, not evidence that gestures or prepared Card navigation are broken. Final V3 status must distinguish the implemented core from literal completion of every original plan recommendation.

The legacy Personal motion test previously skipped because it read only `PHASE11_REVIEW.mediaReviewData`. The standard complete-loading runner already supplies the same disposable Personal media identity through `PHASE7_MEDIA_REVIEW`. A test-only fallback now accepts that existing fixture; the assertions and production motion remain unchanged. Final isolated motion verification passed all three cases, including this Personal case; native comparison p95 was 80 ms against the unchanged 100 ms budget.

## 6. Requirements assessment

This matrix distinguishes automated local evidence, static implementation evidence, unverified environments and deferred work. Final command totals are recorded below. Historical Checkpoint 1–3 handoff text that says physical review is pending is superseded by the subsequent user acceptance of those checkpoints; final integrated physical acceptance remains separate.

| V3 requirement | Classification | Evidence / scope |
|---|---|---|
| Login does not await speculative deep preparation; tiles remain independent | Met and verified | Auth/session code and DeckGrid intent callback; introduction/video specs; no collection-wide prefetch introduced |
| Main perspective on fresh login; authorised same-session/Progress return selection | Met and verified | `group-login-perspective.browser.ts`, preparation policy/resource tests; later approved login rule supersedes pre-login restoration wording |
| All selected Cards, both faces, complete before first scene | Met and verified | `card-preparation-client.test.ts`, `card-preparation.integration.ts`, six held-response traversal cases in `complete-card-preparation.browser.ts`; missing data rejected, known-empty explicit |
| Exact newest-five identities/order/count, source lineage and owner history | Met and verified | Preparation/collection/media integration; long/legacy/duplicate/undated/history fixtures; no approximate query substituted |
| Current-context reflections and collective/member semantics | Met and verified | Reflection controller and integration tests; complete initial response and stale-read/rollback tests |
| Existing Personal Info revisions/attachment permissions | Met and verified | Loading-store/Info revision tests and disposable Personal Info/attachment integration; Group Info functionality remains excluded |
| Navigation through twelve sparse/media-rich Cards | Met and verified | Four final CP5 browser cases passed: both engines, sparse/rich, all 23 forward/reverse selections, exact media/reflection state, zero mounted contribution requests |
| Group/Me priority, no fabricated Me for nonfollower Admin | Met and verified | `group-followup-resource.test.ts`, follower preparation integration and perspective browsers |
| Normal follower set publishes complete; ready selections do not load metadata | Met and verified | Follower resource/page tests and mobile prepared-selection cases; automatic trigger at <=20 is a policy, not a membership cap |
| Approximately 100 members, exact bounded transport, no per-member bootstrap | Met and verified | Follower integration and 100-member browser cases; oversized UTF-8/digest/source-change tests; no progressive UI added |
| Session retention through remount/return, background refresh preserves complete data | Met and verified | Media/reflection controller tests, loading-retention and refresh-resume browser cases; in-memory only |
| Optimistic edits, unrelated data acceptance, rollback/retry and stale-response protection | Met and verified | Full unit suite, source-specific Group/Personal/reflection tests and disposable save/adoption races |
| Correct G/F dependency separation and post-edit R1 | Met and verified | `group-refresh.test.ts`, shared-learning and Group integration; G changes do not dirty F; no initial or unchanged-poll placeholders |
| One Group refresh owner; compatible requests shared; timely cross-user updates | Met and verified locally | Shared-clock tests and CP4 matched local results; fresh CP5 confidence/progress observations reported separately below |
| Permission/account/scope changes and genuine revocation | Met and verified | Deterministic resource tests plus membership/media/reflection/adoption integration and browser boundaries; server checks retained |
| Temporary offline/identity-service failure preserves data read-only | Met and verified | Group/Personal resume cases and current-actor batch tests; confirmed denial clears data; no new offline write queue |
| Thirty-day authentication duration and existing identity checks | Met and verified | `src/lib/auth.ts` retains 30-day expiry/cookie max-age; trailing Personal actor check is coalesced only after both protected reads |
| Introduction-triggered preparation; genuine open/date operations remain separate | Met and verified | Introduction request tests, no-write database snapshot assertions and decoded playback browser cases; actual entry joins in-flight work |
| Existing seven-Card video preparation and on-demand Gallery/playback | Met and verified | 43 video/introduction/signal checks and 48 Gallery/viewer/download checks; no thumbnail warming or full-media prefetch added |
| Deck-mode passive controls and focused direction arbitration | Met and verified | Eight Deck-boundary and ten focused-signal trajectories across engines; native Chromium touch versus simulated WebKit pointers distinguished |
| Direct Group URL avoids unrelated My Decks construction | **Not met** | Always-loaded `membershipDTO` and Group tile loop in `src/app/decks/page.tsx`; section 5 above |
| Hosted normal-opening target / Dublin V3 performance | **Implemented but not fully verified** | No hosted V3 build exists in inspected project; local measurements cannot prove hosted target or regional RTT |
| Physical Safari final integrated acceptance | **Implemented but not fully verified** | Requires user review; desktop WebKit/mobile emulation is not physical Safari |
| Progressive large-Group UI, thumbnail/perspective polish, broad collection prefetch | **Explicitly deferred** | Approved backlog; no such functionality added |
| New introduction `viewedAt` persistence, analytics, extra session marker, prolonged-offline machinery | **Explicitly deferred** | V3 section 11; no new timestamp/history or security mechanism introduced. Preparation remains read-only |

## 7. Performance interpretation and comparison

| Metric | Previous comparable baseline | V3 result | Environment / samples | Interpretation |
|---|---|---|---|---|
| Direct current-Card contribution predicate | Chromium 2.354 s; WebKit 1.971 s medians | Pending hosted V3 | Dublin baseline, n=5 per engine | Do not compare against local all-Card readiness |
| In-app current-Card contribution predicate | Chromium 1.371 s; WebKit 1.151 s medians | Pending hosted V3 | Dublin baseline, n=5 per engine | Same marker required in future hosted run |
| All-Card initial-perspective readiness | Not measured by old hosted benchmark | Pending hosted V3; local results below | Separate milestone | No honest hosted percentage improvement available |
| Active Group background requests / 12 s | 23 before CP4 | 6 in CP4; CP5 rerun below | Matched local fixture only | Existing approximately 74% saving must not be relabelled hosted |
| Player confidence save → Admin F | CP4 local approximately 2.3 s | Fresh CP5 observations below | Local independent sessions | No hosted cross-user result without approved test writes |
| Player progress save → Admin F | No recorded matched earlier sample | New CP5 observations below | Local independent sessions, three changes per engine | Cadence phase matters; compare samples rather than promising exactly two seconds |
| Retained return / prepared selection / normal follower preparation | Existing local functional evidence | New CP5 observations below | Local optimized fixture; explicit sample sizes | DOM waiter timings include automation, not pure input-to-paint |
| Controlled 4G-like in-app opening | No comparable hosted/shaped baseline | New CP5 observations below | Chromium synthetic 150 ms, 1.6 Mb/s down, 0.75 Mb/s up | Does not simulate a physical iPhone or Vercel cold start |

All-Card readiness is supported by exact response assertions plus independent browser traversal with mounted contribution feeds blocked. The timing boundary is complete required metadata accepted and scene available, not every image painted, every perspective prepared, video decoded or Gallery history downloaded. The historical DOM current-Card predicate is retained separately. The local driver checks complete response/scene readiness before sampling that predicate, so its small later timestamp is observation-order overhead, not evidence of a post-presentation content insertion; the independent held-response traversal checks establish completeness. First browser observations do not establish cold Function execution. Browser loopback timings cannot isolate Atlas RTT.

## 8. Verification corrections and build limitation

No application source has been changed in Checkpoint 5. The expanded database run exposed two pre-existing concurrency-test harness errors in `tests/info-card-attachments.integration.ts`: `INFO_REFERENCED_CONFLICT` / `INFO_REFERENCE_FORBIDDEN` were the correct expected outcomes, but each rejected promise could settle while the test awaited the competing successful operation, before `assert.rejects` was attached. Node reported `unhandledRejection`, later followed by `PromiseRejectionHandledWarning`. The tests now attach their exact expected-code assertion immediately, before releasing the barrier, and await both outcomes together. Application guards, race ordering and expected results are unchanged. Neither that test file nor `src/lib/infoCards` was changed by the prior V3 checkpoint commits. The entire affected suite was rerun: **17 passed**, no skips, including both conflict cases. This is test-harness correction, not a change to Info Card application behaviour.

Fresh standard `MONGODB_URI='' npm run build`: application compilation succeeds, then the known ignored diagnostic fails TypeScript at `phase2-test-results/deployment-checkpoint-1/inventory.ts:46`, AWS SDK `ServiceOutputTypes.CORSRules`. The file is not modified/deleted and the build configuration remains unchanged. Scoped optimized production builds and source/tests/scripts TypeScript are reported separately, not called a passing unrestricted workspace build. Build uses an explicitly empty URI, so it does not connect to Atlas.

Fresh coordinated refresh observations in the 58-case run: both Chromium and WebKit issued three `/refresh` and three `/authority` GETs in 12 seconds; follower confidence save → Admin F observed at **2,364 ms / 2,301 ms**. These are one fresh local sample per engine, not hosted or standalone uncontended statistics. CP4 historical samples and environment are preserved above.

## 9. Independent measurement run

The broader database, media and mobile runners finished before the final optimized local acceptance/motion run starts. The final run uses `group-experience-motion.browser.ts` plus `loading-v3-acceptance.browser.ts`, one worker, separate disposable fixture, unchanged production animation and gesture thresholds. It records repeated direct and retained journeys, normal follower surface readiness/HTTP work, ten prepared selections per engine, twelve-Card bidirectional traversal and controlled-network opening. Additional progress-update samples (three per engine) complement the existing confidence measurement. Raw final output: `/tmp/cp5-acceptance-measurements.log`. The first combined run passed eight cases and found four driver heading assumptions. The next new-file run passed five measurement/progress/control cases and found the four strict-selector traversal assumptions described below. The final `--grep twelve` run passed all four corrected cases: Chromium sparse/rich **46.7 / 46.9 s**, WebKit sparse/rich **44.9 / 45.2 s**. Those durations include disposable data creation and all 23 navigation selections, not opening latency. All twelve unique isolated cases now have passing evidence, with no skips.

### Measurement-driver corrections

The first isolated run passed all three motion checks, both repeated Group journey cases, controlled-network traversal and both progress-update cases. Four newly added twelve-Card cases stopped at a test heading assertion: the back-face semantic heading is `Card N`, not the instructional intro title `CP5 Card N`. The assertion now checks the exact semantic `h2` value before testing each Card. No application label or navigation behaviour was changed. The next run reached Card traversal and exposed a second driver assumption: outgoing and incoming Cards intentionally coexist during the established animation, so a strict single-element text assertion needs the same settled-count wait already used by the six-Card suite. The driver now waits for one semantic heading, then checks its exact number, media and reflection state. The final rerun retains all 23 forward/reverse selections; no animation timing or gesture mechanics changed.

Initial repeated-return call timings included roughly a second of Playwright waiting for animated tiles to become stable before generating a click. The final driver records a separate click-capture/animation-frame DOM-ready marker as well as original action-call durations and pre-click waiting. These DOM markers are not presented as pure input-to-paint; the independent native Event Timing motion check remains the paint-budget evidence. No animation or actionability limit is shortened to improve a benchmark.

### Final local measurement table (separate from hosted baseline)

Optimized local six-Card fixture, 390×844 mobile contexts; Chromium 145.0.7632.6 / WebKit 26.0. No competing integration/build runner during the measured journeys. Unshaped direct samples follow one excluded first observation. All times below are milliseconds; n is per engine.

| Marker | Chromium median (range) | WebKit median (range) | n / interpretation |
|---|---:|---:|---|
| Direct all-Card metadata + usable scene | 567 (550–591) | 467 (441–515) | 3; includes document/client preparation and automation waiter |
| Direct historical current-Card predicate | 589 (574–614) | 504 (482–569) | 3; sampled after scene readiness; observation/sampling overhead included |
| Retained return, click capture → DOM ready | 40.7 (37.8–46.1) | 58 (56–63) | 3; accepted complete scene, not a proven GPU paint/edit-authority marker |
| Retained return, automation-call start → waiter | 992 (989–993) | 1,051 (1,039–1,099) | 3; includes 893–903 / 924–995 ms before the click was generated |
| Prepared follower, click capture → selected DOM | 18.95 (6.9–21.5) | 13 (9–28) | 10; no preparation request; physical Card identity retained |
| Prepared follower, automation-call duration | 63 (54–94) | 145 (108–214) | 10; actionability and observation are not application rendering alone |
| Normal follower batch HTTP | 242.543 | 73.076 | 1 completed final-navigation response per engine; 126,196 bytes; not a median over repeated batches |
| First All followers action → ready surface | 594 | 417 | 1 per engine; joins automatic work; not isolated database/HTTP time |
| Progress save → Admin F | 3,962 (3,962–4,008) | 4,023 (3,992–4,074) | 3; save at the preceding update boundary encounters the roughly four-second cycle |
| Confidence save → Admin F | 2,364 | 2,301 | 1 fresh sample per engine in broader run; different phase, not a progress-vs-confidence causal comparison |

Chromium controlled profile, three **in-app unprepared** opens after My Decks tiles are already usable: call-to-complete values **707 / 667 / 623 ms**, median **667 ms**; trusted-click/rAF DOM-ready **595.2 / 564.5 / 550.6 ms**, median **564.5 ms**. Each composed response was 71,024 bytes. All six Cards were traversed in both directions with zero mounted media/reflection feed reads. The 150 ms / 1.6 Mb/s down / 0.75 Mb/s up profile does not include fresh-login/bootstrap asset download, physical radio variability, Atlas RTT or a Vercel cold start. It is not a hosted 4G result.

Native Chromium Event Timing over 50 loaded comparison switches: **80 ms p95**, unchanged 100 ms budget; processing p95 22.8 ms, input-delay p95 1.2 ms. This is separate from the click/rAF DOM markers. Both focused Group continuity and the formerly fixture-skipped ordinary Personal motion case passed; no production timing was retuned.

Payload/request interpretation: one composed POST establishes initial Group metadata; normal followers use one coordinated GET in this fixture. Existing independent publication Update reads and visible thumbnail-byte requests are counted separately in raw records, not presented as removed metadata waterfalls. Prepared selection issues no new preparation requests; retained entry uses the existing protected `/open` POST and no repeated composed POST. Initial request totals vary with thumbnail cache and background start timing. No hosted request-count total or isolated server/database latency is fabricated.

### Fresh disposable database measurements

These samples ran in the broader local verification period, sometimes alongside browser/build work. They are not isolated hosted timings or Atlas RTT. Counts include transaction/cursor work. Each final reader has five warm samples and zero metadata-enumeration commands.

| Complete reader | Median (range), ms | Commands | JSON bytes | n |
|---|---:|---:|---:|---:|
| Personal | 48.16 (46.55–48.98) | 25 | 41,018 | 5 |
| Me | 43.87 (41.76–45.01) | 19 | 32,940 | 5 |
| Group | 49.21 (47.14–52.05) | 21 | 63,332 | 5 |

Complete permitted follower operation (all Cards, real narrow learning/reflection/media projections):

| Distinct members / followers | Attachments | Transport responses | Commands | Serialized bytes | Median (range), ms | n |
|---|---:|---:|---:|---:|---:|---:|
| 19 / 16 | 480 | 1 | 18 | 529,656 | 79.39 (74.81–98.76) | 3 |
| 23 / 20 | 600 | 1 | 20 | 662,205 | 104.36 (89.89–172.95) | 3 |
| 100 / 97 | 2910 | 5 | 98 | 3,215,339 | 512.64 (477.62–557.12) | 3 |

These include the standard three-Admin/sixteen-follower case and a twenty-follower/600-attachment case, unlike the smaller browser fixture. The 100-member dataset uses three Admins/ninety-seven followers. Full Group initial aggregation does not prepare that entire follower operation. Mutable refresh independently measured Group **17 commands / 28,670 bytes / 55.95 ms**, Me **15 / 23,954 / 49.40 ms**, inspection **15 / 23,277 / 46.12 ms**; each is a single fresh local sample with 600 stored contributions.

Heavy owner histories (9,000 attachment references) and long notes remain material query/payload costs. The broad fixtures retain exact history/legacy ordering and do not truncate long reflections. These counters must not be subtracted from the historical 41-command bootstrap as a claimed percentage improvement: that older accounting excluded mounted contributions and differs in scope. Physical Safari heap and hosted bandwidth remain unmeasured.

## 10. Integrated commands, skips and limitations

- `npm run test:unit`: **623 passed**, zero skipped.
- `node --import tsx --test --test-concurrency=1` with `card-preparation`, `group-follower-preparation`, `group-refresh`, `group-experience-perspectives`, `group-experience-management`, `group-experience-lifecycle`, `group-media`, `group-reflections`, `media-collection`, `personal-info-cards`, `info-card-attachments`, `shared-learning`, `update-adoption`, `group-assessments`, `group-personal-assessments`, `media-ux` integration files: **203/205 initially passed**, two late-observed expected rejections corrected. Entire affected `info-card-attachments.integration.ts`: **17/17 passed**. All **205 unique applicable cases** have passing evidence across these runs, with no failed assertion waived. Some MongoMemoryServer cleanup used its SIGKILL fallback after a SIGINT timeout, confined to disposable processes.
- `npx playwright test tests/deck-intro-playback.spec.ts tests/card-video-preparation.spec.ts tests/deck-video-preparation.spec.ts tests/signal-confidence.spec.ts tests/signal-readings-null.spec.ts tests/signal-rollback.spec.ts tests/signal-visibility.spec.ts --workers=1 --output=/tmp/cp5-spec-artifacts`: **43 passed**.
- `npx playwright test --config=playwright.media-collection.config.ts`: **48 passed**, Chromium/WebKit mobile viewports, mocked provider bytes and OS-sharing APIs.
- `node --import tsx scripts/test-phase2.ts --optimized --group-media --complete-loading complete-card-preparation.browser.ts deck-interaction-boundaries.browser.ts focused-signal-arbitration.browser.ts group-perspective-preparation.browser.ts group-refresh-resume.browser.ts loading-retention.browser.ts group-login-perspective.browser.ts`: **58 passed**, no skips. Actual optimized production fixture build, server auth, database and retained resources; mutations only in runner-owned data.
- Isolated optimized `group-experience-motion.browser.ts`: **3 passed**, no skips, including enabled Personal case and unchanged native paint budget. New `loading-v3-acceptance.browser.ts`: five measurement/control/progress cases passed; all four twelve-Card cases passed in the final focused rerun after the documented driver corrections. No pending failing assertion is accepted as success.
- Matching non-media Group boundary/perspective suites: **12 passed**, zero skips (`/tmp/cp5-permission-browser.log`). Never mix their expected `other` fixture with the media fixture that intentionally renames that user Aoife.
- Scoped TypeScript uses a temporary configuration extending the repository configuration, includes application/tests/tracked scripts and generated optimized route types, excludes ignored diagnostic output. Targeted lint passed for **112 V3 TypeScript files**, with final edited files checked again. No production build/typecheck configuration is changed. Final scoped TypeScript and lint results are recorded below.

No live Cloudflare provider, hosted Atlas timing, physical iPhone, production data mutation or actual Function cold-start experiment is claimed. Exact long/history/600-attachment and 100-member data paths are tested, but physical Safari heap usage and real-world heavy-content bandwidth are not profiled. Large member-carousel reflections and owner lineage/history remain genuine payload/query costs; no truncation, hard cap, stored aggregate or new cache framework hides them. Existing two/four/five-second authority/refresh/freshness behaviour is retained.

## 11. Remaining physical iPhone acceptance

The existing Checkpoint 4 application source is unchanged by this checkpoint. Its local review server and fixture are preserved; there is no new Preview URL. Do not reset review data or silently replace fixture IDs. The automatic MongoDB/browser fixtures used above are separate and disposable.

Group address (plain text):

http://192.168.1.38:4184/decks?openExperience=f66732d3-81b1-4cf6-993a-0890a45c1e91

Personal address (plain text):

http://192.168.1.38:4184/decks?openDeck=5b6b9f88-cb9d-43d7-a396-83838b7e1bc4

Accounts: `phase2` / `local-test-only` Admin; `Aoife Kelly` / `local-test-only` follower. Keep the Mac running and phone on the same Wi-Fi. No restart is needed for test/document-only Checkpoint 5 changes. Read-only final smoke checks returned **401** from anonymous `/api/auth/me` and **200** from `/login`; no login, actual-open request, restart or data reset was performed. Physical acceptance is not inferred from these HTTP checks.

1. Fresh login as each role: Group for Admin, Me for follower. Check same-session and Progress return selection independently of fresh-login defaults.
2. Open Personal and Group, navigate all Cards both ways, focus/flip and return. All visible signals, reflection previews and media arrangement should be ready together; image bytes may fill reserved positions. Use an existing twelve-Card Deck if available, without reseeding review data.
3. Select Group/Me early, then repeatedly after readiness. Check the one-time picker Loading boundary retains the current Card. Test unfocused All followers list and focused comparison grid, early and ready; no repeated waits among prepared followers.
4. Return to My Decks and reopen, background Safari and resume, briefly disconnect/reconnect. Known complete content stays present; editing may pause while access is uncertain. A discarded tab is a genuine fresh load.
5. Use independent browser sessions to save follower progress/confidence and watch Admin F update within the existing roughly four-second cadence. Check collective G separately, optimistic reflection feedback, pending `…`, failure/retry and no unrelated content disappearing.
6. From the back face in Deck mode, swipe/tap over signals, thumbnails and reflection areas: navigate/focus only. In focus, test horizontal confidence preview, a 12 px horizontal start followed by a dominant vertical swipe, read-only horizontal feedback and no accidental save from vertical navigation.
7. Open Gallery, change item/page, play video where real playable review content exists, and check save/share/download on actual Safari. Mocks and simulated OS-sharing tests do not establish real Cloudflare/iPhone playback or photo-library behaviour.
8. Where an introduction exists, begin playback, leave early, enter before preparation ends and revisit. Preparation must not pretend an actual opening occurred. The preserved local fixture may lack a playable introduction; use existing suitable content rather than altering it automatically.
9. Logout/switch accounts: no old protected Card remains. Check read-only follower permissions; automated disposable tests cover destructive/revocation scenarios, so do not remove real review members just to repeat them.

Thumbnail appearance/perspective animation polish remains explicitly deferred. No thumbnail warming, gesture retuning or Safari redesign is performed.

## 12. Final acceptance states

| Question | Status |
|---|---|
| Is the core retained/prepared/refresh architecture implemented? | Yes; Checkpoints 1–4 remain intact; no application correction needed in this checkpoint |
| Is every original V3 recommendation complete? | **No**: direct Group URLs still load unrelated collection data; section 5 |
| Is applicable automated functional coverage verified? | Yes for the listed scenarios: **623 unit**, **205 unique MongoDB cases** across broad/corrected runs, **173 unique browser cases** across standalone/integrated/focused runs, no final skipped case; scoped TypeScript/lint/production builds pass. Unrestricted workspace build remains blocked by the known ignored diagnostic |
| Is hosted V3 performance verified? | **No**: no V3 deployment in the inspected project; need approved Preview and disposable hosted entry/save records |
| Is final physical iPhone acceptance complete? | **No**: user activity remains pending |

The core implementation is available for final physical review, but V3 should not be described as unconditionally complete or hosted-performance accepted. Resolve the documented direct-entry requirement and obtain hosted/physical evidence before that broader conclusion. This is not permission to start another development phase, implement deferred UX or deploy automatically.

## 13. Changed-file inventory and Git

Starting commit `359db88` on `feat/group-experience`, clean tree. Prior checkpoints: `cd5e260`, `fca0e05`, handoff `0f78994`, `892b799`, `359db88`; interaction fixes `bf87f98` and `ea692cb`; fresh-login correction `b85eac4` preserved.

Exactly four Checkpoint 5 files:

- `docs/engineering/features/group-experience/loading-architecture-v3-checkpoint-5-handoff.md` — Requirement assessment, environment blocker, measurement definitions/results, test history, acceptance gaps and final review instructions.
- `tests/phase2/loading-v3-acceptance.browser.ts` — Repeated initial/return/prepared journeys, controlled network, twelve-Card sparse/rich traversal and cross-user progress observations; disposable fixtures only.
- `tests/phase2/group-experience-motion.browser.ts` — Accept the existing equivalent media fixture so Personal motion assertions execute rather than skipping; no assertion/timing relaxed.
- `tests/info-card-attachments.integration.ts` — Observe exact expected concurrent rejections immediately, preserving application guards and barrier ordering.

No application source, CSS, configuration, V1/V2/V3 plan, earlier handoff, credential, database, media object or provider setting changed. A separate Checkpoint 5 commit includes this handoff; final hash is reported in chat. Its containing commit can be obtained with `git log -1 --format=%H -- docs/engineering/features/group-experience/loading-architecture-v3-checkpoint-5-handoff.md`. No push, merge or deployment.

## 14. Final verification and completion boundary

Browser case accounting, without double-counting reruns: **43** standalone video/signal/introduction + **48** Gallery/viewer/download + **58** optimized integrated + **3** motion + **9** new CP5 acceptance/measurement + **12** matching permission/perspective = **173 unique passing cases**. Initial failures and exact corrections are documented above; no assertion was disabled, threshold relaxed or application behaviour changed. No tests in these final applicable sets are skipped. Legacy suites needing unrelated fixture packages are not represented as executed.

Final source/tests/scripts scoped TypeScript, targeted V3/changed-file ESLint, optimized production fixture build and Git whitespace checks passed. The standard unrestricted build failure remains explicit. Final initial-URL collection-bypass assessment is **not met**, rather than silently omitted. No appropriate hosted V3 deployment appeared in the final read-only recheck: the latest project deployment remains `4bca8b5`.

Checkpoint 5 completes all verification/measurement work possible without the prohibited deployment/data operations. It does **not** certify hosted performance, physical acceptance or literal completion of the missing direct-entry optimisation. The remaining concrete actions are to review/resolve that scoped requirement, arrange an approved V3 Preview with Dublin Function verification and approved disposable entry/save records, and perform the physical iPhone checklist. Do not start those actions automatically, undertake deferred UX, push or deploy from this handoff.
