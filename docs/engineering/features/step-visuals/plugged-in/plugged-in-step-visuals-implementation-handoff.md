# Plugged-in Step Visuals implementation handoff

Updated: 29 October 2026. Implementation authorised by the final owner instruction; production release is not authorised.

## Baseline and authority

- Worktree: `/Users/peterdomokos/projects/step-visuals`.
- Required/verified branch: `feat/step-visuals-pluggedin`, initial HEAD `090676e4ad1f654c2c9d0638cc25c231df88a6aa`, tree `d00e5a4beaa1c7e06f55a31d809e89d1cfae826c`.
- The owner corrected the initial branch mismatch. No branch switch or merge was performed by Codex.
- Initially no tracked changes; the specification, engineering plan and independent review were untracked. These documents are included as explicit inputs in S00, preserving specification/review contents.
- Specification SHA-256: `23fdd28b60ba0163eea231a4f1afb9e13903b5866acff4767db72cff33635e52`.
- Independent review SHA-256: `77ee2901e92029f95a70ec104db5a966d35821c40048450ae9e3b61fd2fd7a9c`.
- Plan: [plugged-in-step-visuals-engineering-plan.md](plugged-in-step-visuals-engineering-plan.md). It includes F-01–F-19 dispositions, S00–S17, acceptance tests and exact deferred scope.

## Stage A gate

Passed documentation consistency review: all final decisions incorporated, complex concurrent editing removed from core scope, mathematical responsive redesign excluded, host controls separated from mathematical controls, mandatory Framework references, initial implementation excludes demo decks/general media reuse. Original specification and review hashes verified unchanged. No unresolved product choice blocks S01. Installed Next route/cookie guidance and repository layout rules inspected.

## Slice ledger

| Slice | Status | Commit / evidence |
| --- | --- | --- |
| S00 plan, review and handoff | Complete | `ff330b4` |
| S01 registry and Framework references | Complete | `86780c8` |
| S02 canonical step media | Complete | `2c5d300` |
| S03 Roots restore/adapter | Complete, this checkpoint | Commit recorded by next checkpoint |
| S04 early card preview/host | Pending | Not implemented |
| S05 Integration restore/adapter | Pending | Not implemented |
| S06 records repository | Pending | Not implemented |
| S07 account API/offline autosave | Pending | Not implemented |
| S08 attempt lifecycle | Pending | Not implemented |
| S09 release compatibility | Pending | Not implemented |
| S10 creator modal | Pending | Not implemented |
| S11 learner multimedia | Pending | Not implemented |
| S12 video continuation/position/expansion | Pending | Not implemented |
| S13 contextual image delivery | Pending | Not implemented |
| S14 guest identity/persistence | Pending | Not implemented |
| S15 account claim | Pending | Not implemented |
| S16 guest entry | Pending | Not implemented |
| S17 integrated verification | Pending | Not implemented |

## Verification and limitations

S00: read-only branch/status and source inspection; focused plan consistency searches; unchanged input hashes. No application test claimed for that documentation checkpoint.

S01: added pure immutable catalogue and availability resolver for `roots-and-factors` v1 and `integration-area` v2. Framework references are independent of Card IDs and accept old absent fields, explicit empty arrays and known visual IDs; malformed, unknown and duplicate references fail. Sample Framework references now point to the existing visuals. Progress calculations, player and mathematical code unchanged. Preview metadata remains null until generated assets in S04; no new user interface is enabled.

Tests: baseline `npm run test:unit` **432 passed**; targeted catalogue/Framework/deck-intro Node tests **33 passed**; `node_modules/.bin/tsc --noEmit` **passed**; `SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config src/app/step-visuals/tests/playwright.config.ts --project pure` **157 passed**. No provider settings or database data changed.

Physical iPhone Safari testing has **not** been performed. Required device sequence is in plan §12.5. Existing visual overflow, keyboard and enlarged-text limitations are separate visual backlog; test the host bounds independently. Existing R2/Stream delivery security needs the scoped provider audit before new restricted guest-media exposure. Guest retention is provisionally 90 days of inactivity, subject to privacy review before rollout.

S02: canonical zero-to-four ordered video/image/Interactive Visual attachments, conservative Unicode label bounds, non-mutating legacy adaptation, first ordered Introduction video selection, creator roundtrip retention, public DTO allow-lists, full-content writer protocol guard and nested asset ownership/prospective-proof enumeration. No backfill or immutable-version rewrite. Creator modal and learner tabs are later slices; do not enable multimedia authoring in production from this foundation alone. Player timing/element code is unchanged.

S02 verification: **442 unit tests passed**, TypeScript passed, focused new-module/test lint passed. Disposable MongoDB tests: **26 existing foundation/fork tests passed**; new multimedia test passed after correcting its publication title and explicitly creating learner CardData. It verifies old saves/forks reject modern content, owner-scoped upload enumeration, immutable old versions and retained completion. Initial database execution hit sandbox socket restrictions; the authorised disposable replica-set run succeeded outside that restriction. No environment database URI or live database used. Diff reviewed and whitespace check passed.

S03: added activity-local `roots-factors/hostState.ts` and public exports. Snapshot stores settled learning state, consistent prediction/check evidence, bounded visited stages and monotonic event sequence; history remains separate. Hydration does not call the fresh-attempt constructor and emits no events/completion. Hosted adapter delegates mathematical actions to the existing reducer, retains every pending event across batched input until explicit local-outbox acknowledgement, and exposes only supported generic Next capabilities. Existing lab components/reducers and mathematical layout are unchanged. Same-attempt Back to Start is still S08; the retained stage data needed for it is present.

S03 tests: **7 new Node tests passed** (all stages, correct/incorrect predictions, assisted/independent completion, corrupt state, transient pointer exclusion and pending-event acknowledgements); **157 existing activity tests passed**; TypeScript and focused lint passed. No live persistence is claimed yet.

## Exact next step

Commit S03, then implement S04: generic fullscreen host with stable control/content regions, activity-owned hosted rendering, generated inert preview and an internal card-step opening/return example. Expose measured dimensions without changing existing mathematical CSS. Keep execution development-only until durable persistence and guest authorization slices. Use an explicit temporary persistence service reporting local-only status, not Saved. Add browser checks for origin/focus return and host bounds before continuing S05.

Do not push, deploy, merge, switch branches, run live migrations/provider changes, implement demo decks/general file picker or redesign mathematical responsiveness. Use the last successful commit as the recovery checkpoint. Pending work must never be reported as Saved or complete.
