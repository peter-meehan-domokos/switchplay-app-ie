# Personal Info Cards — Implementation and verification handoff

Branch: `feat/info-cards`. Started 28 October 2026 from `de7d378`.

Authority: [final engineering plan](personal-info-cards-engineering-plan.md) and the full A–E implementation instruction. Existing untracked plan preserved. No production database/provider operations or commits authorised.

## Resume point

Checkpoints **A–E code-complete and verified**, 29 October 2026. Final combined real-app run **71/71 passed** (`/tmp/personal-info-final-71.log`); explicit insecure-context creation and portrait/short-landscape geometry selection **2/2 passed** (`/tmp/personal-info-mobile-final.log`); final standard production build passed (`/tmp/personal-info-release-build.log`). The authenticated disposable LAN app is running. Only subjective physical-iPhone/Safari/VoiceOver acceptance and separately authorised operational prerequisites remain. Only the plan was untracked at start. No stage/commit/deploy/provider/live-database operations.

## Checklist

- [x] A: purpose/privacy, associations/dates, projections/store, indexes and focused tests.
- [x] B: atomic Save/Remove, receipts, coherent mixed snapshots and focused tests.
- [x] C: common face/footer/menu and geometry/content tests.
- [x] D: reusable embedded editor, open-pouch selection, My Drafts recovery and browser tests.
- [x] E: combined regression, type/lint/build, diff review and disposable LAN review app.

## Safety and evidence

Normal development deliberately connects to production Atlas: never use it for test writes or index installation. Use existing memory replica-set integrations and `scripts/test-phase2.ts` for seeded Next tests/review. Live index installation and provider writes/configuration remain separately authorised. Accepted direct-public-R2 trial risk is unchanged.

Initial sandbox database launch failed with EPERM; reran outside sandbox against owned memory replica sets only. Initial 69-case existing regression run: 67 passed, 2 old snapshot/order assertions failed and were updated for the approved working-only sources/date ordering. Subsequent combined backend run: 28/29 passed (all 17 attachment cases plus 11 personal cases); remaining failure was a fixture attempting to publish private forked Cards into a permanent public Deck. Corrected fixture to explicitly publish those forks publicly. Fresh personal backend run: **12/12 passed**. No production data/provider operations.

TypeScript passed after data/backend work and again after the first complete frontend wiring. Standard `npm run build` passed (Turbopack, 43 static pages); the final repeat/static results are recorded below. No physical iPhone/Safari verification claimed.

Logs: `/tmp/personal-info-checkpoint-a.log`, `/tmp/personal-info-backend.log`, `/tmp/personal-info-backend-final.log`. Tests use their own URI and database; no Atlas fallback.

## Remaining work

No known remaining implementation defect. Product owner reviews the new sage/credit/menu/editor/touch experience on an actual iPhone. Separately authorise the additional users index before enabling personal mutations in the normal Atlas-connected app. Live provider/device acceptance is not claimed from mocks or Chromium. Do not use the normal production-connected development app to seed review content.

## Current executed verification (28 October)

