# Group Experiences — iPhone review corrections

Status: four corrections implemented, automated checks passed, updated Vercel Preview READY. Physical iPhone acceptance remains required. No commit, push or merge.

## Scope

Four authorised corrections following `group-experience-iphone-regression-investigation.md`: authority renewal ordering, immediate reflection feedback, Group read/bootstrap efficiency, and Gallery opening before metadata completes. Existing Deployment Checkpoint 1 changes remain included and uncommitted. No Card geometry, motion constants, gesture thresholds, storage/provider configuration, permissions or Info Card changes.

## Implementation

1. **Authority renewal:** each verification has a request order. A transient failure from an older request cannot withdraw a newer, still-unexpired matching grant. Confirmed denials, account/context conflicts and publication/membership scope conflicts still invalidate access. The five-second lease remains measured from request start. Full content reads and renewal share this rule.
2. **Reflections:** the existing ReflectionArea patches only the submitted source immediately, reconciles its server revision and allocated row identity directly from POST, and rolls back/reconciles on failure without discarding the editor draft. Reads started before submission cannot overwrite it. Polling pauses while saving. A scoped change event refreshes other instances, excluding the saving instance; no post-save GET or full Deck refresh is required.
3. **Reads:** successful schema inventory checks are shared per connected MongoClient/database/schema, including concurrent initial requests. Failed readiness checks retry. Explicit provisioning and uncached operator assertions remain available. Authority uses a narrow authenticated endpoint that checks current membership, Group revisions and selected Deck/Card root/version visibility without retrieving presentation content. Presentation, peer and aggregate first pages run concurrently after common authority, and final authority/revision checks remain mandatory.
4. **Gallery:** thumbnail callers pass their already-authorised bounded page through the existing scene callbacks. The existing collection controller starts with that page and exact selection while fetching the larger page. The same viewer opens immediately, including for ordinary Personal Cards. Metadata loading/error/retry is visible; failed or denied reads clear media payloads. Account/Card/Deck/perspective changes retain existing scope checks. Image-byte loading and retry, video playback and downloads continue through the existing viewer and authorised delivery routes.

Reflection GET bookkeeping: reads now use current authority and snapshot reads without membership write fences or the extra Admin-list query. They do not persist anything, so there is no lost-update race to fence. Save/delete/hide and collective mutations retain their existing membership/adoption fences, operation receipts and atomic revision checks. This does not create an enduring read grant: Group authority still expires and is revalidated, and media delivery independently authorises access.

Schema-cache lifetime is a connected application client/process, not a permanent certification. Cold server instances validate the provisioned indexes; warm request repositories reuse that result. Index changes remain an explicit operational action; after intentional schema changes, restart affected application workers. No cache contains permission or publication results.

## Verification checkpoints

- Authority/client ordering: 19 tests passed, including deterministic overlapping success/failure, expiry, revocation, disposal, scope changes, mixed publication pages and parallel starts.
- Focused shared client/unit suite: 62 passed; final commands and results below.
- First focused database run: 37/38 passed. The failure was an overlong generated test database name; shortened in the test. No application failure inferred from that setup error.
- First focused browser run: 8/10 passed. The two follower-edit cases clicked during deliberately triggered access revalidation; the tests now wait for verified authority before attempting to open the editor.
- Standard isolated typecheck and production build passed at the initial implementation checkpoint. Root-only ignored diagnostic scripts are excluded from the clean source export, rather than changing application TypeScript settings.
- Broader database and mobile Chromium/WebKit regressions completed; corrected test-setup cases and exact results are recorded below.

All mutation tests use disposable databases and mock providers. Real Atlas profiling is read-only with a command monitor rejecting writes. No review data, accounts, media objects, permissions or persisted test actions are reset.

## Performance — local Node to the same Atlas database

These are measured repository calls, **not Vercel internal spans or hosted page timings**. Before values come from the investigation's warm round; after values from the matching second round with fresh repository instances sharing the connected client.

| Repository read | Before ms | After ms | Before commands | After commands | Before metadata commands | After metadata commands |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Authority | 200 | 56 | 18 | 5 | 11 | 0 |
| Presentation | 232 | 112 | 21 | 10 | 11 | 0 |
| Perspectives | 237 | 127 | 21 | 10 | 11 | 0 |
| Aggregates | 254 | 123 | 22 | 11 | 11 | 0 |
| Group media metadata | 282 | 132 | 25 | 12 | 13 | 0 |

