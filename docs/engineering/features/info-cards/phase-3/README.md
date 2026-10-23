# Info Cards Phase 3 — implementation handoff

Branch: `feat/info-cards`. Scope: Creator/Library UI, agreed manual-review UX corrections and the required media adapters/status route. No commit made; Phase 4 attachments/production pouch fetching remain excluded. The functional specification and plan now record the explicitly agreed UX corrections; fixed card design and stack animation/controller are unchanged.

## Delivered checkpoints

### 3A — Editor and persistence

- `/creator/info-cards/new` and `/creator/info-cards/[infoCardId]` use the existing authenticated session and owner-only editor query. The Deck / Info Card selector appears **only during new-item creation**, never Library/My Drafts/existing Deck editing. Explicit intent survives the autosave URL and reload.
- Title/body/series/visibility edits autosave as independent incomplete drafts. Clean published reads create no draft. Preview uses the approved 240×157 face and shared measured-capacity validator. Over-capacity drafts show an explicit preview-unavailable message and validation issues until corrected; full text stays editable, without painting overflow outside the card or silently clipping it.
- A small independent controller serialises revisions and captured-command retries. Actor-bound requests retain structured errors. Submitted first-save/save/publication commands are journalled in session storage for reload recovery; files/upload URLs are not stored. Conflicts retain local text. Explicitly confirmed Reload saved version discards that local recovery command.
- Mode/draft/Library navigation finishes saves/uploads without publishing. Native browser Back drains a pending text save. Browser unload warns about outstanding text/publication work. File transfers are not resumable after closing/reloading a tab; reselect the file. Text and previous media remain saved.

### 3B — Series and publication

- One native Series dropdown loads all eligible pages, grouping own series before a divider and other discoverable series with usernames. An explicit Create a new series option opens a small inline name input, retries a stable ID, then selects the result automatically. Retained authorised selections survive loss of general discoverability. No series search field, button collection or duplicate summary.
- Private/public publication, permanent-public confirmation, meaningful incomplete/overflow/provider feedback and revision conflict handling. Publication recovery retries its consumed revision and separately refreshes the editor; no history UI or adoption state.
- Rejected publication/series selection can be corrected while preserving text and resuming autosave. Uncertain publication locks editing until its outcome is recovered.

### 3C — My Drafts and Library

- Typed Deck/Info Card draft entries, direct owner info queries traversing all pages, independent destinations and source-specific failures. Info service/index failure does not hide existing Deck drafts.
- `/library` retains the Deck shell and its navigation; `/library?tab=info-cards` mounts one face-up chronological grid. The backend orders **all own published cards first**, then other public cards, by original root creation date descending with stable ID tie-breaks **before pagination**. Publication/update times and series do not affect order. Dirty drafts never replace published content; only owners receive Edit. No Library search/create controls or series headings.
- Each face has secondary `Series (series by username)` above and `Card by username` immediately beneath with a 5px gap; privacy/Edit controls follow. The approved face and tooltip remain unchanged.
- Bounded pagination, duplicate suppression and actor-bound stale-response handling remain. Library editing returns to its Info Cards tab; My Drafts editing returns to its originating editor/dialog through a bounded internal navigation context, preserved on reload. Existing Deck return links remain unchanged. Account changes hide the old editor; session failures clear private Library content/media.

### Agreed editor simplification and prerequisites

- New Info Card/Edit Info Card header, discreet Saving…/Saved status and existing publication controls. No duplicated title/legend, series summary, preview heading or permanent requirements block. Logical form order: Series, Title, Explanation, optional image/video, live preview.
- Title initially empty. Series and a nonblank title unlock explanation and media addition/replacement. A focusable read-only explanation and keyboard/touch-operable unavailable media control give **Choose a series and enter a title first.** Existing incomplete body/media remain saved, visible and recoverable; UI sequencing does not tighten backend draft validation.
- Required-field feedback appears by controls after attempted publication. Live overflow errors appear directly beneath Title/Explanation, with accessible invalid/described-by associations, responding to typing, series selection and media add/remove. The explicit unavailable-preview placeholder no longer repeats capacity advice. Non-duplicate server validation and persistence errors remain actionable; no clipping, scrolling or text shrinking hides invalid content.
- `creatorNavigation.ts` carries explicit creation intent, validates internal draft-origin routes/allowed query fields and strips recursive origins. Returning to `drafts=1` reuses the existing My Drafts dialog instead of adding a new drafts screen. No arbitrary external return URL is accepted.

