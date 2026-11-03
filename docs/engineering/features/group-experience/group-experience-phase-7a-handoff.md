# Phase 7 Checkpoint A — Media integration

## Status / Resume here

Checkpoint A implementation and verification are complete on `feat/group-experience`, from clean Phase 6 commit `8dc572ca724f`. TypeScript, focused lint, the final isolated production build and diff checks passed. This handoff accompanies the focused commit `feat (group experience): integrate bounded media collections`. The proposed split is technically sound. **Checkpoint B has not begun.** Stop after the focused A commit.

The remaining B decisions are placement/treatment of the older-media count, Private/context attribution, creator Delete versus Group Admin Hide controls, and upload affordances on own/Group-wide surfaces. Do not reopen settled ownership, visibility, chronology or permissions. No persistent database, real Cloudflare asset, provider setting or existing review server was changed.

## Completion boundary and approved decisions

A supplies bounded unified owner history, stable chronology/source identities, bidirectional pagination, refresh anchoring, reusable client state/transport, captured Group upload operations, exact-source Delete/Hide dispatch, protected delivery adapters and the existing Personal thumbnail/gallery integration. Existing components provide the gallery, zoom, video playback, download and iPhone sharing; there is no second gallery or new product control.

Ordinary Personal Cards can show the owner's Group-origin media without Private labels, as already approved. The Group surface is not mounted with unlabelled private items or temporary controls: mounting own-Group/Group-wide/inspected media and the new upload/hide/delete affordances remains B. Their data/operation contracts are ready and independently tested. This is the one practical UI dependency on B; it does not block the underlying work.

Approved semantics retained:

- One personal history per CardTemplate; no copied Group files/references or additional CardData.
- Group contributions remain authored personal property after leaving, hiding or origin archival. Origin is independent of viewing context.
- Newest five appear left-to-right with newest right; metadata pages contain at most 30 items.
- Dated uploads follow server timestamps. Legacy undated items form the older block, retaining per-source array order and deterministic source ties. No dates are inferred from CardData updates.
- Personal live fork media history follows the owner's actual stored source chain. Group contribution retrieval remains exact-CardTemplate, not canonical ancestry.
- Owner Group views derive Private for Personal items, other-Group items and hidden current-Group items. Ordinary owner views omit that presentation. Foreign feeds contain only shared exact-Group rows.
- Group Admin hiding never becomes creator deletion or provider cleanup. An owner can delete the exact Group source after leaving. No resharing or unhide operation was introduced.

## Server integration

### Unified owner history

`GET /api/media/history?cardTemplateId=…&limit=…&cursor=…&experienceId=…`

The optional experience validates a current own-Group viewing context; omitting it retrieves ordinary owner history independently of originating memberships. Session/viewer binding and private/no-store handling reuse the Phase 6 owner media boundary. Personal-only deployments work without Group collections or new provisioning. A present but unprovisioned Group media collection still fails its existing index checks explicitly.

The reader:

1. Retrieves only minimal owner source-chain references.
2. Aggregates the relevant Personal media metadata inside MongoDB, with the existing valid-item/deduplication semantics; no reflection, assessments, Info, scheduling or unrelated private fields enter the response.
3. Retrieves bounded Group candidates through the author/Card chronological index, without membership/per-Group fan-out.
4. Merges bounded candidates, resolves origin names in one minimal batch and returns chronological items, actual total/start offset, older/newer cursors and a refresh anchor.

Typed source identity is Personal `(sourceCardTemplateId,mediaItemId)` or Group `(experienceId,contributionId)`. Equal IDs from separate sources cannot collide. Cursor identity includes actor/Card/viewing Group, with literal query values and byte-consistent ordering for legacy identifiers. Missing optional Personal data does not hide owned Group contributions; ambiguous current Personal data is an integrity error. Missing/cyclic/ambiguous later history sources do not manufacture ancestry or expose unrelated records.

New Personal attachments receive an optional server-owned `uploadedAt`. Client timestamps cannot choose it; duplicate attachment retries retain the first value. Legacy arrays/records remain in place. Existing Working DTOs and the Personal upload editor retain their legacy arrays for compatibility; the **new collection endpoints and Group history do not fetch complete media histories into Node**. This checkpoint does not claim to remove every pre-existing full-array Working DTO read or perform the separately gated Personal storage migration.

### Group feed paging

The Phase 6 Group feed accepts `before` as well as `after` and adds `start`, `previous` and `refresh`. Existing `next`/after consumers remain compatible. Pages remain indexed, bounded, current-scope and visibility filtered. No private rows are fetched and later stripped. Refresh anchors preserve the loaded gallery head while exposing newly arrived items through newer navigation; uploads cannot push a still-existing selected item out of its page.

