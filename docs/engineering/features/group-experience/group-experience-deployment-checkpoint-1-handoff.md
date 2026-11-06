# Group Experiences — Deployment Checkpoint 1

> Follow-up: the four approved corrections, updated Preview and final verification are recorded in [the iPhone corrections handoff](group-experience-iphone-corrections-handoff.md). This document retains the original checkpoint/investigation evidence.


## Status and boundaries

Implementation, Atlas setup and automated verification complete; final Preview READY; CORS and real-browser upload/removal verification complete; physical iPhone acceptance pending, 6 November 2026, on `feat/group-experience`, starting from clean commit `7d6102c` (the two unnecessary environment gates are already removed). No commit or push is authorised before founder review. No existing review service/data is reset. This checkpoint changes Group image bucket selection and verifies deployment foundations; the wider media-security project, bucket public-access changes, existing Stream protection changes and Info/Organisation work are excluded.

## Implementation

- Group images now use `CLOUDFLARE_R2_USER_DATA_BUCKET_NAME` (`path-user-data`). No Group-specific bucket setting is required.
- Preserve `group-media/{contributionId}...` keys, immutable contribution/author/origin, conditional signed PUT, exact metadata/type/length checks, app-mediated delivery, revision checks and creator cleanup.
- Remove the obsolete dedicated-bucket configuration error. Missing genuine configuration still fails.
- Real-provider testing found that Stream DELETE can return200 with an empty body. Cleanup now accepts that successful acknowledgement (and204), retains provenance checks and rejects403/negative JSON. Regression tests reproduce the former false cleanup failure. No video privacy settings or delivery design changed.
- `.vercelignore` excludes generated builds, local environment/tool credentials and disposable fixture/test metadata. A CLI dry run originally included254MB of `.next-phase2` files; the corrected upload excludes them.
- Keep Group rows separate from `users.cardsData.mediaItems`; Admin hiding changes only Group visibility. Personal upload/delivery and Group Stream operations are unchanged.
- Provider tests cover shared storage, exact cleanup targets and refusal to delete Personal/wrong-contribution keys. Integration assertions retain the trusted locator across hiding and verify separate contribution persistence.

## Persistent inventory and authorised index provisioning

Read-only preflight verified `cluster0.oc5abhg.mongodb.net`, database `switchplay`, using the existing production database guard. All seven Group collections and legacy `groupCardState` were absent. There were no persistent Group contributions to migrate.

R2 listing succeeded for `group-media/` in both configured buckets (`path-user-data`, `path-assets`): zero objects, not truncated. No dedicated Group bucket is configured locally. Account-wide bucket listing is forbidden with the available token, so an unknown bucket/orphan outside the two configured buckets is not certified absent. No existing objects were altered or abandoned.

The authorised operation called the current `createGroupExperienceIndexes(db)` helper after capturing its exact definitions and confirming no existing Group index/name conflicts. It created **18 indexes across seven collections, including 11 unique indexes**. All current core/media/reflection readiness assertions passed; exact keys, names, uniqueness and partial-filter definitions were checked. At index-provisioning verification all seven collections remained empty. Subsequent normal hosted smoke testing created the explicitly identified review Group and contribution below. Unrelated collection indexes were compared before/after and unchanged. MongoDB also creates the ordinary `_id_` index on each new collection; these are not counted among the18 application indexes. The index-provisioning operation inserted, deleted, migrated and seeded no application records.

| Collection | Application indexes |
| --- | --- |
| `groupExperiences` | `group_identity`, `group_create_receipt` |
| `groupExperienceMembers` | `group_member_identity`, `group_admin_entries`, `group_assignments`, `group_roster` |
| `groupCardData` | `group_learning_identity` |
| `groupOperationReceipts` | `group_operation_identity` |
| `groupRemovalLearning` | `group_removal_identity` |
| `groupMediaContributions` | `group_media_identity`, `group_media_operation`, `group_media_asset`, `group_media_owner_history`, `group_media_shared_history` |
| `groupReflections` | `group_reflection_identity`, `group_reflection_slot`, `group_reflection_owner_history`, `group_reflection_shared_history` |

