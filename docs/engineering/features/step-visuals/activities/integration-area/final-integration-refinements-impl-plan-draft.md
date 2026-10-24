# Integration — final refinements implementation plan (draft)

Date: 24 October 2026. Workspace: `/Users/peterdomokos/projects/step-visuals`. Branch: `feat/step-visuals`.

**Status: approved refinements implemented and verified; awaiting human review.** The final recording, Tooltip and Stage 6 amendments are incorporated. This is a targeted follow-up to the implemented seven-stage experience, not a replacement for the [seven-stage implementation plan][previous-plan]. Approval B remains a human review decision. Actual results and evidence are appended to [the fidelity review][review].

**Revision — subsequent user decisions:** preserve the existing Tooltip behaviour without placement changes; preserve Stage 6's current graph, overall allocation and navigation positions while redistributing unused space below the graph. The completed recording-consistency investigation and approved additions are incorporated in §3.4. Post-implementation updates to the experience specification and fidelity review are approved, preserving historical decisions and evidence. These decisions supersede the corresponding proposals in the first draft.

## 1. Authority, scope and evidence

The user's **Codex Handover — Puckle Final Integration Refinements** supplies the approved changes transcribed below. It overrides the corresponding earlier requirements in the [approved seven-stage design][approved]. Everywhere else, preserve the current approved behaviour and exact copy. Consult the [current experience specification][experience] and [fidelity review][review] as implementation context, not permission to retain superseded content.

The [quality guide][quality], [AI support guide][support], [engineering guide][engineering] and root `AGENTS.md` retain their respective authority. In particular: portable processing, React-owned rendering/state, activity-local implementation, honest numerical presentation, evidence-based mobile checks and no invented educational interactions.

The initial planning task created only this document. Implementation is now authorised within the feature, with tests and the two approved documentation updates. Preserve all pre-existing work, including staged configuration and Card 1 changes. No branch change, dependency, reset, commit or push is needed.

### Evidence inspected for this draft

- Current Integration renderers, reducer/navigation snapshots, mathematical presentation, graph profiles, records, native sliders, Tooltip and CSS; existing pure/browser tests and the seven documents linked above.
- Existing development server: Node PID **66208**, listening on **0.0.0.0:3171**. Chromium successfully opened the real lab menu and selected Integration at `http://localhost:3171/step-visuals`. No restart or application/configuration change was required.
- Read-only Chromium renders at **390×844** and **393×852**, normal text size, reduced-motion enabled for immediate comparison inspection. Captures show current behaviour, **not proposed refinements**. Important screenshots were visually inspected, not merely generated.
- The checks below are planning measurements, not a fresh regression-suite pass. No pure suite, TypeScript, lint or production build was run for this documentation-only task. No WebKit or physical-iPhone/screen-reader verification was performed.

## 2. Current implementation assessment

All source paths in this document are relative to `src/app/step-visuals/`. Unless qualified, filenames are under `activities/integration-area/`.

| Area | Established current implementation | Required delta / discrepancy |
| --- | --- | --- |
| Hosting/navigation | `integration-activity.tsx` owns the reducer/lifecycle/notifications; `StageNavigation` in `stage-controls.tsx` handles outer Previous/Next/Finish/Start again. | Keep the public mount, lab menu, callbacks, stage numbering and progression rules. |
| Stage 2 | `intro-stages.tsx` renders title → instruction → selectors → graph. Selectors include `(constant)`/`(rising)`. One shared rectangle count is retained on switching functions. | Reorder title → selectors → instruction; use the newly approved short labels `y = 2` / `y = x`. Preserve the existing shared-count behaviour, not a new per-function count system. |
| Stage 3 | `learning.ts` enters with `rising`; `comparisons` retains first answers/demonstration state per function. The current `presentation.ts` always supplies the final transition after an answered comparison. | Enter with `flat`; move selectors above the instruction; derive the contextual conclusion from the existing cache. Do not replace the cache, animation or eligibility rules. |
| Stage 4 | Two function modes, fixed b=3, shared graph position, six-stop quadratic slider. No separate rule mode. `division-stage.tsx` displays numerical formulas but does not currently name the whole rectangle and shaded triangle alongside those calculations. | Add the independently selectable rule subsection, exact revised instructions/copy and linear integral preview. Include the requested meaningful labels using the supplied words **Whole rectangle** and **Shaded triangle**. |
| Stage 5 | `offset-area-stage.tsx`, release policies, triangles, constant tooltip and frame reservations implement the current experience. | **No changes.** Preserve the actual current zero-area label and all other details; do not use this task to reconcile historical wording. |
| Stage 6 | `between-curves-stage.tsx` renders stacked selectors, right slider, context-specific explanation, height and numerical area. The grid is `minmax(145px, .4fr) minmax(0, .6fr)`. | Fix the underfilled slider column, improve local spacing and replace only the numerical area output with the approved symbolic integral. Preserve the model and graph. |
| Stage 7 task | All three choices/calculation sections are visible together. `presentation.ts` supplies the old “antiderivative” hint. Shared Tooltip places it immediately above the trigger. | Replace ordinary hint text only. Preserve existing Tooltip placement, interaction and specialised identical-curve feedback. |
| Stage 7 recap | `calculation-stage.tsx` uses a start-aligned grid with 6px gaps inside a much taller reserved panel. Height has no identifying label. | Add **Strip height:** and distribute existing content within that panel; keep Start again at the bottom and retain graph geometry. |
| Mathematical authority | `model.ts` analytically splits crossing regions; `math-presentation.ts` derives non-negative height/area and typeset expressions. D3 prepares graph paths/scales, not assessment truth. | No new numerical method, polynomial model, crossing algorithm or assessment tolerance is required. |

