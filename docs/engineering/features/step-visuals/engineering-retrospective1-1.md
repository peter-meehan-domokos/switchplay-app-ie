# Step Visuals engineering retrospective — Integration

Date: 25 October 2026. Repository: `step-visuals`. Branch: `feat/step-visuals`. Reviewed HEAD: `9017513`.

**Status:** Phases 1–5 reviewed and approved; Phases 6–7 completed on 25 October 2026. Sections 1–5 preserve the original investigation and amendment proposal; §7 records the approved guide update and documentation validation. This report is engineering evidence, not a new activity implementation specification. No application code, tests, dependencies or companion guides were changed by this work.

**Resolved guide paths:** the user renamed the historical guide to `maths-visuals-engineering-guide-v1-1.md`. Its contents are preserved unchanged. The current v1.2 successor is [maths-visuals-engineering-guide.md][current-engineering]; no separate `maths-visuals-engineering-guide-v1-2.md` is created. This supersedes the original filename proposal below.

## Executive assessment

The strongest outcome of Integration is its computational and state ownership: one canonical selection feeds analytic area calculations, pure graph scenes, mathematical presentation and explicit assessment. Activity-local components allowed substantially different teaching interactions without forcing calculus into Card 1's root model. Those are successful boundaries to retain.

The largest avoidable cost was **failure to translate the intended student experience into independently checked implementation requirements early enough**. A working graph and passing mathematical tests did not establish the right controls, exact words, one-screen composition or sequence of actions. Subsequent technical plans and fidelity tests improved this considerably, but the same discipline needs to be cheaper and earlier for the third visual.

Not all changes were defects. The activity changed from six stages to seven; Stage 4 gained The rule; the full worked solution was subsequently requested; and the later b=3 decision replaced a previously specified b=4. Engineering should distinguish missed requirements, genuine regressions, approved evolution and uncertain causes. Otherwise the retrospective prescribes fixes for the wrong problem.

I recommend keeping the guide's twelve-section structure and strengthening a small set of operational contracts, rather than adding a new framework, permanent human gates or a second design process. The priorities are:

1. Translate the current authority/specification into a compact implementation acceptance map, including protected copy, controls, transitions and spatial relationships.
2. Validate both the central interaction and the most demanding approved rendered state early.
3. Treat numerical results, mathematical expressions and working alignment as related but separately verified outputs of one model.
4. Specify fresh/restore/replay/edit/restart semantics explicitly, without imposing one activity's policies on another.
5. Preserve measured invariants during scoped corrections; use risk-based regression checks and honest evidence claims.
6. Consolidate current documentation and refresh the reuse map using both activities, while preserving historical evidence separately.

## 1. Phase 1 — Guidance and evidence baseline

### 1.1 Documents read and their responsibilities

The [existing Engineering Guide][engineering] and [ChatGPT recommendations][recommendations] were read completely. The Engineering Guide is treated as authoritative for this task despite its existing “Version: 1.0 / draft for review” metadata. The recommendations are non-authoritative observations to test against the repository.

The existing guide already defines:

- Scope, readiness and the distinction between mandatory rules, defaults, activity-specific choices and unvalidated generality (§1).
- Ownership and portable dependency boundaries, without compulsory reducer/component hierarchies (§2).
- Reuse/adapt/extract/build-new decisions and a Card 1-based capability map (§3).
- Mathematical authority, precision, tolerances, numerical calculus and plotting correctness (§4).
- Pure scene preparation, React/D3 ownership, immutability and caching (§5).
- Transactions, explicit learning transitions and asynchronous/camera safeguards (§6).
- Browser adapters, hosting and lifecycle (§7).
- Stable geometry, responsive composition, notation roles and answer masking (§8).
- Equivalent input, focus, contrast and evidence-limited accessibility claims (§9).
- Independent compact representations (§10).
- Versioned facts, host-owned persistence, archives and guarded callbacks (§11).
- Layered/proportionate verification, performance and maintenance (§12).

It already gives the engineer authority over ordinary implementation choices and requires escalation for consequential experience conflicts. The retrospective does not justify replacing that with “ask before every technical decision.”

The updated [AI Support Guide][support] was inspected particularly at §§2–3, 7, 9 and 13–14; [Great Maths Visuals][quality] particularly at §§2, 5–9. They define the authority contract, current experience specification and quality outcomes. This report proposes their technical implementation checks, not duplicate educational or collaboration policy.

### 1.2 Evidence register

| ID | Evidence | What it can establish |
| --- | --- | --- |
| E1 | [Canonical model][model], [graph preparation][graph], [mathematical presentation][math-presentation], [presentation policy][presentation] | Current mathematical inputs, supported domain, algorithms and derived representations. |
| E2 | [Learning reducer][learning], [motion adapter][motion], [boundary slider][slider], [pointer adapter][pointer] | Accepted transitions, editing/settling, navigation memory, timing and cancellation mechanisms. |
| E3 | [Records][records], [notifications][notifications], [notification tests][notification-tests] | Versioned payloads, event semantics, archives and mounted-session callback delivery. |
| E4 | [Local frame CSS][styles], [worked calculation renderer][worked], [math renderers][math-renderers], [Tooltip][tooltip] | Current composition, equality alignment, mathematical markup and local reuse. |
| E5 | [Mathematical tests][math-tests], [worked-solution/correction tests][correction-tests], [learning tests][learning-tests], [refinement tests][refinement-tests] | Independent expected values, state/copy assertions and specified edge cases. |
| E6 | [Interaction browser tests][browser-tests], [rendered refinement tests][render-tests], [27-case recap tests][recap-tests], [LAN smoke test][lan-tests] | Real DOM interaction/geometry assertions and reproducible capture procedures; not physical Safari evidence. |
| E7 | [Seven-stage technical plan][plan], [refinements plan][refinements-plan] | Decisions made before implementation, preservation boundaries and known conflicts. Not automatically current authority. |
| E8 | [Fidelity review][fidelity], [early refinement review][early-review], [implementation note][implementation-note] | Recorded discrepancies, corrections and historical verification claims, with differing currency. |
| E9 | [Current experience specification][experience], [original seven-stage design][original-design] | Current consolidated decisions versus earlier approved requirements. |
| E10 | `git log --follow -- activities/integration-area/learning.ts` (using its full source path) and `git show --stat 9017513` | Integration source enters the available committed history in one large commit. Intermediate correction history cannot be independently bisected from those commits. |
| E11 | Available conversation, especially the recent hint/working-alignment requests | Explicit user decisions and reasons for corrections. Earlier user requests are available more extensively than their corresponding assistant implementation turns. No missing dialogue is reconstructed. |
| E12 | [Isolation tests][isolation-tests], [local performance diagnostic][performance-tests] | Existing import checks and local processing measurements, within their stated limits. |