### Protected gallery delivery

- `GET /api/group-media/:id?action=thumbnail` reuses authorised signed playback and redirects to the validated signed thumbnail. It grants no generic/provider-ID access.
- `GET /api/group-media/:id/file?action=download` provides same-origin encoded MP4 bytes for the existing Safari sharing/fallback component. It validates the signed provider URL, preserves Range/attachment headers and rechecks contribution authority/revision after the byte fetch.
- Existing image streaming, signed readiness/download preparation, provider limits and Phase 6 release gates remain. Client grants/downloads verify the response actor and expiry. A presentation-only Group reference cannot be stored as Personal/canonical media; the reservation guard rejects its contextual URL.

These are application adapters over the existing provider infrastructure, not new storage/public URLs or live-provider changes.

## Client integration and operations

`MediaCollectionController` keeps one bounded page and an exact selected source. Navigation uses existing previous/next controls across older/newer pages. Refresh preserves identity; deletion uses the existing next-surviving-index rule. Abort/generation checks reject late/disposed requests. Viewer/experience/subject/epoch/adoption identities and source/owner/private constraints are checked before accepting foreign payloads. Errors clear the controller payload; Group payloads never enter WorkingCardStore.

`useMediaCollection` reuses local invalidation, focus/visibility refresh and bounded polling. Owner mutations refresh mounted owner collections across source contexts; Group events refresh affected Group/Card collections. Context changes dispose pending requests. Existing Personal upload/removal acknowledgements emit the same media invalidation event.

`BackCardFaceContent` and `WorkingCardMediaViewer` consume ordinary owner pages through adapters. The existing thumbnail classes/dimensions and gallery remain. Source keys survive loading, Legacy-to-typed selection conversion, source-ID collisions and React Strict Mode. Only the selected video mounts the existing player; its real provider identity comes from the authorised grant. No CSS was changed.

`mutateCollectionItem` dispatches creator deletion to the original Personal or Group source, and Group hiding to the exact current-origin Group with its epoch/revision. It never infers origin from the viewing Group or grants foreign deletion to an Admin. These methods are ready for B controls; no Delete/Hide button placement was invented.

`GroupMediaUpload` captures immutable actor/Group/Card/epoch/version and an HTTP-compatible operation ID. It reuses existing file validation and transfers, honours signed R2 headers, waits with bounded/abortable readiness checks, and retries the same reservation/proof. A successful transfer or lost transfer acknowledgement is recovered through owner status rather than duplicated. Cancellation uses the owner source and remains available after membership loss. There is no Personal fallback. Group upload UI remains B.

## Automated verification

Tests were introduced before the implementation; the first history run failed on the missing module. Early disposable fixture failures were unique-operation IDs and a conflicting test update, corrected without relaxing assertions.

| Selection | Actual result |
| --- | --- |
| New collection/controller/operations/delivery and selected existing Node media/fork tests | **37/37 passed**. |
| Cumulative unified history, Phase 6 Group media, protected media and personal media access integration | **33/33 passed**. |
| Final history rerun after query/literal/ordering hardening | **8/8 passed**, then the added Unicode/literal cursor case **1/1 passed**. |
| Final malformed-array/Personal-only case | **1/1 passed**. |
| Existing strict Personal append/retry/removal integration | **1/1 passed**. |
| Existing Personal gallery/upload/share logic specs | **73/73 passed**. |
| Chromium + WebKit media/gallery/share browser selection | Initial **41/42 passed**. One pre-existing WebKit share-retry assertion ambiguously matched playback and download alerts; narrowed to the expected download-error message, preserving its retry/share assertions. Corrected targeted rerun **1/1 passed**. |
| Final mixed-source Strict Mode and cross-page gallery browser checks | **4/4 passed**, both engines. |
| TypeScript, focused ESLint, isolated production build and diff | **Passed**; ESLint used `--max-warnings 0`. |

Coverage includes 0/1/5/8 items and **10,000 Personal + 10,000 Group records**, bounded response metadata, chronology/legacy order, identical source IDs, equal dates/Unicode identifiers, live inherited history, current/left/hidden/other origins, zero optional Personal records, malformed records, explicit Private metadata, stable anchors after insertion, actual offsets, adjacent pages, source deletion, operation retries, lost transfer acknowledgements, actor changes, foreign subject/cache identity and provider-byte revocation.

The browser fixture used a new isolated port 4217, no database or credentials, and mocked media. Existing phone review services/worktrees were preserved. WebKit warnings about fake fixture playback and the NO_COLOR/FORCE_COLOR environment do not certify real provider playback. No physical iPhone review was requested for A; B retains its visual gate and Phase 11 its real-device/provider gates.