### Measured current layout and concrete defects

Measurements below are CSS pixels at **390×844**, with diagnostics collapsed. Document height was **844**, with no horizontal overflow. At **393×852**, the inspected states also had document height **852**, no horizontal overflow and the same defects.

| Current state | Measured geometry | Consequence for the plan |
| --- | --- | --- |
| Common later-stage frame | x=12, y=59, width=366, height=721; navigation y=736, height=44 | Reuse this host allocation; do not redesign the lab/header. |
| Stage 3 answered linear | Graph y=198.19, height=225.81; feedback panel height=304 | Reordering the existing 44px selector and reserved instruction rows need not move the graph. The shorter contextual suggestion should fit the existing conclusion allocation. |
| Stage 4 quadratic | Graph y=198.19, height=237.81; panel height=292 | The removed pattern sentence currently takes two lines. Its removal makes room for the revised convergence wording; reserve the longer new instruction across both graph modes. |
| Stage 6 | Graph y=173.80, height=270.20; panel height=284 | Preserve these allocations and navigation position. Redistribute the unused space below the graph for modest spacing and the replacement integral, including the longest crossing explanation. |
| Stage 6 controls | Selector column=145; actual range wrapper/input=127.80; unused space remains on the right | `width:100%` on the input alone cannot fix this: it is already 100% of an undersized grid track. Fix track allocation first. |
| Stage 7 hint | Popup x=8, y=553.30, width=288, height=127.48; calculation section y=521.59…667.19 | Temporary overlap is accepted by the user's clarification. Preserve simple placement; inspect the longer new wording for readability and existing viewport containment, not control avoidance. |
| Stage 7 incorrect recap | Graph height=201.81; panel height=372; recap content height=212.77 | Approximately 159px of reserved panel space is unused. Redistribute that space without moving the graph or footer. |

Planning screenshots: `/private/tmp/integration-final-refinements-planning/`. Representative files: `03-square-incorrect-393x852.png`, `04-square-393x852.png`, `06-controls.png`, `07-hint.png`, `07-recap-393x852.png`. The second viewport's measurements are in `393x852-measurements.json`. These are temporary local evidence, not committed golden images.

The prior fidelity review reports viewport-bound tooltip checks. Temporary control coverage is accepted by the user's subsequent decision and is not a defect or missing acceptance assertion for this refinement. Do not add collision-avoidance requirements or change shared Tooltip behaviour.

## 3. Technical approach and ownership

### 3.1 Keep the current architecture

Keep the single activity reducer, editing transaction, navigation snapshots, comparison cache, local stage renderers, analytic mathematics, D3 scene preparation, callback delivery and lab hosting. Do not create a common subsection engine, general glossary, new assessment system or new route.

The refinements are predominantly presentation changes. The only new durable learning-view state is Stage 4's selected subsection. Stage 3's suggestions are derived, not stored or inferred through React effects.

### 3.2 Subsection representation and semantics

