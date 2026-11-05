# Phase 6 — Group media foundations

> **Historical configuration superseded, 5 November 2026:** `SWITCHPLAY_GROUP_EXPERIENCES_ENABLED` and `GROUP_MEDIA_PRIVATE_PROVIDER_VERIFIED` have been removed. Any disabled-feature behaviour, environment assignments or certification requirements below record the earlier implementation, not current setup instructions. Group functionality uses normal permissions; provider tests are verification rather than a runtime certificate. Bucket/delivery configuration is unchanged. The18 Group indexes must exist before deploying the flag-free build against Atlas. See the [current gate-removal handoff](group-experience-gate-removal-handoff.md).

## Status / Resume here

Implementation and automated verification are complete on `feat/group-experience`, starting from clean `ec863dedecfe567ca4917cad1a9caf5a2de85aec` (the committed `groupCardData` rename). The final isolated production build passed. This handoff accompanies the dedicated Phase 6 commit, `feat (group experience): add protected group media foundations`. Phase 5 was already complete and accepted. Stop after the Phase 6 commit; Phase 7 has not begun.

No persistent database, production media, provider configuration or existing review server was modified. Ordinary local development may use Atlas through `.env.local`; all database tests below instead owned disposable MongoDB replica sets. The build used an isolated source export without that environment file.

## Implemented contract

`groupMediaContributions` is the only new collection. Its records contain stable contribution and operation IDs, immutable authenticated author/Card/Group/Deck origin, captured member epoch and selected version/adoption revision, trusted provider allocation, content type/size, server timestamps and a contribution revision. Lifecycle (`pending`, `attached`, `deleted`) is independent of `groupVisible`. Personal `users.cardsData.mediaItems` and all existing learning/assessment data remain unchanged. No personal Deck or CardData is created for a Group-only author.

The repository reuses existing Group membership/peer policy, selected-Card validation, transactions and member fences. Creation/attachment fence the actor and current Admins, following the established Group-assessment adoption guard, so another Admin cannot adopt conflicting content across attachment. No extra lock/revision field was added to an existing Group document.

### Allocation, attachment and retries

- Allocation accepts an operation ID, access epoch, selected Card version, kind, content type and size. It reserves one contribution per authenticated author/operation, with a hash that rejects reuse for another Group/Card/request.
- Provider allocation is claimed once and occurs outside transaction retry callbacks. Concurrent retries cannot allocate a second file. Known allocation results are reused; final attachment is idempotent and assigns `uploadedAt` once.
- Upload proofs bind purpose, authenticated author, exact contribution/Group/Card, asset, epoch/version/adoption and submitted metadata. No client uploader, timestamp or arbitrary asset URL is accepted. Readiness independently verifies provider metadata and protection.
- Final attachment rechecks current authority, selected scope, captured epoch and contribution state/revision after provider work. Removal, remove/rejoin, adoption, creator deletion and duplicate completion cannot resurrect or reassign an upload.
- A lost/failed provider allocation response is explicitly uncertain. The operation is not blindly repeated: HTTP 503 includes its owned `contributionId`, `outcome: uncertain` and `retrySameOperation: true`. Repeating the same operation can recover a persisted result; it does not issue another non-idempotent Stream allocation. Owner status exposes the reservation revision even if no locator was recovered, allowing cancellation after membership loss.
- If the process/provider loses an allocation result before its locator is stored, automatic recovery/physical purge is not guaranteed. The reservation remains safe, cannot attach, and may require operator reconciliation against provider metadata. No scanner, worker or new service was introduced.

### Ownership, visibility and deletion

Owner history queries exact authenticated author/Card across all origins, independent of current membership, personal CardData or origin activity. It returns attached items only, including hidden items. Origin names use one bounded identity lookup, not one query per Group.

Group feeds query only the exact Group/Card, attached state and current visibility in MongoDB. An inspected subject adds an exact author filter and existing active-Follower/peer checks. The Group-wide feed retains visible former-member contributions. No personal CardData is retrieved for these reads.

Group Admin hiding is a revision-checked visibility change; it does not erase the record, revoke author access or call the provider. Creator deletion requires immutable ownership, not Group or application Admin status. It tombstones first, strips upload credentials/display timestamp, preserves the asset reservation and then attempts bounded provider cleanup. Hidden/deleted items cannot be restored by stale commands. There is no unhide or cross-Group sharing operation.

Deletion acknowledges logical success independently of provider/cleanup-acknowledgement failure. Cleanup state is `pending`, `failed` or `succeeded`; another exact owner DELETE retries it. Provider not-found is successful. While an issued upload permission remains live, cleanup remains pending for a later retry even after an observed provider DELETE. In-flight transfers, cached bytes and previously issued bearer links are not remotely recalled. There is no eventual-purge guarantee without another request/operator action.

### Protected delivery and legacy boundaries

