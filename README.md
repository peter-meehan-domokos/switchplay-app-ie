This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Test baseline

Run these independently from the project root:

```bash
npm run test:e2e   # Playwright: tests/**/*.spec.ts and .spec.tsx only
npm run test:unit  # node:test via tsx: tests/*.test.ts only
npm run typecheck # Clean generated route types, next typegen, then tsc --noEmit
npm run build     # Production build
git diff --check
```

The current Playwright suite tests helpers and rendered components without starting
a browser or application server. The node:test suite requires no live database or
Cloudflare assets. Keep node:test files directly in `tests/` so the explicit command
includes them; fixtures can live in subdirectories.

Run `typecheck` with the development server stopped: it removes only generated
`.next/types` and `.next/dev/types`, then regenerates route definitions with the
installed Next CLI. It does not exclude generated types from TypeScript checking.

Characterisation tests describe legacy behaviour before the first-class Card
refactor. Intentional changes in later phases should update those expectations.

## Read-only migration preflight

Review `scripts/audit-pre-library-migration.mjs`, then run it locally from the
project root against your selected Atlas database:

```bash
node --env-file=.env.local scripts/audit-pre-library-migration.mjs
```

It requires `MONGODB_URI` and `MONGODB_DB`, the existing application variables.
Neither is hardcoded. Missing configuration stops the script before connecting.
You can reuse `.env.local`; none of the other application environment variables
are used. A MongoDB account with the `read` role on the selected database provides
an additional permission boundary. Do not send connection strings or passwords
with the reports.

To exercise the utility without any database connection:

```bash
node scripts/audit-pre-library-migration.mjs --fixtures tests/fixtures/migration-audit-clean.json
node --import tsx --test tests/migration-audit.test.ts
```

Each run creates a unique ignored `migration-audit/audit-<timestamp>-<suffix>/`
directory. `--output DIRECTORY` can choose a different parent; keep custom output
outside version control. Files are created with owner-only permissions.

- `summary.json`: counts, findings by severity/code, drift and readiness.
- `findings.jsonl`: complete exceptions with source IDs and exact paths.
- `review.csv`: the same findings in a spreadsheet-friendly table.
- `summary.txt`: plain-English overview.
- `source-manifest.jsonl`: projected source hashes, Card inventories and sharing
  field fingerprints; no raw learning history or sharing arrays.
- `run-status.json`: `complete`, `incomplete` or `failed`. Only a **complete** run
  is usable; a failed run may leave partial output, which must not be trusted.

For review, send `summary.json`, `summary.txt` and `findings.jsonl` first. Include
`review.csv` for spreadsheet review and `source-manifest.jsonl` for drift/sharing
verification, plus `run-status.json`. These files contain document/template IDs
and hashes and should still be handled as private project data. They omit passwords,
emails, reflections, chat bodies, media descriptions and full asset URLs.

The audit reads only raw current `deckTemplates.template` plus root metadata and
projected user state. `savedTemplate` and `previousVersions` are excluded from the
query and hashes. It does not apply application normalization or Signal fallback.
Providerless legacy images are valid. Empty suggested dates are counted separately
and are valid.

The agreed migration preservation policy retains **personal Card media only**.
Completion, all old signal readings/IDs, obsolete template Signal definitions,
reflections, chats/comments, tests, personal dates and other learning/demo state
will be discarded/reset. The audit only records that policy: it does not perform
any reset. Future completion starts as the application's existing `todo` value;
future readings start as `null` per current Step ID.

Report schema version 2 separates canonical, personal-media, membership, sharing,
audit and discarded-learning-state findings. Discarded learning-state anomalies
are information and never block readiness; legacy signal counts are historical
only and require no interpretation. Orphan personal Card records without media
are non-blocking. Media-bearing orphan/ambiguous records, malformed retained media
and incompatible media references with the same ID/destination block preservation.
Missing/null media arrays contain no stored items; non-array non-null containers
require review because retained media cannot be enumerated safely.

