# Phase 5.5–5.6 — Contextual Progress and presentation

## Resume here

Current commission: implement and separately commit 5.5, then 5.6; prepare a verified disposable iPhone review environment and stop before 5.7. Starting branch `feat/group-experience`, clean tree, HEAD `33297bc` (final planning/5.0 commit following 5.4 `313b86a`). Preserve that commit and all accepted Card geometry/gestures. No model change: requested GPT-6.1 Sol / Extra High is appropriate.

Current state: initial source inspection, no application edits yet. Installed Next page and route-handler docs read (Promise params, server auth and private/no-store transport). Authoritative §9.4–9.8 and 5.4 handoff consulted. 5.0 is now committed and must stay independently usable.

Next: implement 5.5 Group Progress identity/authority transport, validated Deck/Progress return state, shared-shell entry/selector and named destinations; add focused tests, verify and make the first commit. Then implement 5.6 modes/popovers, shared assessment editor transport/origin lines and explicit skipped indicators. No 5.7 or general redesign.

## Findings and implementation dependencies

- Existing ProgressShell/table are personal-only. Area/Item destinations use current personal/archive/Library contexts keyed by Deck identity. Extend with typed experience identities, not a second table or global Group switcher.
- GroupExperienceDeck owns physical face/Card/perspective state and its existing top-right menu is currently Admin-only. Add Progress for all members, keep Group… Admin-only; capture scene state without changing picker defaults or animation.
- 5.4 summary/history APIs carry selected scope, owner, capabilities, safe origin labels and five-second authority leases. Foreign results must remain out of workingCardStore. Roster reads are paged and must be fully consumed with revision consistency.
- Existing AssessmentModal is personal-only and uses crypto.randomUUID in two places; the approved HTTP-safe clientId/preparation handling is necessary when adapting it. Shared defaults must preserve other consumers.
- Existing isolated test runner owns Mongo and Next dist directories; use it for browser verification/review, never normal development Atlas. Preserve the separate 5.0 static preview and its fixture adapter.

## Verification

No new tests run yet. Record actual results and commit hashes here at each checkpoint boundary.

## 5.5 in-progress recovery checkpoint

Implemented navigation foundations (uncommitted): Group progress-navigation roster GET with full revision-consistent paging, fixed Group Progress page, scoped client/resource, shared-table display adapter and dropdown/arrows/sticky metadata. Existing Group Deck menu now includes every-member Progress and keeps Group… Admin-only. Scene return is actor/experience-bound and validated against current Group resources; Card, face, focus and perspective are captured without changing picker defaults.

Normal Progress is labelled My Progress and remains personal-only. Area/Item destination contracts now include typed experience identities and self navigation; Group destination reads are scope-bound. Outside Group learning can be browsed canonically through existing public Library, with fixed Group return context and no assignment. Shared history reading accepts scoped nullable-source rows and stays read-only in the navigation checkpoint; actual mutation transport, origin lines, table modes and popovers are 5.6 work. Foreign history lease expiry and modal invalidation are enforced, not put into workingCardStore.

A first unit navigation/resource suite is at `/tmp/group-progress-5-5-unit.log`. Type/lint checks exposed one Group Deck label-prefix typing issue (fixed by using the actual selected Deck prefix) and render-time ref assignment (removed). Re-run final TypeScript/lint after current source changes. No integration/browser tests yet, no commits. Next: finish focused backend destination/roster tests and browser navigation checks, fix failures and commit 5.5 before 5.6.

Latest 5.5 verification: six pure navigation/resource tests passed. The first browser run passed menu/default/personal separation, but the second test used a non-exact label that matched arrow buttons too; corrected to an exact selector without changing assertions. Added actual browser dual-role/removal coverage in a separate disposable Group. Personal destination regressions are running in `/tmp/group-progress-5-5-integration-final.log`; initial outside Library test lacked any remaining published Deck containing that removed Card, so its fixture now supplies one. This preserves the intended public-only browse policy. Final source type/lint checks had passed before the latest test/return-context edits and must be rerun.

5.5 source is now roughly 30 changed/new files. Shared history adapters deliberately remain read-only for Group contexts in this navigation checkpoint; 5.6 must remove that temporary mutation mask and attach actual Group/personal transports, retain lease hiding and scope keys, add origin date lines, modes/popovers and skipped indicators. No 5.5 commit yet. Final browser log `/tmp/group-progress-5-5-browser-final.log`.

5.5 verification update: 26 focused/unit regressions and 19 Area/Item/Group destination integration checks passed. Browser testing found a real return bug: reading window.location during soft navigation captured the previous Progress URL rather than the incoming Deck URL. Corrected Group Deck entry to use router search params, added explicit Group route synchronization in the existing AppShell and keyed only explicit restored scene entries. The browser assertion still requires the exact original Card and back face; it was not relaxed. Final browser rerun is `/tmp/group-progress-5-5-browser-verified.log`. A final four-case Group destination rerun follows the public-browse mapping clarification at `/tmp/group-progress-5-5-dest-final.log`.

## Checkpoint 5.5 completion gate

Implemented and verified; this state is included in its own implementation commit. Group editing remains intentionally read-only until the immediately following 5.6 editor integration. No visual acceptance is claimed yet.

Actual checks:

- `node --import tsx --test tests/group-progress-navigation.test.ts tests/area-destinations.test.ts tests/progress-client.test.ts tests/assessment-history.test.ts tests/group-progress-preview.test.ts` — 26 passed, 0 failed.
- `node --import tsx --test --test-concurrency=1 tests/group-progress-destinations.integration.ts tests/area-destinations.integration.ts tests/item-destinations.integration.ts` — 19 passed, 0 failed. Final Group-only destination rerun: 4 passed, 0 failed.
- `node --import tsx scripts/test-phase2.ts --group-experiences group-progress-navigation.browser.ts` — 4 passed, 0 failed. Final `--grep 'Item destinations'` rerun after context guards: 1 passed, 0 failed.
- `npx tsc --noEmit --incremental false` passed. Targeted eslint with `--max-warnings 0` across all 29 changed/new TS files passed; `git diff --check` passed.
- Initial failures investigated: an ambiguous browser selector (made exact), a missing public Deck in the outside-browse fixture (added only to disposable data), and a genuine Next soft-navigation URL timing bug (fixed via router search params). No existing assertions were weakened. Browser color-environment warnings were harmless.

The personal Progress label change necessarily updates the corresponding assertions in the personal and static 5.0 preview browser suites; their fixtures and table design remain unchanged. No overarching plan, Organisations document or production Framework configuration was edited.

Next after the 5.5 commit: implement 5.6. Reuse this shared table and scoped history path; add Group/personal mutation transports to the existing editor, safe date/context lines, Group mode switch and touch comparisons, explicit personal/Group skipped-state indicators. Prepare an isolated real-app Framework fixture for iPhone review without modifying production curriculum or removing the static 5.0 preview. Do not begin 5.7.