- Group images use `CLOUDFLARE_R2_GROUP_MEDIA_BUCKET_NAME`, distinct from canonical and personal buckets. Conditional PUT binds the stable object key, length/type and author/Group/Card/allocation metadata. There is no public delivery URL; the application streams the authorised image.
- Group Stream allocation always requests signed URLs, uses the existing 150-second limit and records immutable contribution metadata. Status, playback and download verify actor/origin and signed protection. Existing signed playback and MP4 download helpers are reused with bounded provider requests.
- Provider cleanup validates the dedicated locator and provider provenance, refuses legacy/shared/wrong-owner assets, and runs only after creator deletion. Hiding never invokes cleanup.
- Delivery reauthorises after provider latency. Responses include contribution revision and relevant access/structure/adoption headers, with private/no-store handling. Previously issued video grants retain the approved one-hour maximum lifetime.
- Existing personal/canonical/Info attachment and generic playback/status/delivery boundaries deny reserved Group asset identities, including Stream hex casing and encoded/aliased R2 paths. Reservations survive deletion. This does not implement Group Info Cards or change existing Info ownership.

Provider details were checked against the existing implementation and Cloudflare's [direct creator upload contract](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/) and [R2 S3 conditional-operation support](https://developers.cloudflare.com/r2/api/s3/api/). No live provider request was made.

## APIs ready for Phase 7

All routes authenticate the session actor, reject a mismatched initiating-viewer header, and preserve private/no-store responses. Mutation bodies use explicit field allowlists; cross-site/origin mutation requests are rejected.

| Endpoint | Contract |
| --- | --- |
| `POST /api/group-experiences/:experienceId/cards/:cardTemplateId/media` | Allocate using `{operationId, accessEpoch, version, kind, contentType, size}`; returns stable identity/revision, upload URL/headers and bound proof, or explicit owned allocation uncertainty. |
| `POST /api/group-experiences/:experienceId/cards/:cardTemplateId/media/:contributionId/commit` | `{expectedRevision, proof}` attaches the verified exact allocation. |
| `GET /api/group-experiences/:experienceId/cards/:cardTemplateId/media` | Group feed; optional `subjectUserId`, `after`, `limit`. Current Group scope and peer policy enforced. |
| `PATCH /api/group-experiences/:experienceId/media/:contributionId` | Admin hide with `{expectedRevision, accessEpoch}`; visibility only. |
| `GET /api/group-media?cardTemplateId=…` | Owner contribution history across origins; optional `after`, `limit`. No originating membership requirement. |
| `GET /api/group-media/:contributionId` | `action=playback`, `status` or `download`; owner authority by default, or explicit `experienceId` and optional `subjectUserId` for Group authority. Download GET reads preparation status. |
| `POST /api/group-media/:contributionId?action=download` | Authorised MP4 preparation, using the same explicit authority parameters. |
| `DELETE /api/group-media/:contributionId` | Owner-only `{expectedRevision}`; logical deletion plus bounded cleanup/retry. No originating membership requirement. |

Metadata pages are bounded to 30, sorted by `(uploadedAt DESC, contributionId DESC)`, with total count and context-bound cursor. DTOs expose stable typed source identity, revision, origin, visibility and contextual application delivery URL; upload credentials/provider locators do not enter feed DTOs. Phase 7 can derive Private as a different origin or hidden in the currently viewed Group. Foreign payloads never enter the ordinary personal working store. Owner routes remain available if Group navigation is operationally disabled.

Explicit `createGroupExperienceIndexes` now provisions the media indexes; `createGroupMediaIndexes` can provision just this foundation on an independently approved target. Requests assert readiness and do not provision indexes. Unique contribution, author/operation and provider/asset reservations accompany the author/Card and Group/Card/state/visibility chronological indexes. Existing Group readers do not depend on media-index readiness.

## Verification

Tests preceded the implementation: the initial integration run failed on the missing media repository. Coverage was then expanded without weakening existing assertions.

| Check | Actual result |
| --- | --- |
| New provider/route tests and selected existing media unit regressions | **34/34 passed**. |
| Cumulative Group lifecycle/API, Phase 6, personal media and protected-media integration selection | **66/66 passed**, disposable MongoDB, mock providers. |
| Existing Info, personal Info and Card fork integration selection | **63/64 initially passed**; one existing attach/delete test reported an expected rejection before attaching its assertion handler. Handler timing corrected without changing the expected error/state. Isolated rerun **1/1 passed**. The other 63 checks were not unnecessarily repeated. |
| Final Phase 6 integration rerun after recovery/revalidation changes | **19/19 passed**. |
| TypeScript | `npx tsc --noEmit --incremental false` passed. |
| Targeted ESLint | Passed with `--max-warnings 0`. |
| Production build | Final isolated `npm run build` passed, including route compilation and TypeScript. |
| Diff validation | `git diff --check` passed. |

Key assertions cover independent ownership/visibility, Group-only Admin uploads, no personal writes, active/removed/rejoined members, provider latency, deletion versus completion, hide versus deletion, parallel retries, immutable origin/proofs, post-membership owner deletion, cleanup failures/acknowledgement loss, exact source isolation, peer permissions, allowlisted foreign metadata, owner queries without membership joins, cursor boundaries and actual indexed query plans. Provider tests cover private-bucket gating, conditional upload metadata, signed-only allocation/readiness, wrong-owner/locator cleanup denial, not-found, protected image streaming and signed playback/downloads. HTTP tests cover actor binding, feature gates, uncertain reservations, no-store responses and mutation origin checks.