The small Deck bootstrap still makes five HTTP requests, now three dependent stages rather than five. Warm repository command total is 41 versus 100, with 0 versus 55 metadata commands, excluding HTTP authentication and surrounding My Decks reads. A cold connected process still performs its initial schema inventory. Serverless cold-start time and cache sharing between hosted function instances must be measured separately, not inferred from local profiling.

Evidence: ignored `phase2-test-results/iphone-investigation/read-path-profile.json` and `read-path-profile-after.json`.

## Physical review boundary

Continuous Group stack vibration and subjective Personal animation jerkiness remain physical-review observations. No speculative animation changes have been made. Hosted observation results, limitations and the new review address follow.


## Final automated results

Commands ran against clean isolated source/disposable infrastructure; no Atlas mutation tests:

- `node --import tsx --test tests/group-experience-client.test.ts tests/reflection-feedback.test.ts tests/reflection-presentation.test.ts tests/media-collection-client.test.ts tests/card-media-viewer-layout.test.ts tests/group-media-providers.test.ts tests/media-collection-delivery.test.ts tests/media-centre-metadata.test.ts tests/media-collection-operations.test.ts tests/personal-media-mutations.test.ts` — **62 passed**.
- `node --import tsx --test tests/media-ux.test.tsx` — **13 passed**.
- `npx playwright test tests/card-media-viewer.spec.ts tests/ios-video-share.spec.ts tests/user-card-video-readiness.spec.ts --workers=1` — **19 passed**.
- `node --import tsx --test --test-concurrency=1 tests/group-experience.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-management.integration.ts tests/group-media.integration.ts tests/media-collection.integration.ts tests/group-reflections.integration.ts` — **105 passed**.
- `node --import tsx --test tests/group-experience-api.integration.ts` — **9 passed**, including the new authenticated narrow authority route.
- `node --import tsx --test tests/media-collection.integration.ts tests/card-media-access.integration.ts` — **14 passed** after the final owner-history metadata-cache change. This intentionally reruns the affected collection suite and adds Personal access regressions; do not add its count to the earlier suite as unique cases.
- `PHASE11_REVIEW_INFO=... npx playwright test --config playwright.phase11.config.ts` — **70 passed, 4 test-setup failures** in the initial broader run. Upload refresh inherited Alice inspection/Card 2 from earlier navigation rather than selecting Group/Card 1. The expiry test's loaded transform still intercepted the old full-Group URL. Fixed by explicit Group perspective/Card navigation and intercepting `/authority`; no permission or application changes were made to satisfy these tests.
- Final `--grep 'Group Card upload refreshes|explicit authority expiry|Gallery opens before delayed|valid renewal keeps'` — **12 passed across Chromium/WebKit**, including all four former setup failures. Thus all 74 broader cases passed either in the original run or their corrected rerun.
- `npx playwright test --config playwright.media-collection.config.ts` — **46 passed** across Chromium/WebKit after repairing the older standalone viewer fixture's missing authorised history response. It deliberately retains the legacy CardData thumbnail snapshot; current HTTP thumbnail behaviour is exercised by the collection and full application suites. Coverage includes actual mock-video decoding, paused navigation, bounded paging, image retry, iPhone file sharing/downloads and source-specific inherited media.
- Added a metadata/zoom regression after identifying that a loading line in normal layout flow resized the image and reset zoom. Before the correction the new test failed at 100% instead of 150%; the loading/error status now overlays the viewer without taking layout height. Final `--grep 'background Gallery metadata'` — **2 passed**, one per engine. No Card geometry or animation changes.
- Standard `npm run typecheck` and `MONGODB_URI='' MONGODB_DB='' SWITCHPLAY_DATABASE_MODE=production NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1 npm run build` — **passed** in the clean source export. Final Preview independently runs the standard production build with existing hosted configuration.
- Focused ESLint on changed TypeScript/TSX files and `git diff --check` — **passed** at the final code checkpoint; final inventory check recorded below.

The disposable runner was started in `/private/tmp/switchplay-checkpoint1-2ekw80um`, port4203, with its own MongoMemoryReplSet and mocked providers. Existing phone review servers4191/4192 and live review records were not reset or stopped.


## Hosted verification and performance

