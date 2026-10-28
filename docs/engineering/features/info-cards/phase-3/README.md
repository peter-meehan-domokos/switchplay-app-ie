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
- `/library` retains the Deck shell and latest-publication ordering without owner priority; `/library?tab=info-cards` mounts one face-up chronological grid. The backend orders **all own published cards first**, then other public cards, by latest successful immutable publication timestamp descending with stable ID tie-breaks **before pagination**. Draft/root update/creation times and series do not affect order. Dirty drafts never replace published content; only owners receive Edit. No Library search/create controls or series headings.
- Each face has secondary `Series (series by username)` above and `Card by username` immediately beneath with a 5px gap; privacy/Edit controls follow. The approved face and tooltip remain unchanged.
- Bounded pagination, duplicate suppression and actor-bound stale-response handling remain. Info Cards always return to their Library tab. Decks use approved hybrid collection destinations, while retaining URL context for copying/version selection and reload. My Drafts remains a separate workflow. Account changes hide the old editor; session failures clear private Library content/media.

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

### Earlier Phase 3 implementation changed-file manifest

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

### Latest correction — restore ordinary SPA Library returns (24 October 2026)

The approved full-document approach and perfect-first-visible-frame requirement below are **superseded**. Both Creator return handlers now use ordinary Next `router.push`. No replacement freshness guarantee, cache layer, optimistic sorting, loading overlay, artificial delay or persistence barrier was introduced. The functional specification §5.5/§12.3 and engineering plan §1/§5.1 have only the corresponding superseded clauses corrected.

Removed specifically:

- Library-only `window.location.assign` branches in `CreatorDragLab.tsx` and `InfoCardEditor.tsx`.
- Info Cards' reload-oriented server first-page query/`initialPage` prop and state seeding. Its established authenticated client catalogue read and **Loading Info Cards…** message are restored.
- Persisted-history `pageshow` reload guards in the Info panel and Deck Library navigation hook; these use ordinary existing refresh handling again. Explicit user-requested error/conflict reload buttons are unrelated and remain.

Preserved: server-side latest-successful-publication ordering before pagination (owner-first only for Info Cards), deterministic ties, hybrid Creator destinations, authoritative publication confirmation/recovery, publication-only expiring highlight without Library scrolling, ordinary pagination, account/lifetime/sequence checks and existing save/upload/leave safeguards. No targeted reveal or Show newest returned. **My Decks sorting, working-entry and discovery behaviour are unchanged.** Existing detached Card work is allowed to finish after SPA unmount, not made into a new navigation barrier.

#### Network observations — no visual-loading workaround implemented

`tests/phase2/creator-library-network.browser.ts` exercises the actual authenticated Next application and disposable replica set at **390×844**. Each case enters Creator through real application links: Create menu for new items; Library Edit (Deck detail/menu where applicable) for existing items. Browser document identity is checked on entry and return. All 18 cases sample visible collection IDs/positions, highlight, scroll and loading state every animation frame, independently compare with the ordinary authorised server catalogue, and capture initiation, 250/1000/2000/4000ms, an additional 6000ms slow-network frame, and final state. Perfect first paint is **not** an assertion or an implementation guarantee.

Profiles: unthrottled local development; CDP **400ms latency, 1.6 Mbit/s download, 0.75 Mbit/s upload**; and an additional **1500ms** delay on the Deck Library RSC response or Info catalogue response. The editing session is warm before throttling, including existing routing/prefetch behaviour; this is not a cold-download benchmark or a claim about physical Safari. Timings below run from the recorded initiation capture, including screenshot/click dispatch overhead; they are indicative single-run observations, not production performance limits.

| Library / action | Normal: populated (ms) | Slow mobile (ms) | Delayed data (ms) |
| --- | ---: | ---: | ---: |
| Decks / new publication | 434 | 536 | 1953 |
| Decks / republication | 425 | 552 | 1942 |
| Decks / draft-only return | 499 | 1346 | 2012 |
| Info Cards / new publication | 236 | 1855 | 1759 |
| Info Cards / republication | 222 | 1818 | 1757 |
| Info Cards / draft-only return | 282 | 3141 | 1799 |

Across **18/18** cases: first populated order matched the server catalogue, no later order changes or target-position jumps, no blank sampled frames, no document-navigation requests, same `performance.timeOrigin`, and collection scroll remained zero. Publication returns highlighted the correct item; draft-only returns did not. These observations do not establish that stale content is impossible in all cache/network conditions.