### 3D — Media

- Image/video selection, upload, replacement, cancellation, removal and dedicated-control preview. Image transfer honours returned `Content-Type` and signed `If-None-Match`; upload proofs accompany the actual metadata save. A completed upload merges into the latest text, not its earlier buffer.
- Failed/cancelled transfers leave previous media untouched. Text continues saving during transfer. Upload failures must be retried or cancelled before explicit navigation/publication.
- New `GET /api/info-cards/:id/media/status?revision=N`: authorises the stored owner-draft video before contacting Stream, verifies creator and signed protection, and reports processing/ready/failed without accepting arbitrary asset IDs. Pending processing is polled with stale-response protection.
- Image renderer accepts an optional explicit delivery source; info viewer accepts optional image/playback adapters. Existing default callers retain their behaviour. Creator uses the exact saved draft revision or clean publication; Library keeps the selected immutable publication. Closing returns focus to the compact media control.
- **The provider gate remains closed in the review app.** Automated image/video UI tests explicitly mock transfer/status/playback contracts; draft metadata saves still exercise the real proof-checked backend. They do not establish real Cloudflare upload, private storage, HLS playback or delivery.

## Files

- New Creator routes under `src/app/creator/info-cards/`.
- New editor/controller/series/errors/upload/status-hook/remote-viewer files under `src/components/info-cards/`, with scoped editor styles.
- `CreatorModeSelector.tsx`, `creatorDraftEntries.ts` and typed `CreatorDraftsModal.tsx`; targeted integration in `CreatorDragLab.tsx` and structured request error payloads in `creatorRequest.ts`.
- `InfoCardsLibrary.tsx`, scoped grid styles and `LibraryTabs.tsx`; small additions in `library/page.tsx` and existing `LibraryShell.tsx` collection chrome.
- `src/lib/infoCards/media.ts` plus the new exact-owner-draft status route.
- Optional delivery props in `InfoCardMediaViewer.tsx` and `CardMediaViewerImage.tsx`; no animation/face/pouch CSS changes.
- `src/lib/clientId.ts` and targeted Creator ID call sites: cryptographic UUID generation via `getRandomValues` also works in iPhone Safari on trusted-LAN HTTP, where `crypto.randomUUID` is unavailable. Ownership/authentication remains server-enforced.
- `scripts/test-phase2.ts`: disposable info indexes/demo users/content, explicit LAN option and live dev logs. `next.config.ts`: test-runner-only development origin allowance for loopback and detected review IPs.
- New editor/drafts/upload unit tests and real-app `tests/phase2/info-cards-authoring.browser.ts`; extended Info Cards API integration coverage.

### Exact changed-file manifest

