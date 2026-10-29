# Phase 8 — Migration and Vercel preparation

Status: Stages 1–2 implemented; Stage 3 production database migration and verification
passed on 14 October 2026. Final source review passed; commit approval is pending. The Vercel
project remains paused; deployment and Cloudflare-side changes have not occurred.

## Decisions and source

- Keep Atlas database `switchplay`; rename the five original collections to
  `legacy_<name>` and retain their documents unchanged.
- Keep personal arrays embedded in `users`: `decksData`, `cardsData`, `itemTests`.
- Backup: `/Users/peterdomokos/Documents/Switchplay-Backups/2026-10-13/switchplay`.
  The owner completed `mongodump` 100.16.1. All ten BSON/metadata checksums match the
  reviewed plan. A separate local `mongorestore` test on 14 October restored all 62
  documents with matching identities, BSON types, indexes and collection options.
  Its stopped local instance and database files remain under the ignored
  `migration-plans/phase8/restore-test-7Vds8O/` directory. Only version-information
  `prelude.json` was skipped by the restore tool.
- Dump counts: 41 Decks, 11 users, 5 early-access signups, 4 creator-interest
  submissions, 1 contact submission. No existing new-schema CardData or tests.
  All 17 saved templates match their live templates; 48 snapshots remain in the
  original documents/backup under the historical current-content-only policy.
- The owner explicitly confirmed demo reset for the later-dated user's learning
  fields. Uploaded personal media, auth identities and sharing metadata survive.
- The owner discarded the old `/images/media-traces/gym-trace-01.png` mock image:
  omit its 25 personal-media references from new users only. Do not delete the
  bundled file, change canonical content, or alter backup/legacy references.
- Current reviewed-plan output: 41 Deck roots and versions, 158 Card roots and
  versions, 474 Steps, 11 users, 50 DeckData and 202 CardData, 34 uploaded personal
  media references. Copy all 10 public-form records unchanged. No new memberships.

Historical policy: `codex-phases-1-5-chat.md` lines 104–111, 5056–5088, 6042–6081
and 18756–18762. The later same-database rename strategy supersedes the earlier
separate-database proposal. The original decision to accept an untested restore was
subsequently superseded by the successful focused restore test. Original reset rules
do not apply to subsequent real learning data.

## Tools and retained execution procedure

Existing `migration:plan`, offline fixtures and local-only apply remain available.
New `migration:phase8` uses the existing transformation/graph validation and shared
transactional population. There is no automatic cleanup, reverse migration or
batch journal. Plans contain private authentication/user data: keep them local,
Git-ignored, owner-readable only; do not paste them into chat.

The old plan at `migration-plans/phase8/plan.ejson` is retained but superseded by
`migration-plans/phase8/launch/plan.ejson`, which incorporates the mock-image decision.

Offline plan/review (no database connection):

```sh
npm run migration:phase8 -- --plan \
  --backup /Users/peterdomokos/Documents/Switchplay-Backups/2026-10-13/switchplay \
  --output migration-plans/phase8/launch/plan.ejson
```

Same-plan reruns retain allocated Card/Step IDs and do not rewrite the plan or dump.
Unexpected counts, meaningful outstanding drafts, modern CardData/Item tests,
malformed references or modified backup files stop planning.

**Execution has already completed. Do not rerun the following without new approval.**
Prepare an owner-only credential file outside the repository containing only
`PHASE8_ATLAS_URI` and `PHASE8_ATLAS_HOST`; neither is loaded automatically from
`.env.local`. The URI must be TLS-enabled `mongodb+srv`, match the approved
`*.mongodb.net` host and select `switchplay`. Do not put credentials in command
arguments or reports. The operator needs collection read/inventory/index privileges,
same-database rename, create/index and insert privileges; no deletion is requested.

1. Stop the old application/known writers, including public forms. Downtime is accepted.
2. Execute from the repository root using the actual approved credential-file path:

```sh
node --env-file=/absolute/path/to/private-phase8.env --import tsx scripts/prepare-phase8.ts \
  --execute --confirm switchplay \
  --backup /Users/peterdomokos/Documents/Switchplay-Backups/2026-10-13/switchplay \
  --output migration-plans/phase8/launch/plan.ejson
```

