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
| S00 plan, review and handoff | Documentation checkpoint ready | Commit recorded by next checkpoint |
| S01 registry and Framework references | Next | Not implemented |
| S02 canonical step media | Pending | Not implemented |
| S03 Roots restore/adapter | Pending | Not implemented |
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

S00: read-only branch/status and source inspection; focused plan consistency searches; unchanged input hashes. No application test claimed for this documentation checkpoint. No application code, provider settings or database data changed.

Physical iPhone Safari testing has **not** been performed. Required device sequence is in plan §12.5. Existing visual overflow, keyboard and enlarged-text limitations are separate visual backlog; test the host bounds independently. Existing R2/Stream delivery security needs the scoped provider audit before new restricted guest-media exposure. Guest retention is provisionally 90 days of inactivity, subject to privacy review before rollout.

## Exact next step

Commit S00 with only the four named specification/plan/review/handoff files. Then implement S01: pure compiled Interactive Visual registry and `interactiveVisualIds` Framework validation, without changing Progress calculations. Inspect `src/lib/frameworks/configurationContracts.ts`, `configuration.ts`, `tests/frameworks.test.ts` and existing activity records first. Run relevant Node tests, activity baseline and `node_modules/.bin/tsc --noEmit`; review diff, stage explicit files, commit with no apostrophes in subject/body, update this ledger and continue S02.

Do not push, deploy, merge, switch branches, run live migrations/provider changes, implement demo decks/general file picker or redesign mathematical responsiveness. Use the last successful commit as the recovery checkpoint. Pending work must never be reported as Saved or complete.