- `docs/design/features/info-cards/info-cards-functional-spec.md`
- `docs/engineering/features/info-cards/info-cards-engineering-plan.md`
- `docs/engineering/features/info-cards/phase-3/README.md`
- `next.config.ts`
- `scripts/test-phase2.ts`
- `src/app/api/info-cards/[infoCardId]/media/status/route.ts`
- `src/app/creator/info-cards/[infoCardId]/page.tsx`
- `src/app/creator/info-cards/new/page.tsx`
- `src/app/creator/new/page.tsx`
- `src/app/creator/edit/[deckTemplateId]/page.tsx`
- `src/app/library/page.tsx`
- `src/components/creator/CreatorDraftsModal.tsx`
- `src/components/creator/CreatorDragLab.tsx`
- `src/components/creator/CreatorModeSelector.tsx`
- `src/components/creator/creatorBoardState.ts`
- `src/components/creator/creatorDraftEntries.ts`
- `src/components/creator/creatorNavigation.ts`
- `src/components/creator/creatorPersistenceCoordinator.ts`
- `src/components/creator/creatorRequest.ts`
- `src/components/info-cards/InfoCardEditor.module.css`
- `src/components/info-cards/InfoCardEditor.tsx`
- `src/components/info-cards/InfoCardMediaViewer.tsx`
- `src/components/info-cards/InfoCardRemoteMediaViewer.tsx`
- `src/components/info-cards/InfoSeriesSelector.tsx`
- `src/components/info-cards/infoCardEditorController.ts`
- `src/components/info-cards/infoCardErrors.ts`
- `src/components/info-cards/infoCardUpload.ts`
- `src/components/info-cards/useInfoVideoStatus.ts`
- `src/components/library/InfoCardsLibrary.module.css`
- `src/components/library/InfoCardsLibrary.tsx`
- `src/components/library/LibraryShell.tsx`
- `src/components/library/LibraryTabs.module.css`
- `src/components/library/LibraryTabs.tsx`
- `src/components/media/CardMediaViewerImage.tsx`
- `src/lib/clientId.ts`
- `src/lib/infoCards/media.ts`
- `src/lib/infoCards/capacity.ts`
- `src/lib/infoCards/queries.ts`
- `tests/creator-navigation.test.ts`
- `tests/info-card-drafts.test.ts`
- `tests/info-card-editor.test.ts`
- `tests/info-card-errors.test.ts`
- `tests/info-cards-capacity.test.ts`
- `tests/info-card-upload.test.ts`
- `tests/info-cards-api.integration.ts`
- `tests/info-cards.integration.ts`
- `tests/phase2/creator-drafts.browser.ts`
- `tests/phase2/creator-coordinator.browser.ts`
- `tests/phase2/creator-visibility.browser.ts`
- `tests/phase2/library-ui.browser.ts`
- `tests/phase2/info-cards-authoring.browser.ts`

## Verification

### Series-first Title entry correction

- Authoring sequence is Series → Title → Explanation/media. Title uses the existing focusable read-only prerequisite pattern, muted editor control styling and accessible feedback: **Choose or create a series first.** It unlocks only when the desired series ID matches the selected series metadata; a create option, typed series name, pending request or failed creation is insufficient.
- Stored titles/body/media are not cleared or rewritten. Legacy no-series titles remain displayed read-only; selecting a series restores editing and immediately recalculates the combined-header warning with its actual name. Oversized drafts remain saveable and server publication validation remains authoritative. Retained authorised series selection/recovery is unchanged.
- Targeted files: `InfoCardEditor.tsx`, `InfoCardEditor.module.css`, `tests/phase2/info-cards-authoring.browser.ts`, functional specification §5.4, engineering plan §5.1 and this handoff. No backend capacity, series permissions, face dimensions/rendering, Creator return-navigation or Phase 4 changes. No commit made.
- **24 passed:** complete targeted authenticated Creator/Library Chromium suite with a disposable replica set. Includes Title read-only/keyboard/touch feedback, existing-series unlock, new-series intent/failed/pending response remaining locked, successful returned-ID selection, retained incomplete title/body/media, series-change overflow, autosave and publication regressions. The image preservation case uses mocked provider transfer and real proof-checked backend metadata; it is not live provider acceptance.
- **22 passed:** focused editor/error/capacity/upload/drafts unit tests. TypeScript no-emit, scoped ESLint, diff whitespace and local documentation-link checks passed.
- Actual authenticated Next review app verified at desktop **http://127.0.0.1:4181/creator/info-cards/new** and iPhone LAN **http://192.168.1.38:4181/creator/info-cards/new** (same trusted Wi-Fi). Login **phase2 / local-test-only** or **other / local-test-only**. Both browser checks returned login 200 and showed the new read-only Title/feedback without page errors or changes to existing review content. Runner PID **41840** and disposable review data remain intact; start/stop instructions below still apply. Actual-phone acceptance remains manual; Cloudflare media verification/index deployment remain the existing operational gates.

### Immediate content-capacity feedback correction