- Stages 2/3 continue using their existing mathematical function selection. Prepare their ordered short button labels through the local presentation layer; retain the current segmented appearance and accessible pressed-button group. These are buttons, not ARIA tabs unless full tab semantics are implemented; no tab-widget rewrite is required.
- Add a local `DivisionSubsection = "rising" | "square" | "rule"` field to `IntegrationPanel`, initially `"rising"`. **Do not add `rule` to `IntegrationFunction` or `GrowthFunction`.** It is a presentation/learning view, not a polynomial.
- Add a guarded semantic action such as `{ type: "division-subsection", subsection, revision }` valid only in Stage 4, outside active editing. Choosing rising/square updates the existing mathematical function/region exactly as the old function action did; choosing rule preserves the last mathematical graph state and rectangle count.
- Include the field in initial state, `panelSnapshot`, outer navigation restoration and restart. A return to the same graph subsection from rule must be accepted even when its function equals the retained function. Re-selecting the already active subsection is a no-op.
- Quadratic refinement actions must additionally require the square subsection. A stale/direct refinement must not mutate hidden square state while rule is open. Retain revision/cancellation safeguards.
- Switching subsections does not constitute an outer stage change or move focus to the stage heading. Keep focus on the activated button; make the current instruction/content accessible in DOM order. Next remains available under the existing rules, including from rule without visiting another subsection.
- Preserve the Stage 2 shared count and Stage 3 per-function answer cache. No extra completion state, tick, history-based gate or progress indicator is introduced.

### 3.3 Mathematical scene contracts

Extend `math-presentation.ts` with small, readonly local scenes for the requested indefinite integrals and the symbolic Stage 6 area integral. Reuse `MathExpression`/composed fractions. An indefinite scene carries integrand, primitive/RHS and an accessible mathematical description; it has **no fake bounds**. A definite scene carries actual symbolic bounds `a`/`b`, integrand `h(x)` and the `Area =` prefix.

Add a small `IndefiniteIntegral` renderer to `math-value.tsx`, reusing existing typography/fraction rendering. Keep the existing definite `Integral` call contract backward-compatible, adding an optional prepared prefix if needed. Do not construct mathematical truth in JSX, add a TeX package or convert fractions into slash strings. Render `n + 1` as the whole denominator, and `n+1` as the exponent; provide coherent accessible descriptions without duplicate spoken fragments.

The rule scenes are authored symbolic identities, not a new evaluator for arbitrary powers. Keep them distinct from the definite geometric formulas in b and the numeric assessment machinery.

### 3.4 Records and public compatibility

Keep the existing result/check schema, completed archives, attempt IDs, callback order and success definitions. No additional prediction, assistance or assessment is created by a subsection visit.

The recording investigation is complete and both recommendations are approved. Add `division-rule-viewed` on accepted entry into rule, not as evidence of reading. Graph subsection returns retain `division-mode-selected`; reselecting the active subsection is a no-op. Keep existing function-selection, demonstration, prediction, interaction and assessment facts distinct.

Add an optional readonly `view` context to `stage-changed` and `attempt-started`: `{ region: { curves, a, b }, subsection?: "flat" | "rising" | "square" | "rule" }`. Populate it on every new live event of those types, after destination restoration. Stages 2–4 carry their active subsection; other stages carry their actual mathematical region without inventing subsection identities. Initial Stage 1 therefore explicitly identifies flat/axis, [0,1]; restart's new attempt does the same. Stage 4 rule retains its last mathematical region but is explicitly identified by subsection `rule`.

Keep the context optional in schema-v2 public types so existing payloads/consumers remain compatible; live events always supply it. Retain versions, legacy types, event ordering, IDs, callbacks and immutable histories. No duplicate selection event is needed for outer navigation. No durations, transient frames, new analytics events, persistence or migration are introduced. Record values/identifiers, never formatted mathematics or screen geometry.

## 4. Stage-by-stage implementation and literal fidelity checklist

### Stage 1 — unchanged

Do not edit its copy, initial value, one-decimal display policy, controls, tooltip-free composition or graph. Changes in `intro-stages.tsx`/CSS must be conditional to Stage 2. Verify the preserved Stage 1 render and continuous input regression.

### Stage 2 — reorder only

1. Move the existing function group immediately below the heading; move the current instruction, including its estimated-term Tooltip, below that group.
2. Button labels, in order: **y = 2**, **y = x**. Initial selection remains flat. Keep existing selected/disabled/focus styling and 44px targets. The shorter labels are an explicit new requirement, superseding earlier parenthetical labels.
3. Preserve the graph, shared count, logarithmic count track, exact sums, display precision, both estimated tooltips, explanations, navigation and records.
4. Keep the selector on one horizontal row; do not generalise this change into Stage 1 or change the Stage 2 slider to Stage 4's six stops.

### Stage 3 — contextual conclusions, no new gate

Change first entry from Stage 2 to flat, canonical region flat/axis with b=2. Do not force flat on restored visits: saved outer-navigation state still wins. Move the existing ordered function buttons above the unchanged instruction:

> Watch the width change from 2 to 4.

Keep the current 4,280ms delay, 900ms animation, reduced-motion behaviour, original/additional regions, choices and full correct/incorrect mathematical feedback. Keep quadratic numeric answers/formulas masked as currently required.

