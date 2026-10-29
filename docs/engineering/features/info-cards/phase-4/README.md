# Info Cards Phase 4 — implementation handoff

Branch: `feat/info-cards`. Checkpoints 4A–4E implemented and automated verification complete; no commit. Production acceptance remains gated on the explicit index/provider checks below. Scope is main-card attachments and production consultation only. The latest implementation go-ahead approves pouch/background/Escape cancellation during loading and whole-request errors. No deletion UI, new media renewal system, Phase 5 feature work or live deployment is included.

## Checkpoint 4A — persistence and reference safety

- Optional ordered `infoCardIds` is validated in canonical main content and preserved through Creator columns/template/private-graph adapters, working DTOs and canonical presentations. Generic content comparison recognises absent/empty lists only for main-content-shaped objects; order and unrelated optional fields remain significant. Immutable history is not rewritten.
- Full graph creation, standalone creation, draft save, standalone/combined forks and main publication acquire existing sorted info-root reference guards before canonical writes in their existing transactions. Exact retry recovery does not repeat a reference creation. Default-only card creation stays empty; move-step preserves each main card's list; reference-only Copy does not fork attachments. Drafts may stage own-private publications; public main publication rejects them.
- Nonempty main writes check existing unique Info indexes plus main draft/history reference indexes using the existing cached readiness mechanism. No indexes were deployed to an application database.
- Automated: **39/39 passed** with `node --import tsx --test --test-concurrency=1 tests/info-card-attachments.integration.ts tests/card-foundation.integration.ts tests/card-forks.test.ts tests/creator-recovery.test.ts`. Includes 10 new attachment cases, real attach/delete interleavings, rollback, index absence and existing publication/recovery regressions. Initial sandbox execution could not bind Mongo ports; the reported passing run used permitted local execution and only disposable replica sets. TypeScript no-emit passed. Later checkpoint/final results follow below.

## Operational gates

Application database index deployment/verification and live Cloudflare private R2/CORS/Stream signed-delivery verification remain outstanding. Provider stubs are not production acceptance. Both existing media gates stay fail-closed. No production database/provider operations are authorised or performed in this phase.

## Approved follow-up — private attachment eligibility and publication feedback

- `creatorPublicationPresentation.ts` derives public-only eligibility from either resulting lane's permanent public root or current publication intent. Unmaterialised foreign forks have private lanes, not their source's public status. `CreatorDragLab` passes the live context into the existing title-modal picker.
- `InfoCardAttachments` filters only new options, preserving both groups, metadata hierarchy, Add Info Card/chevron, selected IDs and Save/Cancel. Existing authorised private selections get an ordinary contextual validation paragraph; removal or valid private intent clears it. No new controls, automatic detachment or Info visibility changes.
- The same Creator error presentation translates `PRIVATE_INFO_BLOCKS_PUBLICATION` for direct main/Deck publication and Publish and leave. The backend code, guards, transactions and version/adoption rules remain unchanged. Deck-only publication may still pin an older public main while its newer private-attachment draft remains saved.
- Focused verification: **47/47 Chromium browser tests**, **28/28 unit tests**, **49/49 disposable database integration tests**, TypeScript no-emit and scoped ESLint passed. The browser run combines the new eligibility file with existing attachments, coordinator, visibility and collection-navigation regressions. The database run combines attachments, Creator visibility, forks and foundation cases. No new backend implementation or production/provider operation. The disposable Mongo runner emitted its known owned-child shutdown fallback warning after passing all assertions.
- New coverage: `tests/creator-info-attachments.test.ts`, `tests/phase2/info-card-eligibility.browser.ts`, and an added public-history/Info-promotion case in `tests/info-card-attachments.integration.ts`. Direct main Publish and Publish and leave exercise the real backend guard; the Deck Publish code-translation probe deliberately injects the structured error, because normal Deck-only publication pins already-published main versions rather than publishing their drafts.
- No background polling was added. Publishing an Info Card in another view is reflected on the existing selected-publication/catalogue reads when the attachment modal/dropdown is reopened. Missing/inaccessible metadata stays generic; the server remains authoritative.

Follow-up commands:

```sh
node --import tsx scripts/test-phase2.ts --info-cards info-card-eligibility.browser.ts info-card-attachments.browser.ts creator-visibility.browser.ts creator-coordinator.browser.ts creator-collection-navigation.browser.ts --reporter=line
node --import tsx --test tests/creator-info-attachments.test.ts tests/creator-visibility.test.ts tests/creator-navigation.test.ts tests/my-decks-recency.test.ts
node --import tsx --test --test-concurrency=1 tests/info-card-attachments.integration.ts tests/creator-visibility.integration.ts tests/card-forks.integration.ts tests/card-foundation.integration.ts
```

## Checkpoint 4B — title-modal attachment dropdown

- `InfoCardAttachments.tsx` is a local grouped listbox within the existing title modal. It follows every catalogue page internally on opening, with no search/pagination/preview/create controls. My Cards/Other Cards options use the approved two-line title/series/card-owner hierarchy and Creator colours. Keyboard navigation, accessible groups/selection, Escape/Tab/outside dismissal and trigger focus restoration are supported.
- Ordered selection is modal-local; title and references save together through existing ownership/fork/persistence handling. Selected IDs survive missing metadata and in-flight catalogue responses. Cancel discards local selection; remove only detaches. Existing main-card deletion controls were neither added nor redesigned; no Info Card deletion UI exists.
- **15/15 browser cases passed** in one combined run: `node --import tsx scripts/test-phase2.ts --info-cards info-card-attachments.browser.ts creator-coordinator.browser.ts --reporter=line`. Includes three new tests and all 12 coordinator regressions, using real authenticated Next routes and a disposable replica set. The first run's empty-list assertion incorrectly expected a write for an unchanged absent/empty list; it was corrected to the agreed semantic equivalence. Fixture seeding was made safe across worker restarts. TypeScript and scoped ESLint passed after moving dropdown loading-state initialisation into its opening event.

## Checkpoint 4C — production snapshots and consultation lifecycle

- `GET /api/card-templates/:id/info-cards` uses the existing authenticated actor-bound personal boundary. Working context checks effective membership/adopted main version; canonical context checks the exact displayed immutable public version. Main content and latest authorised info publications resolve in one Mongo snapshot transaction. No client attachment list is accepted.
- Existing `publishedSnapshot` resolution now shares a positional core with strict single-publication reads. Expected malformed, missing or inaccessible entries become metadata-free unavailable slots. Database/auth/programming failures remain whole-request failures. Consultations pin both successful publications and unavailable positions until a genuine new opening.
- `FocusedCardView` retains the mounted Step View/player/activity and existing suspension/isolation. Pending/failed consultations use the existing transparent dialog and closed pouch, with delayed status outside main bounds. Pouch/background/Escape cancel, abort and invalidate late responses. After server resolution and the existing-style post-response actor check, the approved physical stack opens. No extra loading/retry/cancel control or content cache.
- Real Next Strict Mode exposed cancelled imperative turn animations when the newly revealed Motion layer replayed its effects. Deferring turn startup to a microtask after passive effects fixes this integration issue without changing geometry, keyframes or durations. Production-mode fixture tests now explicitly use Strict Mode; the original Phase 1 fixture mode remains unchanged.
- Automated: **42/42** combined main-attachment/snapshot and existing Info repository cases; **3/3** transport binding/cancellation unit cases; **6/6** real authenticated Next browser cases; **7/7** controlled production-lifecycle fixture cases. Real browser coverage includes Intro/Steps 1–3 in both contexts, private/version/query rejection, republication/partial slots, delayed cancellation, no attachments and changed-session responses. Fixture coverage includes exact 999ms/1001ms threshold, status bounds, all cancellation actions, fresh reopening and mounted video/activity preservation. TypeScript/scoped ESLint passed. Earlier failed runs identified the Strict Mode issue and test-only assumptions about Next's additive Vary header, working fixture membership, selector specificity and an unpaused test clock; they are not counted as passing runs.

## Checkpoint 4D — existing exact-publication media

