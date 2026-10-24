# Info Cards — Phase 5 Testing and Release-Readiness Report

Status: **Testing investigation complete; the confirmed metadata defect was subsequently fixed and verified under explicit authorisation.** Production index/provider gates remain open. The original investigation below was completed 24 October 2026; its counts remain historical. See the targeted follow-up at the end for the correction and fresh results, not a rerun of the entire investigation.

## A. Overall assessment

**Ready subject to outstanding operational/device verification:** the original investigation found a medium-severity feedback defect, now resolved by the separately authorised targeted follow-up below. Application-index/live-provider verification remains outstanding. No new backend permission, publication-transaction or reference-integrity defect was demonstrated. The original automated results were **902 passing cases and one known expected-failing case across 903 distinct cases**, deduplicating overlapping rechecks. Those historical totals are not a claim that one combined run was entirely green or that all 903 cases were rerun after the correction. This report does not approve release.

### Baseline and boundaries

- Repository: `/Users/peterdomokos/projects/switchplay-app`; branch `feat/info-cards`.
- Baseline: `4b10ba6` — `feat(info-cards): complete Phase 4 integration and Creator attachment workflows`.
- Worktree was clean at the initial inspection and on resumption after the usage-limit interruption. The earlier Phase 4 changes, including the pouch hit area, are committed in this baseline.
- Authority: [functional specification](../../../../design/features/info-cards/info-cards-functional-spec.md), [engineering plan](../info-cards-engineering-plan.md), [Phase 4 handoff](../phase-4/README.md), and the user's Phase 5 testing-only authorisation.
- Allowed changes: tests, narrowly necessary test utilities/fixtures and testing documentation. No production application changes, live database/provider operations, deployment, staging or commits.

### Execution ledger / resume point

| Workstream | Status | Fresh result / next action |
| --- | --- | --- |
| Baseline and authority | Inspected | Branch/HEAD/clean state confirmed; specification and engineering scope inspected. |
| Coverage inventory | Complete | Functional/security contracts mapped in §B; existing strong coverage reused and 11 justified cases added. |
| Backend security and release setup | Passed | 57 existing security/database cases, six new release checks and five production-database boundary checks passed. Live operational settings remain unverified. |
| Complete lifecycle | Focused and combined passes | New UI-created series/Info/main/Deck journey covers canonical and adopted consultations, independent Info republication and explicit main-version adoption. |
| Metadata response race | Confirmed; regression added | Older selected-publication response overwrites newer public catalogue metadata and restores an obsolete private warning. Production code preserved; narrowly marked known-failure assertion records the defect. |
| Existing browser and motion regressions | Complete, known defect retained | Original 175-case run: 169 ordinary passes, one expected metadata-race failure and five stale/broken test assumptions. Rechecks: all 14 foreign Creator and four private Deck cases passed after test-only corrections. All 57 Info fixture cases passed. |
| TypeScript, lint, optimised build | Passed | Two fresh isolated webpack optimised builds passed, including protected client media enabled with the provider gate closed. Final TypeScript/scoped lint passed after test corrections. Default Turbopack could not follow the isolated external dependency symlink. See `build-notes.md`. |
| Production configuration | Unverified | Application indexes and live Cloudflare private R2/CORS/Stream delivery remain explicit operational gates. |

The first attempt stopped during inspection/delegation before any Phase 5 tests or files were created. No completed Phase 5 test run was lost. Three independent workstreams can run concurrently, but actual Next browser runners share `.next-phase2-test` and must run serially.

## B. Coverage matrix

All paths in this matrix are exact repository test files; fresh execution results follow in §C. Existing strong assertions were reused rather than copied into additional tests.