Derive the conclusion in `presentation.ts` only when the current function's feedback is eligible to appear (submitted answer and demonstration complete):

1. Find the leftmost function in `[flat, rising, square]` without a submitted first prediction in `comparisons`.
2. If none remain, use the existing exact conclusion:

   > We've seen how differently the areas grow. Next, we'll see why we divide by 2 or 3 when calculating them.

3. For current flat with next unanswered rising:

   > Now try y = x. Does the area grow in the same way?

4. For current rising with next unanswered square:

   > Now try y = x². Does the area grow even faster?

5. For other exploration orders use the approved fallback, substituting the leftmost unanswered function's short label:

   > Now try [next unanswered function].

These two expanded cases reproduce the supplied examples; other source/target combinations use the supplied fallback, not invented variants. Use the existing concluding-text location, styling and reservation. Do not make the suggestion clickable or add a second navigation control.

Preserve first answers; choosing an answered function replays then restores its answer/feedback without another prediction. Preserve Next eligibility during that replay. Returning through outer Previous/Next restores the completed comparison immediately. Suggestions do not change any eligibility rule or require all three answers.

### Stage 4 — three freely selectable subsections

Move the segmented control below the title, in order **y = x | y = x² | The rule**, with the current subsection's instruction below it. Initial subsection is rising. Outer navigation preserves the selected subsection and quadratic count.

#### y = x

Exact instruction:

> See how the diagonal divides the rectangle in half. Then tap y = x² to compare.

Preserve the enclosing rectangle/diagonal, b=3, calculations and principal formula. Display the supplied identifying labels with their calculations:

- **Whole rectangle**: `3 × 3 = 9`.
- **Shaded triangle**: composed `½ × 9 = 4½`.
- Principal formula: composed `Area = b²/2`.

Below that formula add the secondary aside, using restrained existing typography, not a panel:

> A glimpse of the rule:

`∫ x dx = x²/2 + C`, with a composed fraction and readable integral sign. Do not append a derivation or explanation. No rectangle-width slider appears here.

#### y = x²

Exact instruction:

> Move the slider towards Narrower. Watch the estimates of the area under the graph get closer together.

Keep b=3, enclosing area 27, both endpoint constructions, counts `[4,8,16,32,64,128]`, initial count 4, current count restoration, one-decimal estimates, principal `Area = b³/3` and the existing rich **Why exactly one-third?** Tooltip/derivative unchanged.

Replace only the convergence sentence:

> The estimates approach 9. That's one-third of the whole rectangle, which has area 27 (as you can see on the graph).

Remove the old final “Notice the pattern…” sentence. Add no indefinite integral to this subsection.

#### The rule

Use an activity-local `division-rule.tsx` content component, selected by the same shell. No graph, rectangle slider, blank graph reservation or new screen/navigation layer.

Exact instruction:

> Compare the two area formulas to see the pattern behind the power rule for integration.

In this order, render:

1. **For y = x:** followed by `∫ x dx = x²/2 + C`.
2. **For y = x²:** followed by `∫ x² dx = x³/3 + C`.
3. **The power rule for integration**, followed by `∫ xⁿ dx = xⁿ⁺¹/(n + 1) + C`.
4. Unobtrusive qualification **n ≠ −1**.
5. “These examples show the pattern: increase the power by one, then divide by that new power.”
6. “We'll explore the constant C in the next stage.”

All fractions/exponents must be properly composed, not a dense text approximation. No third example, proof, compulsory reveal or new controls. Returning to the square subsection restores the exact settled count; no hidden graph interaction remains mounted in rule mode.

### Stage 5 — strict preservation boundary

Do not modify `offset-area-stage.tsx`, its presentation/math branches, graph layout, native input policy, release animation, tooltip content, frame variables or region labels. In particular, do not add the new integral typography/aside to it.

The existing file shared with other stages may change, but no new CSS selector or rendering condition may match Stage 5 unintentionally. Capture its initial, fractional, settled, zero-width and open-tooltip states as regression evidence, without redesigning them.

### Stage 6 — fill the existing grid and replace one output

Keep the opening instruction, graph/arrow/labels, fixed a=1, continuous b in [1,4], selectors and all mathematical semantics.

**Controls:** use the existing left stacked/right slider arrangement. Replace fractional tracks with weights whose flexible sum cannot underfill after the left minimum freezes: for example `minmax(145px, 2fr) minmax(0, 3fr)`, with a 12px column gap. At 366px this provides approximately 145px selectors / 209px slider instead of the measured 145 / 128 with unused space. Ensure the slider wrapper and input stretch to the entire second track, with `min-width:0`; do not merely enlarge the native thumb or input alone.