Preview `dpl_9hpu1nBJgaufPamZ3NZxeNWRZn5s` is independently verified **READY**, target Preview, existing project `switchplay-app-ie`; build duration2m27s. This is an isolated source deployment, with no Git commit/push or Production promotion. Standard build, existing authentication and existing provider configuration remain in use. All27 changed application source files match the deployed source export byte for byte.

Existing Joe login, Group read and narrow authority read returned200. Read-only browser checks use that real Admin session; mutations are blocked. Review content, membership, roles and media are preserved. Real follower login/mutations were not repeated: existing Eamonn/Rowan passwords were not available to automation. Cross-account mutation and revocation coverage uses disposable phase2/Aoife/Alice accounts, and live follower acceptance remains part of physical review.

After the founder appended the new Preview origin, read-only R2 OPTIONS checks returned204 for both Personal and Group uploads, including all six existing Group headers. No object was uploaded, deleted or modified in this correction task. The earlier checkpoint's real-provider upload/deletion verification remains recorded in its handoff; it is not misrepresented as a new live upload test here.

### Same hosted journey, before and after

| Measurement | Previous Chromium | Corrected Chromium | Previous WebKit | Corrected WebKit |
| --- | ---: | ---: | ---: | ---: |
| First measured full navigation to visible Group stack | 14.723s | 12.339s | 11.519s | 4.613s |
| Repeat full navigation in corrected session | Not recorded | 4.620s | Not recorded | 4.084s |
| Thumbnail tap to Gallery dialog | 2.871s | 0.108s | 3.903s | 0.118s |
| Gallery30-item metadata request | 2.707s | 1.085s | 3.462s | 1.106s |

These are actual Vercel requests from this machine, using the same existing Group, account and414×740 mobile viewport as the investigation. The first corrected Chromium navigation followed several hours without these probes. Browser/server caches and function startup are not controlled; Chromium precedes WebKit, so the WebKit run benefits from warmed hosted functions. Neither the first observation nor the repeat is proof of a particular serverless cold-start state. The first-load result of12.339s remains a meaningful limitation; do not describe every Group opening as taking4s or claim startup delay is eliminated.

The first corrected Chromium navigation spent4.787s to document completion, then its Group reads took3.197s authority, up to3.425s for the three overlapping page requests, and0.663s final authority. Corrected WebKit document completion was2.045s, with0.610s authority,0.969s maximum concurrent-page time and0.584s final authority. Request count remains five; the middle three now overlap. The expensive first requests remain visible in the evidence. Vercel function-startup, hosted session and MongoDB internal spans are not individually measured; command counts and database durations above are separately labelled local-to-Atlas profiling.

A separate real-photograph check opened the existing3024×4032 image contribution `376f47af-aae1-488a-891d-6cda160d542d` successfully in both browsers. Dialog opening took156ms Chromium/200ms WebKit; full image readiness took2427ms/203ms after the tap. Image loading feedback is visible while bytes arrive. This is not solely the1×1 provider probe, which is still retained unchanged. Image/video delivery, ownership and storage configuration are unchanged.

The existing Group video also opened successfully:150ms Chromium/137ms WebKit to the Gallery. Both browsers decoded the240×320 video to readyState4 and kept it paused until user playback. No Stream asset/settings were modified; evidence: `live-corrected-video-readonly.json`.

A corrected read-only sampler recorded stable settled positions in both engines:110/106 idle samples and235/226 post-settle comparison samples. The grid was present throughout those comparison samples, with no verification marker; the same focused Card node remained mounted. Group stack top stayed225.688px in Chromium/224.703px in WebKit, and focused top55.703px in both measured comparison windows. No continuing vertical vibration was reproduced. These browser observations do not certify physical iPhone smoothness.

The independent ordinary Personal focus/flip/vertical-traversal test also passed in both engines. Its assertions allow the existing transient two-Card animation and the original Personal Deck face on the next Card; no animation changes were made to satisfy the test.

Evidence (ignored diagnostic artifacts): `live-corrected-readonly.json`, `live-corrected-photo-readonly.json`, `live-corrected-grid-readonly.json`, `corrected-preview-cors.json` under `phase2-test-results/iphone-investigation/`. Screenshots include `corrected-webkit-real-photo.png` and `corrected-stable-chromium-comparison.png` / `corrected-stable-webkit-comparison.png`. The initial reused timing sampler produced no geometry samples; its timing/network results remain valid, and geometry claims use the separate corrected string-injected sampler only.

## iPhone review

