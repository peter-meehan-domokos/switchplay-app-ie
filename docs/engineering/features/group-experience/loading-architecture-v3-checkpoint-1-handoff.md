# Loading Architecture V3 — Checkpoint 1 handoff

Status: Checkpoint 1 implemented; automated results below. Physical iPhone acceptance remains pending. Planning baseline: `d979407`.

The initial working tree was clean and V3 was already committed, so no additional plan commit was needed. Scope is Checkpoint 1 only. Existing HTTP endpoints, bootstrap authority bookends and component refresh cadences remain; no composed readers, automatic follower preparation, infrastructure changes or deployments were introduced.

## Changes

- Personal state keeps known media, dates and reflection values during learning saves. Source mutation stamps protect newer fields while permitting independent incoming sections. Existing Info attachment revisions remain independent.
- Group resources are retained by actor/experience, with shared in-flight reads. Views own timers and active status; ordinary cleanup no longer destroys data. Navigation selection is retained without remounting the physical Card. Read-only retained Personal membership can display while the existing authorised open operation completes.
- Card preview media controllers retain their newest-five/count window. Gallery paging and selection remain local. Temporary failures retain accepted data; confirmed denial, account clearance and scope changes clear affected data. Confirmed hiding/deletion invalidates delayed reads and updates affected previews without deleting the author original during hiding.
- Reflection feed and save logic now lives in a retained source controller. Existing editor, operation retries, optimistic text, revision handling and source-specific rollback remain. Cross-Deck placement shares the same Personal source, with the actual save using its current Deck context.
- Player learning updates mark only matching follower summaries dirty. Confidence and Step progress have separate dependencies. Multiple saves coalesce into an aggregate-only reconciliation after settlement. Collective Group learning updates recalculate G from existing collective learning and do not invalidate F.
- When all permitted follower inputs are already held, F is recalculated exactly using the existing aggregation semantics. No placeholder is needed in that case. Approved R1 uses an overlaid ellipsis while preserving the previous numeric advance. It affects only dirty follower confidence/count slots. First-load dependency repair happens before publishing the initial aggregate, not through an initial placeholder.
- Existing session generation and account clearance invalidate retained resources. Successful sign-in clears the previous client session data; authentication duration and server permission/revision validation are unchanged.

## Verification

- Full unit suite: **575 passed**, including deterministic read/save overlap, rollback, source retention, Info revisions, G/F separation, coalescing, first-load R1 exclusion, exact local F calculation and Strict Mode/account boundaries.
- Disposable Mongo integration: **59 passed** across Group perspectives, reflections, media collection and Personal Info attachment revisions. No Atlas or live review fixture was used.
- Mobile Chromium/WebKit: **four retention journeys passed**, covering Personal and Group Me focus/remount, failed metadata refresh, resume events and whole-Deck return. Personal return keeps the complete cached Card visible while its existing protected open request is held; a separate unit test covers expired freshness.
- Optimized production fixture build plus existing motion/perspective checks: **nine passed, one pre-existing fixture-gated Personal motion case skipped**. Fifty comparison switches retained scene/Card identity; local native Event Timing p95 was **56 ms**. This is not a hosted or physical-iPhone measurement.
- TypeScript passed for application, tests and tracked scripts using an untracked temporary config excluding the old ignored diagnostics. Targeted lint and Git whitespace checks passed.
- Final-source optimized fixture production build and focused grid smoke: **passed** after the last source changes. The standard workspace build limitation above remains separate.

The normal build compiled application code, then failed on a pre-existing ignored diagnostic script: `phase2-test-results/deployment-checkpoint-1/inventory.ts:46` uses SDK union properties without narrowing. Other old diagnostic files similarly affect unrestricted workspace TypeScript checking. They were not modified, deleted or hidden. Application and tracked source/test/script type checking use a temporary diagnostic config excluding ignored probe files; this does not change application configuration.

Earlier excluded runs: an old perspective test expects the username `other`, while the media fixture intentionally renames it Aoife Kelly; those suites must use their matching fixtures. Concurrent build/browser runs also distorted the motion budget and shared artifact output. The reported optimized result was rerun in isolation. Expanded retention gestures honour the existing focus/flip lock and use the Personal Back label rather than the Group Back to My Decks label. Early test-harness errors were corrected; no application motion timing or Back label was changed.

## Checkpoint exit and remaining review

Checkpoint 1 exit criteria are met for retained accepted resources, source reconciliation, G/F dependencies, failure handling and scope safeguards. Complete first presentation of every Card from composed reads remains Checkpoint 2. This checkpoint preserves data that has already loaded; it does not claim to remove first-load contribution waterfalls or consolidate the existing pollers. No hosted deployment or physical iPhone review was performed. Physical Safari should review return/reopen, brief offline resume, pending-save F indicators and G-only edits before broader rollout. Include an Admin who is also a follower, Private-mode follower inspection, brief offline/online return and account switching. Fully discarded Safari tabs necessarily start a fresh load; only still-running sessions retain these in-memory resources.

## Changed-file inventory

- `src/components/auth/AuthScreen.tsx`
- `src/components/decks/CardSemanticAnchors.tsx`
- `src/components/decks/WorkingFocusedCardView.tsx`
- `src/components/decks/presentation.ts`
- `src/components/decks/useWorkingDeck.ts`
- `src/components/group-experiences/AggregateValue.tsx`
- `src/components/group-experiences/ConfidencePair.tsx`
- `src/components/group-experiences/GroupCardBack.tsx`
- `src/components/group-experiences/GroupExperienceDeck.tsx`
- `src/components/group-experiences/group-experience.css`
- `src/components/group-experiences/groupPresentation.ts`
- `src/components/group-experiences/groupResource.ts`
- `src/components/layout/AppShell.tsx`
- `src/components/media/CardMediaCentre.tsx`
- `src/components/media/UserCardMediaUploadPanel.tsx`
- `src/components/media/useMediaCollection.ts`
- `src/components/reflections/ReflectionArea.tsx`
- `src/lib/cards/workingCardStore.ts`
- `src/lib/cards/workingEntry.ts`
- `src/lib/deckMutations.ts`
- `src/lib/mediaCollection/contracts.ts`
- `src/lib/mediaCollection/controller.ts`
- `src/lib/mediaCollection/invalidation.ts`
- `src/lib/mediaCollection/operations.ts`
- `src/lib/mediaCollection/transport.ts`
- `src/lib/reflections/controller.ts`
- `tests/group-experience-client.test.ts`
- `tests/loading-store.test.ts`
- `tests/media-collection-client.test.ts`
- `tests/phase2/loading-retention.browser.ts`
- `tests/reflection-controller.test.ts`
- `tests/shared-learning.test.ts`
- `tests/working-entry.test.ts`
- `docs/engineering/features/group-experience/loading-architecture-v3-checkpoint-1-handoff.md` — this handoff