Local evidence: `phase2-test-results/deployment-checkpoint-1/inventory.json` and `atlas-indexes.json`. The task-local scripts use existing credentials without printing them. Application requests still never provision indexes.

## Real R2 verification

The actual Group provider allocated one tiny disposable PNG in `path-user-data`, uploaded through the signed PUT (200), rejected a second conditional upload (412), verified object metadata/status, streamed the same bytes through provider delivery, returned download attachment headers and deleted exactly that object. A final HEAD confirmed404. This used no Atlas contribution row. It verifies provider operations, not hosted application authentication or browser-upload success.

**Initial result, superseded by the founder CORS correction below:** Group-header CORS preflight failed403, without an allowed-origin header, for `https://www.switchplay.ie`, `http://localhost:3000` and the actual Preview origin. The corresponding Personal-only `Content-Type` preflight succeeds204 for the website and localhost; the existing rule therefore lacks the Group metadata headers. Both Personal and Group preflights fail403 for the new Preview, which also needs an allowed-origin entry. Evidence: `phase2-test-results/deployment-checkpoint-1/preview-cors.json`. Bucket CORS inspection returned `AccessDenied`403; account-wide R2 management returned authentication error10000/403. No CORS or public-access settings were modified. A successful API PUT bypasses browser CORS and is not reported as browser success.

**Completed by founder on 6 November 2026 for the first Preview:** updated the existing `path-user-data` CORS array in Cloudflare for the first Vercel review origin and website. Preserve other clients/rules. Required request headers:

```json
{
  "AllowedOrigins": [
    "https://switchplay-app-kb5ql4p52-peter-meehan-domokos-projects.vercel.app",
    "https://www.switchplay.ie"
  ],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": [
    "Content-Type", "If-None-Match", "x-amz-meta-creator",
    "x-amz-meta-contribution-id", "x-amz-meta-experience-id",
    "x-amz-meta-card-template-id"
  ],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

`Content-Length` is bound by the presigned upload and supplied by the browser itself; it is not a custom JavaScript request header. The founder confirmed the rule was applied while preserving other rules and public-access settings. Fresh preflights now pass204 with the correct origin and all six Group headers for both the actual Preview and `www.switchplay.ie`. Personal PUT preflights also pass for both. At that first check localhost Personal passed and Group metadata was unpermitted. The final founder correction also permits localhost Group headers, verified204 on 6 November. That verifies the first Preview origin only. Actual browser uploads there passed in both engines. The corrected deployment has a new immutable URL; its CORS status and remaining action are recorded below.

## Real Stream verification

The actual Group provider uploaded a disposable existing sample clip, verified original author/Group/Card metadata and signed protection, fetched the signed manifest and thumbnail, prepared/fetched the signed MP4, and removed the exact clip. Final GET confirmed404. Initial checks exposed the empty200 cleanup parsing defect; the first two clips were independently confirmed404, and the final full check passed including cleanup. No existing Stream assets/settings were changed. Evidence: `phase2-test-results/deployment-checkpoint-1/stream-provider.json`.

## Vercel access

The initial saved CLI credential existed but the read-only `GET https://api.vercel.com/v2/user` returns403, code `forbidden`, message `Not authorized`. That initial token alone could not inspect hosted settings. The subsequent CLI login resolved access, as recorded below. There is no root `.vercel/project.json` link. Historical maths proof projects are separate and must not be used as the Group application target.

**Resolved:** founder completed `vercel login`; the installed CLI authenticated as `peter-meehan-domokos`. The existing application is `switchplay-app-ie`, project `prj_DJ3l13AXX5vhETO9uZ77A28BcC5E`, scope `peter-meehan-domokos-projects`, Production domain `www.switchplay.ie`, Node24.x. Both Preview and Production contain all15 required variable names; neither removed gate, dedicated Group bucket variable nor fixture-provider settings is present. Protected-media value1 was verified. Other target settings are Vercel `sensitive` values and are not retrievable; do not interpret unavailable values as mismatches.

Automatic approval review rejected bulk downloading Preview secrets. No secrets file was created; the safer follow-up checked names and only five non-credential settings. This did not retrieve MongoDB credentials, session secrets or provider keys.