The integration runner occasionally force-stopped its own disposable Mongo child after a graceful shutdown timeout; no unrelated process was stopped. Earlier type/lint failures were limited to new test helper typings/naming and were corrected. No failing assertion remains unresolved after the targeted Info test correction.

Exact commands:

```sh
node --import tsx --test tests/group-media-providers.test.ts tests/group-media-routes.test.ts tests/protected-media-route.test.ts tests/protected-media.test.ts tests/media-images.test.ts tests/personal-media-mutations.test.ts tests/info-cards-media.test.ts tests/info-card-upload.test.ts
node --import tsx --test --test-concurrency=1 tests/group-media.integration.ts tests/group-experience.integration.ts tests/group-experience-lifecycle.integration.ts tests/group-experience-api.integration.ts tests/protected-media.integration.ts tests/card-media-access.integration.ts
node --import tsx --test --test-concurrency=1 tests/info-cards.integration.ts tests/personal-info-cards.integration.ts tests/card-forks.integration.ts
node --import tsx --test --test-name-pattern='attach/delete race' tests/info-cards.integration.ts
node --import tsx --test tests/group-media.integration.ts
npx tsc --noEmit --incremental false
npx eslint --max-warnings 0 src/lib/groupExperiences/media src/lib/groupExperiences/indexes.ts src/lib/cards/repository.ts src/lib/infoCards/media.ts src/lib/infoCards/mediaRegistry.ts src/app/api/group-media 'src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/media' 'src/app/api/group-experiences/[experienceId]/media' tests/group-media.integration.ts tests/group-media-providers.test.ts tests/group-media-routes.test.ts tests/info-cards.integration.ts
git diff --check
# Only in /private/tmp/switchplay-phase6-build-nwbhzlf7, no .env.local:
SWITCHPLAY_DATABASE_MODE=disposable MONGODB_URI= MONGODB_DB= PHASE2_BROWSER_TEST=0 SWITCHPLAY_GROUP_EXPERIENCES_ENABLED=0 GROUP_MEDIA_PRIVATE_PROVIDER_VERIFIED=0 NEXT_TELEMETRY_DISABLED=1 npm run build
```

Logs: `/tmp/phase6-{unit-final,regression,compatibility,info-race-final,media-final,typecheck-final,lint-final,build-final}.log`. The full repository/browser suites were not run: there is no visual/client change, and the targeted tests exercise the affected storage, provider and HTTP boundaries. Physical iPhone review belongs to Phase 7 gallery integration.

## Files changed

- New `src/lib/groupExperiences/media/{model,contracts,indexes,proof,providers,registry,repository,reads,http}.ts`.
- Five new route files: Group Card media allocation/feed and commit; Group contribution hiding; owner history; contribution status/delivery/deletion.
- `src/lib/groupExperiences/indexes.ts`: explicit media provisioning.
- `src/lib/cards/repository.ts`: deny reserved Group assets in personal/canonical/fork attachment paths.
- `src/lib/infoCards/{mediaRegistry,media}.ts`: shared alternate-route denial and Info attachment/delivery protection.
- New `tests/group-media{.integration,-providers.test,-routes.test}.ts`.
- `tests/info-cards.integration.ts`: promptly handle its existing expected concurrency rejection; assertions unchanged.
- Engineering-plan Phase 6 status and this handoff.

No completed Card/Deck/Progress presentation, media gallery, learning/assessment calculation, personal storage shape or permissions unrelated to reserved Group assets changed. The existing rename is retained. Organisations work and existing review worktrees/services are untouched.

## Release gates and next phase

Real provider verification has **not** been performed or authorised here. Before participant uploads:

1. Independently approve/provision the target database indexes; no persistent target was touched in this commission.
2. Configure a dedicated private R2 bucket with both public origins/custom domains disabled, distinct from existing buckets; verify authorised streaming and direct unsigned denial.
3. Verify signed-only Stream manifests/thumbnails/MP4s, browser PUT metadata/conditional-header CORS, and creator deletion using explicitly authorised disposable assets only.
4. Only after those checks, set `GROUP_MEDIA_PRIVATE_PROVIDER_VERIFIED=1` alongside the existing protected-media configuration. The public-image trial setting cannot bypass this gate. No such configuration change was made.

The approved one-hour bearer-link/cache limitation and bounded best-effort cleanup remain. An unknown provider allocation can require manual reconciliation; no duplicate allocation or automatic Personal fallback occurs. Legacy public image hosting is not changed or certified by this work.

Phase 7 can now consume the owner/Group feeds, source identities, upload lifecycle and protected delivery APIs. Combined personal/Group gallery adapters, source-aware merge windows, new personal upload timestamps, Private labels, UI invalidation and media controls remain Phase 7 work. Group Info Cards, reflections and all later phases remain unimplemented. There is no unresolved product decision blocking these Phase 6 foundations.
