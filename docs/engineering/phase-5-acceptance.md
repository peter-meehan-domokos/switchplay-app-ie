# Phase 5 — Checkpoint 5 verification and acceptance

Status: verification in progress; final Phase 5 acceptance requires user review.
Scope is the approved five-checkpoint contract in [phase-5-plan.md](phase-5-plan.md).
No production data, Atlas, migration/cutover, or later-phase implementation.

## Acceptance coverage

| Requirement | Permanent verification |
| --- | --- |
| Independent Card/Deck adoption; chronological non-empty notes; explicit stale-review refresh | `update-adoption.test.ts`, `update-adoption.integration.ts`, `phase2/working-updates.browser.ts` |
| Existing global CardData/adoption/history preserved; missing Cards adopt latest; historical Deck references immutable | `update-adoption.integration.ts`, `library-entry.integration.ts`, `phase2/phase5-acceptance.browser.ts` |
| Duplicate/concurrent adoption, transaction rollback, competing publication/personal writes/Archive/Add, exact retry outcomes | `update-adoption.integration.ts`, `phase2/update-adoption.browser.ts`, `phase2/working-updates.browser.ts` |
| Pending personal saves/uploads/attachments; waiting, retry and cancellation; unsent reflection preserved | `working-updates.test.ts`, `phase2/working-updates.browser.ts` |
| Actor-bound writes and delayed-response isolation; Library canonical-only; private-era authorization | `creator-recovery.test.ts`, `card-version-access.test.ts`, `creator-foreign-session.integration.ts`, `phase2/creator-foreign-session.browser.ts`, `phase2/library-ui.browser.ts` |
| First meaningful edit only; stable visual identity; frozen first command; concurrent foreign edits and detached saves | `creator-foreign-session.integration.ts`, `phase2/creator-foreign-session.browser.ts` |
| Submitted-operation reload recovery; lost acknowledgements; advanced targets and unavailable journals fail safely | `creator-recovery.test.ts`, `creator-foreign-session.integration.ts`, `phase2/creator-foreign-session.browser.ts` |
| Media-first authorization, source/actor/target/slot/asset binding and attachment after identity handoff | `creator-foreign-session.integration.ts`, `phase2/creator-foreign-session.browser.ts`, `phase2/phase5-acceptance.browser.ts` (mock providers only) |
| Mixed ownership; exact foreign selections on reopening; owned Card in foreign Deck remains same identity | `creator-foreign-session.integration.ts`, `phase2/creator-foreign-session.browser.ts`, `phase2/phase5-acceptance.browser.ts` |
| Newer foreign publication review; publication races; Card-before-Deck partial success/recovery; no implicit promotion | `creator-visibility.integration.ts`, `creator-foreign-session.integration.ts`, `phase2/creator-visibility.browser.ts`, `phase2/creator-coordinator.browser.ts`, `phase2/creator-foreign-session.browser.ts` |
| Personal fork inheritance once; source-stored viewer history, media deletion, corruption isolation and recursive chains | `card-forks.integration.ts`, `card-corrections.integration.ts`, `card-review-regressions.integration.ts`, `personal-history-projection.test.ts`, `phase2/fork-foundations.browser.ts` |
| Private Library publication enters My Decks; public Library publication canonical-only; self-use source membership retained | `creator-foreign-session.integration.ts`, `phase2/creator-foreign-session.browser.ts`, `phase2/phase5-acceptance.browser.ts` |
| Library returns to original detail; self-use Publish and leave opens new Deck; save/leave/cancel safeguards | `phase2/library-ui.browser.ts`, `phase2/creator-foreign-session.browser.ts`, `phase2/phase5-acceptance.browser.ts` |
| Foreign Copy reuses identity; selected source preserved; exact retries, clean auto-publication and permanent reuse restriction | `card-reuse.integration.ts`, `creator-foreign-session.integration.ts`, `phase2/card-reuse.browser.ts`, `phase2/creator-foreign-session.browser.ts` |
| Two-stage initialization and targeted first open; existing dates/anchor preserved | `library-entry.integration.ts`, `update-adoption.integration.ts`, `phase2/library-ui.browser.ts`, `phase2/working-updates.browser.ts` |
| Mobile/desktop geometry, attribution, Update controls, working gestures/flips/media/upload lifetimes | `phase2/presentation-foundation.browser.ts`, `phase2/library-ui.browser.ts`, `phase2/private-deck.browser.ts`, `phase2/working-updates.browser.ts`, existing component suites |