Exact main commands:

```sh
node --import tsx --test tests/media-collection-client.test.ts tests/media-collection-operations.test.ts tests/media-collection-delivery.test.ts tests/card-media-viewer-layout.test.ts tests/personal-media-mutations.test.ts tests/group-media-routes.test.ts tests/group-media-providers.test.ts tests/personal-history-projection.test.ts tests/card-forks.test.ts
node --import tsx --test --test-concurrency=1 tests/media-collection.integration.ts tests/group-media.integration.ts tests/protected-media.integration.ts tests/card-media-access.integration.ts
node --import tsx --test tests/media-collection.integration.ts
node --import tsx --test --test-name-pattern='equal-date identifiers' tests/media-collection.integration.ts
node --import tsx --test --test-name-pattern='Personal-only deployments' tests/media-collection.integration.ts
node --import tsx --test --test-name-pattern='media append is strict' tests/phase2.integration.ts
npx playwright test tests/card-media-viewer.spec.ts tests/user-card-media.spec.tsx tests/user-card-media-upload-panel.spec.tsx tests/keyed-user-card-media-upload-controller.spec.ts tests/user-card-media-mutation-queue.spec.ts tests/media-upload-client.spec.ts tests/ios-video-share.spec.ts
npx playwright test --config playwright.media-collection.config.ts
npx playwright test --config playwright.media-collection.config.ts media-collection.browser.ts
npx playwright test --config playwright.media-collection.config.ts --project webkit -g 'failed fetch offers retry'
npx tsc --noEmit --incremental false
# Targeted ESLint --max-warnings 0 over every changed source/test/config file.
git diff --check
```

The isolated build reuses the inactive export `/private/tmp/switchplay-phase6-build-nwbhzlf7`, updated with current sources, without `.env.local` or database credentials:

```sh
SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= PHASE2_BROWSER_TEST=0 SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=0 GROUP_MEDIA_PRIVATE_PROVIDER_VERIFIED=0 NEXT_TELEMETRY_DISABLED=1 npm run build
```

Logs are `/tmp/phase7a-{unit-final,regression,history-final,order-final,legacy-final,append-regression,personal-unit,browser,browser-final,share-final,typecheck,lint,build-final}.log`. No full repository suite was required.

## Changed files / scope

- New `src/lib/mediaCollection/{contracts,ownerHistory,controller,transport,presentation,operations,invalidation,videoFile}.ts` and `src/components/media/useMediaCollection.ts`.
- New owner history and Group MP4 file routes; additive Group thumbnail and bidirectional feed contracts.
- Existing `BackCardFaceContent`, `BackCardMediaCarousel`, `DeckDetail`, `useWorkingDeck`, `WorkingCardMediaViewer`, `CardMediaViewer`, `CardMediaViewerVideo`, `CardMediaDownloadButton` and media URL/client/layout adapters.
- Optional Personal upload timestamp and projection handling in `media.ts`, `cards/{repository,personalHistory,personalHistoryProjection}.ts`; compatible optional R2 upload-header argument.
- Narrow Group contextual-reference reservation denial; existing Group media repository/reads/http route extensions.
- Four new Node test files, one browser test, isolated browser config, and the narrowly corrected existing share-error locator.
- Engineering-plan Phase 7 checkpoint status and this handoff.

No production Framework, Card/Deck CSS/geometry, calculation, reflection/Info feature, database schema migration, collection rename or provider configuration changed. No new media collection is introduced; source presentation data is not written to Personal CardData. The initial tree was clean and unrelated work was preserved.

## Checkpoint B and limitations

B must approve and implement only the remaining presentation decisions: older count, Private/context labels, Delete/Hide controls, and own/Group-wide upload affordances. Group surface mounting awaits those decisions rather than showing private items without their mandatory treatment. B should use these hooks/transport and the existing gallery; it does not need new storage or a second viewer.

Normal Personal views preserve a legacy owned-media fallback while collection data is loading/unavailable; the controller exposes errors rather than treating failed reads as successful empty histories. Existing Working DTO arrays remain a compatibility source, not a claim that all legacy bootstrap reads are now paginated. New Group history and collection pages are bounded. The separately approved Personal metadata-migration threshold and release gates remain unchanged.

Phase 6 uncertain provider allocations can still require operator reconciliation; there is no new allocation/cleanup worker or guaranteed remote deletion. Real private-origin/CORS/signed-video checks remain unperformed and separately authorised. **No live participant media should be enabled from these mocked checks.** No product decision beyond the four B presentation questions was introduced. No Group Info, reflection or later-phase work began.
