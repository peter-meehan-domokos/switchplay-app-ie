# Recommended Changes to the Step Visuals Engineering Guide

**Source:** Retrospective of the Puckle Integration Step Visual (seven-stage activity), October 2026  
**Audience:** Codex, as maintainer of the Step Visuals Engineering Guide  
**Status:** Recommendations for investigation and integration — **not an approved implementation specification**  
**Scope:** Engineering practices and technical verification only; learner experience and AI decision authority are governed by the companion *Great Maths Visuals* and *AI Support Guide* (both v1.2).

## Purpose and instructions to Codex

Review the existing Step Visuals Engineering Guide against the lessons below. **Do not simply append this document verbatim.** For each recommendation:

1. Identify the relevant existing engineering rule, test contract or section.
2. Determine whether the recommendation is already adequately covered, should strengthen existing guidance, requires a new rule, or is too specific to Integration to generalise.
3. Verify the actual implementation and test history before asserting a root cause or calling something a confirmed engineering defect. This handover is based on the design process and its review findings, not an independent repository audit.
4. Integrate only transferable guidance, using concise Integration examples where they clarify a general requirement.
5. Keep **educational/product decisions** out of the Engineering Guide. Engineering should faithfully implement the current experience specification and the autonomy contract; it must not introduce unapproved UX changes in the name of fixing technical problems.
6. Report any technical issue that would require changing a protected learner experience, rather than silently redesigning it.

**Important:** The original Engineering Guide was **not supplied for this retrospective**. The suggested destinations below are topical rather than exact section numbers. Codex must check the existing guide and avoid duplication.

---

## Priority overview

| Priority | Recommended engineering-guidance area | Integration evidence / motivation |
|---|---|---|
| High | Mathematical authority, geometric area and piecewise crossings | Stage 6 needs non-negative strip height and correct area where curves cross |
| High | Dynamic symbolic expressions and complete worked solutions | Stage 6 actual integrand and Stage 7 four-line evaluation must agree with the graph and numeric result |
| High | Student-state lifecycle and fresh-entry versus return behaviour | Stage 3 initial function, Stage 4 subsection state, Stage 5 initial boundary regression |
| High | State-aware mobile visual regression review | Screenshots exposed defects in post-answer, hint and Finish states |
| High | Regression isolation and implementation change scope | A targeted refinement coincided with an unexpected Stage 5 initial value |
| Medium | Responsive space allocation and mathematical typesetting | Stage 6 controls, Stage 7 hint wrapping and centred four-line calculation |
| Medium | Learning-event coverage and semantics | Selected/visible functions, subsection visits, predictions and actual evidence of learning are distinct |
| Medium | Animation lifecycle and timing contracts | Stage 3 pre-animation delay changed without changing its animation duration |
| Medium | Separation of mathematical/layout/rendering responsibilities | Complex visual states need maintainable, verifiable presentation without duplicating mathematical logic |
| Medium | Accessibility and input alternatives | Graph gestures, sliders, tooltips and mathematical output need verification beyond static screenshots |
| Medium | Traceable technical changes and documentation updates | Codex plans and refinements must preserve agreed student-facing behaviour |

---

## 1. Mathematical calculation must be authoritative across graph, labels and answer

**Observed need:** Stage 6 calculates the gap between two selected curves, shows the result as a strip-height expression and must then substitute that **same expression** into the displayed integral. Stage 7 needs to derive a worked solution and final result from the same mathematical state.

**Recommended rule:** Define a trustworthy mathematical representation for each activity state; derive plotted geometry, displayed expressions, calculations and assessment values from it. Do not independently hand-code mathematically equivalent formulas in multiple UI components where they can diverge.

Engineering review should cover:

- Explicit distinction between **signed accumulation** and **non-negative geometric area**. They are not interchangeable.
- Consistent identification of upper/lower curves over the chosen interval, including identical functions, zero-width intervals, sign changes and curve intersections.
- If curves cross and the upper curve changes, use a mathematically valid piecewise or split-interval representation. Do not use a single signed polynomial integral as though it always gives total geometric area.
- Numerical tolerances, rounding and displayed precision: indicate when a value is an estimate; never imply exact equality where only numerical approximation was computed.
- Verification that mathematical annotation and geometry remain correct during dragging, not only after release.