| Contract and consequence of failure | Existing coverage executed | New or repaired coverage | Assessment / remaining gap |
| --- | --- | --- | --- |
| Stable independent drafts, saves/recovery, CAS, publication; lost work or foreign edits | [repository](../../../../../tests/info-cards.integration.ts), [API](../../../../../tests/info-cards-api.integration.ts), [editor](../../../../../tests/info-card-editor.test.ts), [drafts](../../../../../tests/info-card-drafts.test.ts), [authoring browser](../../../../../tests/phase2/info-cards-authoring.browser.ts) | [Full UI-to-reading lifecycle](../../../../../tests/phase2/info-cards-release.browser.ts), first case | Passed. Includes incomplete/oversized drafts, saved-response recovery, failed publication and public permanence; no new gap identified. |
| Shared series uniqueness, discovery, attribution and independent ownership; hidden metadata leaks | Repository/API and authoring browser files above | Reused existing concurrency, contribution, hidden-series and retained-selection cases | Passed. Live index deployment is separate, not proved by disposable data. |
| Fixed-size capacity, live field feedback, paragraph breaks and media space; clipped publications or lost drafts | [capacity unit](../../../../../tests/info-cards-capacity.test.ts), [capacity browser](../../../../../tests/browser/info-cards-capacity.browser.ts), authoring browser | Real-face/server parity executed at 360/390/430px, Unicode/line breaks/wide glyphs | Passed. Mathematics/extreme enlargement remain agreed backlog; no character limits or dimensions changed. |
| Ordered attachments, Save/Cancel, all writers, fork/copy/adoption; broken references/history | [attachment DB](../../../../../tests/info-card-attachments.integration.ts), [attachment UI](../../../../../tests/phase2/info-card-attachments.browser.ts), [fork DB](../../../../../tests/card-forks.integration.ts), [reuse DB](../../../../../tests/card-reuse.integration.ts), [adoption DB](../../../../../tests/update-adoption.integration.ts) | Full lifecycle joins actual UI publication, canonical and adopted reading, independent Info updates and explicit main-version adoption | Passed. Missing/empty lists remain equivalent; old publications and personal state preserved. |
| Private/public selection, permanence, truthful contextual feedback | [eligibility browser](../../../../../tests/phase2/info-card-eligibility.browser.ts), [eligibility unit](../../../../../tests/creator-info-attachments.test.ts), attachment DB | Release browser's controlled old-private/new-public metadata race | Normal matrix/filter/refresh/removal tests passed; **one confirmed race remains expected-failing**, not covered by ordinary refresh success. |
| Historical and detached references, concurrent deletion and rollback; dangling/private references | Attachment DB and Info repository tests | [Release DB](../../../../../tests/info-cards-release.integration.ts) checks actual setup CLI and deceptive index options | Passed in disposable replica sets; detached-draft recovery UI remains intentionally deferred without weakening deletion safety. |
| Exact main context, coherent latest Info snapshots, neutral unavailable positions; stale/leaked content | [consultation browser](../../../../../tests/phase2/info-card-consultation.browser.ts), [client unit](../../../../../tests/info-card-consultation-client.test.ts), attachment DB snapshot barriers | Complete lifecycle proves independent Info/main timelines through the real application | Passed. Main version comes from displayed/adopted context, never client-provided attachment IDs. |
| Loading, cancellation, errors, account changes and late responses; lost step state or foreign content | [production lifecycle fixture](../../../../../tests/browser/info-cards-production.browser.ts), consultation browser/client | Nested media pending-grant cancellation case added | Passed. Fast/over-one-second, whole/partial/all-unavailable, reopen and actor-switch cases covered; no new retry/loading UX. |
| Exact-publication private media, upload provenance and legacy-route rejection; asset leakage | [media API/security](../../../../../tests/info-cards-api.integration.ts), [media provider](../../../../../tests/info-cards-media.test.ts), [protected media DB](../../../../../tests/protected-media.integration.ts), [card media DB](../../../../../tests/card-media-access.integration.ts) | Six release DB cases include provider gates and old-public/private-era authorisation; three new consultation cases cover expired/mismatched grants and late response cancellation | Passed with controlled providers. Real R2/Stream security/delivery still unverified; current media gate stays closed. |
| Geometry, fixed-card motion/circular order, state, keyboard/focus/gestures and new pouch target | [integration](../../../../../tests/browser/info-cards-integration.browser.ts), [motion](../../../../../tests/browser/info-cards-motion.browser.ts), [pouch](../../../../../tests/browser/info-cards-pouch.browser.ts), production lifecycle fixture | Existing inward-diagonal finger taps and Previous-margin/pixel-equivalence assertions executed | 57/57 passed. Physical Safari, VoiceOver/browser chrome and subjective thumb/motion feel are not established by Chromium. |
| SPA return, ordering/pagination, detached work, deck/private-copy workflows; missing items/lost work | [collection navigation](../../../../../tests/phase2/creator-collection-navigation.browser.ts), [network observations](../../../../../tests/phase2/creator-library-network.browser.ts), [coordinator](../../../../../tests/phase2/creator-coordinator.browser.ts), [Library](../../../../../tests/phase2/library-ui.browser.ts), [My Decks](../../../../../tests/my-decks-recency.test.ts) | Stale [foreign Creator](../../../../../tests/phase2/creator-foreign-session.browser.ts) and [private Deck](../../../../../tests/phase2/private-deck.browser.ts) expectations corrected to approved rules | Normal SPA/order/detached-work cases and all corrected foreign/private regressions passed. No perfect-first-frame guarantee reinstated. |
| Existing media/player/presentation regressions | [media viewer](../../../../../tests/browser/media-viewer.browser.ts), [download](../../../../../tests/browser/ios-video-download.browser.ts), [card preparation](../../../../../tests/card-video-preparation.spec.ts), [deck preparation](../../../../../tests/deck-video-preparation.spec.ts), [source transition](../../../../../tests/video-source-transition.spec.ts), [readiness](../../../../../tests/user-card-video-readiness.spec.ts) | Test-origin portability and [SSR CSS-import harness](../../../../../tests/presentation-foundation.test.ts) repaired narrowly | Media 20/20, instructional video 37/37, unchanged SSR assertions 9/9 passed. Two local decoder cases use desktop WebKit, not iPhone. |
| Deployment indexes, provider gate, optimized build/CI; unsafe rollout | Release DB, [production DB boundary](../../../../../tests/phase8.test.ts), setup CLI/config inspection | CLI twice, duplicate-data refusal, two isolated optimized builds | Passed locally as documented. Live setup/provider certification and normal fresh-checkout deployment build remain operational checks. |