Scope a modest selector-row gap increase (6→approximately 10px), small control-block margins and explanation/math gaps to Stage 6. Redistribute the existing unused space between the mathematical content and navigation; **do not increase the panel reservation, change the overall stage allocation, reduce or move the graph, or move Previous/Next**. Keep the full longest function name legible and 44px controls. Retain the existing narrow-screen reflow policy below the target widths unless measurement shows a new issue. Do not change Stage 5's shared slider sizing/styles.

**Content:** preserve the normal explanation verbatim:

> At any position x, the strip's height h(x) is the vertical distance between the two curves.

Preserve the dynamic strip-height expression and existing context-specific crossing/equal-curve explanations. Replace only the separate `Shaded area: [value] square units` output with:

> Add these narrow strips using integration:

`Area = ∫ₐᵇ h(x) dx`, with true upper/lower limit placement. Use symbolic a/b exactly as requested, not an evaluated numeric result or a fixed-selector signed difference. This is one replacement block, not an additional help panel.

The equal-curve explanation's existing zero-area sentence remains: it is specialised mathematical feedback, not the redundant numerical output being replaced. Existing exact area computation remains available internally/through records and tests even though its standalone readout disappears.

Fit the replacement block inside the existing below-graph allocation, using the available slack rather than allocating new height. If actual rendering of any required normal-phone state still conflicts after reasonable redistribution, report the graph/content/footer measurements and ask before changing the locked graph or stage allocation. Do not silently shrink the graph as a fallback.

### Stage 7 — hint wording and recap spacing

Replace only the ordinary hint with:

> Use the power rule to integrate each term of the strip-height expression. Then substitute the upper boundary and subtract the result at the lower boundary.

Retain the specialised identical-curve hint. Showing a hint still records assistance through the current reducer; dismissing it does not erase evidence. No assessment, draft invalidation or Finish change.

**Tooltip behaviour is locked unchanged.** Only replace the approved hint wording. Preserve the current Tooltip component, placement function, existing observers, trigger/title, portal semantics, focus and outside/repeat/Escape dismissal. Do not add protected rectangles, avoidance refs, collision policies, viewport observers, a new tooltip system or control non-overlap assertions. Temporary coverage of other controls is acceptable. Verify the longer text using the existing viewport-containment behaviour; it must not expand the document.

**Recap:** add **Strip height:** immediately before the current h(x) expression. Keep selected curves/interval, integral, evaluated area, student's incorrect answer where applicable and correct-area output unchanged. Group existing description, height, integral and answer feedback into semantic local wrappers; stretch the recap through its existing panel and distribute modest row gaps/remaining space between groups. Keep the logical order and Start again in the existing outer navigation row. Do not change the graph, add cards/decorations or move unused space above it. At enlarged text use natural content growth rather than fixed overflowing tracks.

## 5. Mobile layout strategy and acceptance

Retain current fonts, palette and control targets. Normal later-stage body text is 14px, mathematical values 16px and controls at least 44px; these are current baselines, **not permission to reduce sizes**. No absolute positioning of ordinary stage content, clipping, hidden essential copy or ordinary nested stage scrolling.

| Stage / demanding state | Proposed allocation strategy | Acceptance |
| --- | --- | --- |
| 2 | Reorder existing flex children; short labels remain a single row. | Stage 1 unchanged; Stage 2 graph remains stable on function/count/tooltip changes. |
| 3, especially square incorrect feedback | Reorder selector/instruction rows without changing their combined height; retain the existing worst-case feedback reservation. | Graph and axes do not jump across feedback/replay; shorter suggestions do not pull navigation upward. |
| 4 linear/square | Reserve a common instruction height for the longer revised square text. Remove the old pattern sentence; budget the new convergence line and linear aside/labels against the longest mode. Current 292px panel provides a starting point, not an immutable constraint. | Both graph subsections share the same graph box and horizontal scale. Keep established differing labelled y scales. No layout growth on count changes. |
| 4 rule | Use the space otherwise occupied by graph+panel for the three formula groups and conclusions; no empty graph row. | Readable equations and qualification on one screen; return restores graph-mode geometry/count. Absence of a graph here is explicitly approved, not an invariant failure. |
| 5 | No allocation change. | Same physical graph, controls, text and footer as the baseline. |
| 6 longest crossing explanation | Fix the underfilled horizontal grid and redistribute existing unused space below the graph for modest gaps and the replacement integral. Keep the existing 284px panel reservation and overall stage allocation. | Preserve current graph size/position, domains/scales and Previous/Next position at each viewport. Approximately 40/60 controls fill the row, no truncation or overflow. Escalate a measured conflict before changing allocation. |
| 7 wrong hint | Retain current graph/panel reservations and existing simple Tooltip placement; change wording only. | Existing viewport containment/dismissal works with the longer text. Temporary coverage of controls is accepted; no new document overflow. |
| 7 recap, correct and incorrect | Distribute content inside the existing 372px panel; no graph resizing. | More breathing room, readable groups, Start again near bottom, same graph box before/after Finish. |