- `node --import tsx --test --test-concurrency=1 tests/personal-info-cards.integration.ts tests/info-card-editor.test.ts tests/info-card-consultation-client.test.ts tests/working-updates.test.ts tests/card-forks.test.ts`: **54/54 passed** (`/tmp/personal-info-final-focused.log`). Includes 15 new personal database cases, concurrent creation/Save/delete, rollback, actor separation, exact receipt recovery without resurrection and X → Y → Z ancestry.
- Existing API/release/media/fork/reuse/adoption six-file database selection: **62/62 passed** (`/tmp/personal-info-regression-db.log`).
- `node --import tsx scripts/test-phase2.ts --info-cards personal-info-cards.browser.ts info-card-consultation.browser.ts --reporter=line`: **20/20 passed** (`/tmp/personal-info-browser-combined.log`). Real authenticated Next app, disposable replica set; eight personal journeys plus twelve existing consultation cases. Three additional controlled personal edge cases now included in the final run.
- `SWITCHPLAY_FIXTURE_PORT=4190 npx playwright test --config=playwright.info-cards-integration.config.ts --reporter=line`: **57/57 passed** (`/tmp/personal-info-motion.log`), including physical motions, pointer/touch isolation, enlarged pouch target/Previous boundary, loading/cancellation, paused mounted video and activity.
- `SWITCHPLAY_FIXTURE_PORT=4191 npx playwright test --config=playwright.info-cards-capacity.config.ts --reporter=line`: **5/5 passed** (`/tmp/personal-info-capacity.log`), real rendered font/wrapping bounds at 360/390/430px.
- Initial 67-case real-app combined run: **60 passed, 7 failed**, `/tmp/personal-info-acceptance.log`; corrections and the final green 71-case run are recorded below.
- Additional existing lifecycle/history/media/privacy regressions: **79/79 passed**, `/tmp/personal-info-final-regressions.log`.

### Continuation, 29 October

- Additional existing lifecycle/history/media/privacy selection completed **79/79 passed** (`/tmp/personal-info-final-regressions.log`).
- Date/Creator acknowledgement regression selection: **73/73 passed** (`/tmp/personal-info-dates-final.log`): 40 coordinator tests, 17 canonical attachment integration tests and 16 personal integration cases. Includes both normal and lost responses carrying server-assigned dates, map round trips through board/adapters/projections/forks, and remove/re-add as a genuinely new publishable association. Later extensions completed **24/24** lifecycle/upload cases below.
- First 67-case combined run: **60 passed, 7 failed**. Four shared Creator failures and the release journey exposed a real metadata acknowledgement seam: server-owned new date maps were being mistaken for a conflicting content edit. `EntityLane` now has a narrow editable-content comparator only for Card command acknowledgement; normal canonical publication equality still includes association dates. No new coordinator, altered publication rule or date authority. Two new personal assertions incorrectly looked for an alert instead of the editor's existing status, and treated the open positional number as the attachment count; corrected assertions, not UX.
- The immediately subsequent run encountered stale generated Next output: `/api/auth/login` returned **404**, not a failed ownership check. Aborted that environment-invalid run, moved only `.next-phase2-test` to `/private/tmp/switchplay-personal-next-test-stale-20261029` (recoverable generated cache), and relaunched. The runner now accepts only actual auth-route 200/401 as readiness, not arbitrary 404. Current clean run is progressing normally. No production state involved.
- Existing saved review runner (PID 64849, owned memory database) was verified and stopped before refreshing its disposable seed; its old test data was intentionally discarded. No normal Atlas-connected server was stopped. Current review runner PID **942**, Next parent **1264**, port **4181**, database **`switchplay_phase2_browser_b4aabd0937e44773a4af580a135644ba`**.
- Authenticated **mobile Chromium 390×844** checks succeeded over loopback **and actual Wi-Fi `192.168.1.38`** for empty (0), mixed (4) and inherited (4) pouches. See `/tmp/personal-info-review-verification.log`. This is LAN verification from this Mac, not physical iPhone/Safari acceptance. Screenshots: `phase2-test-results/personal-review-{empty,mixed,inherited}-390.png`.
- Final standard build completed successfully (`/tmp/personal-info-final-build.log`); final TypeScript and scoped lint were clean before the last test-only/readiness edits. Repeat final static checks before sign-off.

### Final integration corrections and evidence

The clean 67-case run completed 64 passes/3 failures. Its remaining defects were the publication-label half of server-date acknowledgement and nested Cancel focus restoration; both were corrected without altering canonical equality or editor/pouch state. The third assertion assumed twelve maths lines would fit after removing media; the approved common footer now reserves authorship/actions space without media too. Updated that assertion to retain the source and advisory warning, rather than changing maths acceptance or shrinking content.

