# Membership Phase 2 / 2P handoff

## Authorisation and current checkpoint

Phase 2 implementation in progress; 2P has not started. Latest user amendment authorises completing, testing and separately committing both checkpoints, then stopping. No push, merge, deployment, live database changes, Phase 3 or Phase 7. `/api/users` remains unchanged.

Branch: `site/puckle`. Starting commit: `19718b7` (completed Phase 1). Working tree was clean at start.

## Completed and verified

- Read the specification, engineering plan, Phase 1 completion and relevant independent-review findings; inspected authentication, transaction helpers, Phase 1 contracts and disposable Next test runner.
- Confirmed cookie contract, legacy credential behaviour, required learning arrays and narrow login-route race fix.
- Read installed Next Route Handler/cookies documentation. Action HTML will bypass RootLayout.

## Current subtask / remaining work

1. Implement shared credential preparation/insertion, session version binding and recovery-safe authentication.
2. Implement bounded email transport, challenge/proof, reset capabilities, isolated action document and request UI.
3. Add/run unit, disposable integration, real-server browser, typecheck and lint checks. Record actual results; commit only when Phase 2 passes.
4. Implement/test the approved five-file public-publishing guard/feedback surface and shared helper; complete and commit 2P separately.

No Phase 2 implementation tests run yet. No database or email operations executed. This handoff is currently the only new file.

## Decisions and boundaries

Reuse Phase 1 collections/contracts and existing Mongo transactions. No index creation in requests. Token signing precedes account commit; login uses the password snapshot's session version. No public registration endpoint. Credentials and tokens must never be logged.

Only existing Phase 2 runtime edits: `src/lib/auth.ts`, login route, AuthScreen recovery link. Phase 6 auth notifications are deferred. Later 2P edits are precisely those authorised by the amendment. Existing unrelated files must be preserved.

## Resume

Read this record, plan sections 2–4/6, completion records and `git status`/recent log before continuing. Never discard partial work. Check whether Phase 2 has been committed before starting 2P. Git metadata writes and disposable local-server tests may need sandbox escalation; never use a live database as a fallback.

## Progress checkpoint — security foundations implemented

Phase 2 only; no commit yet. Added shared credential validation, pre-signed account preparation/transaction insertion, version-bound login/session lookup, email transport/templates, challenge/proof flow, atomic limits, reset workflow, isolated action HTML and Forgot password request UI. Existing runtime edits remain auth.ts, login route and AuthScreen recovery link. Added unit/integration/browser tests and extended the disposable test runner with loopback email capture and membership index setup.

Tests completed: new unit suite 6/6; disposable security integration suite 14/14 (including concurrent attempts/reset, rollback and deliberately interleaved bcrypt/reset). An earlier typecheck passed before the latest test/helper additions. Lint and real-server browser checks are in progress. Re-run final typecheck/lint/full unit checks before commit. No live data/mail used.

Decisions: Resend HTTP adapter with explicit per-site environment sender/origin; real delivery disabled without provider key and confirmation that tracking is disabled. A loopback-only transport is allowed only with disposable database configuration. Provider failures are sanitised and persisted; reset responses stay neutral. Proof expiry is authoritative; transient cleanup equals expiry because no reset/verification renewal lookup is needed. Parent capabilities remain types only. `preparePasswordSession` allows testing the credential-snapshot race without a cookie mock; login writes its already-signed token.

Next: finish browser validation, inspect failures, add missing regression cases, write operational configuration/completion evidence, inspect/stage only Phase 2 files and commit. Do not start 2P until that succeeds.

## Phase 2 validation completed — ready to commit

Full unit 485/485; focused unit 6/6; security/foundation/enquiry integration 31/31; real Next browser 7/7; typecheck passed; lint zero errors/six baseline warnings. Initial browser cookie-fixture failure was corrected; no learning source change. Completion/configuration record: `membership-phase2-completion.md`. Final repeated browser run adds a server-log secret assertion and trusted-origin checks. Before commit confirm it has finished successfully, inspect staged scope and secrets. Commit prefix must be `feat(puckle-membership): phase 2 shared authentication and email`.

Remaining: commit Phase 2, then implement 2P's transactional public-only permission checks, minimal feedback and regression tests. No 2P runtime work exists yet. No live email/database operation has occurred. Provider acceptance remains simulated and is documented explicitly.