Existing loading is visible, not hidden: normal Deck cases show **Loading Library…** for about 0.3s; delayed Deck cases retain Creator until about 1.6–1.7s then show that same loading boundary for about 0.3s. Warm slow-mobile Deck cases retained Creator until the collection arrived, without a separate sampled loading frame. Info cases show the Library heading/tabs plus **Loading Info Cards…**: about 0.09–0.10s normally, 1.29–1.37s on the slow profile, and about 1.61s with delayed data. Info's ordinary actor-scoped transport checks authentication before and after the catalogue request, explaining additional latency sensitivity; no security check was removed to improve timing. Draft-only slow returns also include the existing pending-autosave/leave-confirmation work.

Evidence is preserved locally (ignored, not committed) under `phase2-test-results/spa-network-review/`: 18 directories with `observations.json` containing all frame samples and the screenshot sequence. Representative sequences:

- Deck republication, normal: `creator-library-network.br-a5b79-eator-to-Library-navigation/` (`frame-250.png` shows existing loading; `frame-1000.png` shows correct highlighted first item).
- Info republication, slow: `creator-library-network.br-f1881-eator-to-Library-navigation/` (`frame-1000.png` shows existing loading; `frame-2000.png` shows correct highlighted first item).
- Info draft-only, slow: `creator-library-network.br-ef4dc-eator-to-Library-navigation/` shows the longer save/return interval, then unchanged publication order without highlight.

An additional direct-editor-entry baseline also passed 18/18, preserved separately in `phase2-test-results/spa-direct-entry-baseline/`; do not substitute its timings for the real-link results above.

#### Regression coverage and scope

- Dedicated browser regressions hold a detached upload and a detached autosave, remove the Card, navigate to Library by SPA, then release the request and verify the saved Card metadata/content. Both passed without a new wait barrier. Existing attached-upload/save failures, publication failure/retry and hybrid destination tests remain.
- The asynchronous stale-read fixture now holds **only its old pre-navigation request**; holding every request accidentally blocked the restored Info mount read. The initial combined run completed **109 passed / 1 failed** (including all 18 network observations); that failure was the interception error, not evidence of application stale ordering. After correcting only the fixture, the full six-file Creator/Library regression suite passed **92/92 in one uninterrupted run (4.3 minutes)**, including that case and the selected-publication media fixture. Together with the 18/18 saved network observations, all 110 distinct scenarios passed; this is not represented as a single uninterrupted 110-pass run.
- **72/72 unit tests** passed: navigation/recency, editor/errors/capacity, coordinator/recovery and Library read models. **42/42 database integration tests** passed: publication ordering/ties/pagination, draft-only non-promotion, ownership, transaction/deletion and private-media boundaries. The existing Mongo shutdown fallback warning did not fail an assertion.
- TypeScript no-emit and scoped ESLint passed. No Phase 4, Phase 1 visual/interaction change, publication/security-policy change or commit. Real iPhone Safari, cold production navigation, live Cloudflare verification and deployed index checks are not claimed as covered.

Reproduce network observations with `node --import tsx scripts/test-phase2.ts --info-cards creator-library-network.browser.ts --reporter=line`. Reproduce the combined regressions with `node --import tsx scripts/test-phase2.ts --info-cards creator-collection-navigation.browser.ts creator-drafts.browser.ts creator-visibility.browser.ts creator-coordinator.browser.ts library-ui.browser.ts info-cards-authoring.browser.ts --reporter=line`. Each runner owns its disposable server/database; run them sequentially. The curated local evidence index is `phase2-test-results/spa-network-review/README.md`; generated artifacts are not committed. Relative documentation/evidence links (43) and diff whitespace checks passed.

Changed in this reversal: `src/components/creator/CreatorDragLab.tsx`; `src/components/info-cards/InfoCardEditor.tsx`; `src/app/library/page.tsx`; `src/components/library/InfoCardsLibrary.tsx`, `useLibraryNavigation.ts`; `tests/phase2/creator-collection-navigation.browser.ts`, `creator-coordinator.browser.ts`, new `creator-library-network.browser.ts`; the media fixture's obsolete SSR-only comment in `info-cards-authoring.browser.ts`; and these narrowly reconciled documentation clauses. Other existing uncommitted Phase 3/navigation changes were preserved.

**Discussion only:** no ordering defect was established by these samples, so no further ordering intervention is recommended now. The existing loading-message transition is observable, especially on slow Info reads; any future decision to change it requires separate approval. Broader cold-cache/production-build measurements could be collected if needed, without assuming a new architecture is necessary. Safari and arbitrary network/cache conditions remain limits of this Chromium/local-development evidence.