At **390×844 and 393×852**, test actual rendered layouts with the real lab header and collapsed inspector. Require document scroll height ≤ viewport height (allow at most 1px measurement rounding), no horizontal overflow and essential controls inside the visible viewport. Normal soft-keyboard use is separately assessed; it cannot be certified by a keyboard-closed screenshot. At 200% text, smaller screens and reduced usable browser heights, readable controlled scrolling is preferable to clipping.

No promise is made that the refinements have passed visual QA. Verify the content and spacing early, before completing all refinements. In Stage 6 the existing graph, stage allocation and navigation position are constraints, not adjustable budgets. Do not affect Stage 5 to find space elsewhere.

## 6. Files and change containment

| File | Planned change |
| --- | --- |
| `intro-stages.tsx`, `intro-stages.module.css` | Stage 2-only child order/short labels/horizontal selector constraint; no Stage 1 changes. |
| `learning.ts` | Initial flat Stage 3; Stage 4 subsection field/action/snapshot/restoration/guard; retain all existing manipulation and assessment transitions. |
| `presentation.ts` | Contextual Stage 3 conclusion, literal Stage 4 instructions/copy/rule content, new Stage 7 ordinary hint, Stage 6 replacement lead-in. |
| `math-presentation.ts` | Prepared indefinite-rule scenes, symbolic Stage 6 integral and descriptive math labels; no change to Stage 5 mathematics. |
| `math-value.tsx` | Small local indefinite renderer and backward-compatible prepared prefix for the existing definite renderer if needed. |
| `stage-controls.tsx` | Stage 4's ordered three-button subsection group; retain existing function groups/navigation semantics. |
| `later-stages.tsx` | Order title → subsections → instruction only for Stages 3/4; conditionally render rule content without graph. Other stages retain their current shell order. |
| `division-stage.tsx`, new `division-rule.tsx` | Requested local mathematical content and rule view. |
| `between-curves-stage.tsx` | Replace numerical output; preserve height/context/controls. |
| `calculation-stage.tsx` | Strip height label and recap grouping; retain the existing hint rendering/interaction. |
| `later-stages.module.css` | Stage-scoped row reservations, Stage 4 rule layout, Stage 6 track/gap fixes, Stage 7 recap distribution. No broad `.frame` change affecting Stage 5. |
| `records.ts` | Add the approved rule-visit event and optional destination/initial view context; preserve existing payload compatibility and delivery semantics. |
| Existing Integration pure/browser tests and isolation tests | Focused updates/new cases described below; preserve independent expected mathematics and existing Tooltip behaviour. |

Expected **no change** to `model.ts`, graph geometry/plotting modules, `use-boundary-pointer.ts`, `use-stage-motion.ts`, `boundary-slider.tsx`, `division-refinement-slider.tsx`, `offset-area-stage.tsx`, `platform/web/tooltip.tsx`, `core/presentation/tooltip-layout.ts`, Card 1, lab/menu appearance, dependencies, Next configuration or global CSS. If implementation reveals a need outside this list, justify it against scope before expanding.

The user has approved updating the current experience specification and fidelity review **after implementation** with these superseding refinements, concrete tests and screenshots. Preserve original historical design decisions and evidence; distinguish superseding decisions from earlier results. Do not silently edit the original Approval A document. Those approved future documentation updates are not performed in this planning task.

## 7. Mathematical and educational safeguards

- **No numerical/model change:** keep analytic areas, independent curve ordering, crossing splits, true curve sampling/clipping, continuous geometry and the existing tolerances. The new power-rule notation does not enter assessment calculations.
- **Stage 3:** constant/linear/quadratic growth factors remain 2/4/8. No b³/3 or quadratic numeric area is shown early. Contextual suggestions derive from submitted answers, not merely visited/animated functions.
- **Stage 4:** `Area=b²/2` and `Area=b³/3` describe areas from zero to b for the illustrated non-negative interval. The separate `∫ … dx=…+C` expressions are indefinite integrals, not evaluated definite areas or assertions that C=0. Preserve n≠−1. Do not add a proof/domain lecture beyond the approved content.
- **Stage 5:** do not change its specific fixed subtraction or conflate its chosen C with the arbitrary constant in the new rule examples.
- **Stage 6:** h(x) remains non-negative local distance. In crossing cases it is not one fixed selector's function minus the other. `Area=∫ₐᵇh(x)dx` is valid precisely because that meaning is retained. Do not replace piecewise geometric area by `abs(integral(first−second))`.
- **Stage 7:** specialised same-curve feedback remains, any checked numerical answer still enables Finish, edits/region changes invalidate current eligibility, and recap still uses the latest checked answer. Hint wording/position does not assess choices or reveal the answer.
- All visible copy changes are enumerated in §4. Preserve other correct/incorrect explanations, tooltips and labels. Technical accessibility descriptions may clarify notation without introducing new visible teaching copy.