- Available consultation entries retain their authorised immutable `MediaContext`. The compact face control passes that complete card to the existing `InfoCardRemoteMediaViewer`; no raw provider URL fallback is used for production entries. The original local media viewer remains only for the existing Phase 1 fixture inputs.
- Nested media does not refresh the consultation. Reopening it requests authorisation for the same Info publication even after republication; genuinely reopening the pouch obtains the latest publication. Delivery failure leaves the selected card and full attachment count intact. No new scheduler, token cache, automatic renewal, provider gate or media controls.
- Capture the media trigger before the consultation stack becomes inert, and pass it to the existing dialog focus-return hook. This fixes a real integration test failure where implicit focus capture happened too late. The optional return target preserves all other viewer callers.
- Existing private-media/API/legacy-route tests: **14/14 passed**, using disposable databases/mocked providers. Fresh real-Next media acceptance is recorded with the combined run below. Image delivery success there is a controlled mock; image/video gate failures use the real media route returning 503. Synthetic video fixtures use a non-`fixture-` asset ID so the existing test-only “Mock video” display hint does not mask the real failure presentation. No live Cloudflare acceptance is claimed.
- The fixture TypeScript loader now supplies the actual filename to `transpileModule`. Importing the production adapter exposed that generic `.ts` syntax was previously parsed as TSX. This is test infrastructure only, not an application/bundling change.
- Known limitation retained: a Stream URL is approximately one hour, not indefinitely renewable during a paused viewer. Close/reopen nested media for fresh authorisation to the same publication. Actual signed delivery/CORS and Safari playback remain operational/device verification, not demonstrated by mocks.

## Checkpoint 4E — combined acceptance

| Check | Recorded result |
| --- | --- |
| Main attachments + Info repository + foundation + forks + reuse + Creator visibility, six disposable database files | **87/87 passed** |
| Existing Info media/API, protected media and card media access, four disposable database files | **14/14 passed** |
| Focused attachment file after adding adoption → fresh Info publication assertions | **16/16 passed** (subset/recheck, not 16 additional distinct tests) |
| Focused client, foundation/forks/reuse, Creator navigation/recovery/visibility, My Decks recency and Info capacity units | **53/53 passed** |
| Complete original motion/pouch/integration suite plus seven new production lifecycle cases | **50/50 passed** |
| Expanded production lifecycle suite, including 844/932×390 landscape status bounds and all-unavailable circular pack | **10/10 passed** (seven overlap the 50-case run; three additional cases) |
| Real authenticated Next combined Creator/Library/Info/attachment/consultation/copy/fork/adoption browser run | **111 passed / 1 failed** in the 112-case run: the sole failure was an old `My decks` heading assertion, while the actual approved heading was `My Decks`. Assertion corrected, no application change. |
| Combined focused recheck after that assertion correction: all fork cases + all new attachment/consultation/media cases | **18/18 passed**, including the previously failing case; no full-112 passing rerun is claimed |
| TypeScript no-emit, scoped ESLint, `git diff --check` | **Passed**; touched-test lint also passed after fixture/assertion corrections |

The 87-case database run also emitted Mongo memory-server shutdown warnings before its fallback killed owned disposable child processes. All assertions passed; this is not a production database operation or a transaction failure.

The first broader 98-case browser run finished **94 passed / 4 failed**. The failures were test assumptions, not hidden passing results: a pagination loop decided to click More before the preceding response settled; two attachment cases expected a shared private example's original title after another test had deliberately edited it; and an existing Library media case used a global View image selector after Phase 4 fixtures added another image. Fixes are respectively a settle-aware test loop, dedicated attachment publications, and a selector scoped to the intended published card. No application navigation/pagination/authoring behaviour was changed to accommodate them. All four passed together in the subsequent 112-case run. The additional stale heading assertion found by expanding that run to older fork regressions was then corrected and rechecked in the 18-case combined run. No known assertion failure remains unresolved; these counts are not flattened into a fictitious single all-green run.

Final documentation checks: **36 local Markdown links resolve**, and the changed-file manifest accounts for **all 43 changed/untracked files**, including the generated screenshots. Whitespace checking and a focused diff/source scan found no temporary source files or recognisable credential/private-key patterns. The only documented login is the disposable review credential; no environment/provider configuration files changed. This is a focused implementation check, not a claim of a comprehensive security audit.