3. The script checks inventory and full original-document hashes before writes,
   refuses collisions/unexpected collections or autonomous-expiry indexes, then renames:

| Source namespace | Retained namespace |
| --- | --- |
| `switchplay.deckTemplates` | `switchplay.legacy_deckTemplates` |
| `switchplay.users` | `switchplay.legacy_users` |
| `switchplay.earlyAccessSignups` | `switchplay.legacy_earlyAccessSignups` |
| `switchplay.creatorInterestSubmissions` | `switchplay.legacy_creatorInterestSubmissions` |
| `switchplay.contactSupportSubmissions` | `switchplay.legacy_contactSupportSubmissions` |

Each rename uses `dropTarget: false`. Renames are sequential, outside the data
transaction. A partial rename requires inspection and separately approved recovery;
it is never silently completed or reversed.

4. Create new standard-name collections plus `cardTemplates`, `cardTemplateVersions`
   and `deckTemplateVersions`, create indexes, then insert all target data in one
   snapshot/majority transaction. Never update legacy documents.
5. Verify target contents/graph, required indexes and unchanged legacy hashes/counts.
   An exact completed target can be acknowledged without writes. Conflicting or
   post-migration edited data is refused. An all-renamed, empty target can be retried
   only by deliberately rerunning the authorized execution command after review.
6. Optional separate read-only verification, using the same approved connection:

```sh
node --env-file=/absolute/path/to/private-phase8.env --import tsx scripts/prepare-phase8.ts \
  --verify --confirm switchplay \
  --backup /Users/peterdomokos/Documents/Switchplay-Backups/2026-10-13/switchplay \
  --output migration-plans/phase8/launch/plan.ejson
```

Exact target comparison is intended before application smoke tests make deliberate
new writes (for example first working-open timestamps/cadence). Once genuine new
state exists, an exact-plan rerun correctly refuses it rather than resetting it.

Stop on errors. Leave failed targets and legacy collections intact. Recovery is
manual: inspect, correct and approve a specific retry. If returning to the old app,
preserve new targets under unused names before approved restoration of original
names; never overwrite them. Any new writes must be retained, not automatically
reverse-transformed. Production/Cloudflare credentials are never needed by local tests.

## Vercel preparation

No `.vercel` project linkage or authenticated Vercel access was present locally.
The owner paused the existing `main` deployment; its public URL returned
503 `DEPLOYMENT_PAUSED` before and after migration. Leave it paused until the new
application is ready and deployment is explicitly approved.
`vercel.json` selects Next.js, `npm ci` and `npm run build`; leave
output-directory override unset. The obsolete GitHub Pages workflow is now a
manual build check and cannot deploy the app. No Vercel CLI or deployment was run.

Configure the Vercel project root to this repository and Node.js 22.x (the local
verification major). MongoDB 7 requires at least Node 20.19; do not use an older
project override. Vercel supports 22.x; no account settings were changed.
Keep production credentials in Production scope; do not copy them into disposable
development or unapproved Preview deployments. Set before building/deploying:

| Variable | Value/purpose |
| --- | --- |
| `SWITCHPLAY_DATABASE_MODE` | `production` (default is guarded disposable mode) |
| `MONGODB_URI` | Approved Atlas SRV URI; secret |
| `MONGODB_DB` | `switchplay` |
| `SWITCHPLAY_ATLAS_HOST` | `cluster0.oc5abhg.mongodb.net`, matching the existing local configuration; reconfirm at execution |
| `SESSION_SECRET` | Strong production signing secret, not the test secret |
| `NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA` | `1`; build-time presentation flag, not a credential |
| `CLOUDFLARE_ACCOUNT_ID` | Existing account |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Scoped bucket credentials |
| `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_USER_DATA_BUCKET_NAME` | Existing local configuration identifies `path-assets` / `path-user-data`; reconfirm provider configuration |
| `CLOUDFLARE_R2_PUBLIC_BASE_URL`, `CLOUDFLARE_R2_USER_DATA_PUBLIC_BASE_URL` | Reference origins; stored URLs remain unchanged even when public delivery is disabled |
| `CLOUDFLARE_R2_LEGACY_ORIGINS` | JSON mapping old origins to `canonical` or `personal`; confirm actual buckets |
| `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_CODE` | Stream upload/status/token configuration |