The summary counts media-bearing states, mapped/orphaned/ambiguous destinations,
total/malformed/safe media occurrences and uninspectable containers. Its readiness
checks require safe canonical content, complete retained-media accounting and
unambiguous My Decks membership. Canonical ownership/visibility/content checks,
membership checks and sharing fingerprints remain in place. Legacy full Card-state
source accounting is diagnostic only. Personal media counts describe reference
occurrences rather than unique physical assets; no deduplication is performed.

Atlas mode performs two primary/majority scans. `stable` means no difference was
observed; it is not a transactional snapshot and cannot detect changes that revert
between reads or occur after the verification read. Hashes use canonical decoded
BSON values, ignore object key order and retain array order. The first scan is the
audited source; changes observed in the second scan require a fresh audit. A later
migration must compare source hashes again immediately before proceeding.

Exit codes: `0` means ready or ready with warnings, `2` means blockers/decisions/drift
require review, and `1` means the run failed or could not start. A green exit does
not approve a migration: inspect warnings and verify the selected database name.
Empty reads require review; projected finds cannot distinguish empty collections
from missing collections. No collection metadata privileges are required.
On failure, `run-status.json` records the stage, scan pass, error name, numeric code
and token-shaped code name when available, with a fixed safe explanation. Raw
driver messages, stacks, hosts and connection details are withheld.
Report generation is
the only write activity, and it writes local files only. Mongo operations are
connection setup, projected `find`, cursor sorting/batch
reads and connection/cursor cleanup. No database mutation, asset fetch or repair
operation exists.

## First-class Cards: Phase 1 foundation

The new domain is isolated in `src/lib/cards/`. Phase 2 connects the private
Creator/My Decks/working-Deck UI to these boundaries as described below.
No production cutover has been performed.
The read-only audit is unchanged and remains a separate utility.

`model.ts` defines independent Card/Deck roots and immutable version documents.
Roots hold owner, visibility, `latestVersion`, nullable draft, revision,
timestamps and optional fork provenance (`null` when absent). Published versions
hold `content`, publication metadata and an optional `updateNote`. Cadence is
`{ intervalDays: 7 }` by default; Deck metadata contains `categories`, `themes`
and `labelPrefix`. The pure `layout.ts` seam derives prefix plus position.

Personal state remains inside `users`: `decksData` contains only membership,
positive adopted Deck version, global active Card ID, archive/timestamps and
untouched sharing metadata; `cardsData` contains one retained record per global
Card ID. Personal adoption is never null or zero. CardData
contains completion/signals keyed by Step ID, personal date, reflection, media,
Deck-context chats and Boolean pass/fail tests. The future scheduler is not built;
the date selection primitive supports existing → suggested → generated precedence.

`repository.ts` requires an injected database/client (or its explicit application
factory). Mutations derive owner/data access from persisted records and use
field-level updates. Canonical creation, drafting and fork autosaves create no
DeckData or CardData. Ownership alone never supplies My Decks membership. Archive and
restore change only the archive flag/timestamp; restore preserves adoption.
Concurrent ensure operations insert at most one personal record.

Publication creates the next version, clears only that entity's draft and advances
existing publisher adoption in the same transaction, including archived DeckData.
Other users are unaffected. Public canonical publication alone does not create
membership. First private Deck publication may enter My Decks and initialize
missing CardData; first Card-fork publication may inherit the actor's eligible
source current state and link source-stored personal history. Publication never
deletes learning state or publishes another entity's draft. Public Decks require
actually published public Cards; private Cards are never implicitly promoted.
Effective visibility changes only on successful publication and public content
cannot demote. Private-era immutable versions remain private. Visibility-only
changes count as outstanding work. Empty Decks are valid.

Phase5's approved five-checkpoint contract is in
[`docs/engineering/phase-5-plan.md`](docs/engineering/phase-5-plan.md).
Update review/adoption APIs pin the reviewed eligible publication, preserve current
personal state and return chronological notes. Card adoption is global per user;
Deck adoption preserves already-adopted Cards and initializes only missing ones.
Stale reviews require refresh. Retry outcomes acknowledge current adoption without
replaying writes or undoing archive. Update controls are Checkpoint2 work.