### Earlier correction — publication ordering and authoritative Library returns (superseded navigation approach)

- Both Library tabs sort by latest successful publication before normal pagination. Info Cards retains owner-first priority and ID ties; Decks retains its existing timestamp/cursor order without owner priority. Draft saves/opening content do not promote items. My Decks max(creation, opening) sorting and working-entry/discovery behaviour remain unchanged.
- Creator completes existing saves/uploads/recovery and uses a fresh document navigation **only for Library collection returns**. The authenticated server page queries the authoritative ordinary first page before either tab renders tiles. Info receives that page as initial React state, without a competing mount-time catalogue read. Old document responses and prefetched RSC/mounted pages cannot replace it; actor/sequence guards and persisted-history reload protect session boundaries. This is the chosen simple technical cache boundary, not a new navigation framework or loading design.
- Minimal controller/lane `confirmedPublicationVersion` metadata is set only by a successful server acknowledgement or verified recovery receipt. Existing published roots, draft saves, failed/rejected/uncertain requests do not set it. Confirmed returns add `published=<actual resulting ID>` for the existing brief outline; other Library returns use the plain tab URL. No automatic Library scrolling, promotion or extra controls. Existing My Decks highlighting/scrolling remains opt-in and unchanged.
- Removed Library reveal API/query contracts, seek/anchor window code, `revealedId` client bookkeeping and both Show newest controls. Keep the shared `CollectionReturnHighlight` because ordinary highlighting and My Decks still consume it; scrolling is explicit for My Decks only. Unpublished Stay/Leave, hybrid Deck origins, private-copy identity, capacity/authoring, Phase 1, publishing/security and media gates are preserved. No Phase 4 or commit.
- **10 passed:** focused authenticated Chromium navigation scenarios, including held publication acknowledgement, an initial rejected publication/retry, held authoritative destination document, an old in-flight Library read released after return, every observed rendered-frame order, highlight expiry without scrolling, unchanged draft-only order/top, account switching after publication and rejected obsolete reveal API parameters. The initial harness incorrectly queried the DOM while deliberately holding its next document; the corrected test inspects the uncommitted frame URL instead. Failing/interrupted debug runs are not counted as passes.
- **All 90 browser scenarios verified across runs:** the combined authenticated Creator/Library run completed **89 passed / 1 failed**. Its remaining media-viewer fixture still assumed a browser-side initial catalogue fetch, which no longer exists. It was changed to seed a stored publication in the disposable database and exercise the actual server-rendered catalogue; only image delivery is mocked. The corrected case then **passed in isolation (1/1)**. There is no unresolved failing case, but this is **not** represented as one uninterrupted 90-pass run. The application source did not change between the combined run and this test-fixture correction. Existing autosave, uploads, publishing retries, visibility, draft recovery, hybrid navigation, pagination, keyboard/mobile layout and My Decks regressions passed.
- **72 passed:** focused navigation/recency, editor/error/capacity, coordinator/recovery and Library read-model unit tests. Receipt metadata assertions cover no receipt from a clean existing publication, uncertain/lost responses, explicit retry and verified recovery; mismatched immutable receipts remain conflicts without highlighting.
- **42 passed:** disposable-replica-set Library/Info Cards integration tests. Coverage includes server publication timestamps versus conflicting root creation/update times, owner-first Info grouping, deterministic tied page boundaries, draft saves leaving order/content unchanged, republication promotion, and existing ownership, transactions, deletion and private-media boundaries. Existing Mongo shutdown fallback warning is not an assertion failure.
- TypeScript no-emit and scoped ESLint passed, with no outstanding lint warning. Deterministic ordering/navigation does not require phone re-acceptance; only visual judgement of the existing highlight or perceived full-document transition is human-only. No live Safari/provider pass is inferred; existing Cloudflare protection/index deployment gates remain unchanged.

Complete file summary for this correction (earlier uncommitted navigation changes are retained, not replaced wholesale):