https://switchplay-app-l1415n0zl-peter-meehan-domokos-projects.vercel.app/decks?openExperience=738ebc9c-6a48-4148-8d89-7928d4cf7ce1

Use the existing credentials: **Joe — Group Admin, not a follower; Eamonn and Rowan — followers, not Group Admins**. Passwords and account roles are unchanged. The local phase2/Aoife/Alice accounts remain disposable local fixtures and are not new Atlas review credentials.

1. As Joe, open the first Card, focus it, open All followers and leave the grid open for20–30seconds. Flip and traverse Cards normally; observe whether the previously reported vibration/jitter remains.
2. Open the Card back and tap an existing thumbnail. The Gallery should open promptly; use the real photograph rather than judging the intentionally retained1×1 probe. Check loading feedback, next/previous, video, zoom, close/reopen, download/share and the separate Media Centre.
3. Save a collective Group reflection as Joe. After the editor closes, its text should already be on the Card. Reopen and edit again.
4. As Eamonn, save an individual reflection in Me, then check it in the Group member carousel. Check an ordinary Personal reflection too. Use the same existing content across account changes; nothing is reseeded.
5. Compare initial and repeat Group loading. Check ordinary Personal focus, flip and vertical navigation for the reported jerkiness. These two unresolved visual observations still require physical acceptance.

No further product decision is needed for these four corrections. Physical iPhone approval remains the stop boundary. First-load latency is not fully eliminated, and subjective animation smoothness is not claimed resolved.

## Final working-tree inventory

Branch: `feat/group-experience`. Base commit remains `7d6102c`. All approved Deployment Checkpoint1 work is preserved alongside these corrections. No commit, push, merge, Atlas mutation test, review-data reset or unrelated server shutdown.

Complete pending inventory: **50 files**, including retained earlier checkpoint work.

