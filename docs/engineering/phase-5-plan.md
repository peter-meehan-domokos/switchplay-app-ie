# Phase 5 — definitive implementation contract

Approved scope: cross-owner Creator editing through internal first-edit forks,
and deliberate Card/Deck update adoption. Implement one checkpoint at a time;
each completion requires user review and explicit approval before the next.
No production/Atlas access, production migration/cutover, or automatic commits.

## Governing rules

- Roots/drafts are canonical authoring state; published versions are immutable.
  Drafting/fork creation does not create personal data. Personal adoption is
  always a positive immutable version, never null or zero.
- DeckData means personal Deck membership. CardData means retained global
  learning state for one user and Card identity, independent of membership.
- Library is authenticated, latest-public canonical content only. No personal
  overlays. My Decks resolves adopted versions and viewer-owned personal history.
- Public publication is irreversible. Draft intent does not change effective
  visibility. Foreign access checks the exact version's public visibility;
  private-era/unclassified versions fail closed. Public Decks require actually
  published public Cards, with no implicit promotion. Empty Decks remain valid.
- `cardVersionAtPublish` is historical information. New personal Card records
  adopt the latest eligible published version. Existing CardData wins, including
  when another Deck is added/updated/restored. Restore never upgrades adoption.
- Continuing stable Step IDs preserve completion (including skipped) and signal
  readings through all content changes. No content-change classification/reset.
  Defensive new IDs default todo/null; retained older identities are not erased.
- Card Update advances that user's global adoption everywhere. Deck Update changes
  composition only, preserving existing CardData and creating only missing data.
- Add/Restore/Update do not first-open a Deck or generate cadence dates. Normal
  working open performs initialization. Existing dates/anchor take precedence.

## Checkpoint 1 — Update adoption foundations

Backend only; no Update controls or pending-upload UI yet.

1. Actor-owned review APIs for Cards and Decks return an exact adopted/target
   version command, entity title, and all non-empty eligible intervening update
   notes in chronological order. No detailed content comparison. Already-current
   adoption returns a null review; unavailable/ineligible content fails explicitly.
   No draft/private metadata exposure.
2. Prefer Refresh/Cancel over adopting a stale reviewed target. Adoption validates
   the reviewed latest eligible target transactionally. Never silently adopts an
   unreviewed version. A stale response supplies a refreshed review for CP2.
3. Deck review captures latest versions only for Cards lacking personal data.
   Already-adopted Cards are not publication-freshness dependencies. If a missing
   Card acquires CardData through another entry after review, preserve that data.
4. Atomic adoption uses existing Mongo snapshot transactions and root guard
   counters. Acquire dependent Cards in stable identity order before the Deck.
   Guard counters never change authoring revisions, content or timestamps.
5. Card adoption changes only adopted version, updatedAt and Step projections;
   retain current values, reflection, dates, history pointers and source-stored
   chats/tests/media. New visible Step IDs initialize normally. No inheritance
   replay and no physical copying of historical events.
6. Deck adoption preserves active Card if retained; otherwise first remaining
   Card, or null. Preserve cadence anchor, openedAt, existing dates, archive state,
   creation time and sharing metadata. Missing Card records pin transactionally.
7. Bind commands to the actor who reviewed them. Derive authentication from the
   server session. Actor mismatch must fail before writes; replies identify the
   actor. Personal responses are private/no-store.
8. Use expected adoption plus current-state outcomes, not a new receipt collection:
   expected state can advance; already-target is no-op; beyond-target is superseded;
   unexpected intermediate state conflicts. A retry never rewrites learning state
   or unarchives. Outcomes state what is adopted now, not which request caused it.
9. Correct contradictory architecture documentation; legacy destructive/reset
   reconciliation remains retired and outside new paths.

Acceptance/verification: pure identity reconciliation and validation tests;
transaction tests for notes, independence, privacy, global Card adoption, missing
Card initialization, active/cadence preservation, empty Decks, duplicate requests,
lost responses, stale publication, concurrent personal writes/Archive/Add and
rollback. Authenticated API tests exercise malformed/actor-mismatched commands,
409 refreshed reviews and no-store replies. Run existing regression suites,
typecheck, lint, empty-Mongo build and both diff checks. Report no UI changes.

Implemented CP1 API contract:

- `GET /api/cards-data/:cardTemplateId/update` and
  `GET /api/decks-data/:deckTemplateId/update` return `{ viewerUserId, review }`.
  Review is null when already current; otherwise `{ command, title, notes }`.
  The command contains actor, kind, entity ID, adopted/target versions and the
  ordered missing-Card selection. Card reviews require owned personal CardData;
  Deck reviews also require active membership. Canonical ownership alone does
  not authorize personal adoption.
- `POST` to the same URLs takes `{ command }`. The actor must match the current
  authenticated session and the route kind/ID must match. `X-Personal-Viewer`
  additionally binds reads/writes to the initiating account. CP2 clients must
  capture the actor and reject replies belonging to an obsolete session.
- Success returns actual adopted versions and `updated`, `already-adopted` or
  `superseded`. Deck results include active/archived membership state and actual
  global Card adoptions. Stale review returns 409 `UPDATE_REVIEW_CONFLICT`,
  `refreshRequired: true`, and `latestReview`. Unexpected source adoption returns
  an explicit conflict. Authorization/missing-content failures remain explicit.
- Retried already-completed outcomes perform no repairs, date initialization or
  other writes. No new schema, indexes, persistent adoption receipts or migrations.

## Checkpoint 2 — My Decks Update experience

Depends on CP1 review/adoption contract.

- Minimal Deck Update button beside Completion/Confidence in detail header;
  minimal Card Update button bottom-left of active front with attribution clearance.
  Only eligible working updates; never Library. No new planned header ticks/date
  or other unrelated header redesign.
- Modal identifies entity, chronological non-empty notes or simple newer-version
  explanation, progress preservation, Cancel/Update. Card modal explains global
  effect. Stale adoption offers Refresh/Cancel; no silent retargeting.
- Scope the transition barrier to affected working saves, signals/completion/date/
  reflection and media attachment. Wait with clear state and retry/cancel on error.
  Do not abort uploads/discard personal work on Cancel. Preserve unsent reflection
  editing rather than blindly refetching over it. No general mutation framework.
- On Card adoption invalidate/refetch affected actor-owned working projections,
  including other Decks. Reject obsolete epochs/versions and stale account replies;
  prevent optimistic old snapshots from overwriting newer adoption. Refresh on
  navigation/focus as needed, without a new realtime/general cache platform.
- Deck adoption refreshes composition and active selection safely. Normal working
  open initializes only missing dates; never recalculates established dates.

Acceptance/verification: component/API/browser tests for controls, notes, stale
review, pending save/upload failure and cancellation, global reused Cards,
account changes, active Card removal/empty Deck and dates. Existing mobile/desktop
geometry, gestures, flip, history/media and Library regressions stay intact.

Implemented CP2 working contract:

- Working DeckDetail supplies absolute Card-front actions and a compact Deck
  header action to the shared presentation. Library supplies neither. A native
  modal holds the exact reviewed command; Refresh requires another explicit Update.
- Submitted personal work is tracked per actor and affected Card/Deck. The barrier
  includes signal coalescing, the full upload/attachment lifetime, source-history
  media deletion and open reflection editing. Cancel stops waiting only. Failed
  exact writes can retry; failed provider transfers require retry in the media
  editor. Uploaded assets with failed attachment reuse the original attachment.
- Successful adoption refreshes working data in place. Deck adoption uses normal
  working open to initialize only missing dates; Card adoption uses a read. Stable
  Deck component keys retain controllers and editors. Composition reconciliation
  selects the server's retained/fallback active Card without treating personal
  field changes as navigation.
- Actor headers guard existing working reads/writes. Update/refresh clients verify
  the live session before installing responses. Scoped work revisions, refresh
  generations and actor-specific adoption epochs reject obsolete projections;
  cached Card adoption cannot decrease. Other Decks receive current global Card
  adoption on collection refresh, navigation and window focus.
- An uncertain adoption retries the same command. Once success is known, refresh
  failure retries reads only. No new persisted receipts, schema or migrations.

## Checkpoint 3 — Foreign Creator session and identity handoff

Depends on CP1/2; retain entity-scoped persistence lanes.

- Owner editing retains identity. Creator can present a foreign Deck or foreign
  Cards without requiring membership; use explicit owner/foreign DTOs and exact
  public immutable version authorization. Strip foreign private draft/revision/
  recovery metadata instead of spreading database roots.
- Confirm foreign Deck entry: editing creates an owned copy, original unchanged;
  no technical “fork” wording. Opening/cancelling with no meaningful edit creates
  nothing. Confirm first operation needing a foreign Card copy. Explicit visibility
  changes count; inherited private copy default alone does not. Cancel saves nothing.