- The shared `src/lib/infoCards/capacity.ts` adds typed `fieldIssues` (field/code/message), retaining aggregate issues and measured metrics. Geometry, wrapping, explicit newline handling, collapsed blank-line paragraph gaps and media reservation are unchanged. React performs no glyph/line-height calculations, leaving a clean renderer-independent diagnostic contract for future variable-height content; no maths rendering or validation is implemented.
- Title and Explanation warnings update immediately and are linked to their fields. Oversized text remains editable and autosaveable. Server publication rejection is unchanged; duplicate capacity messages already shown at fields are omitted from the generic error panel, without hiding other errors or legacy responses.
- Targeted changes: capacity module; `InfoCardEditor.tsx`/scoped field-error styling; `infoCardErrors.ts`; capacity/error unit tests; authoring browser tests; this handoff, engineering plan and functional specification §5.4's feedback location. No approved face/pouch/stack or Library/navigation behaviour changed. No commit or Phase 4 work.
- **21 passed:** complete targeted authenticated Creator/Library Chromium suite against a disposable Mongo replica set. Covers live title feedback on typing/series changes, explanation feedback/placement/accessibility, media add/remove reservation, preserved oversized autosaves and server **422** rejection, corrected re-publication, preview restoration, paragraph rendering and existing authoring regressions. The initial run's stale single-alert assertion was corrected to target the retained conflict alert; the final full run passed uninterrupted.
- **22 passed:** focused capacity/error/editor/upload/drafts unit tests. Includes explicit newlines, multiple blank lines collapsing to the existing 7px paragraph gap, media reservation, structured field diagnostics, duplicate-message suppression, preserved other/legacy errors and persistence recovery.
- TypeScript no-emit, scoped ESLint, diff whitespace and local documentation-link checks passed. These checks do not claim a full repository test run or actual Safari/Cloudflare delivery verification.
- Actual authenticated Next review app verified on desktop **http://127.0.0.1:4181/library?tab=info-cards** and phone LAN **http://192.168.1.38:4181/library?tab=info-cards** (same trusted Wi-Fi), login **phase2 / local-test-only** or **other / local-test-only**. Both browser checks returned login 200, loaded the owner editor without page errors, and retained a **240×157px** face. Existing runner PID **41840** and review data remain intact; start/stop instructions below still apply. Physical iPhone acceptance remains manual; private media remains gated until live provider verification.

### UX correction pass (23 October 2026)

- **85 passed:** focused editor/drafts/upload/navigation and existing Creator coordinator/recovery/visibility/Library unit tests. Explicit navigation-context tests include creation reload, draft-origin return and rejection of external/normalised out-of-scope origins.
- **26 passed:** disposable-replica-set Info Cards repository tests, including original-creation ordering across page boundaries, mixed ownership, private exclusion, tie-breaking and republishing without promotion. Existing permissions, transactions, reference/deletion races and media protections remain covered. Mongo's test-process shutdown needed its own SIGKILL fallback; no assertion failed.
- **75 Creator/Library scenarios verified:** final combined Chromium run **74 passed / 1 failed**. The Deck leave/publication case was interrupted by a development hot reload during this coding session and then **passed in an isolated final-source rerun**. All **19 Info Cards** and the other **55 existing Deck** cases passed in the combined run. No unresolved failing assertion remains; this is not represented as a single uninterrupted 75-pass run. Initial query-unsafe Deck test helpers and a reload-before-navigation race in a new browser test were corrected before this final run.
- Acceptance covers prerequisites and preservation of incomplete text/media; dropdown groups/create/all-page loading/retained selection; no Library search/create controls; distinct attribution immediately below each face; new-vs-edit/reload/draft return context; and real server-backed catalogue pagination with mixed original/publication dates. Deck test helpers extract IDs from pathname rather than including persisted query context; explicit assertions verify existing Deck edits have no selector.
- **43 passed:** existing Phase 1 browser regressions covering animations, pouch geometry, video pause/pending-play cancellation, activity state, nested media, gesture isolation, focus and reduced motion. Phase 1 implementation/design is unchanged by these corrections.
- TypeScript no-emit, scoped ESLint, `git diff --check` and relative documentation-link checks passed. No WebKit/device/provider pass is inferred from Chromium results. The known full-unit CSS-module harness limitation remains outside this focused run.
- Updated desktop/mobile screenshots are in ignored `phase2-test-results/phase3-review/editor-corrected-390.png`, `library-corrected-390.png`, `editor-corrected-1440.png`, `library-corrected-1440.png`, with `new-editor-corrected-390.png` demonstrating the blank-title/prerequisite state. Direct inspection confirmed the simplified editor and flat attributed collection. At 390×844 and desktop, face dimensions remain **240×157px**, with no page horizontal overflow.
- Authenticated browser checks at both **127.0.0.1:4181** and **192.168.1.38:4181** returned login **200**, loaded the actual corrected application, survived editor reload and returned to Library's Info Cards tab with **no page errors**. Existing review runner PID **41840** and disposable review data are preserved; no server restart or data reset was needed. This is LAN/browser verification, not physical iPhone acceptance.
- Main Create → Info Card and blank-title prerequisites were also checked over LAN. A Chromium touchscreen-coordinate tap on the focusable read-only Explanation produced the exact prerequisite message. `Locator.tap` refuses controls marked `aria-disabled`; the initial actionability timeout was therefore replaced with real touch coordinates, without removing the control's availability semantics. This is emulated touch evidence, not Safari/VoiceOver acceptance.

