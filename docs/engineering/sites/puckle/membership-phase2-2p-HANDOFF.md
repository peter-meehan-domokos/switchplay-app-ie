# Membership Phase 2 / 2P handoff

## Current state and authorisation

Branch: `site/puckle`. Phase 2 is complete and committed as `2e488c6` (`feat(puckle-membership): phase 2 shared authentication and email`). Phase 1 is `19718b7`.

After the Phase 2 commit the user requested a stop for credit limits; no 2P work was begun then. The latest user instruction explicitly resumes 2P. The earlier amendment authorises its separate tested commit, followed by stopping for manual review. No push, merge, deployment, live database mutation, Phase 3, Phase 7 backfill or `/api/users` deletion.

**Current checkpoint: 2P complete and tested; stop for manual review after its separate commit.** The only uncommitted file at resume was the prior stopping-point update to this handoff. It has been preserved in this history.

## Completed and tested Phase 2

See `membership-phase2-completion.md` for exact functionality/files/configuration. Its commit contains credential preparation, transaction-compatible insertion, verification challenges/proofs, password recovery, version-bound sessions, trusted email transport, isolated fragment-token action HTML and Forgot password UI.

Phase 2 evidence: 485 unit, 31 integration and 7 real-server browser tests passed; typecheck and lint passed (six baseline warnings). No live email/data. Real provider acceptance requires configured senders/origins/key and tracking disabled. Do not reimplement Phase 2.

## 2P implementation and decisions

- `src/lib/userPermissions.ts`: public transaction guard conditionally increments publicPublishingRevision on the current scalar boolean grant. Explicit object/boolean type checks avoid Mongo's array-matching behaviour. Ordinary private capabilities and safeguarding remain separate.
- `src/lib/cards/repository.ts`: guards only public Card and shared internal Deck publication; the latter covers automatic Copy.
- `src/lib/infoCards/repository.ts`: public-only publication guard.
- `src/components/creator/creatorPublicationPresentation.ts`, `src/components/info-cards/infoCardErrors.ts`, `src/components/creator/CreatorCopyTo.tsx`: specific existing feedback only.
- No other existing runtime edits. Existing media, learning, ownership, reference locks, visibility rules and committed receipt recovery remain unchanged.
- New permission integration and browser suites; two existing error tests; old publishing fixtures explicitly identify trusted test accounts. These are disposable fixtures, never real-user grants.
- `scripts/test-phase2.ts`: trusted fixture flags and generated loopback Mongo URI in ignored interactive metadata for manual review.
- Final completion record: `membership-checkpoint2p-completion.md`, including source inventory, verification, operational limits and manual checklist.

## Test results so far

- `npm run test:unit`: 487 passed, zero failures.
- `npm run test:phase2 -- public-publishing-permissions.browser.ts card-reuse.browser.ts`: 9 passed.
- `npm run test:phase2 -- --info-cards info-cards-authoring.browser.ts membership-security.browser.ts`: 31 passed.
- `npm run test:phase2 -- creator-visibility.browser.ts public-publishing-permissions.browser.ts`: 14 passed, including the final two Card/Deck denial-feedback tests. Across the three runs: 49 distinct browser journeys, 54 successful executions.
- `node --import tsx --test --test-name-pattern='grants/revocation|unapproved learner' tests/public-publishing-permissions.integration.ts`: 3 passed. Corrected reader calls and private-fork/receipt behaviour confirmed.
- Final typecheck passed after additions; full lint passed with six unchanged warnings; the last changed fixture also passed targeted ESLint. Diff whitespace check passed.
- `npm run test:integration`: **381 passed, zero failures/skips**, including all 17 final new permission tests. Output `/tmp/puckle-2p-integration.log`. No tests remain running.
- Initial focused new integration run: 14 passed/2 failed due to a test supplying an ID instead of an ID array to publishedSnapshot; corrected. Initial fixture typecheck excess-property error corrected without changing PersonalUser. One old Info release fixture also now explicitly seeds a trusted user before public publication. These were fixture corrections, not relaxed product assertions.

## Commit and resume instructions

The tested 2P work and this final handoff belong in the separate commit titled:
`feat(puckle-membership): checkpoint 2P public publishing permissions`.
Resolve its exact hash with `git log -1 --format='%h %s' -- docs/engineering/sites/puckle/membership-checkpoint2p-completion.md`; the record cannot contain its own Git commit hash. Phase 2 remains `2e488c6` and must not be combined or reimplemented.

At interruption/resume, inspect Git status/log first. If that 2P commit exists and the tree is clean, both authorised checkpoints are done: await the user's manual review. If the final commit was interrupted, inspect/stage only the documented 2P files and commit the already completed/tested checkpoint. No unverified implementation remains. No Phase 3 or live permission backfill is authorised.

## Safety and unresolved items

Only disposable local MongoDB sets and loopback captured mail have been used. No real-user data, permissions or credentials changed. No new indexes/migration/backfill. No extra runtime approval is currently needed. Phase 7's reviewed grants must precede production enforcement deployment; missing grants deny public publication. Physical devices/production deployment have not been tested or authorised here.

Manual local review instructions are in the 2P completion record. Public Join does not yet exist. Git worktree metadata and disposable test sockets may need sandbox escalation; never use a live database as a fallback.

## Pre-commit verification (Claude, 14 November 2026)

Staged diff inspected against the completion-record inventory: 31 files, runtime edits limited to the five approved files plus `userPermissions.ts`; no `/api/users`, auth, seed or learning changes. Guards run only when visibility is public. Re-run by Claude (focused only): message unit tests (27 passed), `tests/public-publishing-permissions.integration.ts` (17 passed, 0 skipped), `npm run typecheck` (passed), `git diff --cached --check` (clean), no secret/env files staged. The full 381-test integration suite and the browser suites were NOT re-run; those figures remain Codex's reported results.