## C. Test results

The following complementary totals deduplicate rechecks. Full execution history, including corrected test failures, follows; expected failures and historical evidence are never counted as ordinary passes.

| Distinct executed cases | Ordinary passes | Known expected failures |
| --- | --- | --- |
| Complete Node unit suite | 420 | 0 |
| Existing database regressions: foundation 128 + Info/security 55 | 183 | 0 |
| New release/security database checks | 6 | 0 |
| Actual authenticated Next browser cases, after focused test-only rechecks | 174 | 1 |
| Info motion/integration/pouch/production-lifecycle fixtures | 57 | 0 |
| Capacity parity browser cases | 5 | 0 |
| Ordinary media/gallery/download browser cases | 20 | 0 |
| Instructional-video browser cases | 37 | 0 |
| **Total: 903 cases** | **902** | **1** |

The six-file security run contained 57 cases, **two of which are unit tests already included in 420**, leaving 55 distinct DB cases. Earlier 197-unit, five-Phase-8, nine-presentation, three-media, two-workflow and two-CLI rechecks overlap these totals. No case was skipped/flaky in the recorded successful runs. The single expected failure is the confirmed warning defect, not a verified product contract.

Raw runtime evidence is preserved in ignored artifacts under `phase2-test-results/phase5-*.tap`, the combined/recheck JSON reports and existing Playwright temporary reports. The focused run overlaps the final full unit suite and is not added again as distinct coverage. Database suites run with `--test-concurrency=1` against owned disposable replica sets.