The authorised Preview deployment uses existing project credentials plus explicit approved NON-SECRET deployment/build values: `MONGODB_DB=switchplay`, `SWITCHPLAY_ATLAS_HOST=cluster0.oc5abhg.mongodb.net`, `SWITCHPLAY_DATABASE_MODE=production`, `CLOUDFLARE_R2_USER_DATA_BUCKET_NAME=path-user-data`. These apply only to this Preview and preserve Production settings. The existing database guard rejects a stored URI that does not match the approved target. No project environment variable was added or changed. Before a later Git-triggered deployment or Production promotion that does not include these per-deployment overrides, confirm those four stored settings match the values above in the relevant Vercel environment. Their names were verified, but their sensitive stored values could not be inspected. This is a configuration-verification limit, not a demonstrated mismatch; the current Preview target is verified by its explicit settings, database guard and real requests.

First Preview, now superseded, created from the isolated source export without Git commit/push or Production promotion: `dpl_Hq3m8cWbKTLkHmtrBLWax5CxjV9W`, `https://switchplay-app-kb5ql4p52-peter-meehan-domokos-projects.vercel.app`. The deployment reached **READY**; the Vercel `npm ci` / standard `npm run build` completed successfully on Node24.x in approximately three minutes. Hosted status/logs independently confirmed READY; initial CLI JSON wording alone was not used as evidence. Vercel Authentication is enabled and preserved.

## Hosted API smoke and review data

The actual Preview was authenticated using the existing Joe account. Anonymous Group reads return401; authenticated My Decks, Library, published Deck preview, Group listing/creation, roster, summary, Card reads, Group Progress page and Update-review endpoint return200. Settings PATCH, Group Step completion/confidence saves, shared collective reflection save and subsequent read passed. Joe is Admin-only in this new Group; an individual Follower request correctly returns403.

One Group was created through normal application APIs: **Galway U18 review**, experience `738ebc9c-6a48-4148-8d89-7928d4cf7ce1`, using existing published `deck-001`, first Card `44c3fa5a-1aeb-4502-aa26-fbc504cfaad4`, version1. No new users or source Deck/Card publications were seeded or altered. The initial Group API smoke image `deployment-image-check.png`, contribution `9e388223-90ad-49e0-9678-f363c1cbbc37`, is retained for review. Its hosted allocation, signed PUT, metadata-verified attachment, Group feed, continuous author history, app-mediated image read and download all passed against real R2. This initial transfer used the API client, and is not counted as browser CORS proof.

At initial deployment the review Group contained only Joe as an Admin, without silently creating a follower perspective. This incomplete review setup was corrected on 6 November by adding Rowan and Eamonn as followers, as recorded below. Its collective reflection is “Our group improved its balance and passing together today.” Only this new Group received test learning/settings/reflection writes. Existing user histories, source Decks and prior review fixtures were not reset. An initial harness probe incorrectly used GET on the PATCH-only settings route and received405; the harness was corrected and PATCH passed. This was not an application defect.

The hosted smoke used one existing account. Cross-account Admin/Follower, visibility-only removal and actual new-publication adoption were verified in disposable integration/mobile suites; they are not misrepresented as live cross-account tests. Do not modify an existing published Deck merely to manufacture an update for this review.

Evidence: `phase2-test-results/deployment-checkpoint-1/hosted-smoke.json`. No existing account password is changed or printed. Vercel protection remains enabled; the CLI automation cookie is held privately for browser tests.

## Hosted refresh defect and focused correction — 6 November

Actual Vercel UI verification exposed a pre-existing deployment defect that local mock latency did not reveal: a full Group refresh performs multiple sequential reads, each taking approximately1.5–2.2seconds in the deployed environment. The five-second authority lease expired while the next content refresh was still pending. A read-only30second observation measured197/300 samples unverified (66%), temporarily hiding controls and suspending media overlays. Evidence: `/tmp/group-deploy-checkpoint1-authority-monitor.log` (the JSON snapshot was later replaced by the corrected-build run). This is distinct from R2/CORS and must not be presented as a successful final UI acceptance.