Repository evidence was examined before the recommendation-by-recommendation reconciliation in §4. Reading the recommendations first, as requested, cannot make the investigation blind; it does not make their diagnoses established facts.

### 1.3 Checks actually run for this retrospective

Read-only verification used the existing installation and running development server; no build, dependency installation, source changes or new test cases were needed.

| Check | Result on 25 October 2026 | Limits |
| --- | --- | --- |
| Entire feature pure Playwright project | **157 passed**, 20.7s | Includes both activities, numerical/layout/state/record and isolation checks; finite supported cases, not arbitrary-function correctness. |
| Focused Chromium selection | **8 passed**, 27.2s | Two current refinement capture sequences plus animation timing, replay, Stage 5 settlement, Stage 6 crossing/reversal, Stage 7 answer-edit/Finish and drag interruption tests. |
| Current rendered refinement captures | **16 states at each of 390×844 and 393×852** | Document heights respectively 844/852; overflow and content/graph/control bounds asserted. This is not every possible rendered activity state. |
| Visual inspection in this run | Stage 4 quadratic n=128 at 393×852; Stage 7 incorrect worked recap at 390×844 | Confirms those actual renders were opened. Generating other screenshots is not a claim that every one was visually inspected. |
| Git/worktree review | Only existing companion-guide modifications and the untracked recommendations file preceded this report | Those changes belong to the user and remain untouched. |