- **197/197 focused existing unit tests passed**, no skips/failures, fresh TAP evidence: `phase2-test-results/phase5-units.tap` (Node test runner with `--import tsx`).
- **6/6 new release/security tests passed**, including actual index-setup CLI idempotence and duplicate-data failure, malformed-index readiness, provider gate combinations and exact-publication authorisation. See [security notes](security-release-notes.md). The subsequent two-case setup recheck overlaps these six and is not additional distinct coverage.
- **128/128 existing foundation, fork/reuse, visibility, Creator recovery, adoption and Library database regressions passed**, no failures/skips, 437.6 seconds. Evidence: `phase2-test-results/phase5-foundation.tap`.
- **57/57 existing Info/security/database cases and 5/5 production database boundary cases passed**. See [security notes](security-release-notes.md) for exact files and commands.
- **57/57 real-component Chromium fixture cases passed**, 5.7 minutes, including circular order, animation interruption/reversal, reduced motion, video/activity/focus isolation, delayed/cancelled requests and the enlarged pouch touch boundary. This is not an actual Safari run or a repeat production animation-timing study.
- **3/3 new actual-Next Chromium browser cases passed** in a focused run (21.1 seconds) and again in the combined run: expired/mismatched HTTP-200 video grants and nested-viewer cancellation/late grants. Existing tests covered fail-closed HTTP errors and image publication pinning but not these client-adapter cases.
- The new complete lifecycle browser case passed in its focused and combined runs, including the dedicated companion-fixture isolation improvement. The separate stale metadata regression reached its deliberately expected-failure assertion both times; it is an open defect, not a passing feature assertion.
- **5/5 capacity parity browser cases and 20/20 ordinary media/download browser cases passed** on fresh owned ports 4179/4188. The old 4178 listener was stale and left untouched. Four URL expectations in `tests/browser/ios-video-download.browser.ts` now derive the configured fixture origin, so these tests do not require reusing that old server. Safari-user-agent/Web Share simulations in Chromium are not Safari certification.
- A single installed **WebKit 26.0 launch/click smoke passed** outside the sandbox. This proves that launch context only; it does not certify the complete Info Cards feature or physical iPhone/Safari. No browser repair/download loop was attempted.
- A fresh bounded run of `tests/presentation-foundation.test.ts` reproduced its existing CSS-import harness failure before nine named assertions could register. This was **one failed file load**, not nine failed application assertions. A test-local temporary CSS import stub, restored before assertions, repaired the SSR-only harness; **9/9 unchanged assertions then passed**. No application implementation changed.
- **37/37 existing instructional-video browser cases passed**, covering card/deck grant preparation, poster/decoded-frame handoff, source transitions, actor/version/unmount cancellation and processing readiness. Two cases explicitly launched desktop Playwright WebKit with local WebM and passed; the rest use Chromium. No real Cloudflare delivery or iPhone claim follows from this.
- The 175-case actual-Next combined run completed in **11.9 minutes**: **169 ordinary passes, one expected metadata-race failure, five unexpected test failures**, no skips/flaky results. Playwright's `170 passed` includes the expected failure and is not 170 successful feature assertions. Four unexpected failures are obsolete foreign-Creator source-detail/automatic-open expectations; the fifth private-Deck journey incorrectly includes `?entry=create` in its parsed Deck ID and contains old return-navigation assertions. JSON: `phase2-test-results/phase5-browser.json`.
- The subsequent **18-case foreign/private recheck passed 17 and failed one**: all 14 foreign Creator cases passed after test-only correction. The private journey then reached its later Back action, correctly blocked by an injected completion-save failure which the old test never resolved. `PersonalWork.wait` intentionally retains that failed field operation. The test now uses the existing completion control to make a successful newer save, waits for its actual 200 response and verifies the resulting persisted state rather than silently discarding failed work. The final focused private-Deck rerun **passed 4/4**, 37.3 seconds. JSON: `phase2-test-results/phase5-navigation-recheck.json` and `phase5-private-final.json`; separate output directories preserved original combined evidence. No unexpected assertion failure remains unresolved.
- After repairing the existing SSR test harness, the complete existing `tests/*.test.ts` unit suite passed **420/420**, no failures/skips, 21.6 seconds. This includes the earlier focused 197-case run, five Phase 8 boundary checks, two Info media cases and nine presentation assertions; those overlaps are not additional distinct tests. TAP: `phase2-test-results/phase5-all-units.tap`.
- No production animation-timing measurements were repeated. Prior recorded startup-frame/early-layer-handoff evidence remains historical, not a new failure or new acceptance threshold.

### Environment, static checks and evidence limits

- Node 22.14.0, Next 16.2.6, React 19.2.4, Playwright 1.58.1 on the supplied Intel macOS environment. Actual application tests use the repository's authenticated Next development runner, single-worker Chromium and owned single-member Mongo memory **replica sets** with WiredTiger/real transactions. They never substitute a live URI. The separate optimized builds are production compile checks, not a production-runtime browser run.
- Browser coverage includes 320/360/375/390/430px portrait/mobile widths, 844/932px landscape and 1280/1440px desktop layouts across the relevant suites, touch emulation, keyboard/focus, reduced motion and orientation/geometry checks. Not every test runs at every width. Mock video events/local WebM and intercepted providers are identified in the worker notes.
- **Final TypeScript** `npx tsc --noEmit --incremental false`: passed. **Scoped ESLint:** all seven changed/new test files passed, plus 53 Info-related and 46 Phase 4 source/script files checked earlier with zero warnings/errors. No whole-repository lint pass is claimed.
- **Two actual optimized webpack production builds passed**, with protected-media client flag off/on and provider verification remaining off; compilation, integrated TypeScript, all 41 static-generation tasks and tracing completed. Default Turbopack could not use the temporary external dependency symlink. Font fetch initially failed in the sandbox; unchanged build passed with authorised network access. Exact commands and the initial working-directory correction are in [build notes](build-notes.md).
- **Whitespace, links and scope:** `git diff --check` passed; report links resolve; no application/source/config/deployment or staged changes. No dependency changes, production migrations or provider operations. Existing disposable Mongo child-process cleanup emitted known fallback warnings in some passing suites; no test assertion/transaction failure was hidden by them.
- User-reported Phase 4 device acceptance and older phase test counts remain historical. One WebKit launch smoke and two local decoder cases are the only fresh WebKit evidence; no full Info Cards WebKit/iPhone Safari/VoiceOver test is claimed. No new animation thresholds or comparison with an unmeasured original Phase 1 baseline was invented.