A focused correction now renews unchanged authority through the existing authenticated Group endpoint independently of slower content pagination. Request starts are two seconds apart, or immediately after a slower request completes, without overlapping renewal calls. The five-second lease remains measured from request start. Identity, membership/access epoch, structure and adoption revision must still match; changed scopes purge peer rows, confirmed revocation/account changes clear data, delayed reads cannot extend the lease, and older renewals cannot override a newly acknowledged generation. Full content refresh and scalar queues remain unchanged. No new endpoint, database, service, setting, privacy mode or permission is introduced.

Files: `src/components/group-experiences/groupResource.ts`, `GroupExperienceDeck.tsx`, `tests/group-experience-client.test.ts`, `tests/phase2/media-ux.browser.ts`. New tests first failed against the prior implementation. All final focused verification below passed. The five-second lease remains unchanged. A second 30-second hosted observation recorded 7/300 samples unverified (2.3%), one brief initial interval, compared with 197/300 before the fix. This reduces the repeated suspension; it does not promise access verification never briefly expires on a slow connection. Logs: `/tmp/group-deploy-checkpoint1-authority-monitor.log` and `/tmp/group-deploy-checkpoint1-authority-monitor-final.log`.

## Thumbnail refresh defect and focused correction — 6 November

The exact-upload check then established a second client defect: a newly attached image appears in Media Centre but not in the Card's thumbnail strip until reload. The shared controller's refresh deliberately uses an anchored cursor to preserve Gallery selection. Applying that same anchored refresh to the five-thumbnail strip prevents it from following new uploads.

A new controller regression failed against the prior implementation. The correction adds an explicit newest-page refresh option, enabled only by the two existing thumbnail consumers (Personal and Group Card backs). Gallery and Media Centre retain their existing refresh defaults, stable selection and pagination. No permissions, media records, upload lifecycle or UI design change. Tests verify new Group uploads appear in the strip and open the exact uploaded item without reload, then disappear after creator removal.

The initial Chromium harness selected the last thumbnail assuming it was the new upload; it actually opened the retained older one. Retrying with exact contribution identity proved the missing refresh. These failures are retained in `hosted-browser-thumbnail-selection-attempt.json` and `hosted-browser-chromium-retry.json`, rather than counted as passing. Only their exact test uploads were cleaned. WebKit completed its earlier upload/removal flow, but its image-size assertion alone did not prove the exact newly uploaded thumbnail was selected; the strengthened final harness checks contribution identity.

## Final Preview and hosted verification

Final deployment: `dpl_91HZqU9QbcC8rH44sNoaVSMw6VR4`, **READY**, independently confirmed by `vercel inspect --wait`; standard hosted build passed.

```text
https://switchplay-app-opuj2i8iy-peter-meehan-domokos-projects.vercel.app
```

It contains the bucket, Stream cleanup, authority renewal and thumbnail refresh changes. Same project, Atlas database, review Group and credentials; Vercel Authentication remains enabled. No Git commit/push or Production promotion. Final existing-account login and Group read returned200, retaining the same Group. Both mobile Chromium and WebKit passed final-build read/navigation checks: existing image filename/uploader, Gallery decode, authenticated attachment bytes, Gallery close/reopen Centre, Admin settings and Progress/Back. Evidence: `hosted-browser-readonly.json`, `/tmp/group-deploy-checkpoint1-hosted-readonly-thumbnail.log`; screenshots `hosted-chromium.png` and `hosted-webkit.png`. The separate real upload recheck is recorded below and is not inferred from these reads.

The preceding authority-fix Preview (`dpl_93sbpyGXhCTmT9MdhuzHNvbXCy6a`, hostname `switchplay-app-dsh1gxe7e-peter-meehan-domokos-projects.vercel.app`) reached READY and passed mobile Chromium/WebKit read/navigation checks: Group Card, real-image filename and `By: Joe`, thumbnail-to-Gallery, decoded image and exact attachment bytes, Gallery close/reopen Centre, Admin settings and Progress/Back. Evidence: `hosted-browser-readonly-authority-build.json`. After the founder added its CORS origin, Personal and Group preflights passed204 and real browser signed PUT/attachment passed in both engines; WebKit also completed creator Remove and owner-history exclusion. That build does not contain the subsequent thumbnail correction and is not the final review build.