- `src/lib/infoCards/queries.ts`: latest immutable-publication sort; remove Info reveal window.
- `src/lib/cards/libraryReadModels.ts`, `src/lib/infoCards/http.ts`, `src/app/api/library/decks/route.ts`, `src/app/api/library/info-cards/route.ts`: remove the earlier Library reveal query/window additions, restoring ordinary authorised pagination contracts. Some of these files consequently have no diff against the last commit.
- `src/app/library/page.tsx`: authenticated authoritative server first pages for both tabs; scope Deck publication highlight to the current owner and an already-public rendered row.
- `src/components/creator/creatorNavigation.ts`, `CreatorDragLab.tsx`, `creatorPersistenceCoordinator.ts`: unchanged hybrid destination policy; confirmed-publication metadata and fresh Library return.
- `src/components/info-cards/InfoCardEditor.tsx`, `infoCardEditorController.ts`: confirmed-publication receipt, fresh Library return and preserved unpublished leave/save/upload/retry safeguards.
- `src/components/library/InfoCardsLibrary.tsx`, `LibraryShell.tsx`, `useLibraryNavigation.ts`, `CollectionReturnHighlight.tsx`: authoritative initial state, no competing Info mount read, no seek/Show newest, publication-only non-scrolling outline, ordinary pagination and persisted-history/session protections.
- `src/components/layout/AppShell.tsx`: explicit opt-in to existing My Decks scroll/highlight; no My Decks ordering or working-entry implementation change.
- `tests/creator-navigation.test.ts`, `creator-coordinator.test.ts`, `info-card-editor.test.ts`, `info-cards.integration.ts`, `library-read-models.integration.ts`; `tests/phase2/creator-collection-navigation.browser.ts`, `creator-visibility.browser.ts`, `info-cards-authoring.browser.ts`, `library-ui.browser.ts`: new ordering/receipt/asynchronous return coverage and corrected regression expectations. The existing My Decks recency test is unchanged and rerun.
- Functional specification §5.5/§6/§12.3, engineering plan Phase 3 correction/Library/navigation/validation sections, and this handoff. Historical results below describe earlier requirements and are not current ordering acceptance.

### Earlier Creator collection-navigation correction (Library discovery superseded above)

- New Deck private/public intent routes immediately to My Decks/Library. Existing owned Decks retain their collection origin; direct/draft routes use a valid same-item origin or visibility fallback. An actual private Library-origin copy uses its resulting ID in My Decks; unchanged foreign sources are not treated as private copies. Info Cards always return to Library → Info Cards. No Back to My Drafts destination remains in Creator.
- Returns show collections, never automatically opening a working Deck. Destinations are re-evaluated after saves/publication/copying; ownership/fork/version URL context and save/upload/recovery barriers are preserved. Deck leave confirmations explain relevant unpublished-item absence. Info Cards have Stay/Leave without publishing confirmation for saved unpublished items. Nothing publishes implicitly.
- My Decks uses unified max(membership creation, last-opened) recency with deterministic ties. Library sorts are unchanged. Authenticated validated reveal queries return bounded, correctly ordered target windows without fetching all earlier pages; hidden/unknown targets fall back to normal collections. Show newest resets the window. A one-time scroll/subtle expiring outline marks the item; no membership/working-entry write occurs.
- Changed implementation: Creator navigation helpers/routes/components and leave confirmation; Info editor return/confirmation; My Decks ordering/heading; DeckTile item marker; Library collection page/shells/refresh, info/deck read queries and API parsing; new `CollectionReturnHighlight.tsx`. Tests cover helper/recency units, repository window/ACL checks, new `creator-collection-navigation.browser.ts` and updated affected regression expectations. No authoring/capacity or publishing/security policy changes. No commit or Phase 4 work.
- **85 passed (4.1 minutes):** final uninterrupted combined authenticated Chromium run of `creator-collection-navigation`, `creator-drafts`, `creator-visibility`, `creator-coordinator`, `library-ui` and `info-cards-authoring`. Covers new private/public-intent destinations, sticky origins/reload, actual private-copy identity, no working-entry writes, My Decks recency, old-item reveal/highlight/expiry/reset, authorised fallback, unpublished warnings/Stay/Leave, pending uploads, failed/conflicted saves, partial publication recovery, and existing authoring/capacity/Library regressions. Earlier assertions expecting old labels or an automatically reopened Deck were updated; an explicit tile-open assertion was scoped to the main open action rather than matching both the tile and mini-card controls. No failing assertion remains in the final run.
- **72 passed:** focused navigation/recency, editor/error/capacity, coordinator/recovery and Library read-model unit tests. **42 passed:** disposable-replica-set Library/Info Cards integration tests, including seek-window continuation, unchanged chronology and identical normal fallback for private/unknown targets. Mongo's existing shutdown fallback warning did not fail an assertion.
- TypeScript no-emit, scoped ESLint, diff whitespace and all **28** relative documentation links passed. The existing full-unit CSS-loader limitation and live provider/device checks were not treated as passes. Phase 1 components/animation styles were untouched; this run targets Creator/Library behaviour rather than rerunning the entire Phase 1 programme.
- Authenticated Chromium verified login **200** at desktop **http://127.0.0.1:4181/creator/new** and LAN **http://192.168.1.38:4181/creator/new**, with the new **My Decks** return label. On both hosts, opening the existing published owner Info Card and clicking Library reached `/library?tab=info-cards&reveal=demo-owner-public`, scrolled/highlighted its face and produced **no page errors**. Screenshots: ignored `phase2-test-results/phase3-review/navigation-desktop-390.png` and `navigation-lan-390.png`. This is the actual Next application/disposable database, not port 4180; physical iPhone Safari acceptance remains manual.
- Existing review runner **41840** remains running, with its disposable data preserved. Login **phase2 / local-test-only** (alternate **other / local-test-only**). Open **http://192.168.1.38:4181/library?tab=info-cards** on the same trusted Wi-Fi. Stop this instance with `kill -TERM 41840`; start from the repository root with `node --import tsx scripts/test-phase2.ts --dev --lan --info-cards`. Restarting creates fresh disposable data and a new PID; Ctrl+C stops a terminal-started instance. Cloudflare protection verification and deployed application indexes remain the existing operational gates.