### Commands

```sh
node --import tsx --test --test-concurrency=1 tests/info-card-attachments.integration.ts tests/info-cards.integration.ts tests/card-foundation.integration.ts tests/card-forks.integration.ts tests/card-reuse.integration.ts tests/creator-visibility.integration.ts
node --import tsx --test --test-concurrency=1 tests/info-cards-media.test.ts tests/info-cards-api.integration.ts tests/protected-media.integration.ts tests/card-media-access.integration.ts
node --import tsx --test tests/info-card-consultation-client.test.ts tests/card-foundation.test.ts tests/card-forks.test.ts tests/card-reuse.test.ts tests/creator-navigation.test.ts tests/creator-recovery.test.ts tests/creator-visibility.test.ts tests/my-decks-recency.test.ts tests/info-cards-capacity.test.ts
SWITCHPLAY_FIXTURE_PORT=4190 npx playwright test --config=playwright.info-cards-integration.config.ts --reporter=line
node --import tsx scripts/test-phase2.ts --info-cards info-card-attachments.browser.ts info-card-consultation.browser.ts creator-coordinator.browser.ts info-cards-authoring.browser.ts creator-collection-navigation.browser.ts creator-visibility.browser.ts creator-drafts.browser.ts creator-library-network.browser.ts fork-foundations.browser.ts update-adoption.browser.ts card-reuse.browser.ts --reporter=line
node --import tsx scripts/test-phase2.ts --info-cards fork-foundations.browser.ts info-card-attachments.browser.ts info-card-consultation.browser.ts --reporter=line
npx tsc --noEmit
git diff --check
```

Mongo/Chromium require the permitted outside-sandbox launch context on this Mac. Each automated backend/application runner creates and destroys its own replica set, never falls back to a live URI, and uses mocked media providers. No WebKit suite, live provider test or production deployment is included. The existing 4180 review server was not stopped or mistaken for the actual application; fresh fixture regressions used 4190 to avoid its stale compiled bundle.

## Actual application review and evidence

The pre-existing disposable authenticated Next app on **4181** was left running. Through its authenticated application APIs, a small text-only review deck was created without changing existing review records. Both loopback and LAN URLs returned HTTP 200 HTML **from this Mac**, not an actual iPhone test; its real consultation endpoint returned two available publications. Chromium then opened the real Library/main/Intro/pouch workflow and the existing Creator title-modal dropdown at 390×844. These are application screenshots, not the Phase 1 fixture:

- [Closed production Step View](screenshots/390-real-closed.png)
- [Production consultation](screenshots/390-real-consultation.png)
- [Title-modal attachment dropdown](screenshots/390-attachment-dropdown.png)

Review URLs (valid while that disposable runner lives):

- Desktop: `http://127.0.0.1:4181/library/phase4-review-deck-20261024`
- iPhone on the same Wi-Fi: `http://192.168.1.38:4181/library/phase4-review-deck-20261024`
- Sign in as `phase2` / `local-test-only`. These are disposable-only credentials. The IP may change when the network changes.

Open the main card, tap its title/Intro or a step, then tap the corner pouch. Inspect physical motion/touch feel and the new dropdown with actual Safari/VoiceOver as needed. Deterministic ordering, save/adoption/permissions, timers, cancellation and playback/activity state do not need to be manually re-proven. No iPhone/Safari/VoiceOver acceptance is claimed by desktop Chromium. This text-only deck is not a real video/media-delivery certification.

Current runner stop command:

```sh
kill -TERM 41840
```

Restart from the repository root in a terminal:

```sh
node --import tsx scripts/test-phase2.ts --dev --lan --info-cards
```

The foreground runner keeps the app and its replica set alive; Ctrl+C stops both. It does not install an automatic Mac restart service. **Restart creates a new database**: this review deck and existing manual edits disappear; the runner reseeds Info Card examples only. Recreate a main/deck through Creator, attach published examples in its title modal, publish the main then deck, and use the resulting collection URL. The command prints the current LAN address. Do not stop unrelated servers/processes or assume this deck ID persists across restarts.