### Ordinary SPA navigation under controlled networks

The existing 18-case observation harness exercises new publication, republication and draft-only return for **both** Library tabs. It samples animation frames and captures screenshots without enforcing the withdrawn perfect-first-frame requirement or changing application behaviour. Slow-mobile profile: 400ms latency, 1.6Mbps download/0.75Mbps upload; delayed-data profile: 1500ms added to Library data responses.

| Collection / profile | First visible collection across three actions |
| --- | --- |
| Decks / normal | 427–546ms |
| Decks / slow mobile | 567–1360ms |
| Decks / delayed data | 1937–2006ms |
| Info Cards / normal | 236–340ms |
| Info Cards / slow mobile | 1788–3076ms |
| Info Cards / delayed data | 1736–1836ms |

In these recorded samples, all final orders were correct; no stale visible ordering, order change or blank sampled frame occurred. Existing loading states were visible in most cases. This is local development-run observation, not a universal first-frame guarantee or subjective assessment of phone smoothness. Measurements/frame captures remain in `phase2-test-results/artifacts/creator-library-network.*/observations.json` and adjacent PNGs, preserved from the original combined run. No loading/navigation solution was implemented.

### Main reproduction commands

Run from the repository root. Local Mongo/browser binds require the permitted execution context on this Mac. Do not run actual Next runners concurrently; each uses `.next-phase2-test`. All databases below are owned/disposable; these are not deployment commands.

```sh
node --import tsx --test --test-concurrency=1 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/info-cards-release.integration.ts
node --import tsx --test --test-concurrency=1 tests/info-cards.integration.ts tests/info-card-attachments.integration.ts tests/info-cards-api.integration.ts tests/info-cards-media.test.ts tests/protected-media.integration.ts tests/card-media-access.integration.ts
node --import tsx --test --test-concurrency=1 tests/card-foundation.integration.ts tests/card-forks.integration.ts tests/card-reuse.integration.ts tests/creator-visibility.integration.ts tests/creator-foreign-session.integration.ts tests/update-adoption.integration.ts tests/library-read-models.integration.ts tests/library-entry.integration.ts
PLAYWRIGHT_JSON_OUTPUT_FILE=phase2-test-results/phase5-browser.json node --import tsx scripts/test-phase2.ts --info-cards info-cards-release.browser.ts info-card-consultation.browser.ts info-card-attachments.browser.ts info-card-eligibility.browser.ts info-cards-authoring.browser.ts creator-coordinator.browser.ts creator-visibility.browser.ts creator-drafts.browser.ts creator-collection-navigation.browser.ts creator-library-network.browser.ts creator-foreign-session.browser.ts fork-foundations.browser.ts update-adoption.browser.ts card-reuse.browser.ts library-ui.browser.ts private-deck.browser.ts --reporter=line,json
PLAYWRIGHT_JSON_OUTPUT_FILE=phase2-test-results/phase5-navigation-recheck.json node --import tsx scripts/test-phase2.ts --info-cards creator-foreign-session.browser.ts private-deck.browser.ts --output=phase2-test-results/phase5-navigation-artifacts --reporter=line,json
PLAYWRIGHT_JSON_OUTPUT_FILE=phase2-test-results/phase5-private-final.json node --import tsx scripts/test-phase2.ts --info-cards private-deck.browser.ts --output=phase2-test-results/phase5-private-final-artifacts --reporter=line,json
SWITCHPLAY_FIXTURE_PORT=4190 npx playwright test --config playwright.info-cards-integration.config.ts
CI=1 npx playwright test --config playwright.info-cards-capacity.config.ts --reporter=line
npx playwright test --config playwright.config.ts tests/card-video-preparation.spec.ts tests/deck-video-preparation.spec.ts tests/video-source-transition.spec.ts tests/user-card-video-readiness.spec.ts --workers=1 --reporter=line,json
npx tsc --noEmit --incremental false
```

The ordinary media run's fresh-port temporary override and optimized-build commands are documented in [build notes](build-notes.md); exact backend/runbook details are in [security notes](security-release-notes.md). Generated reports and traces are ignored local evidence, may be replaced by later runs and are not required application commit files. The tests and this durable report preserve the reproduction/diagnosis.

## D. Findings and risks

### Medium — stale selected-publication metadata restores a resolved private-attachment warning (subsequently resolved)