The subsequent 71-case combined run completed 70 passes/1 diagnostic failure. Isolated reproduction plus Chromium CDP proved the new creator credit used system Arial while body text used the required custom Liberation Sans. Scoped maths-footer `font-family: inherit` fixes the actual fallback; the strict diagnostic font check remains unchanged. The following **15/15** real maths/personal browser selection passed, including the trusted screenshot diagnostic and overflowing-content diagnostic/publication.

Actual insecure-LAN touch testing then exposed a separate implementation mistake: direct `crypto.randomUUID()` is unavailable over Wi-Fi HTTP. Replaced that one call with existing `clientId()` (cryptographic `getRandomValues`), with no new ID system. Added an explicit missing-randomUUID creation regression. Fresh mobile Chromium checks on `http://192.168.1.38:4181` confirmed `isSecureContext=false`, absent randomUUID, working getRandomValues, and successful touch Edit/Cancel and + New/Cancel retaining the selected card. `/tmp/personal-info-review-touch-final.log`; not a claim of physical Safari testing.

Latest consolidated pure unit run: **162/162 passed**, `/tmp/personal-info-units-complete.log`:

```sh
node --import tsx --test --test-concurrency=1 tests/info-card-editor.test.ts tests/info-card-consultation-client.test.ts tests/working-updates.test.ts tests/card-forks.test.ts tests/info-card-upload.test.ts tests/creator-coordinator.test.ts tests/creator-publication-presentation.test.ts tests/info-maths.test.ts tests/info-maths-trusted.test.ts tests/creator-recovery.test.ts tests/creator-info-attachments.test.ts tests/creator-visibility.test.ts tests/creator-lifecycle.test.ts tests/creator-introduction-state.test.ts
```

Latest personal lifecycle/media integration: **24/24 passed** (20 personal database cases + 4 upload-adapter cases), `/tmp/personal-info-lifecycle-final.log`:

```sh
node --import tsx --test --test-concurrency=1 tests/personal-info-cards.integration.ts tests/info-card-upload.test.ts
```

Includes controlled attach-wins/delete-wins interleavings, identical concurrent Save receipts, cross-Deck reuse after archive, owner-only exact image/video versions after later edits, and the shared upload adapter in personal mode. Provider readiness/delivery is mocked; no live upload or Cloudflare verification in this run.

Existing **62/62** backend regression command (`/tmp/personal-info-regression-db.log`):

```sh
node --import tsx --test --test-concurrency=1 tests/info-cards-api.integration.ts tests/info-cards-release.integration.ts tests/info-cards-media.test.ts tests/card-forks.integration.ts tests/card-reuse.integration.ts tests/update-adoption.integration.ts
```

Existing **79/79** regression command (`/tmp/personal-info-final-regressions.log`):

```sh
node --import tsx --test --test-concurrency=1 tests/info-cards.integration.ts tests/info-card-attachments.integration.ts tests/personal-history-projection.test.ts tests/personal-lifecycle.integration.ts tests/protected-media.integration.ts tests/card-media-access.integration.ts tests/info-card-upload.test.ts tests/info-card-drafts.test.ts tests/info-card-errors.test.ts tests/creator-navigation.test.ts
```

Counts above are per executed command, **not summed as unique cases**; selections intentionally overlap. Intermediate failing runs are retained above rather than silently counted as green. The final full combined command completed **71/71** at `/tmp/personal-info-final-71.log`:

```sh
node --import tsx scripts/test-phase2.ts --info-cards personal-info-cards.browser.ts info-cards-authoring.browser.ts info-card-attachments.browser.ts info-card-eligibility.browser.ts info-cards-release.browser.ts creator-collection-navigation.browser.ts info-maths.browser.ts --grep-invert 'firefox|webkit|mobile WebKit' --reporter=line
```

The five Firefox/WebKit selections in the existing maths file were deliberately excluded; Chromium evidence is not iPhone Safari/VoiceOver evidence. Existing production animation timing investigation was not repeated; the 57-case motion/integration suite verified unchanged timings/lifecycle interactions.