- Keep stable visual identities through small foreign/creating/owned/uncertain
  binding states. Rebind canonical persistence identity atomically on acknowledgment;
  preserve typing, modals, drag targets, players, queued work and upload attachments.
  Reuse coordinator lanes rather than replace the persistence architecture.
- Submit stable caller-allocated target and Step IDs, exact sources, expected
  destination revisions and first meaningful content change through existing
  atomic fork commands. Unchanged Cards remain references; no personal records.
- Persist exact selected foreign Card versions as private draft-authoring metadata,
  surviving My Drafts reopening. This is neither personal adoption nor a permanent
  published Deck pin. Do not silently refresh selections.
- Operation-only sessionStorage recovery journal: actor/session-scoped frozen
  submitted command, stable target IDs, source versions, expected revisions,
  origin and timestamp. Write before submission; clear after proven acknowledgment
  and owned route installation. No unsent keystrokes, file bytes, upload URLs or
  session secrets. Block first creation if journal cannot be recorded. Filter/clear
  on account change. An advanced target yields safe conflict/load, never a new ID.
- Media-first foreign editing uses narrowly signed prospective authorization and
  attachment proof bound to actor, exact source, prospective target, slot, provider
  asset, expiry and purpose. Reuse upload controllers/provider validation. Successful
  upload/meaningful attachment can create the owned draft; no artificial unchanged
  copy to authorize upload. No staging database unless evidence requires it.

Acceptance/verification: controlled in-flight save/handoff, multiple edits, visibility
cancel/reversal, media-first edit, actor changes, reload after submitted creation,
lost response/advanced target, authorization and provider attachment tampering.
No dropped edits, duplicate UI entities or misattached uploads; no Phase5 standalone UI.

Implemented CP3 session/handoff contract:

- `GET /api/creator/session` is actor-bound (`X-Creator-Actor`) and private/no-store.
  Its discriminated owned/foreign entities expose owner drafts only to their owner;
  foreign entities contain exact public immutable content/source/owner identity,
  without authoring revisions, drafts, recovery metadata or personal state.
  My Decks entry selects adopted versions; Library authoring selects exact requested
  public versions. `PATCH` saves an owned Deck with its frozen foreign selections.
- The existing coordinator retains the original board/Card/pair keys. Small identity
  maps translate canonical Card/Step IDs at request/acknowledgment boundaries;
  newer desired generations are never replaced by an old response. First creation
  uses existing Card/Deck/combined fork transactions, with explicit visibility intent
  and private root visibility. Concurrent Card creations serialize on the Deck lane.
- Foreign Deck entry and the first foreign Card operation require nontechnical copy
  confirmation. Cancel creates nothing. A private default is not a meaningful edit;
  an explicit visibility change is. Owned Cards within foreign Decks stay owned.
- `foreignCardSelections` is optional private Deck-root authoring metadata, validated
  against exact authorized immutable versions. It is excluded from published reads,
  is not Deck/Card adoption and is not part of Deck content equality/versioning.
  Card replacement drops only its old selection. A first Add Card can atomically
  create default owned Cards alongside the Deck copy; unchanged references remain.
- Before submitting a first command, an actor/source-Deck/tab-scoped sessionStorage
  journal records that frozen command, target/Step IDs, expected attachment revision,
  original return query and submission time. No unsent editor buffer, files, provider
  upload URLs or login credentials. Bounded attachment proofs may accompany the
  submitted command; they are purpose-specific, expiring capabilities, not session
  tokens. Recovery uses the exact operation; advanced targets conflict without a
  new ID. Fresh owned-route sessions also recognize exact committed replacements,
  including the gap between owned URL installation and journal cleanup. Recovery
  blocks new editing until resolved. Journal storage failure stops
  creation; a proven acknowledgment plus owned route installation clears it.
- Prospective upload authorization checks an exact public source and binds actor,
  target, source, slot, provider asset and delivery reference. A domain-separated
  signing key derives from the existing session secret. Proofs expire after 30 minutes
  and never enter canonical roots/versions. Successful attachment creates the copy;
  opening/file allocation alone does not. An already-submitted creation must finish
  binding before another upload chooses its target. No staging/receipt collection.