Do not enable `PHASE2_BROWSER_TEST`, `PHASE2_MEDIA_FIXTURE_ORIGIN` or
`NEXT_PUBLIC_PHASE2_MOCK_MEDIA` in production. `getMongoClient` enforces the
application connection policy, including public-form routes. The dev runner
explicitly overrides production mode/protected delivery while retaining its own
Mongo server, accounts, mocks and cleanup. No indexes/migration run on app startup.

Atlas network access from Vercel and project secrets must be checked under later
approval; they cannot be established from repository files. Keep automatic Vercel
production deployments disabled until the approved execution/deployment point.

## Media preparation and outstanding provider approval

Approved approach: private R2 origins plus a session-authorized image endpoint;
Stream `requireSignedURLs` plus expiring tokens issued after authorization. Code
supports this, but it does not secure publicly available old provider URLs by itself.

- `/api/media/protected` authorizes trusted stored media. Personal media comes only
  from the authenticated user's retained CardData, including archived/source data.
  Owned drafts and readable immutable canonical versions can supply canonical media.
  Public roots do not expose private-era versions; canonical ancestry never grants
  access to another user's personal uploads.
- R2 reads use configured buckets/origins and original keys through the S3 API,
  stream image bytes with private/no-store headers, and never redirect to public
  URLs or fetch arbitrary browser-supplied origins. Old origins can be mapped to
  existing buckets; the dump includes `assets.tebostudio.com`,
  `user-uploads.tebostudio.com` and a historical `pub-…r2.dev` origin.
- Stream thumbnail, iframe and HLS requests receive authorized one-hour bearer
  tokens. This covers the current upload limit. A copied token is usable
  until expiry, as explicitly accepted. Reopening media obtains a fresh token;
  indefinite playback sessions/automatic mid-stream renewal are not implemented.
- New Stream uploads request signed delivery when protected mode is enabled.
  No existing Stream settings or assets have been changed.
- Stored media IDs/keys/URLs are unchanged; only presentation delivery URLs change.
  Bundled public artwork remains public. The explicitly discarded mock image is
  omitted from migrated personal lists, not deleted from disk or original records.

Cloudflare-side security remains separate future work and is not a condition for
the completed database migration or source commit. Before accepting protected
direct access for launch, separately approve disabling public R2 access paths for affected
buckets (including old r2.dev/custom domains), confirming the old-origin bucket map,
and enabling signed URLs for existing Stream assets used by the app. Shared canonical
assets need one consistent policy; signed delivery can serve public content after
the existing authenticated Library authorization. Never delete/copy/rename assets.
Check whether other sites use these origins before changing public access; no
provider configuration was inspected or modified during preparation.

Then verify an old direct R2/Stream URL is denied without authorization, authorized
images/thumbnails/HLS/iframe playback work in Creator/Library/My Decks, and new R2
uploads and Stream processing/playback work. Check cancellation/retry and wrong-user
access using test assets only. Real provider operations remain unperformed.

## Remaining launch review

- The sample Maths Framework's four development Card IDs are not migrated identities.
  Catalogue content/IDs remain unchanged; choose actual mapped Cards using the saved
  migration mapping before expecting real Framework progress. No curriculum is invented.
- Sharing metadata is retained; the previously parked Shared with Me feature remains
  parked. No sharing UI or Phase 9 navigation work was added.
- The backup restoration and production migration have passed. The saved plan and
  verification report retain their original `backupRestoreVerified: false` field;
  this is historical plan metadata, not the current backup-recovery result. Keep
  the plan and its identity mappings unchanged; restoration evidence is separate.
- Deployment and provider changes still require separate approval. Do not resume
  the incompatible `main` deployment automatically.

## Stage 2 verification

| Check | Result |
| --- | --- |
| Focused unit tests: migration, CLI, connection guard, media and existing Phase 2 contracts | 28 passed |
| Disposable-Mongo tests: existing apply, Phase 8 rename/population and media privacy | 12 passed; four affected Phase 8 tests rerun after final policy/index checks passed |
| Existing media component/client tests | 43 passed |
| Connected browser journeys: auth, Creator, Library, media, assessments, archive/restore | 6 passed |
| Typecheck | Passed, including final script/test changes |
| Production build | Passed with MongoDB variables empty and protected presentation enabled |
| Lint | Zero errors, six existing warnings; new files pass focused lint |
| Working-tree/staged diff checks | Passed |
| Backup hashes and plan permissions | All ten BSON/metadata files unchanged; launch plan mode 0600 |