Manual checklist: main menu Create → switch Deck/Info Card; blank title and prerequisite feedback by touch/keyboard; series groups and inline creation; autosave/reload; private/public confirmation; Library chronological cards and distinct creators; Library Edit → return to Info Cards; My Drafts Edit → Back to My Drafts (including reload); existing Deck edit has no selector and retains its return context. Media add/replace still fails closed until provider verification. No extra search, filters, management screens or Phase 4 controls were introduced.

### Earlier Phase 3 baseline (before these corrections)

- **67 passed:** combined authenticated Next.js Creator/Library acceptance, including 11 new Info Cards scenarios and 56 existing Creator/deck/Library regressions, against a fresh disposable replica set.
- **43 passed:** existing Phase 1 consultation, motion, pouch geometry, playback/state preservation and nested-media browser regressions.
- **82 passed:** focused editor/drafts/upload and existing Creator coordinator/recovery/visibility/Library unit checks.
- **6 passed:** real Info Cards route integration tests, including exact-owner-draft processing, provenance, actor mismatch and closed-provider-gate checks. The initial new test's actor-state leak was fixed before the successful run.
- **11 passed:** focused Phase 3 browser rerun after final scoped styling/preview fixes, including the approved header-height assertion; overlaps the combined run above.
- **1 passed:** additional keyboard activation, confirmation focus containment/restoration and My Drafts Escape test. It exposed a new confirmation-trigger focus issue, fixed locally in the info editor and verified.
- `next typegen`, TypeScript no-emit, scoped ESLint and `git diff --check`: passed.

Chromium UI tests use the real authenticated Next.js app with a disposable Mongo replica set. Media transfer/status/viewer mocks are labelled explicitly; real provider access is not tested. No WebKit repair, full production build or simulated iPhone infrastructure was attempted. The documented existing full-unit CSS-module harness failure was not rerun or repaired. Actual-phone Safari acceptance remains manual.

Reproduce combined acceptance:

```sh
node --import tsx scripts/test-phase2.ts --info-cards \
  info-cards-authoring.browser.ts creator-drafts.browser.ts library-ui.browser.ts \
  creator-visibility.browser.ts creator-coordinator.browser.ts --reporter=line
npx playwright test -c playwright.info-cards-integration.config.ts
node --import tsx --test tests/info-card-editor.test.ts tests/info-card-drafts.test.ts \
  tests/info-card-upload.test.ts tests/creator-navigation.test.ts tests/creator-coordinator.test.ts \
  tests/creator-recovery.test.ts tests/creator-visibility.test.ts tests/library-ui.test.ts
node --import tsx --test tests/info-cards-api.integration.ts
node --import tsx --test tests/info-cards.integration.ts
```

## Actual application review

This is the real Next application, not the Phase 1 fixture. The runner owns a **disposable local replica set** and refuses a production database. Stopping it discards review data; each restart creates the demo content again.

Start from the repository root:

```sh
node --import tsx scripts/test-phase2.ts --dev --lan --info-cards
```