**Tests to consider:** analytical cases with known areas; reversed curve selections; identical curves; endpoint intersections; internal intersections; zero area; boundary extremes; randomized or property-based comparisons against an independently validated numerical method where appropriate. Check that a display transformation does not inadvertently change the underlying mathematics.

**Boundary:** Choice of which cases a student is allowed to explore, and how piecewise notation is taught, remains a design decision. Engineering must surface any necessary change to the approved experience.

## 2. Treat mathematical rendering as a semantic output, not decorative text

**Observed need:** The Stage 6 formula changed from a generic `h(x)` integrand to the actual polynomial expression. Stage 7 expanded from an integral-equals-answer shortcut to a dynamic four-line calculation, using brackets, bounds, superscripts and substitutions.

**Recommended rule:** Provide a reliable way to produce mathematical display expressions from validated mathematical data rather than duplicating fragile string concatenation in components.

Engineering review should consider:

- A clear boundary between mathematical expression construction, mathematical value evaluation and graphical display.
- Correct handling of negative terms, parentheses, coefficient simplification, operator precedence, powers and integrals with bounds.
- A deterministic formatting policy for exact values versus rounded values. Avoid inconsistent expressions that describe different values from the curve during dragging.
- Support for the **sequence** of a worked calculation: original integral, integrated expression with evaluation bounds, explicit upper/lower substitution and numerical simplification. Each displayed line must be mathematically valid for the current supported case.
- Identical curves, zero integrand and other degenerate cases without fabricated or misleading intermediate steps.
- Long expressions on phone widths: readable, intentional wrapping or layout adjustment; no horizontal clipping or scroll by default.
- Accessible names or equivalent readable descriptions for mathematical expressions where applicable.

**Tests to consider:** expression snapshots or structural assertions for representative polynomial cases, plus numerical agreement of every displayed line; long and negative expressions; identical-function cases; mobile display and text-size stress tests.

**Do not hardcode** the illustrative `9 + 2x - 3x²` Stage 7 example as a universal solution.

## 3. Specify a clear lifecycle for initial, active, restored and restarted states

**Observed need:** Stage 3 was changed to begin on `y = 2` on fresh entry while retaining meaningful exploration history on return. Stage 4 subsection switching had to preserve active exploration settings. Stage 5 unexpectedly appeared with `b = 4` when the current intended fresh-entry default was `b = 3`.

**Recommended rule:** For every activity, distinguish and test:

1. **Fresh entry:** approved mathematical defaults and instructions.
2. **Active interaction:** continuously updated state and any committed/snap-on-release state.
3. **Subsection switch:** what is retained versus reset.
4. **Stage navigation and return:** previous choices, predictions and feedback restored as specified.
5. **Restart:** deliberate new attempt and explicitly defined reset behaviour.
6. **Remount or resumed session, where supported:** persistence semantics and data migration compatibility.

Avoid reapplying fresh-entry defaults when returning to a valid prior state. Equally, do not mistake a stale restored value for the approved initial default. Keep mathematical inputs, progression/assessment state and transient presentation state distinct where it materially improves clarity.

**Tests to consider:** fresh entry and re-entry after every relevant navigation path, stage/subsection switching, slider movement without release, completed predictions, restart, remount, and any state migration scenarios supported by the host.

**Unresolved historical point:** The Stage 5 default discrepancy should be traced to the actual source/history before labelling it a regression caused by a particular change. The transferable lesson is to verify initial-state contracts and detect unintended effects.

## 4. Inspect the significant rendered states of the learner journey

**Observed need:** Defects arose or became obvious only after particular actions: Stage 3 feedback after prediction, the crowded Stage 4 quadratic subsection, Stage 7 tooltip appearance and the Finish recap. One initial screenshot per stage was insufficient.

**Recommended rule:** Create an activity-appropriate **visual-state review matrix** derived from the approved experience specification. Capture and inspect the states that materially change the mathematics, instruction, feedback or controls.

Typical candidates:

- Initial entry for each main stage.
- Different graph/function/subsection selections.
- Slider min/mid/max and representative dragged states.
- Before and after prediction/check.
- Incorrect answer, visible hint and assisted retry.
- Completion and full worked-solution recap.
- Return to a stage or subsection after previous interaction.
- Relevant zero or crossing cases.

For the Integration activity, representative phone sizes used in review were **390 × 844** and **393 × 852**. Treat these as tested examples, not universal device breakpoints. Verify responsive layout at additional small/large and enlarged-text configurations as warranted.