Steps remain embedded. UUID Step IDs are reserved globally by a technical
`CardTemplateRoot.stepIds` array plus a unique partial multikey index. This is an
index reservation, not Step ownership or another entity. Published historical
IDs remain reserved. Initial cross-Card slot swaps atomically transfer both IDs
and are prohibited if either Card or the Deck has published/forked history, or
either Card has ever been reused (`firstReusedAt` remains set after removal).
Same-Card reorder retains identity. UI geometry remains a Phase 2 concern.

Resolution boundaries are `resolveWorkingDeck` (membership/adopted versions),
`resolveCreatorDeck` (owner drafts, foreign published content),
`resolveDeckPreview` (latest versions without personal data) and
`resolveHistoricalDeck` (historical Card pins). Reads batch referenced roots and
versions. Runtime capabilities name template/data owners separately. Working
Card mutation/upload authorization requires an active adopted Deck occurrence.

New personal image helpers generate/validate
`user-cards/{userId}/{cardTemplateId}/{uuid}.{ext}`. Stream asset IDs remain
provider-generated. Migration copies trusted old media verbatim; browser validation
does not accept the legacy namespace. Phase 2 upload routes use the new personal
image identity while retaining trusted legacy references for display.
Delivery confidentiality remains separate deferred work.

The explicit `createFoundationIndexes` operation installs unique Card/Deck IDs,
owner+ID indexes, unique entity+version indexes, the Deck Card-reference index and
the Step reservation index. It is never called by an import or legacy route.
Mongo clients are lazy; transaction callbacks use sequential operations and
`withTransaction`, with no asset operations inside them.

### Migration planning and disposable validation

Create an offline plan (no Mongo connection):

```bash
npm run migration:plan -- --fixtures tests/fixtures/first-class-migration.json --plan migration-plans/review/plan.ejson
```

The `--fixtures` source must be raw JSON/Extended JSON with `deckTemplates` and
`users` arrays. Planning validates sources and the entire target graph. Unknown
authored fields are refused rather than silently lost. Existing plans are reused
only when their hashes/source match; this retains generated Card/Step IDs across
retries. `savedTemplate`/`previousVersions` are excluded from content and drift
hashes. The plan is not an authorization to migrate production.

Planning from a separately restored **local disposable clone** uses `--source`
instead of `--fixtures PATH`, with `MIGRATION_SOURCE_URI` and
`MIGRATION_SOURCE_DB`. It performs only projected Deck reads and raw User reads;
no source writes, indexes or collection renames. The source database name must
start with `switchplay_migration_`.

To exercise writes against a separate local disposable replica-set target, set
`MIGRATION_TARGET_URI` and `MIGRATION_TARGET_DB`, then run:

```bash
npm run migration:plan -- --apply --plan migration-plans/review/plan.ejson
```

Only loopback Mongo hosts and database names beginning `switchplay_migration_`
are accepted. The app's `MONGODB_URI`/`MONGODB_DB` are never used. Production Atlas
apply/rename functionality deliberately does not exist in this Phase 1 CLI.
The target must be empty or exactly match this plan. Conflicting, partial or
subsequently changed targets are refused. All data writes form one transaction;
index setup is explicit before it. Exact reruns are no-ops. Source data stays intact.

Migrated roots/versions start at v1, drafts null, revisions zero. Cards inherit
Deck ownership/visibility; each embedded Card gets its own UUID without semantic
deduplication. Steps get fresh UUIDs. Deck references pin Card v1 historically.
Themes converge to `themes`, labels default to positional `Card X`, and no owner
memberships are invented. Existing DeckData memberships adopt v1; active Card IDs
are translated (stale selections fall back to the first live Card or null).

Only personal media references survive from old Card state. Completion initializes
`todo`, readings initialize `null` per current Step ID, reflection becomes empty,
chats/tests empty and personal dates null. No storage objects/URLs/keys are changed
and no assets are requested. Sharing field presence/values are fingerprinted and
checked exactly. Counts are derived, never hardcoded to the live audit totals.

