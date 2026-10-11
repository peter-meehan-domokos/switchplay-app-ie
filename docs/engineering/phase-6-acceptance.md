# Phase 6 — Checkpoint 5 acceptance and Phase 7 handover

Status: **Phase 6 complete — acceptance passed.**
Scope: final connected acceptance of Checkpoints 1–4. No Phase 7 interface,
production access, migration, deployment or real-provider operations.

## Connected acceptance

| Behaviour | Permanent coverage |
| --- | --- |
| Ordered configuration, global Item identities, Item-only mappings, fork-of-fork inheritance, ancestry failures and Framework independence | `frameworks.test.ts`, `frameworks.integration.ts`, `framework-readers.integration.ts` |
| Active and archived adopted compositions, independent original/fork contributions, shared Card deduplication, exclusions and raw weighted calculations | `frameworks.test.ts`, `framework-readers.integration.ts`, connected journey in `phase2/assessment-ui.browser.ts` |
| Empty versus zero versus all-skipped completion; unavailable contributors suppress affected scores only | `frameworks.test.ts`, `framework-readers.integration.ts`, `presentation-foundation.test.ts` |
| Explicit Card adoption, reordered stable Steps, retained progress and adopted source titles | `framework-readers.integration.ts`, connected assessment journey, `phase2/working-updates.browser.ts` |
| Combined direct Item, own Card and source-stored inherited tests; source-event deduplication; identical IDs at different sources | `assessment-history.test.ts`, `framework-readers.integration.ts`, `phase2/assessment-ui.browser.ts` |
| Original-source CRUD, retained archive/access-loss edits, active-context Add, privacy and preserved unrelated state | `assessments.integration.ts`, `phase2/assessment-api.browser.ts`, connected assessment journey |
| Concurrent operations, transactional rollback, stale revisions, duplicate and lost submissions, deleted-event resurrection prevention | `assessments.integration.ts`, assessment client unit coverage, `phase2/assessment-ui.browser.ts` |
| Two simultaneously mounted fork histories refresh edits/deletes; retained conflict input and explicit reviewed resubmission | `phase2/assessment-ui.browser.ts` |
| Incomplete histories retain readable rows and source diagnostics while suppressing uncertain indicators; title fallback; direct-only Items | `framework-readers.integration.ts`, `phase2/framework-readers.browser.ts`, `phase2/assessment-ui.browser.ts` |
| First-test entry, chronological indicators, modal CRUD/reload, keyboard focus and quiet centered confidence | `phase2/assessment-ui.browser.ts` |
| Card geometry, header/media placement, swipes/flips, signals, dates, reflections, uploads and canonical Library presentation | assessment UI, presentation foundation, private Deck, Library UI and working Update browser suites; existing component suites |

The connected journey uses a separate authenticated local learner. It verifies
Framework eligibility through active and archived Deck memberships, shared-Card
deduplication, independent original/fork contributions, and exclusion of unmapped
content. It records a test through the real working Card UI, creates and publishes
an actual personal fork and fork-of-fork, archives source/repeated memberships, and
uses the real Framework handlers with a test-only catalogue. It then adopts a
reordered Card publication, edits/deletes the inherited event through the Card
modal, records direct Item results through the existing Item harness, and verifies
original storage, privacy, deduplication, reload persistence and missing-version
incomplete-data behaviour together. Test-only catalogue substitution does not add
permanent content or an application configuration switch. Real authentication and
empty-catalogue endpoints are also covered by the existing API browser tests.

## Final verification

| Check | Result |
| --- | --- |
| Unit tests | 320 passed |
| Disposable-Mongo integration tests | 232 passed |
| E2E/component tests | 124 passed |
| Full connected browser regression suite | 135 passed |
| Typecheck | Passed |
| Production build | Passed with MongoDB connection settings empty |
| Lint | Zero errors; six pre-existing warnings |
| Working-tree and staged diff checks | Passed |

The initial browser run exposed an ambiguous selector in an existing
unavailable-membership test: earlier journeys can leave multiple legitimate
unavailable memberships. The assertion now accepts their coexistence, while its API
assertion still verifies the exact fixture identity. No application behaviour changed.

The permanent `dev:phase2` environment is preserved. Automated browser tests use
its disposable loopback MongoDB replica set and mocked Cloudflare services. Mongo
runtime downloads and Next telemetry were disabled. The production build used
explicitly empty MongoDB connection settings. No production database was accessed.

## Phase 7 technical handover

- **Metadata and metrics:** `GET /api/frameworks`, `/api/frameworks/summary` and
  `/api/frameworks/[frameworkId]/summary` use the ordered configuration and snapshot
  readers in `src/lib/frameworks/readModels.ts`. Item/Area progress has explicit
  complete, empty and incomplete states. Summary assessment data is compact;
  retrieve full history separately. The real catalogue is deliberately empty.
- **Mapping and eligibility:** reuse `configuration.ts`, `mapping.ts`,
  `eligibility.ts` and `calculations.ts` in `src/lib/frameworks`. Canonical ancestry
  controls mappings; adopted active/archived memberships control personal metrics.
  Phase 7 can count matches from supplied Deck references and resolved mappings;
  no Deck-discovery or matching-count query was implemented in Phase 6. Personal
  history links do not establish mappings.
- **Assessments:** `GET /api/items-data/[itemId]/history` combines direct, eligible
  own and inherited assessments. Results carry original storage source, revision,
  title availability and attribution; incomplete histories retain readable rows
  and diagnostics. Reuse `AssessmentControl`, `AssessmentModal` and
  `useAssessmentHistory` with Item context. Direct Item creation requires configured
  identity; retained retired-Item results remain manageable. Source-targeted CRUD,
  mounted-view subscriptions and explicit conflict recovery are already available.
- **Previews and targeted opening:** reuse the canonical presentation components
  `DeckScene`, `FocusedCardView`, and `LibraryDialog` as appropriate.
  `LibraryShell`, viewer-status readers and `workingDeckHref` demonstrate destination
  selection and `/decks?openDeck=…&openCard=…`. Current working destinations are active
  adopted Decks only. Framework archive eligibility must not broaden that route.
  Archived preview/Restore and open need the Phase 7 contract, not an implicit restore.
- **Library relevance:** published Library content can supply navigation contexts
  without contributing to personal metrics. Compute effective mappings and counts
  across the complete eligible result set before ranking/pagination; filtering only
  the first existing Library page is insufficient. Discovery queries and destination
  selection remain Phase 7 work. A standalone mapped Card supplies no Deck destination.

The agreed Area modal lists Decks only: **My Decks** expanded, **Archived** and
**Library** collapsed. Each section has its own count, chevron and subtle divider;
rows show titles and matching-Card counts, ordered by descending distinct matching
Cards, including recognized forks. Phase 7 should use a deterministic tie-breaker
(recommendation: title, then Deck identity). Archived Decks can be previewed without
restoration; working entry requires explicit **Restore and open**. Item navigation
offers valid Deck contexts and opens the correct Card. All previews remain read-only
and must not create personal records or advance adoption.

## Remaining boundaries

Final empty Progress-screen acceptance belongs to Phase 7; Phase 6 verifies the empty
catalogue/read contracts. New curriculum content still requires agreement. Mounted
assessment refresh is within one session, not real-time cross-tab synchronization.
Responsive visual inspection used Chromium viewport emulation and screenshots, not
physical devices. Mocked uploads/status responses do not verify real Cloudflare R2 or
Stream uploads, processing or playback. No production migration or deployment was
performed. Provider-backed acceptance and production migration/deployment remain
separate approved work; Phase 8 cutover is not authorized by these results.