**Final-origin CORS verified, 6 November:** the founder added the final immutable Preview origin. Fresh preflights return204 with the exact origin and all six required Group headers for the final Preview, website and localhost. Personal preflights also pass204 for all three. Existing rules and public-access settings were preserved. Evidence: `preview-cors.json`. Both final exact-upload/Gallery/Remove browser journeys passed; no further CORS action is needed for this build.

**Final real-browser checks passed:** `node --import tsx phase2-test-results/deployment-checkpoint-1/hosted-browser-final.ts`, `/tmp/group-deploy-checkpoint1-hosted-final.log`, evidence `hosted-browser-final.json`. Mobile-width Chromium and WebKit each passed all nine recorded checks: Group Card opens; real signed PUT/CORS; filename and original uploader; exact newly uploaded thumbnail opens Gallery without reload and decodes; authenticated download returns identical attachment bytes; creator Remove through Media Centre; deleted item excluded from owner history; Admin settings opens/cancels; Progress and Back. WebKit recorded no HTTP errors. Chromium recorded one media-read403 for its now-deleted temporary contribution; its required authorised image/read/download assertions all passed. The lightweight response recorder did not capture that request timing, so this is retained as an observation rather than described as a clean HTTP trace. Only the two explicitly identified temporary browser uploads were created/removed; existing review data remains unchanged. Final screenshots are `hosted-chromium.png` and `hosted-webkit.png` in the ignored evidence folder.

Native file-save/share remains physical iPhone acceptance: headless download-event attempts were inconclusive, although the authenticated attachment endpoint returned correct bytes. All earlier test assets were cleaned by exact contribution identity; read-only HEAD checks confirmed all eleven deleted test images absent and the retained review image present (`browser-cleanup-verified.json`); tombstones remain to prevent resurrection. Read-only HEAD checks establish object absence separately from `cleanup: pending`, which may remain when removal preceded signed-PUT expiry. The initial review image is retained. No unrelated objects or user history were cleaned.

Live cross-account/follower scenarios and actual publication/adoption of a newly edited Deck remain physical smoke checks. Disposable automated coverage passed; it is not claimed as real-account testing.

## Exact automated verification

Commands run from the repository or equivalent isolated export (application source matched):

```sh
node --import tsx --test tests/group-experience-client.test.ts tests/group-management-client.test.ts tests/group-assessment-client.test.ts tests/group-personal-assessment-client.test.ts tests/group-media-providers.test.ts tests/group-media-routes.test.ts tests/cloudflare-r2.test.ts tests/media-images.test.ts tests/personal-media-mutations.test.ts tests/protected-media.test.ts tests/protected-media-route.test.ts
node --import tsx --test --test-concurrency=1 tests/group-experience-api.integration.ts tests/group-experience-management.integration.ts tests/group-framework-progress.integration.ts tests/group-media.integration.ts tests/media-collection.integration.ts tests/group-reflections.integration.ts
PHASE2_APP_PORT=4203 node --import tsx scripts/test-phase2.ts --dev --group-experiences --group-media --group-reflections
PHASE11_REVIEW_INFO=/private/tmp/switchplay-checkpoint1-2ekw80um/phase2-test-results/review-server.json npx playwright test --config playwright.phase11.config.ts --grep 'club journey|published Deck adds|own Group history|Admin inspection Centre|Personal icon/count'
PHASE11_REVIEW_INFO=/private/tmp/switchplay-checkpoint1-2ekw80um/phase2-test-results/review-server.json npx playwright test --config playwright.phase11.config.ts --grep 'club journey|published Deck adds|owner media and layout survive|peer inspection is Gallery-only'
PHASE11_REVIEW_INFO=/private/tmp/switchplay-checkpoint1-2ekw80um/phase2-test-results/review-server.json npx playwright test --config playwright.phase11.config.ts --grep 'owner media and layout survive|explicit authority expiry'
npm run typecheck
npx eslint src/components/group-experiences/groupResource.ts src/components/group-experiences/GroupExperienceDeck.tsx src/lib/groupExperiences/media/providers.ts src/lib/groupExperiences/media/http.ts tests/group-experience-client.test.ts tests/group-media-providers.test.ts tests/group-media.integration.ts tests/phase2/media-ux.browser.ts
MONGODB_URI='' MONGODB_DB='' SWITCHPLAY_DATABASE_MODE=production NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA=1 npm run build
git diff --check
```