## 8. Regression risks and focused verification plan

These are **planned tests**, not claimed passes.

### Pure state/presentation tests

1. Stage 3 enters flat on first visit, but saved visits restore their function/answers. All six answer orders produce the correct leftmost unanswered suggestion; full completion restores the original conclusion. Check both wrong/right answers and replay masking.
2. Answer cache and Next eligibility remain unchanged: no duplicate prediction on replay; outer Previous/Next restores without replay; no requirement to answer all functions.
3. Stage 4 starts rising, rule is freely selectable, and square n=128 → rule → rising → square restores 128. Outer navigation restores subsection/count. Same-button selection, stale action, refinement in rule and selection during active edit are no-ops.
4. New integral scenes contain the exact prescribed integrands/RHS, composed denominators, +C and n≠−1; no fake integration bounds or evaluated answer. Stage 6 symbolic area scene remains the same presentation across changing bounds while its internal numeric area changes correctly.
5. Test accepted rule/graph visits, unchanged-selection guards, explicit initial/restart views and restored destination context. Preserve callback/archival compatibility, legacy payloads and event order. Ordinary explanatory content is not assessment assistance.
6. Hint ordinary/equal branches, unchanged Stage 7 Check/edit/Finish/recap behaviour and unchanged Stage 5 display/settlement policy.
7. Retain existing Tooltip placement tests unchanged. Verify the new hint wording, existing viewport containment and dismissal; add no collision-avoidance requirements or control non-intersection tests.

### Mathematical regression oracles

Keep the existing independent assertions, not self-comparisons against another renderer using the same helper:

- Stage 2 rising n=4: exact estimate 5.625, displayed ≈5.63, actual 4.5; constant estimate=actual=6.
- Stage 4 lower/upper displays: n4 **5.9/12.7**, n8 **7.4/10.8**, n16 **8.2/9.9**, n32 **8.6/9.4**, n64 **8.8/9.2**, n128 **8.9/9.1**; exact lower≤9≤upper.
- Stage 5 settled b1…4: desired areas **0, 1½, 4, 7½**; removed area remains ½, continuous preview and integer release unchanged.
- Stage 6 [1,3]/[1,4]: line/parabola **22/3, 9**; line/axis **4, 15/2**; parabola/axis **10/3, 31/6**. The crossing at x=3 adds both lobes. Reversed choices agree, same choices/zero width produce 0.
- Stage 7 all 27 ordered pair/interval combinations: line/parabola **9,5,14**; line/axis **10,12,22**; parabola/axis **1,7,8** for [0,1]/[1,2]/[0,2]; all equal pairs 0.

### Browser behaviour and rendered screenshots

Use the existing Chromium infrastructure and real components, not mock interfaces. Do not run WebKit in this environment. Update old expectations only for explicitly changed defaults/copy/structure.

At **both target phone sizes**, capture and inspect:

- Stage 2 both subsections, changed rectangle count and both estimated Tooltip triggers.
- Stage 3 initial flat, partial-answer suggestions in normal and non-linear order, longest square incorrect feedback, replay to an answered function, and all-three-answered conclusion. Use the clock for real animation/delay assertions as well as reduced-motion capture.
- Stage 4 linear with labels/preview; square n4 and n128 with revised long copy; unchanged derivative Tooltip; rule; return from rule with count restored. Verify title → buttons → instruction order geometrically and in DOM.
- Stage 5 baseline initial/fractional/settled/zero-area/constant-tooltip states to prove no unintended shared-style or shell regression.
- Stage 6 full-width slider, longest option, default/reversed/identical/crossing/zero-width cases. Verify label/readout/track/ends use the second grid column; graph domains/axes remain stable.
- Stage 7 wrong ordinary hint and same-curve hint, input/edit/recheck/Finish eligibility, and correct/incorrect recaps with Strip height label and redistributed spacing.