The first sandboxed integration attempt could not bind local ports; the same tests
passed with local-port permission. The browser runner overrides inherited production
mode/protected flags and uses its own Mongo/mocks. A separate interactive dev launch
was refused because an existing Next dev server owns `.next-phase2`; it was not
stopped or cleaned up. Its unauthenticated `/api/auth/me` check returned expected 401.
No full-suite reruns, physical-device checks, backup restoration, live Mongo access,
real Cloudflare operations, Vercel account access/deployment or commits occurred.

Provider configuration references:
[R2 public access](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[Stream signed delivery](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/),
[Vercel environments](https://vercel.com/docs/environment-variables),
[Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Stage 3 execution and verification

The owner explicitly authorized production migration after backup restoration and
paused `https://www.switchplay.ie/`. Final preflight confirmed the approved Atlas
host/database, required permissions, exactly five original collections, matching
source fingerprints and backup checksums. The previously attempted all-user writer
inspection is unsupported by this Atlas tier; pausing the known deployed application
resolved the operational write restriction. No local application server was running.

The existing migration CLI completed the five collision-refusing renames and
transactional population. Its subsequent verification confirmed:

| New collection | Documents |
| --- | --- |
| `deckTemplates` | 41 |
| `deckTemplateVersions` | 41 |
| `cardTemplates` | 158 |
| `cardTemplateVersions` | 158 |
| `users` | 11 |
| `earlyAccessSignups` | 5 |
| `creatorInterestSubmissions` | 4 |
| `contactSupportSubmissions` | 1 |

All five `legacy_` collections retain their original 62 documents and fingerprints.
Exactly 13 collections exist. All target documents match the approved plan, including
474 Steps, 50 embedded Deck states, 202 embedded Card states and 34 retained personal
media references. Ownership, visibility, identity mapping, relationships, foundation
indexes and copied ancillary indexes passed verification. There were no migration
errors or data discrepancies.

Private execution and verification records remain in the ignored
`migration-plans/phase8/launch/` directory. Production has not been accessed again
during final source review. No deployment, provider change or commit has occurred.

## Final source review and commit verification

The final review corrected three in-scope defects: case-insensitive MongoDB TLS
options could bypass the connection guard, asynchronous R2 failures escaped the
route's private error response, and exact-target retries could bypass unexpected
collection checks. Focused regressions cover all three. No identity mappings,
production data, provider settings or application navigation rules were changed.

| Check | Result |
| --- | --- |
| Focused unit tests | 29 passed; affected route test also passed after final lint correction |
| Disposable-Mongo integration tests | 25 passed |
| Media/component tests | 56 passed |
| Connected authentication, Library, Creator, assessment and archive browser journeys | 6 passed |
| `npm run dev:phase2` smoke | Passed unauthenticated/authenticated session checks and My Decks, Library and Progress pages |
| Typecheck | Passed |
| Production build | Passed with production mode, protected delivery enabled and MongoDB variables empty |
| Lint | Zero errors, six pre-existing warnings |
| Working-tree/staged diff checks | Passed |
| Private-file exclusions and configured-secret scan | Passed; migration plans, restore files and `.env.local` excluded |

The sandboxed build stalled during compilation; only that owned build process was
stopped, and the same build passed outside the sandbox. The development smoke and
browser runner owned their separate loopback MongoDB instances and mocked media,
and used their existing cleanup. Existing local databases, the retained restore
test, production collections and both Codex accounts were untouched.

Commit readiness does not approve deployment or unpausing Vercel. Configure the
production variables listed above, deploy the compatible application only after
approval, and verify authentication and application entry before resuming service.
Protected delivery remains enabled: missing bucket-origin mappings or provider
credentials fail closed. Direct provider-URL protection and real upload/playback
acceptance remain separate Cloudflare work. The development Maths catalogue still
contains placeholder Card mappings and needs deliberate curriculum selection before
expecting production Framework figures.