Results:

- Tests-first bucket selection: four assertions failed under the old dedicated-bucket implementation, then passed after correction.
- Final unit/controller/provider/Personal selection: **67/67 passed**, `/tmp/group-deploy-checkpoint1-unit.log`.
- Disposable MongoDB integration: **92/92 passed**, six suites, `/tmp/group-deploy-checkpoint1-integration.log`. Initial sandbox local-port denial was resolved with authorised process access; no Atlas database was used for these suites.
- Initial mobile selection: **10/10 passed**, full club/account/role/learning/reflection/media journeys, explicit published updates by a non-creator Admin, Personal and own-Group media and Admin visibility-only removal. `/tmp/group-deploy-checkpoint1-browser.log`.
- After the authority fix: **10 distinct final cases passed across Chromium/WebKit**. Six role/update/peer-revocation cases passed in `/tmp/group-deploy-checkpoint1-browser-final.log`. Its two slow-save cases initially failed an obsolete expectation that a slow scalar save must expire authority; that expectation was corrected, and explicit held-authority expiry coverage added. All four affected/new cases then passed in `/tmp/group-deploy-checkpoint1-browser-authority-final.log`. The test still proves genuine expiry disables Group writes and preserves the owner's media; no privacy coverage was dropped.
- TypeScript, focused ESLint, standard local production build and corrected Vercel production build passed. Logs `/tmp/group-deploy-checkpoint1-typecheck.log`, `/tmp/group-deploy-checkpoint1-lint.log`, `/tmp/group-deploy-checkpoint1-authority-lint.log`, `/tmp/group-deploy-checkpoint1-build.log`. A temporary generic test helper typing failure was corrected; final typecheck passed.
- Additional thumbnail controller/operations tests: **10/10 passed**, `node --import tsx --test tests/media-collection-client.test.ts tests/media-collection-operations.test.ts`; `/tmp/group-deploy-checkpoint1-thumbnail-unit.log`. The new anchor/newest regression first failed, then passed.
- Additional mobile thumbnail/Personal regressions: **6/6 passed**. `--grep 'own Group history|Personal icon/count'` passed4/4 (`/tmp/group-deploy-checkpoint1-thumbnail-browser.log`); `--grep 'Group Card upload refreshes'` passed2/2 (`/tmp/group-deploy-checkpoint1-thumbnail-group-browser.log`). Both engines verify new exact-item thumbnails/Gallery without reload and removal refresh.
- Final thumbnail-change TypeScript, targeted lint and standard production build passed: `/tmp/group-deploy-checkpoint1-typecheck-thumbnail-final.log`, `/tmp/group-deploy-checkpoint1-lint-thumbnail-final.log`, `/tmp/group-deploy-checkpoint1-build-thumbnail.log`.
- Hosted real-service API smoke, provider lifecycle and previous corrected-build browser checks passed as qualified above. Final hosted build and mobile Chromium/WebKit read/navigation checks passed. Final-origin CORS and both exact-item browser upload/removal journeys passed. Physical iPhone acceptance remains pending.
- Final read-only Atlas postflight again verified all18 index definitions and `path-user-data/group-media/` locator persistence.

No root development server was used because its configured database is Atlas. Only this task's disposable loopback4203 runner was stopped after checking its PID, command, URL and database prefix. Pre-existing phone review servers/data were preserved. The build export contains no copied environment files; `.vercelignore` dry run excludes secrets and generated/fixture state.

## Changed-file inventory