### Final outcome

- The exact 71-case combined command above completed **71 passed, 0 failed**, 4.6 minutes. All ordinary Creator/Library/navigation, main attachment eligibility/publication, maths diagnostic and personal operation assertions passed together.
- After that collection had already been compiled, the insecure-LAN ID mistake was corrected. An explicit fresh missing-randomUUID creation/Save run passed **1/1** (`/tmp/personal-info-insecure-creation-final.log`), followed by the final missing-randomUUID + geometry/menu selection **2/2** (`/tmp/personal-info-mobile-final.log`):

```sh
node --import tsx scripts/test-phase2.ts --info-cards personal-info-cards.browser.ts --grep 'empty pouch creates a private note|footer geometry' --reporter=line
```

- Geometry checks use actual rendered boxes at **360×844, 390×844, 430×844 and 844×390**, two animation frames after resizing: logical face **240×204**, creator centre error **<0.1px**, creator/control bands separated and rendered menu target **≥24px**. Tests also exercise tooltip, menu keyboard/outside isolation and focus restoration. Normal portrait targets are larger because the existing Step View scales the pack.
- `npm run typecheck`: passed (`/tmp/personal-info-final-typecheck.log`, final repeat `/tmp/personal-info-handoff-types.log`). Scoped `npx eslint` over every changed/new TS/TSX file: no errors or warnings (`/tmp/personal-info-final-eslint.log`); final geometry-test lint repeated separately (`/tmp/personal-info-handoff-lint.log`). CSS changes are local modules, not global overrides.
- `npm run build`: **passed**, normal Next 16.2.6 Turbopack production build, compilation 8.3s, TypeScript 14.6s, **43/43** static pages generated. No isolated Webpack substitute, production DB setup or provider calls.
- `git diff --check`: passed. Reviewed staged/unstaged/untracked inventory and relevant full source diffs; no staged changes, accidental credentials, env/provider changes, generated artifacts or unrelated feature work. The 58 tracked modifications plus 9 untracked files are enumerated below; one of those untracked files is the pre-existing final plan.
- Small infrastructure adjustments are limited to existing review-runner seed content and correct auth-route readiness. No application navigation/cache/media/ancestry/modal framework was introduced. The old test cache remains recoverable in `/private/tmp`, outside the commit.

The automated media evidence covers reusable image transfer/proof/cancellation, video processing/viewer plumbing and owner/exact-version enforcement, including personal roots; **not live Cloudflare delivery**. The unchanged review fixture deliberately keeps live Info media gated and ordinary media mocked. No live asset upload/configuration/index installation was performed to manufacture acceptance.

No approved product decision was changed. Two necessary canonical-client seams now distinguish editable intent from authoritative date metadata, while database publication equality still detects real association changes. The common footer's maths font inheritance and nested-editor focus restoration preserve the intended existing mechanisms. Deferred storage-origin confidentiality and separately authorised index installation are operational/trial constraints, not silently fixed implementation defects.

## Review environment and copyable commands

Actual authenticated Next app, own disposable Mongo replica set and mocked providers, **not** the old Phase 1 fixture and **not** production Atlas. No auto-start service added. Data is discarded on stop; restarting creates new review IDs and prints fresh links.

Desktop:

```text
http://127.0.0.1:4181/decks
```

Wi-Fi phone URL (verified authenticated from this Mac):

```text
http://192.168.1.38:4181/decks
```