Screenshots are evidence for visual review, not proof of interaction correctness or accessibility. The engineering workflow should combine automated checking with actual rendered inspection and, where available, representative device testing.

## 5. Allocate mobile space without compromising the mathematical focal point

**Observed need:** Stage 6 had available vertical space below its explanation that could accommodate improved controls without shrinking the graph. Stage 7 had room for four calculation lines in its Finish state. The Stage 7 hint needed either more usable width or a separate centred equation.

**Recommended rule:** Responsive layout should account for the *meaning and priority* of regions, not just mechanical equal divisions. Inspect unused space and long mathematical expressions before compressing a graph, reducing readability or adding scroll.

Engineering review should cover:

- Graph dimensions and stable mathematical coordinate frame across states, where comparisons require stability.
- Adequate continuous-control size and touch targets, including sliders inside multi-column layouts.
- Tooltip content sizing and wrapping, without globally changing all tooltips for a local problem.
- Centred equation groups that preserve their logical equality structure.
- Distinguishing permitted overlay behaviour from accidental clipping. **Do not introduce a collision-avoidance system merely because a tooltip can overlap another control** when the approved behaviour allows temporary overlap.
- No unintended horizontal overflow or ordinary page scrolling in the approved single-screen experience, while preserving accessibility requirements.

**Verification:** capture longest formula/longest instruction/expanded hint/Finish states, not only typical short content.

## 6. Use animation contracts and lifecycle tests

**Observed need:** Stage 3 required reducing its pre-animation wait from **4,280 ms to 2,140 ms**, while keeping the animation duration unchanged (900 ms in the discussed implementation).

**Recommended rule:** Represent distinct animation concerns separately: start delay, running duration, easing, replayability, cancellation/cleanup and reduced-motion behaviour. A requested change to one must not silently alter the others.

Check for stale callbacks or duplicate animations during navigation, stage re-entry and rapid function switching. Confirm that the explanatory and predictive learning states are coherent both before and after animations, and that animations do not leak answers prematurely.

The stated millisecond values are **Integration-specific**, not engineering defaults for future visuals.

## 7. Learning records need defensible educational semantics

**Observed need:** The Integration review distinguished function selection, the function visible when a stage loads, prediction submission, prediction demonstration, subsection viewing and attempts. A `division-rule-viewed` event and improved stage-change context were specifically discussed and approved for Integration.

**Recommended rule:** Document event meanings and the conditions under which events are emitted, with a stable host-facing contract. Distinguish:

- **Exposure:** the interface displayed an object or subsection.
- **Interaction:** the student selected or manipulated something.
- **Commitment/attempt:** the student submitted a choice or result.
- **Assistance:** the student requested help.
- **Outcome:** what the task demonstrated under its rules.

Do not infer understanding, reading or mastery solely from a view or interaction event. Ensure initial visibility is captured where educationally required; avoid duplicate events on harmless rerenders. Revisit/restart and separate attempts must have clear semantics.

**Engineering responsibility:** type/schema compatibility, event identity, lifecycle correctness, durable delivery where required, and regression tests for consumers. **Design responsibility:** deciding which learner events actually matter and how their evidence may be interpreted.

## 8. Keep technical changes bounded and protect unrelated stages

**Observed need:** Small agreed changes sometimes produced or coincided with unrelated differences, including the Stage 5 initial boundary discrepancy. Local tooltip or layout issues also invited broad framework changes that were unnecessary for the approved design.

**Recommended rule:** Prefer a narrow, traceable change surface for refinements. For a scoped update, identify:

- Which approved behaviour is intended to change.
- Which nearby and shared behaviours must remain invariant.
- What regression checks will demonstrate that they stayed invariant.
- Whether a shared component, default or state contract will affect other stages or activities.

Recheck all affected stages after changes to shared mathematical, navigation, tooltip or layout utilities. Test the full student journey when a shared utility can alter it. A passing targeted unit test is not sufficient evidence that an unrelated stage stayed unchanged.

If an implementation solution requires changing educational wording, adding a control, changing the graph or altering assessment, check the **current autonomy contract**. Escalate if that decision is protected; do not silently extend the scope.

## 9. Keep mathematical model, layout and rendering responsibilities explicit

**Observed need:** Integration combines D3 interactive graph geometry, React-managed educational state, mathematical expressions, estimates, and conditional instructions across seven stages.