The new acceptance browser tests connect previously separately tested boundaries:
Library Add → normal first open/personal completion → another account's normal
Creator publication → deliberate Card adoption → media-first My Decks adaptation
→ publication/working navigation/source preservation. A second test exercises
owned-Card publication inside a foreign Library Deck through the actual UI.

## Defect found during connected verification

My Decks still gated its Deck menu on canonical `canEditDeck` ownership. As a
result a valid foreign working membership could not enter the already implemented
My Decks continuity Creator workflow through the UI. `DeckDetail` now allows
Creator entry from its authorized working membership, while retaining the owner
entry behavior. This does not change canonical write permissions, source-version
authorization, confirmation, first-edit creation or return routing. The acceptance
test exercises the actual menu, cancellation with no copy, unchanged ownership
permissions, media-first editing and Publish and leave to the new personal Deck.

The new test also waits for the working route/settled geometry and targets the
native completion button, rather than a similarly named Step-navigation parent.
These are test synchronization/selector corrections, not gesture or CSS changes.

## Permanent isolated development environment and offline boundary

`npm run dev:phase2` remains available. `scripts/test-phase2.ts` creates its own
loopback Mongo replica set, named disposable database, loopback media server and
two local accounts. It overrides Mongo/provider configuration; it does not connect
to an environment-supplied database. Data is discarded on shutdown. The command
is permanent; the generated database is deliberately disposable, not persistent.

- Accounts: `phase2` and `other`; both use `local-test-only`.
- The launcher prints the dynamically allocated application URL. Sign in there;
  the application exercises real authentication, domain authorization, transactions
  and attachment metadata with mocked provider transfer/status responses.
- Interactive development uses `.next-phase2`; automated browser runs use
  `.next-phase2-test`, separately from the production build.
- The existing interactive instance was left running. Both accounts passed local
  login and separate authenticated-session checks. A second interactive launch
  correctly refused the occupied Next development directory; no existing process
  was stopped and no user Deck/Card data was edited for that smoke check.
- Startup on a fresh machine requires installed npm dependencies and a suitable
  MongoDB binary. `mongodb-memory-server` can download that binary if missing.
  Browser automation also needs an installed Playwright Chromium binary.
- With dependencies/binaries already present, `MONGOMS_RUNTIME_DOWNLOAD=false`
  prevents Mongo bootstrap from downloading anything. Missing binaries fail
  explicitly; they are not replaced by a remote database.
- Acceptance browsing blocks non-loopback browser requests and records them as a
  test attachment. This tests independence from external browser resources, not
  an operating-system network firewall. Provider allocation/status/PUT calls use
  the loopback fixture server; real Cloudflare APIs are not required.
- Remote canonical image URLs and actual Stream playback still require internet.
  Synthetic Stream assets do not play real video. Displaying their saved metadata
  or local mock notice is not playback verification. Optional analytics/Next
  telemetry may attempt network access; they are not necessary for these workflows.
  Set `NEXT_TELEMETRY_DISABLED=1` for the offline launcher check.

Therefore the environment supports offline local workflows after bootstrap, but
is not an unconditional offline media player or a zero-download fresh installation.
No global networking, playback, telemetry or provider behavior is changed for this
verification.

## Outstanding acceptance and deliberately deferred work

Real Cloudflare R2/Stream acceptance remains mandatory before production cutover:
real uploads, media-first edits, attachment after Card/Deck ownership handoff,
canonical reference reuse, processing/readiness, playback across Creator/Library/
My Decks, cancellation, failed allocation/transfer/attachment, lost responses and
safe explicit retry. See [issues.md](issues.md). Mock tests do not substitute for it.

Previously approved limitations remain: no unsent-keystroke crash recovery,
automatic cross-reload File upload resumption, guaranteed lost provider-allocation
recovery, or elaborate orphan-asset cleanup. Conflicts/errors require explicit
recovery/manual retry rather than silently creating another identity or replaying
personal state. No standalone Card surfaces, Creator Preview Draft, deferred
test-history UI, full discovery, learning event log, Progress or production cutover.

The previously documented intermittent headed-mobile geometry test issue remains
separate. Established geometry baselines/tolerances must not be weakened.

Final manual acceptance should cover the integrated journeys above on the user's
chosen devices. Account switching, failures and transaction races have automated
coverage; reproducing every injected race manually is unnecessary. Real-provider
media acceptance requires a separately authorized provider-backed environment.