The default LAN port is **4181**. `SWITCHPLAY_REVIEW_PORT=4182` can select another port. The runner prints the desktop/phone URLs and its PID and writes them to ignored `phase2-test-results/review-server.json`. It stays running in that terminal; stop with **Ctrl+C**. A tool-started review instance can be stopped with `kill -TERM <runner PID>` using the recorded PID, rather than killing an unrelated Node process. It does not install a login service or auto-restart after a Mac reboot.

- Desktop: `http://127.0.0.1:4181/library?tab=info-cards`.
- Phone: use the printed LAN address on the same trusted Wi-Fi. The final verified address/PID is recorded with acceptance results.
- Sign in as **phase2 / local-test-only**, or **other / local-test-only**. These are disposable fixture credentials, not real accounts.
- Both creators have an identically titled Basics series and public/private sample cards. You can contribute to the other creator's public-discoverable series while retaining ownership.
- Create via the overview Create entry → Info Card selector, or `/creator/info-cards/new`. Check draft recovery through My Drafts, private/public publication, Library editing, attribution and return navigation.
- Media selection currently reports the protection gate. Cancel a failed upload to continue with text. Successful live media acceptance is pending the operational checks below.

Manual acceptance: actual Safari keyboard/series interaction, device text readability, comfortable targets, orientation/safe areas and real provider image/video handling. Automated viewport checks and a Mac browser loading the LAN URL do not prove an iPhone has connected.

Final running review instance (23 October 2026): desktop `http://127.0.0.1:4181/library?tab=info-cards`; phone `http://192.168.1.38:4181/library?tab=info-cards`; runner PID **41840**. The address was verified with authenticated Chromium over the LAN interface: Deck → Info Card switching, cryptographic series creation and autosave succeeded, with no browser page errors. The clean catalogue has three authorised sample cards for `phase2`; one "Phone review" draft in the Review series is available in My Drafts. The actual provider gate returned **503**, as required. Physical iPhone acceptance is pending.

Stop this particular running instance:

```sh
kill -TERM 41840
```

Rendered editor face: **240×157px**, header **11.984375px**, no page horizontal overflow at 390×844. Final screenshot artifacts (ignored, generated locally): `phase2-test-results/phase3-review/editor-390.png`, `library-390.png`, `editor-1440.png`, `library-1440.png`. A scoped-style check ensures editor control sizing does not enlarge the approved face's internal series button. The review server must be restarted with the command above after stopping; its PID and disposable database change on each restart.

## Operational prerequisites and limitations

1. **Application database indexes:** the runner installs them only in its disposable database. Production/application index deployment remains outstanding. Reviewed setup command: `node --env-file=.env.local --import tsx scripts/setup-info-cards.ts`.
2. **Cloudflare:** verify every R2 public/custom/Worker origin and alias is protected, conditional PUT/CORS, Stream creator/signed-only delivery and actual owner/private/public access before enabling `INFO_CARDS_PRIVATE_MEDIA_VERIFIED=1` with protected delivery. Do not infer verification from environment flags or mocks.
3. Upload credentials/proofs expire; interrupted or long failed transfers may require selecting the file again. No upload-resume queue or provider asset garbage collection was introduced.
4. Publication capacity remains conservative for unknown Unicode/fallback fonts, per Phase 2. Creator preview and phone review complement server validation; no rich text/math rendering is included.
5. The existing full-unit CSS-module loader failure documented in Phase 2 is not repaired by this work. Focused regression evidence is distinguished from a passing full suite.

## Phase 4 handoff

Implement the main-card attachment picker/order and persistence only after every canonical attachment-producing writer participates in Phase 2's guard protocol. Wire main publication/adoption constraints and authorised main-context snapshot fetching. Keep the Phase 1 consultation lifecycle and use exact-publication media adapters; no arbitrary caller-supplied attachment IDs as authority. Add owner deletion/reference-blocker UI using the existing deletion API; detached main-draft recovery remains deferred. No Phase 4 field or production pouch fetch has been enabled here.

No new product decision was needed. Phone acceptance, deployment indexes and live provider verification remain explicit outstanding gates.
