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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