Plans contain full transformed user records, potentially **authentication/private
metadata**. They are ignored by Git, stored with mode 0600 in private run directories
and must not be pasted into chat. Review `summary.json`/`run-status.json`; the
`plan.ejson` retains mappings, hashes and preservation fingerprints locally.
Application state changed since planning requires a new reviewed plan.

### Foundation verification

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run typecheck
npm run build
git diff --check
```

Integration tests start disposable `MongoMemoryReplSet` instances, never read an
Atlas URI and close clients/servers afterward. First execution may download a
Mongo binary and needs permission to bind local ports. They cover real transaction
rollback, concurrent ensures/publication, publisher adoption, archive retention,
version selection, Step transfer and deterministic migration retry/conflict cases.
Legacy Phase 0 characterization tests remain; the new suite supplements them with
the intentional new rules. The private UI now consumes the new model in Phase 2.

Phase 2 routes the private Creator/My Decks/working Deck slice through these
repositories/resolvers, removes legacy theme-row dragging and disables legacy
shared-progress UI/mutations while preserving sharing metadata.
Production cutover requires a separately
reviewed cutover procedure using the external backup; this CLI cannot perform it.

## First-class Cards: Phase 2 private vertical slice

**This branch is local-only until a separately approved production cutover.**
Application authentication and Card repository factories refuse Atlas/remote
hosts before connecting. Local database names must begin with
`switchplay_phase2_`, `switchplay_test_` or `switchplay_migration_`.
Existing `.env.local` Atlas settings are not a Phase 2 development database.

For a disposable browser review with no Atlas connection:

```bash
npm run dev:phase2
```

The command creates its own local replica set, indexes and test users, prints its
application URL, and mocks R2/Stream service boundaries. Sign in with `phase2` /
`local-test-only`. Ctrl+C stops the app and discards this database. Each run starts
empty; it does not preserve your manual test work. Provider mocks do not prove
real Cloudflare delivery, CORS or encoding. Next output is isolated in
`.next-phase2`; logs and the test-only tsconfig are ignored under `phase2-test-results`.

Creator stores separate Card/Deck drafts with revision checks. First persistence
creates canonical state only. Individual Card and Deck publications
use the foundation transactions and separate optional update notes. Publish and
leave saves first, publishes outstanding Cards, then the Deck. Partial successes
remain published; failures stay in Creator and retries read fresh revisions and
publish only outstanding entities. Visibility controls stage publication intent;
first public publication requires irreversible-publication confirmation. Copy to
reuses Card identity with permanent construction restrictions. Foreign editing
and identity handoff remain Phase5 work. Theme-row dragging remains removed.

My Drafts resolves owned unfinished canonical work independently of membership.
My Decks reads positive adopted DeckData. Archive/restore changes membership without deleting
personal data. Working opens select the exact adopted Deck/Card versions, initialize
the personal cadence anchor once. Add establishes missing CardData before first
open, without cadence initialization. Dates use
existing personal → intrinsic suggested → fixed positional cadence precedence.
Completion and signals are Step-linked; personal mutations use global Card IDs
with field-level updates. Fresh opens supersede cached optimistic snapshots.

The Shared with me and all-user admin progress views are parked. Shared-progress
endpoints and destructive legacy reconciliation return fixed 410 responses before
authentication, lookup or mutation. Unrelated writes preserve sharing metadata.
Legacy pure helpers remain only for characterization coverage; live routes bypass
embedded Card state and template reconciliation.

Verification:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:phase2
npm run typecheck
npm run lint
MONGODB_URI='' MONGODB_DB='' npm run build
git diff --check
```

`test:phase2` owns its database and mocks, authenticates through real application
routes, and exercises Creator, publication failures/retry, personal state/media,
archive/restore, retained adoption and unauthorized access. It ignores any inherited
Atlas URI. Browser traces on failure are under `phase2-test-results/artifacts`.
No application route creates indexes or performs a production migration.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