For each state save screenshot plus viewport/document dimensions, graph bounds/domains and relevant control/popup rectangles. For Stage 6 compare graph and Previous/Next bounds directly with the pre-change baseline at the same viewport; do not accept changed allocation merely because the page still fits. For the hint verify existing viewport containment and dismissal, not avoidance of other controls. Verify no unexpected graph/footer movement, no hidden required control, no clipped equations and correct record deliveries after navigation once the recording investigation is incorporated.

Also check narrow-width reflow, 200% text, tablet/desktop, keyboard focus/Enter/Space/Escape, outside/repeat Tooltip dismissal, menu interruption, native range operation and unchanged Roots and Factors/lab dropdown/session preservation. Mathematical symbols need meaningful accessible names. Chromium does not certify physical Safari keyboard, touch or screen-reader behaviour.

### Commands and final evidence

Using the functioning server, run the focused new/affected tests first, then the relevant existing pure and Chromium regression selection. The existing configuration supports:

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure
SPV_TEST_BASE_URL=http://localhost:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration-seven-stage.browser.ts integration.browser.ts integration-intro.browser.ts integration-refinements.browser.ts
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint src/app/step-visuals
npm run build
git diff --check
```

Include the existing lab and Card 1 regression selection to protect preserved behaviour; shared Tooltip code must remain unchanged. Keep the isolation checks in the pure suite. If build/type metadata requires a different order, follow the installed Next.js guidance and current repository commands. Read the relevant installed guide before implementation, as required by AGENTS.md.

Inspect a compiled production render as well as development; record actual pass/fail counts, screenshots and any pre-existing failures separately. Do not claim future tests already passed or physical-device approval. Preserve the running development server where possible; verify its actual LAN address/port rather than inventing a phone URL.

## 9. Incremental implementation sequence after approval

1. **Preserve baseline:** recheck branch/worktree, retain all existing dirty work, use these current-state measurements/captures. Confirm menu/controls hydrate before relying on browser output; do not repeat the earlier architecture investigation.
2. **State and pure presentation:** add the Stage 4 subsection/action/snapshot semantics and focused tests; change Stage 3 initial selection/contextual conclusion; prepare exact mathematical/copy scenes. Keep all Stage 5 and assessment branches unchanged. Implement the approved recording context/rule-visit additions described in §3.4.
3. **Prove demanding Stage 4 layouts early:** implement subsection order, linear aside and rule view, remove the obsolete square sentence, and render the longest square/rule content at both phone sizes. Establish common graph-mode reservations before proceeding. No extra review gate is needed unless an actual conflict is found.
4. **Stage 2/3 composition:** apply Stage 2-only reorder/short labels and later-stage 3/4 row ordering; verify replay/state restoration and the square feedback fit.
5. **Stage 6 as one contained unit:** fix horizontal track allocation, modestly redistribute existing below-graph space and replace the output. Preserve the current graph, panel allocation and navigation bounds. Test crossing/equal cases; report a measured conflict before any substantial layout change.
6. **Stage 7 as two focused units:** first change hint copy only, preserving Tooltip behaviour; then recap label/distribution without changing assessment or graph geometry.
7. **Full fidelity/regression pass:** literal copy review, pure/browser checks, real screenshots, geometry/overlap measures, type/lint/build/isolation. Update the current experience/fidelity records only after implementation authorisation; report discrepancies honestly.
8. **Handoff and stop:** provide actual changes, results, screenshot paths and manual-phone checks limited to feel/readability/Safari behaviour automation cannot establish. No commit, push, extra activity or further redesign.

## 10. QUESTIONS

**No new educational or product questions.** The approved examples plus generic Stage 3 fallback settle the contextual copy, and Stage 2 retains its existing shared rectangle count rather than introducing new per-function memory. Tooltip behaviour and Stage 6's graph/stage/footer geometry are explicitly settled by the user's latest decisions.

The recording investigation has been incorporated and its recommendations approved; there is no outstanding dependency. Implementation is authorised. If rendering reveals an actual Stage 6 one-screen conflict within its preserved allocation, present the measurements and ask before changing graph dimensions, navigation positions or overall allocation. Do not pre-emptively allocate more height or shrink the graph.

[approved]: ../../../../../design/features/step-visuals/puckle-integration-seven-stage-approved-design.md
[experience]: ../../../../../design/features/step-visuals/activities/integration-area/experience-specification.md
[quality]: ../../../../../design/features/step-visuals/great-maths-visuals.md
[support]: ../../../../../design/features/step-visuals/ai-maths-visuals-support-guide.md
[engineering]: ../../maths-visuals-engineering-guide.md
[previous-plan]: seven-stage-experience-impl-plan.md
[review]: approval-b-fidelity-review.md