- **Confirmed**, reproduced by the new controlled regression in `tests/phase2/info-cards-release.browser.ts` (`newer public metadata must not regress…`). Full reproduction/evidence is in [workflow notes](workflow-notes.md).
- Open a public-intent main-card title modal containing private Info publication v1 and hold its selected-metadata response. Publish that Info Card publicly as v2 elsewhere. Open the attachment dropdown so its fresh public catalogue response arrives and clears the warning. Release v1 last: the old private warning reappears despite the publicly eligible option.
- `src/components/creator/InfoCardAttachments.tsx:21` and `:40` independently merge metadata without checking publication versions. Selected IDs/content are preserved; no unauthorised backend publication or private-content leak was observed. The defect is misleading authoring feedback, not a demonstrated security bypass.
- The original recommendation was a small version-aware merge in both response paths and removal of the narrow expected-failure marker. **That correction is now implemented and the regression passes normally**, as recorded in the targeted follow-up. No application fix was made during the original testing-only investigation; its historical expected failure remains excluded from the original passing counts.

### Release gates — application indexes and live provider protection remain unverified

- **Deployment acceptance blocker**, not a failed disposable test. Real index setup has not been run or inspected here. `scripts/setup-info-cards.ts` writes indexes; its idempotence and fail-closed duplicate handling were verified only on owned disposable databases. It offers no dry-run/verify flag. Required unique roots/publications/series/media indexes and main draft/historical reference indexes must be checked before production attachments.
- **Production media acceptance blocker:** real R2 anonymous denial/CORS/conditional writes and Stream signed-only delivery remain unverified. Both existing media gates remain fail-closed. Do not set the provider acknowledgement simply because mock tests pass; ensure the public client flag is present at build time, not merely runtime.
- Existing instructions: [Phase 2 provider/deployment runbook](../phase-2/README.md#provider-security-and-deployment-gate), [production preparation](../../../phase-8-preparation.md#vercel-preparation), and [media preparation](../../../phase-8-preparation.md#media-preparation-and-outstanding-provider-approval). Historical Phase 8 migrations must not be rerun for this feature. No live credentials or settings were changed or certified.

### Low — CI and harness evidence limitations

- `.github/workflows/deploy.yml` currently provides manual build verification, not an enforced regression/security gate. Adding CI test execution is a later engineering improvement, not a new product requirement or a change made here.
- The corrected presentation harness proves SSR structure only. The isolated build uses the existing webpack option because default Turbopack rejects the temporary external dependency symlink. A normal fresh-checkout CI build is still a useful deployment check; this isolation error is not evidence of an application compile defect.
- One early build command inadvertently ran in repository cwd and loaded `.env.local`; it was promptly stopped with Mongo explicitly blank/disposable. No database access, tracked implementation change or live operation occurred. See [build notes](build-notes.md) for the exact execution correction, font-network retry and clean isolated passing builds.
- Desktop WebKit/local decoder success does not resolve the original sandboxed crash generally, certify the complete Info Cards feature on WebKit, or establish Safari/VoiceOver acceptance. No repeated repair investigation was attempted.

### Retained, previously agreed limitations — not newly invented requirements

- No automatic renewal while a Stream viewer remains paused beyond its roughly one-hour bearer lifetime. Reopening nested media reauthorises the same pinned publication. No scheduler/cache/permission manager was added.
- Already-issued Stream bearer URLs are not instantly revoked by application logout; they expire normally. Actor/exact-publication checks govern grant issuance, not immediate revocation of previously issued provider tokens. This is an existing documented lifetime trade-off, not a newly introduced policy or a claim that live provider controls were verified.
- Detached main-card drafts can still be hard to reach and legitimately block deletion; their retained references remain protected. Broader recovery and deletion UI remain deferred.
- Extreme text enlargement/unusually small screens and mathematical rendering remain recorded backlog, not implemented Phase 5 scope. Standard viewport capacity and browser zoom are preserved; no visual redesign was performed.

## E. Release checklist

### Verified in this investigation

- [x] Independent draft/publication/series identity and permissions, public permanence, invalid-publication rollback and recovery.
- [x] Canonical attachment writers, immutable historical blockers, both attach/delete race orders, adopted/canonical version separation and coherent snapshots.
- [x] Exact-publication media ACLs, disabled-provider fail-closed behaviour, proof provenance and legacy-route isolation with controlled providers.
- [x] Setup CLI idempotence/non-destructive failure on disposable data; required index-option checks and explicit recovery.
- [x] Fixed-card layout/capacity parity, circular order, motion cancellation/reversal/reduced motion, playback/activity/focus and hit-area boundary regressions.
- [x] Two isolated optimised production builds and static checks, with limitations recorded.
- [x] Complete combined actual-application browser run and focused rechecks; known expected-failing application race explicitly separated from corrected test assumptions.

### Remaining work requiring separate authorisation or operational access

- [x] Separately authorised metadata-race correction implemented; original regression and reverse-response regression pass normally. No defect waiver or product change needed.
- [ ] Confirm target production database/backup and approve required index inspection/setup. Run the existing index script only with the approved environment; restart processes if indexes are changed out of band because successful readiness is cached.
- [ ] Verify live R2 aliases/access/proxy/CORS/conditional upload and signed Stream playback; only then enable provider acknowledgement. Confirm matching build/runtime public media flag.
- [ ] Run ordinary release CI against a clean checkout/lockfile; enforce automated test gates later if desired. No deployment or historical migration is included in this investigation.

### Limited actual iPhone/Safari/VoiceOver checks

The user has already reported Phase 4 manual UX acceptance. Do not repeat checks already covered by that acceptance or deterministic ownership/order/timer/persistence automation. Remaining device/provider evidence should be limited to genuinely unverified items:

1. On an actual iPhone, exercise pouch opening/cycling/closing and nested media with Safari browser chrome expanded/collapsed and after orientation changes. Check physical thumb comfort near Previous and absence of unwanted page scroll/edge gestures.
2. With VoiceOver, reach the pouch, unavailable slot, series tooltip, media and close controls; verify consultation focus isolation and return without losing step context.
3. After live provider verification, play a real authorised image/video through both private-owner and authorised public publication contexts, close to the same Info Card and confirm the step video stays paused at its previous position. Native HLS/fullscreen/interruption/background behaviour cannot be certified by Chromium/provider mocks.

Use the existing **actual authenticated disposable application**, not the Phase 1 fixture, for these checks. Freshly verified from this Mac: both URLs below returned authenticated HTTP 200 HTML and the review Deck API returned 200. This does **not** establish that an iPhone reached them.

```text
Desktop: http://127.0.0.1:4181/library/phase4-review-deck-20261024
iPhone, same Wi-Fi: http://192.168.1.38:4181/library/phase4-review-deck-20261024
Disposable login: phase2 / local-test-only
```

The existing runner PID 41840 was left running; no review data was recreated or discarded. Foreground restart command: `node --import tsx scripts/test-phase2.ts --dev --lan --info-cards`; Ctrl+C stops that runner and its disposable database. The current reviewed runner can be stopped with `kill -TERM 41840` **only while it still identifies that same runner**. See the [Phase 4 handoff](../phase-4/README.md) for details. Restart creates a fresh database, so the above review Deck ID will not survive it; the command prints the current LAN address and seeds Info examples. Automated runners used here create/clean their own separate databases and do not persist phone-review edits.

## F. Changes and boundaries

The **11 repository changes from the original testing-only investigation** were tests or testing evidence:

| File | Purpose |
| --- | --- |
| `tests/info-cards-release.integration.ts` (new) | Six disposable release/index/provider/old-publication security checks. |
| `tests/phase2/info-cards-release.browser.ts` (new) | One complete cross-boundary lifecycle and one controlled expected-failing metadata race. |
| `tests/phase2/info-card-consultation.browser.ts` | Three new invalid/expired/pending media-grant cases; existing cases unchanged. |
| `tests/presentation-foundation.test.ts` | Test-local CSS import handling; original nine SSR assertions unchanged. |
| `tests/browser/ios-video-download.browser.ts` | Four URL assertions use the configured origin instead of a stale fixed port. |
| `tests/phase2/creator-foreign-session.browser.ts` | Replace superseded detail/auto-open assertions with approved collection/copy-ID destinations. |
| `tests/phase2/private-deck.browser.ts` | Parse IDs without query strings, use approved collection returns and explicitly recover an injected failed save. |
| `docs/engineering/features/info-cards/phase-5/README.md` (new) | This incremental/final report. |
| `docs/engineering/features/info-cards/phase-5/security-release-notes.md` (new) | Exact backend commands, security/index/operational evidence and SSR harness correction. |
| `docs/engineering/features/info-cards/phase-5/workflow-notes.md` (new) | Workflow/metadata reproduction, video regression and private-journey evidence. |
| `docs/engineering/features/info-cards/phase-5/build-notes.md` (new) | Static/build/environment limitations, capacity/media runs and foreign-test correction. |

**Original investigation: 11 new cases, ten passing and one recording the then-unresolved defect.** At that point no application implementation, functional specification, engineering plan, environment/configuration, live data, indexes or provider settings changed. `git diff --check` passed and the source/config/package/deployment and staged diffs were empty. The separately authorised application correction and additional reverse-order test are recorded below. Generated TAP/JSON/screenshots/traces, temporary media config and isolated build copy are runtime evidence, not new application/commit files. No temporary production switch, secret or debug component was introduced. Nothing was staged or committed.

## G. Decisions requiring approval

No new product/UX/security-policy decision was needed or silently resolved. The existing warning-clears-on-resolution requirement determines the correct outcome of the metadata race. Separate authorisation for the small application correction was subsequently supplied and has been implemented; see below.

Live index/provider operations still need explicit target/access approval and verified configuration, not a change to agreed ownership/privacy/publication rules. Release approval should wait for that evidence and any outstanding device checks; this report does not approve deployment.

## Authorised targeted follow-up — stale metadata race resolved

- **Root cause:** selected-publication hydration and catalogue loading independently replaced `labels` entries by arrival order, letting a delayed v1/private response overwrite already-known v2/public metadata.
- **Small correction:** `InfoCardAttachments.tsx` now uses one component-local `mergePublicationMetadata` function in both existing response handlers. Lower publication versions are discarded per stable Info Card ID; equal versions may still refresh attribution. Dropdown rows use that same retained metadata before applying the **unchanged** eligibility predicates, so an older catalogue cannot downgrade option labels/eligibility either. Selected IDs/order, Save/Cancel, requests/cancellation, publication rules and layout are unchanged. No new fetching, global state or cache was added.
- Removed the original browser regression's expected-failure marker. Added a controlled reverse-order case: hold a private v1 catalogue, deliver selected publication v2/public first, then release v1; title, selection, eligibility and absence of warning must remain correct.
- Fresh checks: **8/8 focused eligibility/error unit cases passed**; TypeScript no-emit/nonincremental, scoped ESLint for the component and two changed browser files, and `git diff --check` passed.
- Two initial focused 22-case browser runs each passed **21 cases**, including both metadata races and the full authoring-to-adoption workflow. One existing private-copy test timed out on each run: it reloaded the source URL after observing the database commit but before the client installed the resulting copy URL, reopening the foreign-Deck confirmation. Trace inspection confirmed a successful fork response with a different resulting Deck ID. Added only a test assertion waiting for that owned-copy URL before reload; no application copy/navigation implementation changed. A three-case recheck passed **3/3**, 11.4 seconds: original metadata race, reverse catalogue race and the synchronized private-copy test. The final combined focused run then passed **22/22**, approximately 1.3 minutes, with no expected failures, skips or flaky results. These final 22 browser cases and eight unit cases are fresh focused acceptance, not a rerun of the full Phase 5 suite.
- Artifacts: `phase2-test-results/phase5-metadata-fix.json`, `phase5-metadata-fix-recheck.json`, `phase5-metadata-final.json` and `phase5-metadata-combined-final.json`, with separate output directories retaining each run's evidence.
- Follow-up files: `src/components/creator/InfoCardAttachments.tsx`; `tests/phase2/info-cards-release.browser.ts`; `tests/phase2/info-card-eligibility.browser.ts`; this report and `workflow-notes.md`. All earlier uncommitted Phase 5 work was preserved. Source diff is limited to the attachment component; no production Cloudflare settings, database indexes, publication/security rules, packages or unrelated application files changed. Nothing staged or committed.

```sh
node --import tsx --test tests/creator-info-attachments.test.ts
PLAYWRIGHT_JSON_OUTPUT_FILE=phase2-test-results/phase5-metadata-fix-recheck.json node --import tsx scripts/test-phase2.ts --info-cards info-cards-release.browser.ts info-card-attachments.browser.ts info-card-eligibility.browser.ts --output=phase2-test-results/phase5-metadata-fix-recheck-artifacts --reporter=line,json
PLAYWRIGHT_JSON_OUTPUT_FILE=phase2-test-results/phase5-metadata-final.json node --import tsx scripts/test-phase2.ts --info-cards info-cards-release.browser.ts info-card-eligibility.browser.ts --grep 'older selected private|older catalogue|private copies' --output=phase2-test-results/phase5-metadata-final-artifacts --reporter=line,json
PLAYWRIGHT_JSON_OUTPUT_FILE=phase2-test-results/phase5-metadata-combined-final.json node --import tsx scripts/test-phase2.ts --info-cards info-cards-release.browser.ts info-card-attachments.browser.ts info-card-eligibility.browser.ts --output=phase2-test-results/phase5-metadata-combined-final-artifacts --reporter=line,json
npx tsc --noEmit --incremental false
npx eslint src/components/creator/InfoCardAttachments.tsx tests/phase2/info-cards-release.browser.ts tests/phase2/info-card-eligibility.browser.ts
git diff --check
```