**Recommended review, not a prescribed rewrite:** Check whether existing engineering guidance adequately defines boundaries among:

- Mathematical domain calculations and validation.
- Stateful learner interactions and navigation/assessment.
- Pure graph/layout calculations (coordinate transformations, positions and bounds).
- Rendering of shapes, annotations and mathematical notation.
- Educational copy and derived presentation state.

The existing project preference has been to use React for rendering and D3 for layout/math-related visual computation where appropriate, with functional state/data transformations. Codex should verify and retain the actual current engineering conventions; this retrospective does **not** authorise an architectural rewrite, new framework or global CSS change.

Extraction or reuse should be justified by real shared behaviour and regression risk, not by a desire for abstraction alone.

## 10. Treat accessible interaction and mathematical communication as verification obligations

The existing *Great Maths Visuals* guide makes accessibility a quality requirement; this handover does not claim that Integration has met every accessibility criterion.

Verify that engineering guidance addresses:

- Accessible equivalents for essential drag or pointer-only operations, including touch assistive technologies where relevant.
- Keyboard/focus behaviour, discernible control names, appropriate hit areas, and support for enlarged text.
- Correct reading order and accessible descriptions for changing mathematical expressions and feedback.
- Animations under reduced-motion preferences.
- Focus and announcement behaviour of hints, assessment responses and navigation.
- Explicit tracking of deferred requirements: milestone acceptance does not imply complete accessibility compliance.

Do not equate screenshot review, automated browser tests, or mathematical unit tests with end-to-end accessibility verification.

## 11. Engineering handoff and documentation: follow current design authority

Engineering updates should reference the **living experience specification** for current student-facing behaviour, the **decision log** for the reasons behind consequential choices, and the **autonomy contract** for the scope of technical/educational authority currently delegated to AI.

For every major implementation phase or substantive refinement:

1. Check which educational requirements are current, protected, proposed or superseded.
2. Report conflicts and uncertainty before implementing protected design changes.
3. Independently resolve ordinary engineering details within delegated authority.
4. Keep technical documentation aligned with actual behaviour and verified tests.
5. Clearly distinguish implemented and tested work from proposed future work or unverified assumptions.
6. Make the verification report learner-relevant: describe what was checked in the actual mathematical experience, not just test counts.

The AI Support Guide owns the *phase/autonomy policy*. The Engineering Guide should provide only the operational technical checks needed to respect it, without duplicating the full policy or constraining AI in an initial fully autonomous design phase.

---

## Suggested validation scenarios drawn from Integration

These are illustrative tests to adapt to the existing test suite, not a mandated file or test-name list.

| Scenario | Expected engineering evidence |
|---|---|
| Stage 3 fresh entry vs return | Fresh default is correct; returning preserves prior relevant state |
| Stage 3 animation delay change | Start delay changes independently; duration and replay remain correct |
| Stage 4 switch from quadratic to rule and back | Graph/rectangle settings and relevant learner state remain consistent |
| Stage 5 fresh entry and navigation return | Approved initial `b` on fresh entry; previously explored state on return |
| Stage 6 selection of any two supported curves | Displayed height, integrand, shaded gap and area agree |
| Stage 6 crossing or equal curves | Non-negative geometric area and correct special-case presentation |
| Stage 7 arbitrary supported interval | All worked calculation lines and final result agree mathematically |
| Stage 7 visible hint | Full equation readable at representative portrait viewport widths |
| Stage 7 Finish screen | No clipping; coherent connected calculation; answer feedback and navigation remain present |
| Restart/new attempt | Reset rules and learner-record/attempt identity remain consistent |
| Shared display/tooltip/component change | Previously approved neighbouring stages have no unintended visual or behavioural change |

## Requested output from Codex

Prepare a **focused update** to the existing Step Visuals Engineering Guide, not an Integration-only replacement. In the completion report provide:

1. A brief mapping of each recommendation to **already covered / strengthened / new / not generalised**, with existing section references.
2. The sections actually changed and the reason for each significant addition.
3. Technical claims verified from the repository versus retrospective observations not independently confirmed.
4. Any unresolved engineering risk or educational decision that requires separate review.
5. Confirmation that the guide remains compatible with the two v1.2 design/process guides and that no implementation or learner-facing design changes were made as part of this documentation task.

**End of handover.**