- All Creator operations are actor-bound, including delayed replies. Session teardown
  stops stale transitions, while specifically registered detached owned-Card saves
  may finish with authentication rechecked. Canonical Card uploads use Card ownership,
  independently of Deck ownership/placement; personal upload permissions are unchanged.
  Existing owned Copy uses the bound canonical IDs and actor transport after handoff.
  Foreign Deck introduction readiness uses the exact public-version media read;
  after handoff it uses the owned Deck context without remounting the preview.
- Library-origin return resolves the original specific Library Deck; My Decks/direct
  entry retains its existing destination. Existing Save/leave/public confirmation
  safeguards remain. The Library foreign Edit menu, mixed-ownership publication,
  self-use Publish-and-leave destinations and publication/reopening review remain CP4.

## Checkpoint 4 — Foreign editing, publication and reopening

Depends on verified CP3 handoff.

- Owned Decks with foreign Cards can open Creator. Editing a foreign Card creates
  that Card copy and replaces only the intended reference. Owned Card inside a
  foreign Deck stays owned/same ID; its edit alone must not copy the Deck.
- Copy eligible foreign public Cards through existing Creator Card workflow as
  same-identity references. No Library Copy entry point/standalone Cards. Preserve
  existing destination, clean-auto-publication, retry and permanent reuse rules.
- Fork drafts remain unpublished; first Card publication is v1. If actor has
  eligible immediate-source CardData, transactionally copy current skipped/
  completion, readings, target date and reflection once and link private personal
  history. Same behaviour from Library/My Decks. Source data/events unchanged.
- History uses existing recursive viewer-owned source relationship. Chats/tests/
  personal media stay stored once in original context. Preserve malformed-item
  isolation, source media ownership/deletion and finite-chain/cycle protection.
- Private Library-origin Deck copy publication enters My Decks; public Library
  publication is canonical-only. Explicit self-use membership continues journey:
  keep source Deck active, carry anchor and valid/remapped active Card (else null),
  new openedAt null, no sharing recipients. No automatic archive/replace choice.
- Publication validates exact immutable referenced versions and permissions. A
  newer foreign publication than authoring selection must be identified in review
  and confirmed; a further relevant publication invalidates review. Preserve
  existing latest-at-publication semantics; no implicit Card promotion.
- Return to original specific Library detail for Library entry, owner or copy.
  My Decks self-use Publish and leave opens newly published personal Deck. Preserve
  Save and leave, cancellation, unsaved guards and direct entry behaviour.
- Recover partial publication and exact committed outcomes, never replay state
  inheritance, publish unreviewed work, or create v2 as a v1 retry.

Acceptance/verification: mixed ownership combinations, exact selected versions
across reopening, reused Cards, public/private first publication and confirmations,
history privacy, partial success/retry, navigation and upload/controller lifetime.

## Checkpoint 5 — Full verification and acceptance

Audit all rules above against actual implementation. Run full unit, integration,
E2E, Phase2 browser, typecheck, lint, production build with empty Mongo variables,
working/staged diff checks. Exercise Alice/Bob/Carol adoption and fork journeys,
mobile/desktop geometry, account switching, network failures and controlled races.
Fix only in-scope defects; report blockers/deferred work/manual checks. Stop for
approval without starting Phase6 or committing.

## Proportionate safeguards and explicitly deferred work

All twelve reviewed safeguards are incorporated: actor binding (CP1–4), explicit
adoption outcomes (CP1), narrow freshness (CP1/4), working barriers (CP2), global
projection invalidation (CP2), binding states (CP3), submitted-operation recovery
(CP3), prospective upload authorization (CP3), stored foreign selections (CP3/4),
mixed-ownership DTOs/publication (CP3/4), exact version eligibility (CP1/4), legacy
isolation/documentation (CP1/5).

Defer unsent-keystroke crash recovery, automatic cross-reload upload resumption,
guaranteed provider-allocation lost-response recovery and elaborate orphan-asset
cleanup. Fail clearly, retry manually with valid authorization, bound expiry/retries;
never delete uncertain/shared media or silently attach unauthorized content.
No general server recovery journal, storage redesign or realtime cache infrastructure.

Also deferred: standalone Card surfaces/membership/editing; Creator Preview Draft;
test-history header/modal; reset-progress controls; timestamped learning event log;
Progress/counting; full Library discovery; source keep/replace/archive UX; live
Cloudflare delivery privacy redesign; production migration/cutover. Preserve all
existing Phase4 deferred issues, including headed-mobile geometry test reliability.