## Scope, limitations and remaining gates

- No approved face/pouch dimensions, typography, motion keyframes or timing were redesigned. The only motion-controller integration change is the Strict Mode turn-start scheduling described above. No global CSS, My Decks order, Library order, Creator return rules, Info authoring/capacity rules or personal progress schema changes.
- No new UX decisions, search, pagination controls, inline creation, retry button, spinner, loading card or deletion UI. Existing main-card Delete controls are unchanged and are not Info Card deletion controls.
- Main attachments are ordered stable IDs. Main changes use normal draft/publish/adopt; Info content uses latest authorised publication per genuine opening and stays pinned through media. Absent/empty references remain equivalent without rewriting historical versions.
- Offset catalogue pagination can shift during concurrent publication; deduplication and authoritative save/publication checks are retained. No cross-request catalogue snapshot infrastructure was added.
- Deployment still requires explicit index verification and live Cloudflare protection/CORS/signed-delivery verification. Existing fail-closed media flags are unchanged. No live database indexes, migration, provider settings or secrets were changed.
- Device-only subjective motion/touch and Safari/VoiceOver judgement remain pending; ordinary landscape status bounds are automated, exceptional reflow/extreme enlargement remains the existing backlog. No new unresolved product choice has been introduced.

## Initial Phase 4 changed-file inventory (before subsequent approved UI corrections)

Documentation/evidence:

- `docs/design/features/info-cards/info-cards-functional-spec.md`
- `docs/engineering/features/info-cards/info-cards-engineering-plan.md`
- `docs/engineering/features/info-cards/phase-4/README.md`
- `docs/engineering/features/info-cards/phase-4/screenshots/390-real-closed.png`
- `docs/engineering/features/info-cards/phase-4/screenshots/390-real-consultation.png`
- `docs/engineering/features/info-cards/phase-4/screenshots/390-attachment-dropdown.png`

Backend contracts, guards and projections:

- `src/app/api/card-templates/[cardTemplateId]/info-cards/route.ts`
- `src/lib/cards/domain.ts`
- `src/lib/cards/model.ts`
- `src/lib/cards/publicationRules.ts`
- `src/lib/cards/repository.ts`
- `src/lib/cards/readModels.ts`
- `src/lib/cards/libraryProjection.ts`
- `src/lib/infoCards/model.ts`
- `src/lib/infoCards/queries.ts`
- `src/lib/infoCards/repository.ts`

Creator/presentation/consultation:

- `src/components/creator/CreatorDragLab.tsx`
- `src/components/creator/InfoCardAttachments.tsx`
- `src/components/creator/InfoCardAttachments.module.css`
- `src/components/creator/cardArchitectureAdapter.ts`
- `src/components/creator/creatorBoardState.ts`
- `src/components/decks/FocusedCardView.tsx`
- `src/components/decks/presentation.ts`
- `src/components/decks/types.ts`
- `src/components/info-cards/infoCardConsultationClient.ts`
- `src/components/info-cards/InfoCardConsultation.tsx`
- `src/components/info-cards/InfoCardConsultation.module.css`
- `src/components/info-cards/InfoCardPhysicalStack.tsx`
- `src/components/info-cards/InfoCardPhysicalStack.module.css`
- `src/components/info-cards/InfoCardPouch.tsx`
- `src/components/info-cards/InfoCardMediaViewer.tsx`
- `src/components/info-cards/InfoCardRemoteMediaViewer.tsx`

Tests/fixtures/configuration:

- `playwright.info-cards-integration.config.ts`
- `tests/browser/fixture-loader.cjs`
- `tests/browser/info-cards-integration-fixture.tsx`
- `tests/browser/info-cards-production.browser.ts`
- `tests/info-card-attachments.integration.ts`
- `tests/info-card-consultation-client.test.ts`
- `tests/phase2/info-card-attachments.browser.ts`
- `tests/phase2/info-card-consultation.browser.ts`
- `tests/phase2/creator-library-network.browser.ts`
- `tests/phase2/info-cards-authoring.browser.ts`
- `tests/phase2/fork-foundations.browser.ts`
