# Puckle membership — Phase 7 completion (existing-account preparation tooling)

15 November 2026, branch `site/puckle`, on top of the Phase 6 commit `c544df2`. **No live database was read or written.** Everything below was built and tested against disposable in-memory databases. No real manifest exists yet.

## Delivered
- `src/lib/knownUserBackfill.ts` (logic and safeguards) and `scripts/backfill-known-puckle-users.ts` (thin CLI); `package.json` script `backfill:known-puckle-users`; schema and examples in `membership-backfill-manifest.md`. No runtime application, auth, root or learning file changed. `seed:user` untouched.
- **Assessment (`--assess`):** read-only draft manifest for every account: id, username, current permission state, and evidence (isAdmin, created date, counts of non-private published Card/Deck/Info versions, whether a Puckle profile, DOB or approval record exists, learning-array sizes, prior backfill). Every `publicPublishing` is `null`, so the draft cannot be applied until a person decides. No emails, credentials or hashes appear in it.
- **Dry run (default):** per-account actions, conflicts, unlisted accounts and blockers; writes nothing; exit 2 on blockers.
- **Apply (explicit):** all-or-nothing preflight (any unlisted, unresolved, malformed, expectation-mismatch, duplicate or drifted account refuses the whole run before any write), then one transaction per account that re-verifies its preconditions and writes only: `permissions.publicPublishing` (targeted `$set`, never the whole object; `publicPublishingRevision` untouched), allowlisted `safeguarding` subfields, one Puckle profile (unique per account; never overwritten), and the `membershipBackfill` receipt.
- **Safety:** requires an explicit disposition for every existing account; exact `userId` to apply (email/username only resolve in dry runs); unknown manifest fields rejected; DOB source defaults to operator-entered, self-declared only with provenance, assurance stays `none` unless independent evidence is supplied; a differing DOB is a conflict unless a reviewed correction names it (history appended, assurance invalidated); existing approval evidence, credentials, sessions (`sessionVersion`), learning arrays, ownership and publications are never touched; welcome stays ineligible; original source stays `unknown`; email and age are never marked verified. Writes need a disposable database, or production mode plus `--confirm-live <manifestId>`; the shared connection guard additionally refuses any non-approved database.

## Tests
| Command | Result |
| --- | --- |
| `tests/known-user-backfill.test.ts` | 7 pass (manifest validation, permission states, digest, live-write gate) |
| `tests/known-user-backfill.integration.ts` | 13 pass (assessment read-only; dry-run zero writes; apply touches only allowed fields; whole-run refusal cases; repeat no-op; drift refusal after a direct revocation; DOB and correction rules; profiles and A-level null; concurrent learning writes preserved; credentials/session version intact; reviewed grants honoured by the 2P guard without re-login; CLI behaviour) |
| `tests/phase2/backfill-regression.browser.ts` | 1 pass (legacy login and legacy unversioned JWT valid on puckle, switchplay and strat17 before and after; no welcome for a backfilled account) |
| typecheck, lint, unit, related regressions | see the commit message |

## Proposed live procedure (needs your separate approval; none of it has been run)
1. Take a verified backup/snapshot of the live database.
2. Run `--assess` read-only against production (needs explicit authorisation and a read-only credential). Complete the draft: for each account decide `true` (genuinely trusted to publish publicly) or `false`. Accounts with malformed permissions, or whose DOB or Puckle details you want recorded, are listed separately.
3. Save the manifest privately (not in Git); dry-run it against a restored copy, then against production. Review the report line by line.
4. Apply with `--apply --confirm-live <manifestId>` in production mode, then rerun the dry run: every account should read `already-applied`.
5. Only then deploy the permission enforcement (2P), then later open Join (`PUCKLE_JOIN_ENABLED=1`) after Phase 8. Trusted users must never lose publishing between deployments.

## What is missing to prepare the real review
Account-specific evidence needs read access to the live users and publication collections, which this task did not have or use. So there is no list of real accounts, no trusted-account proposals and no accounts needing individual decisions yet. The only inputs required are your read-only access authorisation and your own trust decisions.

## Addendum — isAdmin disposition (separate tooling commit)
The founder's reviewed decisions include `users.isAdmin` values, which the original manifest rejected as an unknown field. The tool now accepts an optional `isAdmin` with a mandatory `currentIsAdmin` precondition (missing / true / false). It is written by targeted `$set` in the same per-account transaction and receipt, refused on mismatch or a non-boolean value, and reported as drift if changed after apply. Dry-run lines now show exact values (DOB, assurance method and evidence, profile name, course and level). Tested on disposable data only. The account-specific manifest and the production dry-run report stay in the gitignored `migration-audit/puckle-live-assessment/`; nothing was applied.