Commands:

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure --output=/private/tmp/integration-engineering-retrospective/pure
SPV_TEST_BASE_URL=http://localhost:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration-final-refinements.browser.ts integration.browser.ts --grep 'approved final refinements|start delay|cached function|tracks continuously|left-stacked selectors|edits require rechecking|drag interruptions' --output=/private/tmp/integration-engineering-retrospective/browser
```

Logs: `/private/tmp/integration-engineering-retrospective-pure.log` and `/private/tmp/integration-engineering-retrospective-browser.log`. Captures/measurement JSON are under the browser output above. These paths are temporary local evidence, not durable golden fixtures. WebKit was not run, following the existing user instruction. Physical Safari, software keyboard and assistive technologies were not tested. Previous build/lint/production results in E8 are historical claims, not checks rerun for this report.

## 2. Phase 2 — Independent engineering retrospective

Evidence labels below distinguish **Verified** (current source/checks), **Recorded** (historical documents or explicit requests), **Inference** and **Recommendation**. A recorded historical observation is not a newly reproduced defect.

### F1. The computational architecture succeeded; implementation fidelity needed a stronger independent oracle

**Verified:** E1–E6 separate computation, transition logic, platform input and rendering. Current tests check exact approved wording, unavailable controls, subplot order, fixed graph rectangles and explicit assessment. E8's original discrepancy audit nevertheless recorded correct mathematical machinery alongside wrong/missing controls and page heights up to 1249px at an 844px viewport.

**Recorded:** correction requests repeatedly protected particular words, control groupings and action sequences. A Set/input workflow, automatic versus learner-performed movement, and one screen versus several internal screens were consequential differences, not interchangeable technical solutions. Some were changed by later decisions rather than missing from the original implementation contract.

**Inference:** mathematical correctness and code-level consistency were better specified/tested than the mapping from educational intent to the actual interface during the early passes. Passing tests could preserve an implementation interpretation instead of the intended experience.

**Recommendation:** make a short implementation acceptance map derived from current requirements: source clause → initial/state-dependent scene → literal protected copy/control inventory → accepted action/transition → spatial invariant → independent check/evidence. Include negative requirements (no extra Set, no automatic assessment, no premature numeric answer). Tests must take expected behaviour from the requirement, not merely mirror the implementation. Reuse an existing plan/fidelity table; no additional mandatory document or universal schema is needed.

**Transfer:** all activities; especially those whose exact instructions and representation order carry the teaching. The current autonomy contract determines what is protected. This is not a permanent ban on delegated wording or design decisions.

### F2. Source-of-truth drift is a real engineering risk; not every “regression” was a code regression

**Verified:** E9's original approved document specifies Stage 5 b=4; the current experience specifies b=3; E7's older technical policy table still says 4. E8's “Six final corrections” traces b4 to fresh-entry configuration, not navigation restoration. Current `nextStage` sets b3, then deliberately restores saved panels; fresh/re-entry tests pass. The existing `implementation.md` still describes the old `{top,bottom,a,b}` state and deleted `boundary-control.tsx` / `integration-controls.tsx`, whereas current code uses selected curves and ordered pieces.

**Verified historical limit:** Git currently contains the Integration implementation principally in `9017513`. The earlier fidelity text saying no committed reducer history existed described its then-uncommitted worktree. It must not be read as a claim about today's history or used to invent an introducing commit.

**Inference:** repeated reading of large historical plans and amendment stacks increases the risk of faithfully implementing an obsolete value. Documentation volume alone does not prevent drift.

**Recommendation:** use the living specification for current requirements, a concise decision log for reasons/supersession, and technical notes for how. Mark plans as implemented/historical and point to current sections when they become stale; preserve original evidence without treating it as current instruction. Before labelling a regression, distinguish a changed requirement, a bad default, a restore defect and an unknown cause. Consolidation follows the Support Guide; the engineering addition is the handoff consistency check and test update discipline.

**Transfer:** all long-running activities and agent/model handovers. No documentation repair outside this report is authorised in this phase.

### F3. Early validation must include demanding composition, not only a successful central gesture

**Verified:** E7 budgets for the longest Stage 3 feedback, paired Stage 4 estimates, Stage 5 fractions and Stage 7 form. E6 now captures wrong answers, hints, rule and recap. E8 records initial later-stage screens substantially exceeding the required viewport.

**Inference:** a central graph prototype is necessary but insufficient when exact copy and controls consume constrained phone space. A graph that works alone does not validate the assembled activity.

**Recommendation:** retain the existing minimal-interaction prototype and add an early rendered check of the highest-risk content states using real components and approved copy. Budget host header, safe areas and diagnostics separately. Validate before implementing the complete journey; repeat only when substantive content/constraints change. Fixture state is legitimate engineering scaffolding, but must not become an alternate product flow or mount hidden solutions in the learner interface.

**Transfer:** any constrained mathematical UI; no compulsory new approval gate, permanent preview mode or per-stage prototype requirement.

### F4. Selected objects and locally ordered geometry are the right abstraction for area

**Verified:** `RegionSelection` preserves selector order; `analyseRegion` derives ordered interval pieces at polynomial intersections. `areaBetween` remains strict about its ordered inputs. The graph shades those pieces, while Stage 6 presents the non-negative distance. Reversal, identical curves, endpoint/internal crossings and zero-width cases have independent tests.

For parabola/axis on [1,4], geometric area is **10/3 + 11/6 = 31/6**. Taking the absolute value of the signed total would give **3/2**, a different quantity. Conversely, the displayed **integral of |x²−3x|** is a valid distance-integral representation; absolute-value notation is not inherently a mathematical shortcut or defect.

**Recommendation:** strengthen the existing area contract: declare signed/unsigned meaning, split topology where required, preserve selected identities separately from derived local order, and derive shading/height/value from the same analysis. Test each piece and an independent expected total. Ordinary permitted degenerate cases require prepared valid outputs, not generic errors.

**Transfer:** ordered geometry, clipping and signed measures across calculus and functions. Integration's quadratic root solver, finite function inventory and particular absolute-value teaching are not universal algorithms or approved content for future activities.

### F5. Mathematical output has semantic and spatial structure, not just a correct final value

**Verified:** coefficients feed evaluation, primitives, height expressions and `workedAreaLayout`; the latter is expressly limited to the supported final-task family and integer bounds. Its tests compare independent primitive values for all 27 ordered curve/interval combinations. `MathExpression` uses text/fraction tokens; the final working is derived, not a hardcoded reference solution.

**Recorded and verified:** the latest correction distinguished a centred group with a common equality axis from four independently centred rows. The current renderer/CSS retain one intrinsic-width block; the recap browser tests measure the equality column and integral inset. Both layouts can fit without overflow, but they communicate working differently.

**Recommendation:** separate expression construction, evaluation and rendering; support the mathematical roles needed by the approved task (bounds, fractions, substitutions, equality alignment and accessible descriptions). Verify critical intermediate steps independently, not only the final number or a snapshot of a generated string. Define the input family each formatter supports and fail unsupported configuration honestly. Preserve line/baseline geometry when performing horizontal-only adjustments.

**Transfer:** algebraic rearrangements, calculus workings and proof-like sequences. Do not mandate four lines, a 14px inset, centred mathematics everywhere, a general AST/CAS, TeX or a new dependency. Local typed tokens/coefficient-based helpers remain adequate until actual needs exceed them.

### F6. Display precision exceptions need to be explicit, not silently normalised

**Verified:** Stage 1's `stageOneReadout` deliberately rounds b to one decimal and computes the displayed area from that rounded display model, while geometry and committed state remain continuous. Its accessible description explains the policy. This resembles, but is not identical to, Card 1's approved integer factor display during continuous dragging. Stages 2/4 distinguish numerical estimates from exact areas; Stage 7 assessment uses unformatted values and an explicit tolerance.

**Assessment:** the existing guide already distinguishes canonical, effective, display and assessment values well. Its §8.4 records only the Card 1 discrepancy. Current Integration supplies a second relevant example of a rounded display that can differ from the exact graph without an explicit visible approximation cue in that calculation.

**Recommendation:** preserve approved activities but keep the limitation visible in the guide's evidence/status notes. For new work, resolve what the displayed statement claims before simplifying precision; do not use the exception as a general permission for false exact correspondence. A display-only derived calculation is not a competing canonical model if its role is explicit. Resolving existing learner-facing presentation requires the relevant authority, not an incidental documentation fix.

**Transfer:** all numerical visuals. Do not force exact fractions everywhere or prescribe a universal decimal count/tolerance.

### F7. Fresh, restored, replayed and edited states are distinct contracts

**Verified:** outer Previous/Next use panel snapshots; Stage 3 separately caches first answers per function and uses a replay identity. Returning via a selector replays then restores feedback; outer return restores a completed comparison immediately. Stage 4 retains its quadratic count through The rule. Stage 2 intentionally shares one count across its two functions. Stage 7 problem/answer revisions invalidate current Finish eligibility while retaining checked submissions.

**Recommendation:** define a small transition/state-ownership table for defaults, subsection change, outer return, draft edit, restart, suspend/resume and exit where relevant. State explicitly which facts are retained, invalidated, replayed or recomputed. Test return paths after non-default interaction, edit-then-revert and replay without duplicate evidence. A “preserve subsection state” rule must not invent per-subsection memory where the approved state is shared.

**Transfer:** most staged activities. Snapshot stacks and the number/names of learning stages remain implementation choices, not a required lesson engine.

### F8. Animation is a semantic transaction with an independent clock policy

**Verified:** Stage 3 has named 2140ms delay and 900ms duration; Stage 5 settlement uses 150ms. `useStageMotion` dispatches reducer-owned progress, cleans up scheduled frames, handles visibility/suspension and respects reduced motion. Records do not traverse/apply history per frame. Existing browser tests use a controlled clock to distinguish waiting, continuous progress, completion and replay.

**Recommendation:** explicitly specify/test start delay, duration/easing, pause/resume versus restart, run identity, cancellation, reduced motion, answer visibility and completion facts. Prevent obsolete runs from committing state or duplicating meaningful events. These are independent concerns: a delay change is not permission to change timing of assessment.

**Transfer:** demonstrations and settling in other visuals. Millisecond values, cubic easing and auto-animation are Integration-specific.

### F9. Mobile fixes should preserve measured relationships, not just “still fit”

**Verified:** local stage profiles and fixed content reservations allow feedback without graph movement within the specified comparison. Stage 6 preserves its established graph/navigation bounds while using the available horizontal slider column and unused lower space. Its frame need not match Stage 7 or the differently scaled quadratic demonstration. Tooltip width can be locally configured without a protected-control avoidance system.

**Recommendation:** before a local change, state the permitted changes and unaffected geometry; compare those measured relationships afterwards. Inspect allocated/unused space and minimum intrinsic widths before reducing a graph, typography or adding scroll. Standalone mathematics, prose, equation chains and inline units need distinct alignment roles. Preserve line-box/fraction metrics for positioning-only work. Viewport containment and an approved overlay temporarily covering controls are different issues.

**Transfer:** any responsive activity. Neither identical graph geometry across all seven stages nor universal one-screen fit at every size is justified. Honour explicit normal target fit while preserving readable scrolling at small/enlarged-text/keyboard states. The 390/393px viewports and panel pixel reservations are reference evidence, not global breakpoints.

### F10. Learning records are accepted facts, not proof of exposure, correctness or mastery

**Verified:** live v2 records represent selected curves rather than one global top/bottom; legacy v1 types remain. `attempt-started` and `stage-changed` carry arrival context; accepted rule entry emits `division-rule-viewed`. Reselecting the current subsection is a no-op. Meaningful commits/checks are retained; pointer/animation frames are not. Callbacks deliver events/completions, then snapshots and explicit exit, with archive/reentrancy tests.

**Important distinctions:** a reducer can emit a visit without proving that a browser actually painted the screen or a student read it. Stage 3's historically named prediction events follow the demonstration under its approved experience; their names alone do not establish anticipatory prediction. Stage 7 may validly finish after an incorrect numerical Check: `status: completed` coexists with `outcome: incorrect` and `successMode: null`.

**Recommendation:** define what each fact means, its acceptance trigger, initial/return context, exclusions and version interpretation. Distinguish accepted navigation, interaction, submission, assistance and outcome; keep completion and correctness separately represented. Preserve public compatibility and historical meaning rather than casually renaming established events. Do not expand recording to timings, every frame or arbitrary analytics. Records reconstruct only facts promised by the contract, not an exact visual replay of every unrecorded default/frame.

**Transfer:** every recorded activity. Mounted-session duplicate suppression is not guaranteed durable delivery or persistence.

### F11. Local isolation was productive; generalise proven boundaries, not whole lessons

**Verified:** Integration reuses projection, plotting, affine conversion, measurement, Tooltip and hosting while supplying local mathematical/state/scene/control components. It does not instantiate Card 1's root reducer or frame. Native range adapters have similar safeguards but different count/movement policies. The small Tooltip extension supports a real second use without a glossary framework.

**Recommendation:** retain the reuse decision framework, but align its default with the project's current experience-first isolation policy. Modest duplication is acceptable when semantic differences or regression risk outweigh extraction benefits. Review for shared primitives across approximately five distinct activities as the current project strategy, not a universal threshold or reason to forbid safe reuse now. A function's actual dependencies/contracts matter more than its filename or `core/` location.

**Performance evidence:** this run's local pure diagnostic reports p95 processing about 1.38ms for Stage 5, 0.99ms for Stage 6 and 2.28ms for 128 paired rectangles, on Node v22.14.0/darwin. It also checks that preview processing does not access historical arrays. This supports retaining the architecture, not a claim of mobile 60fps or a reason to remove freezing indiscriminately. Scene preparation can still repeat analyses/freezing; optimise only a demonstrated workload.

**Transfer:** all activities. A generic calculus engine, universal transaction hook or React Native infrastructure is not warranted by this retrospective.

### F12. Browser/default-action behaviour and host readiness need tests outside pure state

**Recorded:** E8 describes a Next button morphing into a form submit button during the same browser activation, unintentionally assessing a restored draft. Distinct DOM identities and prevented navigation default actions fixed it. The restoration browser regression checks that a valid retained draft stays unassessed until Check.

**Recorded, with limits:** the phone failure involved server-rendered HTML without working controls. The implementation note reports a LAN allowlist fix; the later planning probe also reported an HMR handshake issue on another origin, explicitly without proving its cause. These are related diagnostics, not proof of one cause for every non-interactive phone session.

**Verified:** `lab-network.browser.ts` checks a real menu activation, touch root movement and both activity mounts, not just HTTP 200 or hit testing. Current test config still defaults to `127.0.0.1`, while the approved working test commands use an explicit localhost/LAN origin; test setup must not assume all origins behave identically.

**Recommendation:** verify a hydrated, interacting baseline at the actual host/origin before changing application input code or trusting screenshots. Test native form submission/default actions, focus and pointer-capture boundaries when controls change identity or role. Diagnose listener/route/assets/runtime/hit-testing/input separately. Do not install the Info Cards fixture's gesture/overlay machinery simply because another environment needed it.

**Transfer:** all browser-hosted visuals. Specific Next origin configuration and iOS workarounds remain environment evidence, not a prescribed fix.

### F13. Verification became strong, but evidence durability and coverage accounting can improve

**Verified:** independent analytic tables, direct rectangle sums, reversal/zero/crossing invariants, controlled clocks, DOM movement checks, record delivery and import isolation all add distinct value. Current screenshot suites call `page.screenshot` and assert geometry; those captures are not automatic approved-image comparisons. The alignment tests now verify a semantic spatial relationship that a scroll-height assertion alone could not catch.

**Verified limitation:** many integration test sequences overlap and carry historical correction names; useful references point to temporary `/private/tmp` artifacts. The isolation tests enumerate portable Integration modules and scan imports; they do not prove all transitive boundaries. No physical Safari or screen-reader evidence was established by this run.

**Recommendation:** map tests to current behaviour rather than test count; retain independent oracles and meaningful regression cases. Save selected review evidence in the team's durable review/CI mechanism when one exists, alongside source revision, viewport and commands; temporary captures should be regenerable and labelled temporary. Do not invent a storage service, mandate all screenshots in Git, or claim pixel regression coverage without baseline comparisons. Revisit obsolete/overlapping assertions when an approved requirement changes; do not weaken unrelated invariants to obtain green tests.

**Transfer:** all visuals. Full build/browser suites remain appropriate for substantial changes, not every wording or documentation edit.

### F14. Accessibility boundaries and engineering autonomy should be preserved, not expanded into bureaucracy

**Verified:** native ranges/selects/forms, graph keyboard semantics, focus handling, reduced motion and readable enlarged-text reflow exist. Card 1's non-drag touch gap remains deferred; Integration's native alternatives do not prove physical assistive-technology usability. The current guide already states these distinctions clearly.

**Recommendation:** keep equivalent input and honest accessibility evidence mandatory. Add activity-specific unresolved issues to a visible status record, not a new generic checklist duplicating §9. Engineers own algorithms, local component boundaries, measurement, test strategy and technical improvements within their remit. Investigating protected experience problems is encouraged; changing them requires the current authority contract. Escalate a measured contradiction, not an ordinary choice between valid implementations.

**Transfer:** all activities. The first two experiences do not validate universal layouts, gesture abstractions, animation semantics or educational claims.

## 3. Phase 3 — Comparison with the existing Engineering Guide

Classifications concern guidance changes, not whether an individual implementation has a defect. Multiple entries may strengthen the same existing rule; they should be consolidated in the eventual edit.

| Finding / convention | Classification | Existing section(s) | Proposed disposition |
| --- | --- | --- | --- |
| F1: protected copy/control/transition/spatial acceptance mapping | **Strengthen** | §§1.3, 12.1, 12.4 | Add a compact technical acceptance map; literal and negative assertions plus rendered requirements. |
| F2: living authority versus history; cause classification | **Strengthen** | §§1.1, 1.4, 12.4–12.5 | Operational provenance/consolidation check; no competing specifications or guessed regression causes. |
| F3: early interaction plus demanding-state composition | **Strengthen** | §§1.3, 8.2 | Test the risky approved composition before full journey; no automatic extra human gate. |
| F4: mathematical truth, local ordering, crossings | **Already covered**, sharpen example | §§4.1–4.4 | Retain core rules; add selection/ordered-piece example and valid absolute-value-integral distinction. |
| F5: domain-bounded semantic workings and equality alignment | **Strengthen** | §§4.2, 5.1–5.2, 8.3, 12.1 | Intermediate mathematical steps and layout roles get explicit contracts/oracles. |
| F6: Integration rounded display exception | **Revise** factual evidence | §§4.1–4.2, 8.4, 12.5 | Generalise the known-limitation note beyond Card 1; no blanket exception or code change. |
| F7: fresh/restored/replayed/edited state | **Strengthen** | §§6.1–6.2, 7.2 | Add retention/invalidation/replay table and tests; do not mandate snapshot stacks. |
| F8: independent animation clock/lifecycle contract | **New** explicit subtopic | §§6–7, 12.1 | Small animation subsection; reducer-owned semantic progress with stale-run and reduced-motion checks. |
| F9: measured preservation and mathematical alignment | **Strengthen** | §§8.1–8.3, 12.1 | Normal target fit, baseline relationships, unused space, inline versus standalone/equality roles. |
| F10: view/interaction/submission/outcome semantics | **Strengthen** | §§11.1–11.3 | Explicit arrival context when required; accepted visits do not prove reading; completion need not mean correct. |
| F11: isolation before generalisation | **Revise** default emphasis | §§3.1–3.3 | Retain reuse framework; prefer fidelity/local isolation over reuse pressure; refresh two-activity evidence. |
| F11: purity, React/D3 ownership, hot-path history exclusion | **Already covered** | §§2, 5, 12.3 | Preserve; add Integration references, no duplicate mandate or performance claim. |
| F12: hydrated baseline/native default actions | **New** operational checks | §§7.1, 12.1–12.2 | Real action smoke check on actual origin; form/identity/default-action regressions. |
| F13: state-based visual evidence and coverage/durability | **Strengthen** | §§12.1–12.5 | Distinguish captures, geometry assertions, image baselines, visual inspection and device evidence. |
| F13: import-check scope now includes Integration | **Revise** stale fact | §12.1 | Replace the Card 1-only description; retain the source-scan/transitive-coverage caveat. |
| F14: equivalent input and accessibility evidence | **Already covered** | §9, §12.1 | Preserve; cross-reference current quality standard rather than add a parallel policy. |
| Function inventory, stage counts, snapping values, timings, exact panel sizes and four-line policy | **Activity-specific** | Examples in §§3–8 and 12 | Label as examples; do not promote to general defaults. |

### Guidance to remove or consolidate

- Replace the stale Card 1-only evidence/reuse descriptions; do not remove the successful numerical, ownership or callback standards.
- Reconcile §3.1's preference for abstraction over duplication with the current activity-isolation policy, without a ban on safe primitives or shared components.
- Revise §12's default browser command to account for explicitly unsupported/unavailable engines and actual server origins. Keep cross-engine/device coverage as an evidence goal, not a claimed result or a requirement to rerun known-broken tooling indefinitely.
- Keep readiness/authority checks in §1 and verification procedures in §12, cross-linked rather than repeating the same handoff checklist in four places.
- Extend §8.4's existing exception note, rather than adding a separate precision policy for every activity.
- Preserve the Support Guide's authority modes by reference. Do not copy its collaboration rules, create a second approval system or define every future word as permanently protected.

## 4. Phase 4 — Critical reconciliation with ChatGPT recommendations

This comparison follows the repository findings above, rather than treating the handover's priority list as proof of cause or an authoritative architecture.

| Recommendation | Assessment | Reconciliation / final amendment |
| --- | --- | --- |
| 1. Mathematical authority and geometric area | **Agree; mostly already covered** | §§4.1–4.4 already require authority, signed/unsigned distinction and splitting. Add the selected/ordered-piece example and independent cases (A4). Property/randomised testing is optional when useful, not a new universal requirement. Absolute value of a signed total is wrong for crossings; an integral of pointwise absolute distance is valid. |
| 2. Semantic mathematical rendering/worked solutions | **Agree, with bounded scope** | Strengthen expression/rendering contracts and intermediate oracles (A4). Do not prescribe a general symbolic framework or always four lines. The latest shared-axis correction is more precise than merely “centre the equations.” |
| 3. State lifecycle | **Agree, with historical correction** | Strengthen transition retention/invalidation (A5). Do not describe b4 as an identified regression introduced by recent refinements: it followed earlier requirements. Remount recovery/migration remains explicitly out of scope unless a host needs it. |
| 4. Significant rendered states | **Agree; strengthen existing guidance** | Add a proportional state/requirement evidence map and early demanding compositions (A1, A3, A11). Current tests demonstrate the value. Screenshots alone are not interaction/accessibility evidence. |
| 5. Mobile allocation | **Agree, with constraints** | Use existing space and measured invariants first (A6). A rule to centre every independent line would be wrong for an equality chain; exact alignment roles depend on the approved presentation. Tooltip overlap is not automatically a defect; avoid inventing protected rectangles. |
| 6. Animation lifecycle | **Agree; useful explicit addition** | Add a small animation contract (A7). 2140/900/150ms and replay details are activity policies, not future defaults. |
| 7. Learning records | **Agree, but qualify exposure and delivery** | Add semantics/context examples (A8). An accepted “viewed” transition does not prove painting, reading or understanding. Do not turn “durable delivery where required” into an activity-owned persistence obligation; current duplicate guards are mounted-session guarantees. |
| 8. Scoped technical changes/regressions | **Agree, with proportionate verification** | Add measured preservation boundaries (A6, A11); test shared consumers according to affected risk. Do not infer the Stage 5 cause or require the entire journey/build after every local wording fix. |
| 9. Model/layout/rendering boundaries | **Already adequately covered; refresh evidence** | Preserve §§2/5, update reuse references (A9). No architectural rewrite, new framework or mandatory extra reducer/layer is justified. |
| 10. Accessibility | **Already adequately covered** | Preserve §9 and known deferrals, maintain evidence status (A12). Keyboard/native controls and emulation do not establish full touch-AT compliance. No additional accessibility process or implementation is required by this report. |
| 11. Handoff/current authority | **Agree; operationalise rather than duplicate** | Technical provenance/acceptance mapping and documentation checks (A1–A2), explicitly subject to the v1.2 Support Guide's authority modes. Engineering does not acquire educational authority by calling a new control an accessibility or implementation fix. Legitimately delegated design work remains autonomous. |
| Suggested scenario list | **Useful examples, not a required universal suite** | Current tests cover many; adopt a risk/requirement-derived subset. Complete finite-case enumeration is cheap/useful here, not obligatory for unbounded function families. |

### Important findings not adequately captured in the recommendation document

1. **Native default actions can assess an answer even when pure navigation state is correct.** Browser identity/submission tests are an additional layer, not redundant interaction coverage (F12).
2. **HTTP 200 and a screenshot can conceal an unhydrated page.** A real action on the intended origin is prerequisite evidence (F12).
3. **Current documentation still describes superseded models and deleted files.** Strengthening a guide without consolidating current handoffs would not remove that practical ambiguity (F2).
4. **Completion may intentionally be incorrect.** Host-facing result contracts must not equate a completed attempt with correctness, independence or mastery (F10).
5. **The available history cannot support a precise account of every introducing change.** One large Integration commit and temporary evidence limit attribution (F2, F13).
6. **Existing guidance is already substantial.** Many recommendations are examples or operational refinements, not eleven absent standards. Adding another broad architecture/accessibility checklist would increase friction without fixing fidelity (F1, F14).
7. **The approved precision exception also exists in Integration.** Update the limitation register, rather than implying only Card 1 has a current graph/display discrepancy (F6).

## 5. Phase 5 — Prioritised amendment proposal for review

These are proposed amendments, not edits already made. **M** means a proposed mandatory correctness/boundary check; **D** means a recommended technical default; **E** means evidence/example maintenance. Apply obligations only where the activity and current authority contract make them relevant.

| ID / priority | Section affected | Problem and proposed amendment | Reuse beyond Integration | Trade-off / recommendation |
| --- | --- | --- | --- | --- |
| A1 — highest | §§1.3, 12.1 | **M:** map current protected copy, scene/control inventory, transitions and spatial relationships to implementation and independent acceptance checks. Preserve causal phrasing and negative requirements. | Prevents “technically works, wrong experience” in algebra, graphs and calculus. | Keep one short map in the existing plan/review, not one test or document per sentence. **Adopt.** |
| A2 — highest | §§1.1, 1.4, 12.4–12.5 | **M/D:** check current requirement provenance at handoff; consolidate living requirements and mark historical plans; distinguish defects from approved changes/uncertain causes. | Stops stale instructions propagating across model/agent handovers. | References the Support Guide's policy, not a duplicate approval workflow. **Adopt.** |
| A3 — high | §§1.3, 8.2 | **M:** validate the central interaction and highest-risk complete rendered states early, with exact content and real controls. | Discovers impossible compositions before expensive full implementation. | No mandatory second prototype or extra review for routine work. **Adopt.** |
| A4 — high | §§4.2–4.4, 5.1, 8.3 | **M/D:** strengthen shared mathematical derivation, signed/unsigned contracts, supported expression families, intermediate-step checks and semantic working/alignment roles. | Supports calculus, algebraic transformations and linked representations. | No general CAS/AST or prescribed rendering library. **Adopt.** |
| A5 — high | §§6.1–6.2, 7.2 | **M:** define/test fresh, return, subsection, replay, edit/invalidation, restart and suspension semantics where present. | Prevents state loss, accidental assessment and stale answers. | A small state table, not a generic lesson engine; shared memory may be intentional. **Adopt.** |
| A6 — high | §§8.1–8.3, 12.1 | **M/D:** preserve measured unaffected graph/content/navigation relationships during refinements; inspect unused space and mathematical line structure before compression. | Protects every phone-first activity and local styling change. | Baseline assertions should target meaningful relationships; avoid fragile pixel values where exact invariance is not required. **Adopt.** |
| A7 — medium | §§6–7, 12.1 | **M:** compact animation lifecycle contract covering clock phases, semantic owner, run identity, interruption, replay and reduced motion. | Demonstrations, transformations and settling across topics. | Timing/easing values remain activity-specific; do not force animations into every visual. **Adopt.** |
| A8 — medium | §§11.1–11.3 | **M:** clarify arrival/selection versus action/attempt/outcome semantics, compatible extension and completion-versus-correctness. | Produces trustworthy host data for diverse experiences. | No extra analytics, rendering acknowledgements, duration tracking or durable-delivery promise. **Adopt.** |
| A9 — medium | §§3.1–3.3 | **D/E:** favour faithful isolated activities; update reuse map with both implementations, clear assumptions and evidence status. | Avoids root-shaped abstractions constraining different mathematics. | Permit modest duplication and safe shared components; approximately five visuals is the current review strategy, not a universal extraction rule. **Adopt.** |
| A10 — medium | §§7.1, 12.1–12.2 | **M/D:** verify interacting host baseline and native event/default-action behaviour; use actual origin/tool support and diagnose before broad fixes. | Avoids misdiagnosing hydration/server problems as gestures or menu defects. | A small smoke check, not a new fixture/server system. **Adopt.** |
| A11 — medium | §§12.1–12.5 | **D/E:** state-based coverage/evidence accounting, independent oracles, reproducible captures, explicit visual inspection and proportional test selection. | Makes confidence and review cheaper without using test counts as quality proxies. | No mandatory screenshot service or all-images-in-Git rule. Consolidate overlapping tests only in later authorised work. **Adopt.** |
| A12 — maintenance | §§8.4, 9.3, 12.1, 12.5 | **E:** update precision/accessibility/evidence limitations and stale Card 1-only descriptions; preserve existing mandatory boundaries. | Stops acknowledged exceptions becoming defaults for the third visual. | Document status, do not fix the activities or repeatedly reopen settled deferrals. **Adopt.** |

**Professional recommendation:** approve A1–A12 as a focused in-section revision of the existing twelve-section guide. Most changes operationalise existing principles; A7 and A10 are small missing technical subtopics. No application refactor or infrastructure project is a prerequisite for the third activity. Specific module reuse decisions should follow that activity's approved requirements.

### What this changes in the next implementation handover

1. **Establish one current contract.** Read the living specification and current delegated/protected decisions; use history to resolve provenance, not as competing instructions.
2. **Translate, do not redesign.** Turn the specified words, controls, state changes and spatial relationships into the small acceptance map. Copy protected phrases literally; choose algorithms, files and local CSS independently. Record missing consequential requirements as grouped questions, not guessed interface improvements.
3. **Prove the risky parts first.** Validate canonical mathematics/edge cases and render the central interaction plus the most demanding approved content using actual components at the target phone size.
4. **Implement and verify against the contract.** Exercise non-ideal journeys and compare rendered copy, control inventory, ordering, mathematical roles and geometry as well as reducer outcomes. A green test that only repeats the chosen implementation is insufficient.
5. **Hand back evidence and specific exceptions.** Report what changed, meaningful checks, inspected renders and remaining device/AT uncertainty. No extra review is needed for ordinary decisions already delegated; any protected compromise needs a measured, explicit decision rather than a silent substitute.

## 6. Maintenance and validation plan after amendment approval

1. Resolve the output-file authority question below; do not create competing authoritative guides silently.
2. Preserve the twelve-section structure and existing important rules, including all numerical, accessibility, portability, callback and performance caveats.
3. Incorporate approved changes at the affected sections, cross-linking rather than appending this retrospective to the guide.
4. Update reference evidence to both activities and label finite-family/phone/native assumptions. Do not make the third activity depend on unimplemented shared infrastructure.
5. Verify each A1–A12 amendment against the revised text; check for duplicated obligations, new approval gates, accidental education policy and overgeneralised Integration details.
6. Compare against the v1.2 companion guides and AGENTS.md; check relative links, section references, examples and diff scope.
7. Report documentation checks separately from historical application verification. A guide-only change does not justify another production build or a claim of fresh physical-device validation.

Engineering improvements that could be considered separately—not authorised by this task—include consolidating stale implementation notes, making chosen review artifacts durable, and reviewing duplicated range adapters or repeated analysis only when a real consumer/performance need justifies it. None blocks the proposed documentation amendment set.

## Historical question and resolution

**Q1 — Which file should become authoritative after Phase 6?** The output instructions request a new `maths-visuals-engineering-guide-v1-2.md`, while Phase 6 says to update the original Engineering Guide in place. These are different operations. **Recommendation:** create the requested v1.2 successor after amendment approval, preserve the original as the previous version, and explicitly identify the successor as current when approved. If you instead want the original path updated as well, please confirm that so existing links do not leave two apparently current standards. No guide file is changed before this decision and amendment approval.

**Resolved by the subsequent user approval:** preserve the user-renamed v1.1 historical file and create current v1.2 at the unversioned canonical path. A1–A12 were approved with four refinements, incorporated as recorded below. There are no remaining blocking questions. Application fixes, shared refactors, new analytics and resolution of deferred accessibility/precision issues remain outside this documentation task.

## 7. Phases 6–7 — Approved guide update and validation

The [current guide][current-engineering] is version 1.2, marked the current authoritative successor. It retains all twelve major sections and incorporates the approved amendments in place, rather than appending this retrospective. The [historical guide][engineering] is byte-for-byte preserved, including its original internal “Version: 1.0 / draft for review” metadata; the user's `v1-1` filename identifies the archived predecessor, not a second current authority.

### Amendment and refinement coverage

| Approved item | Current v1.2 section(s) | Validation outcome |
| --- | --- | --- |
| A1 — independent, contract-aware acceptance map | §§1.1, 1.3, 12.1–12.2 | Covered: source-derived positive/negative expectations; protected copy/control/layout checks; no design freeze or new approval gate. |
| A2 — provenance and current documentation | §§1.1, 1.4, 12.5–12.6 | Covered: living specification versus history, supersession and cause classification; no competing design process. |
| A3 — early real-content rendering | §§1.3, 8.2, 12.2 | Covered: actual intended interaction/content, demanding states, real components; missing decisions resolved within authority or escalated specifically. |
| A4 — mathematics and semantic workings | §§4.1–4.4, 5.1–5.2, 8.3 | Covered: common mathematical authority, local order/crossings, bounded expression generation and independent intermediate checks; no universal symbolic engine. |
| A5 — retained and invalidated state | §§6.1–6.3, 7.2 | Covered: fresh/return/subsection/edit/restart semantics and correct distinction between shared and per-subsection state. |
| A6 — measured layout preservation | §§8.1–8.3, 12.2–12.3 | Covered: geometry baselines, unused-space allocation, equation/line-box relationships and scope-appropriate regressions. |
| A7 — animation lifecycle | §6.4, §§7.1–7.2, 12.1 | Covered: clock phases, run identity, cleanup, replay, interruption, reduced motion and assessment separation; timings remain local examples. |
| A8 — record meanings and compatibility | §§11.1–11.3 | Covered: initial/restored context, accepted visits versus reading, completion versus correctness and version/delivery limits; no new analytics requirement. |
| A9 — fidelity-first reuse | §§3.1–3.3 | Covered: both activities, safe reuse/local isolation, limited duplication and current five-visual review strategy without a universal extraction threshold. |
| A10 — interacting host/native browser baseline | §§7.1, 7.4, 12.1, 12.3 | Covered: real action, actual origin, native submit/default-action/identity checks and evidence-led diagnosis. |
| A11 — evidence and proportionate verification | §§12.1–12.6 | Covered: state-derived coverage, independent oracles, capture/review distinctions, reproducibility and historical/current result separation. |
| A12 — known limitations and refreshed evidence | §§3.2, 8.4, 9.3, 12.1, 12.6 | Covered: both precision exceptions, Card 1 input deferral, Integration device/AT gaps and current import-check scope. |
| Refinement: acceptance respects autonomy | §§1.1, 1.3 | Explicit: valid autonomous educational decisions remain revisable; protection derives only from the current contract. |
| Refinement: verification independent of implementation | §§1.3, 5.2, 12.1 | Explicit: mathematical/interface expectations come from independent authority; an unauthorised Set cannot become valid through a passing implementation-derived test. |
| Refinement: prototype reflects the intended experience | §§1.3, 8.2, 12.2 | Explicit: no invented copy/controls/behaviour or alternative student flow to complete a prototype. |
| Refinement: capturing is not visual review | §12.2, §12.5 | Explicit evidence table separates generated images, automated geometry, actual visual inspection, devices and AT; genuine inspection required for significant states where tools permit. |

### Documentation validation and scope

- Compared the complete successor against the preserved predecessor: mathematical authority/precision/tolerances, numerical calculus, discontinuity/sampling, pure contracts, React/D3 ownership, immutability/performance, transaction safeguards, lifecycle, accessibility, static representations, records/archives/callbacks and proportionate verification remain present.
- Reviewed against the current v1.2 companion-guide authority/quality sections and AGENTS.md. The guide references their policy rather than duplicating it. No new mandatory human review, framework, generic lesson engine, extra analytics or native infrastructure is introduced.
- Checked all **74 guide references and 37 report references**, local target paths, heading/section references, version/status information, code fences and changed-file whitespace. All twelve numbered major sections remain, with no duplicate numbered headings or undefined Markdown references. Documentation results are distinct from §1.3's earlier application test results; no application suites, build, TypeScript or lint were rerun for the guide update.
- Audited guide references: normal Integration plan/experience links still use the canonical unversioned path and now resolve to v1.2. This retrospective's original-guide reference intentionally targets the historical v1.1 filename; the successor also links it expressly as historical. No references to a separate v1.2 filename require migration. The recommendations handover remains non-authoritative and unchanged.
- Preserved the historical guide's SHA-256: `b5cc4608dddabcf6f44fac102bbe759c6a9c2a2fa89098b8e53a6678acc8cd55`. Existing user changes to the two design guides and the recommendations document were not edited.

### Remaining limitations and separate future work

No unresolved contradiction blocks the guide. Existing precision/accessibility/device-verification limitations remain visible and are not fixed by documentation. The archived predecessor retains its original metadata intentionally; current authority is unambiguously identified in v1.2 at the stable path.

The Integration `activities/integration-area/implementation.md` note still contains obsolete six-stage status, a `{top,bottom,a,b}` region description and links to removed `boundary-control.tsx` / `integration-controls.tsx`. Its earlier LAN/HMR narrative also needs to be read alongside the later fidelity review's explicit causal limits. The older seven-stage plan retains superseded b4 and delay values in its historical implementation contract. These are known future consolidation candidates, not current authority to restore old behaviour and not changes made during this guide task. No broad documentation cleanup, application change, commit or push was performed.

[engineering]: maths-visuals-engineering-guide-v1-1.md
[current-engineering]: maths-visuals-engineering-guide.md
[recommendations]: engineering-guide-recommended-changes.md
[support]: ../../../design/features/step-visuals/ai-maths-visuals-support-guide.md
[quality]: ../../../design/features/step-visuals/great-maths-visuals.md
[experience]: ../../../design/features/step-visuals/activities/integration-area/experience-specification.md
[original-design]: ../../../design/features/step-visuals/puckle-integration-seven-stage-approved-design.md
[plan]: activities/integration-area/seven-stage-experience-impl-plan.md
[refinements-plan]: activities/integration-area/final-integration-refinements-impl-plan-draft.md
[fidelity]: activities/integration-area/approval-b-fidelity-review.md
[early-review]: activities/integration-area/final-refinements-review.md
[implementation-note]: activities/integration-area/implementation.md
[model]: ../../../../src/app/step-visuals/activities/integration-area/model.ts
[graph]: ../../../../src/app/step-visuals/activities/integration-area/graph-layout.ts
[math-presentation]: ../../../../src/app/step-visuals/activities/integration-area/math-presentation.ts
[presentation]: ../../../../src/app/step-visuals/activities/integration-area/presentation.ts
[learning]: ../../../../src/app/step-visuals/activities/integration-area/learning.ts
[motion]: ../../../../src/app/step-visuals/activities/integration-area/use-stage-motion.ts
[slider]: ../../../../src/app/step-visuals/activities/integration-area/boundary-slider.tsx
[pointer]: ../../../../src/app/step-visuals/activities/integration-area/use-boundary-pointer.ts
[records]: ../../../../src/app/step-visuals/activities/integration-area/records.ts
[notifications]: ../../../../src/app/step-visuals/activities/integration-area/notifications.ts
[notification-tests]: ../../../../src/app/step-visuals/tests/integration-notifications.spec.ts
[styles]: ../../../../src/app/step-visuals/activities/integration-area/later-stages.module.css
[worked]: ../../../../src/app/step-visuals/activities/integration-area/worked-calculation.tsx
[math-renderers]: ../../../../src/app/step-visuals/activities/integration-area/math-value.tsx
[tooltip]: ../../../../src/app/step-visuals/platform/web/tooltip.tsx
[math-tests]: ../../../../src/app/step-visuals/tests/integration-math.spec.ts
[correction-tests]: ../../../../src/app/step-visuals/tests/integration-six-corrections.spec.ts
[learning-tests]: ../../../../src/app/step-visuals/tests/integration-learning.spec.ts
[refinement-tests]: ../../../../src/app/step-visuals/tests/integration-final-refinements.spec.ts
[browser-tests]: ../../../../src/app/step-visuals/tests/integration.browser.ts
[render-tests]: ../../../../src/app/step-visuals/tests/integration-final-refinements.browser.ts
[recap-tests]: ../../../../src/app/step-visuals/tests/integration-six-corrections.browser.ts
[lan-tests]: ../../../../src/app/step-visuals/tests/lab-network.browser.ts
[isolation-tests]: ../../../../src/app/step-visuals/tests/isolation.spec.ts
[performance-tests]: ../../../../src/app/step-visuals/tests/integration-performance.spec.ts