| File | Purpose |
| --- | --- |
| `.vercelignore` | Retained checkpoint exclusions for safe isolated Preview source upload. |
| `docs/engineering/features/group-experience/group-experience-deployment-checkpoint-1-handoff.md` | Retained prior implementation/provider verification; added current correction handoff link. |
| `docs/engineering/features/group-experience/group-experience-engineering-plan.md` | Retained approved shared user-data bucket requirements from Deployment Checkpoint1. |
| `docs/engineering/features/group-experience/group-experience-gate-removal-handoff.md` | Retained follow-up note superseding the dedicated Group bucket requirement. |
| `docs/engineering/features/group-experience/group-experience-iphone-corrections-handoff.md` | This implementation and verification handoff. |
| `docs/engineering/features/group-experience/group-experience-iphone-regression-investigation.md` | Preserved original investigation evidence; added current correction handoff link. |
| `docs/engineering/features/group-experience/group-experience-phase-6-handoff.md` | Retained historical Phase6 record with the superseding shared-bucket decision. |
| `src/app/api/group-experiences/[experienceId]/authority/route.ts` | New narrow authenticated authority GET. |
| `src/components/decks/BackCardFaceContent.tsx` | Pass the authorised Personal thumbnail page; retain newest-five refresh. |
| `src/components/decks/DeckDetail.tsx` | Capture Personal Gallery opening page with its selection. |
| `src/components/decks/DeckScene.tsx` | Forward optional media snapshot through existing callback; motion unchanged. |
| `src/components/decks/FocusedCardView.tsx` | Forward optional media snapshot through existing callback; gestures/motion unchanged. |
| `src/components/group-experiences/GroupCardBack.tsx` | Pass the authorised thumbnail page; retain newest-five refresh. |
| `src/components/group-experiences/GroupExperienceDeck.tsx` | Carry selected authorised Gallery page; retain checkpoint renewal scheduling. |
| `src/components/group-experiences/groupResource.ts` | Renewal ordering, strict scope/lease handling and parallel bootstrap pages. |
| `src/components/media/CardMediaViewer.module.css` | Overlay status without resizing media or resetting zoom. |
| `src/components/media/CardMediaViewer.tsx` | Existing viewer opens during metadata loading, with error/retry handling. |
| `src/components/media/CollectionGallery.tsx` | Seed the existing Gallery from authorised thumbnails; load history in background. |
| `src/components/media/WorkingCardMediaViewer.tsx` | Personal Gallery seed, scope guards and denied-data clearing. |
| `src/components/media/useMediaCollection.ts` | Optional opening snapshot; retained checkpoint newest-thumbnail refresh behavior. |
| `src/components/reflections/ReflectionArea.tsx` | Immediate preview, read-generation protection, rollback and scoped invalidation. |
| `src/lib/cardMediaViewer.ts` | Optional typed thumbnail page in existing media callback. |
| `src/lib/cardMediaViewerLayout.ts` | Carry the opening page with existing source-bound Personal selection. |
| `src/lib/groupExperiences/media/http.ts` | Retained truthful existing-provider configuration error wording. |
| `src/lib/groupExperiences/media/providers.ts` | Retained shared user-data R2 bucket and empty Stream DELETE response correction. |
| `src/lib/groupExperiences/media/repository.ts` | Reuse established media readiness across request repositories. |
| `src/lib/groupExperiences/publicVersions.ts` | Projected selected-publication visibility verification. |
| `src/lib/groupExperiences/readiness.ts` | Coalesced per-client/database schema readiness; positive-only optional media availability. |
| `src/lib/groupExperiences/repository.ts` | Shared readiness and narrow authority reader. |
| `src/lib/mediaCollection/controller.ts` | Validated initial page/selection and existing bounded refresh/pagination guards. |
| `src/lib/mediaCollection/ownerHistory.ts` | Reuse positive media schema readiness without repeated metadata enumeration. |
| `src/lib/reflections/clientState.ts` | Exact-source optimistic reflection patch and acknowledgement reconciliation. |
| `src/lib/reflections/groupRepository.ts` | Reuse established reflection readiness; mutation fences unchanged. |
| `src/lib/reflections/reads.ts` | Remove redundant GET bookkeeping writes and Admin lookup; snapshot permissions retained. |
| `tests/browser/ios-video-download.browser.ts` | Existing Personal viewer/video/share regressions, mock history endpoint or metadata/zoom regression. |
| `tests/browser/media-collection.browser.ts` | Existing Personal viewer/video/share regressions, mock history endpoint or metadata/zoom regression. |
| `tests/browser/media-viewer.browser.ts` | Existing Personal viewer/video/share regressions, mock history endpoint or metadata/zoom regression. |
| `tests/browser/personalMediaFixture.ts` | Existing Personal viewer/video/share regressions, mock history endpoint or metadata/zoom regression. |
| `tests/group-experience-api.integration.ts` | Focused storage, ownership, readiness, permission or client regression coverage; retained provider checks. |
| `tests/group-experience-client.test.ts` | Focused storage, ownership, readiness, permission or client regression coverage; retained provider checks. |
| `tests/group-experience.integration.ts` | Focused storage, ownership, readiness, permission or client regression coverage; retained provider checks. |
| `tests/group-media-providers.test.ts` | Focused storage, ownership, readiness, permission or client regression coverage; retained provider checks. |
| `tests/group-media.integration.ts` | Focused storage, ownership, readiness, permission or client regression coverage; retained provider checks. |
| `tests/group-reflections.integration.ts` | Focused storage, ownership, readiness, permission or client regression coverage; retained provider checks. |
| `tests/media-collection-client.test.ts` | Focused storage, ownership, readiness, permission or client regression coverage; retained provider checks. |
| `tests/media-collection.integration.ts` | Focused storage, ownership, readiness, permission or client regression coverage; retained provider checks. |
| `tests/phase2/group-experience-motion.browser.ts` | Mobile Personal/Group reflection, Gallery, authority, permission and navigation regression coverage. |
| `tests/phase2/media-ux.browser.ts` | Mobile Personal/Group reflection, Gallery, authority, permission and navigation regression coverage. |
| `tests/phase2/reflections.browser.ts` | Mobile Personal/Group reflection, Gallery, authority, permission and navigation regression coverage. |
| `tests/reflection-feedback.test.ts` | Focused storage, ownership, readiness, permission or client regression coverage; retained provider checks. |

Final handoff check: changed-file ESLint completed with0 errors/warnings; `git diff --check` passed. An additional independent Personal focus/flip/traversal check passed2/2 across Chromium/WebKit. Its initial assertions were corrected to allow normal exiting-Card overlap and the original Deck-facing side on the next Personal Card; implementation was unchanged.

Hosted build logs independently confirm `npm run build`, successful compilation, completed TypeScript and `Build Completed in /vercel/output`. The final clean-export `npm run typecheck`, including the added Personal motion test, exited0. Read-only live membership inspection reconfirmed Joe Admin/not Follower and exactly the existing Eamonn/Rowan follower perspectives.