Login **phase2 / local-test-only**. Second actor **other / local-test-only**. Current data includes `Personal Info Cards review` (Empty pouch and Mixed pouch) and `Inherited personal notes review` (same actor's adapted Card; original associations, not copied notes).

Direct initial empty/mixed/ancestor choices:

```text
http://192.168.1.38:4181/decks?openDeck=4adb6f7d-b5b2-436b-86fc-ddf31ec62f35&openCard=d13976c3-682d-4c51-98e9-dff7218d592c
http://192.168.1.38:4181/decks?openDeck=4adb6f7d-b5b2-436b-86fc-ddf31ec62f35&openCard=fc337501-2ebb-49e5-9a7c-36285af016bc
http://192.168.1.38:4181/decks?openDeck=defc39eb-9b9b-48ce-b9d5-1c9573310f30
```

Start (keep terminal open; never substitute normal `npm run dev` for disposable seeding):

```sh
cd /Users/peterdomokos/projects/switchplay-app
node --import tsx scripts/test-phase2.ts --dev --lan --info-cards
```

Stop current verified runner, which also stops its Next child and destroys only its disposable replica set:

```sh
kill -TERM 942
```

When started interactively use **Ctrl+C**, or the newly printed PID. `phase2-test-results/review-server.json` records the current PID, database and review IDs. The extra `100.64.*` interface printed by the runner is not the verified Wi-Fi address. No production media credentials are used by this review app; live Cloudflare upload/playback is not enabled in it. Automated provider-mocked media journeys and exact-publication security tests are separate from real-device/live-provider acceptance.

Manual checks are limited to subjective/device-specific acceptance: sage/centred credit/readability, long-name reveal, three-dot/plus touch affordance, native editor with iPhone keyboard, VoiceOver focus, and unchanged pouch/swipe feel. Test New→Save, Edit→Save, Remove and Cancel in the same open pouch; inherited Remove intentionally affects the original same-user association. Do not ask the owner to manually retest database races, ordering or ownership already covered automatically.

## Complete worktree inventory

All changes are unstaged. The engineering plan listed below was already untracked when implementation began and was preserved, not rewritten. All other files are this implementation/test/handoff work. No credentials, environment files, dependencies, generated screenshots/caches or provider configuration are included in the source diff.

Tracked modifications (58):

```text
scripts/setup-info-cards.ts
scripts/test-phase2.ts
src/app/creator/info-cards/[infoCardId]/page.tsx
src/components/creator/CreatorDragLab.tsx
src/components/creator/cardArchitectureAdapter.ts
src/components/creator/creatorBoardState.ts
src/components/creator/creatorDraftEntries.ts
src/components/creator/creatorPersistenceCoordinator.ts
src/components/creator/creatorPublicationPresentation.ts
src/components/decks/DeckDetail.tsx
src/components/decks/DeckScene.tsx
src/components/decks/FocusedCardView.tsx
src/components/decks/StepView.tsx
src/components/decks/presentation.ts
src/components/decks/types.ts
src/components/decks/useWorkingDeck.ts
src/components/info-cards/InfoCardConsultation.module.css
src/components/info-cards/InfoCardConsultation.tsx
src/components/info-cards/InfoCardEditor.module.css
src/components/info-cards/InfoCardEditor.tsx
src/components/info-cards/InfoCardFace.module.css
src/components/info-cards/InfoCardFace.tsx
src/components/info-cards/InfoCardMaths.module.css
src/components/info-cards/InfoCardPhysicalStack.tsx
src/components/info-cards/InfoCardPouch.tsx
src/components/info-cards/infoCardConsultationClient.ts
src/components/info-cards/infoCardEditorController.ts
src/components/info-cards/infoCardErrors.ts
src/components/info-cards/infoCardMaths.ts
src/components/info-cards/useInfoCardDialog.ts
src/components/layout/AppShell.tsx
src/components/library/InfoCardsLibrary.tsx
src/lib/cards/domain.ts
src/lib/cards/libraryProjection.ts
src/lib/cards/model.ts
src/lib/cards/personalHistory.ts
src/lib/cards/publicationRules.ts
src/lib/cards/readModels.ts
src/lib/cards/repository.ts
src/lib/cards/workingCardStore.ts
src/lib/infoCards/mathsValidation.ts
src/lib/infoCards/media.ts
src/lib/infoCards/model.ts
src/lib/infoCards/queries.ts
src/lib/infoCards/repository.ts
src/lib/infoCards/trustedMaths.ts
tests/browser/info-cards-capacity.browser.ts
tests/creator-coordinator.test.ts
tests/creator-publication-presentation.test.ts
tests/info-card-attachments.integration.ts
tests/info-card-consultation-client.test.ts
tests/info-card-editor.test.ts
tests/info-card-upload.test.ts
tests/phase2/info-card-consultation.browser.ts
tests/phase2/info-cards-authoring.browser.ts
tests/phase2/info-cards-release.browser.ts
tests/phase2/info-maths.browser.ts
tests/working-updates.test.ts
```

Untracked files (9; include intentional application/test files, not disposable artifacts):

```text
docs/engineering/features/info-cards/personal-info-cards-engineering-plan.md
docs/engineering/features/info-cards/personal-info-cards-handoff.md
src/app/api/cards-data/[cardTemplateId]/personal-info-cards/route.ts
src/app/api/info-cards/[infoCardId]/save/route.ts
src/components/info-cards/InfoCardMenu.tsx
src/components/info-cards/PersonalInfoEditorDialog.tsx
src/lib/infoCards/attachmentDates.ts
tests/personal-info-cards.integration.ts
tests/phase2/personal-info-cards.browser.ts
```

Intermediate failures were corrected and not counted as passes: embedding callbacks/DOM refs had entered the personal command journal; the controller now explicitly serialises only origin/deck/version/list revision. A last-item Remove could ignore a close tap during reconciliation; its existing X is now correctly disabled during that operation. Two personal fixtures selected the wrong CardData record or used public-Deck/private-Card context; corrected fixture assertions/context. Existing Library credit/geometry assertions are updated only for the approved common footer, not to change content/publication rules.

## Implementation notes

- Personal immutable purpose/origin on the existing root; shared APIs use an explicit creator-only filter. Generic Publish and shared reference writers reject personal IDs even for their owner. Exact media reads enforce owner purpose in addition to publication authorisation.
- Optional CardData association IDs/date map/list revision; first Save appends with server date in the same transaction as the immutable private version. Subsequent Save/receipts never append. Remove changes only the original association. Existing root conflict writes protect against deletion races.
- Shared dates are server-normalised at canonical create/graph/save/fork boundaries; retained/legacy references are not redated. Maps survive board, adapter, working and Library projections. Absent/empty semantics retained.
- Existing `personalHistorySegments` resolves the actor's original source records live; no copied notes/arrays or new ancestry. The existing working store receives independently revisioned source acknowledgements, including descendant projections.
- One coherent exact-main consultation resolves shared/local/inherited publications, sorts by association date (authorised root creation fallback), fixes publication versions for the consultation and returns content-free opaque unavailable positions.
- Common 240×204 face uses sage only for personal cards, centred actual card creator, media left/menu right. Footer is the maths collision boundary in all hosts; maths source/publication acceptance is unchanged.
- The existing editor/controller is embedded in a thin native dialog. Save/Edit/Remove replace the same open consultation snapshot and select new/same/next surviving previous-order card; Cancel retains the pinned snapshot. Empty state is a single plus. No new toolbar, search, deletion UI, modal framework, cache or scheduler.
- Personal unfinished work uses existing My Drafts; clean/removed personal roots are excluded. Eligible recovery enters a real working Card; no invented memberships. Journals remain actor/purpose bound.

## Operational actions still separate

The new nonunique users index `cardsData.personalInfoCardIds_1` is part of the existing setup/readiness code and tested idempotently on disposable databases only. It has **not** been installed in Atlas. The previously installed twelve indexes do not establish this new prerequisite. Authorise live inspection/setup separately before personal trial use in the normal production-connected app.

No Cloudflare settings/assets changed. Signed new videos, exact-publication checks and the accepted non-sensitive direct-public-R2-image trial risk are preserved. No live provider verification claimed for this run.