Changed-file manifest for this navigation correction (the earlier Phase 3 manifest above is historical):

- Navigation: `src/app/creator/edit/[deckTemplateId]/page.tsx`; `src/components/creator/CreatorDragLab.tsx`, `CreatorLeaveConfirmation.tsx`, `creatorNavigation.ts`; `src/components/info-cards/InfoCardEditor.tsx`.
- Collection rendering/discovery: `src/app/library/page.tsx`; `src/components/layout/AppShell.tsx`; `src/components/decks/DeckTile.tsx`, `myDecksLayout.ts`; `src/components/library/CollectionReturnHighlight.tsx` (new), `InfoCardsLibrary.tsx`, `LibraryShell.tsx`, `useLibraryNavigation.ts`.
- Authorised collection reads: `src/app/api/library/decks/route.ts`, `src/app/api/library/info-cards/route.ts`; `src/lib/cards/libraryReadModels.ts`; `src/lib/infoCards/http.ts`, `queries.ts`.
- Tests: `tests/creator-navigation.test.ts`, `my-decks-recency.test.ts` (new), `info-cards.integration.ts`, `library-read-models.integration.ts`; `tests/phase2/creator-collection-navigation.browser.ts` (new), `creator-coordinator.browser.ts`, `creator-drafts.browser.ts`, `creator-visibility.browser.ts`, `info-cards-authoring.browser.ts`, `library-ui.browser.ts`.
- Documentation: functional specification §5.3/§5.5/§12.3, engineering plan §5.1/Phase 3 validation and this handoff. No publishing writes, ownership rules, content-capacity logic, Phase 1 components or styles changed.

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

Current manual checklist: main menu Create → switch Deck/Info Card; blank title and prerequisite feedback by touch/keyboard; series groups and inline creation; autosave/reload; private/public confirmation; Library publication-ordered cards and distinct creators; every Info Card entry point → Library → Info Cards; new Deck private/public intent → My Decks/Library; existing Deck → originating collection, including reload; private Library copy → My Decks under the resulting ID. Check unpublished-item Stay/Leave and no automatically opened working Deck. Library highlights only confirmed publications without scrolling; no Show newest remains. My Drafts stays separate. Existing Deck editing has no creation selector. Media add/replace still fails closed until provider verification. Deterministic return/ordering acceptance is automated; device/visual judgement and real provider delivery remain separate. No search, filters, management screens or Phase 4 controls were introduced.

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
  creator-collection-navigation.browser.ts info-cards-authoring.browser.ts creator-drafts.browser.ts library-ui.browser.ts \
  creator-visibility.browser.ts creator-coordinator.browser.ts --reporter=line
npx playwright test -c playwright.info-cards-integration.config.ts
node --import tsx --test tests/info-card-editor.test.ts tests/info-card-drafts.test.ts \
  tests/info-card-upload.test.ts tests/creator-navigation.test.ts tests/my-decks-recency.test.ts tests/creator-coordinator.test.ts \
  tests/creator-recovery.test.ts tests/creator-visibility.test.ts tests/library-ui.test.ts
node --import tsx --test tests/info-cards-api.integration.ts
node --import tsx --test tests/info-cards.integration.ts
node --import tsx --test tests/library-read-models.integration.ts
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