- `.vercelignore` — exclude local credentials, generated caches and disposable test metadata from CLI uploads.
- `src/lib/groupExperiences/media/providers.ts` — existing user-data bucket; successful empty Stream DELETE acknowledgement.
- `src/lib/groupExperiences/media/http.ts` — remove obsolete dedicated-bucket configuration error.
- `tests/group-media-providers.test.ts` — shared bucket, precise object/provenance cleanup, real Stream response regressions.
- `tests/group-media.integration.ts` — shared-bucket locator persistence and visibility-only hiding assertions.
- `src/components/group-experiences/groupResource.ts` — renew matching authority independently of slow content refresh without widening the five-second lease.
- `src/components/group-experiences/GroupExperienceDeck.tsx` — schedule/coalesce the independent authority rechecks.
- `tests/group-experience-client.test.ts` — slow refresh, revocation, changed scope, request-start expiry and late-generation regression tests.
- `tests/phase2/media-ux.browser.ts` — distinguish fresh authority from explicit expiry; newest-thumbnail, exact-item Gallery and removal regressions.
- `src/lib/mediaCollection/controller.ts` — explicit newest-page refresh, retaining anchored default.
- `src/components/media/useMediaCollection.ts` — pass thumbnail refresh policy on invalidation/poll/focus.
- `src/components/group-experiences/GroupCardBack.tsx` — Group thumbnails follow newest page.
- `src/components/decks/BackCardFaceContent.tsx` — Personal thumbnails follow newest page.
- `tests/media-collection-client.test.ts` — anchored Gallery versus newest thumbnail refresh regression.
- `docs/engineering/features/group-experience/group-experience-engineering-plan.md` — current approved storage/configuration and completed Atlas setup.
- `docs/engineering/features/group-experience/group-experience-phase-6-handoff.md` — mark historical bucket requirement superseded.
- `docs/engineering/features/group-experience/group-experience-gate-removal-handoff.md` — mark subsequent bucket/index setup explicitly.
- `docs/engineering/features/group-experience/group-experience-deployment-checkpoint-1-handoff.md` — this execution record and review handoff.

Task-local operational scripts and evidence remain under ignored `phase2-test-results/deployment-checkpoint-1/`; no secrets were added to tracked files. No Git files have been staged or committed.

## Review followers added — 6 November 2026

On the founder's explicit request, added two existing accounts through the hosted Group Admin member API:

| Account | Group role | Individual follower perspective |
| --- | --- | --- |
| Joe | Admin only | None |
| Rowan | Follower only | Own Card / Me |
| Eamonn | Follower only | Own Card / Me |

The hosted roster confirms exactly two active followers, both `isAdmin: false`; Joe remains `isAdmin: true`, `followerStatus: never`. No accounts were created and no passwords, personal histories, Group settings, media, reflections or learning values were changed. Only the two memberships and their normal operation receipts were added through the existing API.

Read-only application repository verification for both followers passed: default perspective `self`, own Card readable with own-learning write capability, Group Card readable without Group-learning write capability, Admin roster access denied. Joe's aggregate summary loads with both followers. These are server-side role/data checks, not completed browser sign-ins as those users. Their existing passwords differ from the configured Joe review password; no login credentials were changed or claimed verified. Evidence: ignored `phase2-test-results/deployment-checkpoint-1/review-followers.json`.

## iPhone review

Preview (plain text):

```text
https://switchplay-app-opuj2i8iy-peter-meehan-domokos-projects.vercel.app/decks?openExperience=738ebc9c-6a48-4148-8d89-7928d4cf7ce1
```

Sign into Vercel if its existing Preview protection asks, then use the existing **Joe** application account/password. No local `phase2`/Aoife fixture users were seeded into Atlas, and no existing password was changed. Joe remains Admin-only. The review Group now has exactly two followers, Rowan and Eamonn, neither a Group Admin. Use their existing passwords; no credentials were reset.

1. Open Galway U18 review, Card1. Check the saved Group completion/confidence, collective reflection and Progress/Back navigation.
2. Open Media Centre, upload an iPhone photo and a short video, check filename/By attribution, open a thumbnail in Gallery, download/share and remove the owned test upload.
3. Switch to Rowan or Eamonn using that account's existing password. Verify the follower starts in their own perspective, can record their own learning/reflection/media, and sees Group values read-only. No additional follower setup is needed.
4. As Admin, remove the follower upload from Group visibility; switch back and verify its author retains it with the current-Group visibility indicator.
5. Use a separately owned test Deck for publication/explicit Group Update if desired; do not alter an existing published Deck merely to manufacture an update. The full publication/adoption journey already passed disposable Chromium/WebKit acceptance.

Final physical iPhone acceptance remains the founder boundary. Production has not been promoted. No Git commit or push has been made.
