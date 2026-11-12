# Integration — seven-stage implementation plan

Started: 23 October 2026. Planning review completed: 24 October 2026. Workspace: `/Users/peterdomokos/projects/step-visuals`. Branch: `feat/step-visuals`.

**Status: implementation plan approved, with the three final decisions in §11 incorporated.** The current task is limited to updating this document; implementation will be performed by GPT-6.1 Sol in the next phase. No unresolved educational questions remain. Approval B remains a later physical-iPhone review.

## Handoff status and resumption instructions

This document is the durable record of the architecture investigation, saved before the credit interruption and reviewed after resumption. No investigation needs repeating merely because the implementation model changes.

- Read completely: the approved seven-stage specification, both design guides, the engineering guide, current six-stage experience specification and fidelity review, root `AGENTS.md`, and installed Next.js `use-client` guide. Inspected the six-stage reference image as historical context only.
- Inspected current Integration model, reducer, graph/layout/presentation, both renderers, input and animation adapters, records/callbacks, lab hosting, Tooltip, CSS, mathematical/state/browser tests and isolation checks.
- Verified workspace/branch. HEAD was `9354aad`; branch was one commit ahead of origin. There is substantial pre-existing staged work, including Integration, documentation and `next.config.ts`. The requested plan file existed but was empty/untracked. Preserve all pre-existing changes; do not reset or stage them incidentally.
- Independently calculated the new rectangle estimates and both approved area tables; values are recorded below. These are arithmetic audit results, not tests of an implementation that does not yet exist.
- No application source, tests, other documentation, dependencies or server configuration has been changed in this planning phase.
- Completed planning checks: source/plan consistency review, all six reference links resolve, Markdown fences balance, and the working-tree review shows no new tracked-file edits outside this plan. The mathematical audit and read-only browser probe are recorded below; no application regression suite or production build was run for this documentation-only phase.
- The former Stage 3 question is resolved by the user's final decision: replay, then restore. The user also locked Stage 7 rechecking after answer edits and Stage 5's zero-area annotation. These decisions override conflicting earlier plan wording and are incorporated throughout this document; §11 records all three.

### Existing-server probe: evidence and limit

During the 23 October read-only planning probe, the existing listener on port 3171 served `/step-visuals`, but a Chromium click did not open the burger menu and the client-hydration readiness check timed out. A diagnostic also reported an invalid HTTP response for the development HMR WebSocket handshake. No HTTP script-response failure or JavaScript exception establishing the cause was captured. These observations **do not establish that HMR caused the missing interaction**, nor that application source is defective.

The server was not restarted and no configuration was changed. Therefore this probe did not provide a usable interactive baseline or seven-stage screenshot evidence. Sol must establish a functioning hydrated development baseline first, checking the exact listener, browser-loaded scripts and actual menu/drag interaction; a successful document response alone is insufficient. Diagnose before changing application source. No current LAN URL is certified by this planning document.

## 1. Authority and labels

**LOCKED REQUIREMENTS** come from [the approved seven-stage design][approved], especially its numbered stage sections and shared rules B/C, as amended by the user's three final decisions recorded in §11. Those final decisions take precedence over conflicting earlier wording. The current [experience specification][experience] supplies preserved Stage 1–2 details and existing compatible behaviour. The [quality guide][quality], [AI support guide][support] and [engineering guide][engineering] govern their respective responsibilities subject to the current handover. The old [fidelity review][review] is evidence of the six-stage implementation, not authority to retain superseded educational decisions.

This plan references exact copy blocks rather than reproducing the full specification. Sol must copy the approved strings literally, including causal words, instructions, choice labels, tooltip paragraphs and feedback. In the matrices, **S** means explicitly specified, **P** means preserved approved behaviour, and **T** means a technical decision. These classifications do not claim implementation or verification has occurred.

The latest planning-only instruction overrides every earlier instruction to implement automatically. In Phase 1, write only this file. In Phase 2, after approval, changes belong inside `src/app/step-visuals/` plus the two expressly authorised activity documents. No new package, application integration, global style, Card 1 change, commit or push is needed.

## 2. Repository findings that determine the architecture

All source paths below are relative to `src/app/step-visuals/`; Integration paths are under `activities/integration-area/` unless qualified.

| Current capability | Evidence and consequence |
| --- | --- |
| One React activity owner | `integration-activity.tsx` owns the reducer, suspension, host request keys, focus and notifications. Keep this public mount and callback boundary. |
| Approved introductory implementation | `intro-stages.tsx`, its CSS, `display-policy.ts` and the first two `presentation.ts` branches implement the preserved controls/copy. Their DOM, display policy and interaction behaviour are the regression baseline. |
| Finite polynomial family | `model.ts` stores constant/linear/quadratic coefficients and analytic primitives. The existing ID `parabola` means **3x²**, not x²; add a distinct `square` ID for x². |
| Whole-interval ordering | `orderedRegion()` throws on interior crossings. `areaBetween()` intentionally validates one globally ordered interval. Keep these honest primitives; add a segmented geometric-area analysis instead of weakening validation or applying `abs()` to a signed total. |
| Stage-number assumptions | Stage types are duplicated in `model.ts` and `records.ts`; numeric gates appear throughout the reducer, layouts, renderer, slider and tests. Insert the new Stage 4 deliberately. Old 4/5/6 become 5/6/7; do not do an unchecked global number replacement. |
| Navigation snapshots | `previousPanels`/`nextPanels` already preserve visited panels. Retain this mechanism for seven outer stages, but remove the final stage's `region → limits → calculate` navigation and its special merge rules. |
| Stage 3 answer loss on function changes | Current function switching resets the single prediction/progress pair. It does not preserve a first answer per function. Add a small activity-specific comparison cache; apply the approved replay-then-restore policy in §11.1. |
| Existing animation timing | `use-stage-motion.ts` exports `STAGE_THREE_START_DELAY_MS = 2280`, duration 900ms; local settlement is 150ms. The new handover expressly says to inspect the existing delay and add 2,000ms: planned new delay **4280ms**, not 2280ms and not an invented baseline. |
| Continuous input safeguards | `use-boundary-pointer.ts`, `boundary-slider.tsx`, `IntroRange` and reducer transactions already preserve offset, final release, capture ownership, interruption and stale-action rejection. Reuse them; relocate the integer-release policy from old Stage 4 to new Stage 5 only. |
| Graph assumptions to remove locally | `graph-layout.ts` uses one frame for old Stages 1–5, clips the exploratory parabola at x=3, places final-stage function labels close together and uses a capped strip. `integration-graph.tsx` does not currently use the prepared `selected` curve flag to subdue unused curves. These conflict with the new requirements. |
| Existing mathematical typography | `MathExpression`/`MathPart`, `MathValue` and the integral renderer already support composed fractions. Extend locally for the derivative; no TeX dependency is necessary. |
| Tooltip | Existing `platform/web/tooltip.tsx` accepts rich React content, uses a portal, visual-viewport placement and Escape/outside dismissal. Reuse its API/styles. Key the Stage 7 hint by problem revision to close it after a region change. |
| Records | Current records are schema/activity version 1, with a globally ordered `top/bottom` region. Crossings and a changed stage sequence require explicit versioning, not relabelling the old payload. Callback delivery and restart archives already exist. |
| Layout | The later-stage grid has minimum graph height 220px and fixed panel reservations tailored to six stages. Those reservations are insufficient for the longer new content. `integrationPlaneLayout` itself requires 200px. The shared measurement hook supports 160px, but that does not authorise shrinking a graph below a legible size. |

### Reuse decisions

**TECHNICAL DECISIONS:** reuse React state/rendering, focused D3 packages, analytic polynomial evaluation, function plotting, clipping concepts, coordinate inversion/calibration, existing native input transaction safeguards, Tooltip, notification delivery, lab menu and public activity hosting. Keep all stage-specific mathematics, controls, placement policies and styles local to Integration.

Do not reuse Card 1's root reducer, root marker layout, pedagogical stages or frame reservations. Do not change shared axes or measurements just to fit Integration. The current `core/` directory is not a general-purpose calculus framework. Avoid changing Stage 2's rectangle slider while adding the different six-stop Stage 4 control.

## 3. Proposed source/component structure

### Files to modify

| File | Concrete change |
| --- | --- |
| `model.ts` | Single seven-stage type; add `square`; distinguish selected region from ordered segment; introduce segmented region analysis and lower/upper quadratic sums; semantic validation helpers. Preserve Stage 1–2 analytic results. |
| `learning.ts` | Add Stage 4; migrate later stage gates; per-function comparison evidence; six-stop refinement state; crossing-compatible selections; single-screen Stage 7; empty-versus-invalid feedback; preserve transaction and assessment guards. |
| `records.ts` | Versioned seven-stage payloads, selected curves plus ordered pieces, Stage 4 mode/refinement events and Stage 3 function/answer identities. Preserve archived facts and delivery envelope. |
| `graph-layout.ts` | Explicit frame profiles, split area paths, enclosing rectangle and paired approximations, thin arrow, region labels/leader lines, below-axis boundary label lanes, function-label separation. |
| `integration-graph.tsx` | Render prepared scene layers; use curve emphasis; replace caps with arrowheads in 6/7; no final-stage drag handles; memoise planes by frame profile, not old `stage===6`. |
| `presentation.ts` | Literal approved stage copy and branches; no quadratic area value in Stage 3; exact new main-screen content/tooltip models; final task always exposes the unsolved integral. |
| `math-presentation.ts` | Stage-specific pure math scenes, Stage 4 fraction/derivative tokens, revised Stage 5 explanations, honest crossing height expression and exact final integrals. Avoid preparing unrelated stage mathematics on every drag. |
| `integration-activity.tsx` | Route to seven-stage renderers, focus only on meaningful navigation/Finish/restart; retain lifecycle and callbacks. |
| `later-stages.tsx` | Reduce to local composition/header/navigation and dispatch to stage content components. Remove the final three-substep flow. |
| `later-stages.module.css` | Stage-specific reserved rows, approved selector arrangements, stable feedback areas, responsive reflow. Do not apply new selectors to introductory content. |
| `integration.module.css` | Add graph-role classes locally: selected/context curves, lower/upper bounds, thin arrows, labels. Preserve existing Stage 1–2 default styles. |
| `boundary-slider.tsx` | Stage 5 integer policy, Stage 6 continuous range [1,4], prepared visible labels/readouts; keep native range/cancellation semantics. |
| `use-stage-motion.ts` | 4280ms delay, existing 900ms demonstration/150ms settlement, Stage 3 replay identity and new Stage 5 gate; pause on suspension/hidden page and reject old frames. |
| `public.ts` | Export the resulting record contracts with explicit versions; preserve existing activity entry and all Card 1 exports. |
| Existing Integration tests and `tests/isolation.spec.ts` | Replace superseded six-stage assertions; extend new local pure-module coverage and browser fidelity checks. Do not weaken surviving safeguards. |

`intro-stages.tsx` may need narrow type/selector adaptations if the region contract changes; preserve its markup, exact copy, slider values and styles. `display-policy.ts`, introductory CSS, lab registry/menu and Card 1 implementation require no functional changes. `notifications.ts` and the lab record consumer should retain their logic; type-only adaptations are permitted if versioned record unions require them.

### Small new activity-local components

- `growth-stage.tsx`: Stage 3 selector, question, choices, result and transition.
- `division-stage.tsx`: Stage 4 tabs, two estimate outputs, formulas and tooltip; uses a local `division-refinement-slider.tsx` adapter if separating its native transaction handlers improves clarity.
- `offset-area-stage.tsx`: Stage 5 boundary control, three explanations and constant tooltip.
- `between-curves-stage.tsx`: Stage 6's **left stacked selectors/right slider** and height/area feedback.
- `calculation-stage.tsx`: Stage 7's simultaneous three sections, assessment form and recap.
- `math-value.tsx`: move the existing local fraction renderer and integral rendering here for these Integration consumers. Preserve semantic descriptions and stylesheet roles; this is not a shared maths framework.
- `stage-controls.tsx`: local curve-select and progression renderers with explicit layout variants, native semantics and prepared labels. No stage-specific mathematical decisions inside JSX.
- `use-calculation-viewport.ts`: browser-only focus/keyboard visibility handling if required by the focused prototype; no mathematical state.
- `legacy-records.ts`: preserve the current v1 record definitions if needed for the public version union described below.

New files use lowercase/hyphenated names. Do not split every small SVG primitive or sentence into a file. Each content component receives prepared presentation/mathematics, current control values, and semantic callbacks. `IntegrationGraph` is mounted at a stable location above the current stage's controls; do not remount it for feedback, selections or a tooltip.

## 4. Mathematical contracts and computational decisions

### 4.1 Function IDs and stage policies

**TECHNICAL DECISIONS:** preserve existing function IDs (`flat=2`, `rising=x`, `lower=x²−3x`, `upper=9+2x`, `parabola=3x²`, `axis=0`); add `square=x²`. Keep Stage 2's comparison type restricted to `flat | rising`. Introduce `GrowthFunction = flat | rising | square` and `DivisionFunction = rising | square`. Do not make the new quadratic available in Stage 2.

Use named stage policy functions for `boundaryBounds`, `releasePolicy`, function inventory and frame profile. They must explicitly return:

| Stage | Authoritative variable / accepted input | Policy |
| --- | --- | --- |
| 1 | b in [0,4], initial 1 | Continuous movement and continuous commit; existing one-decimal display calculation. |
| 2 | Function flat/rising; n in integers 1–128, initial 4; a=0,b=3 | Existing logarithmic native track; preserve keyboard increments and right sums. |
| 3 | Growth function; demonstration p in [0,1]; first answer in {2,4,8} | b=2+2p; no editable boundary. |
| 4 | Division tab; n in {4,8,16,32,64,128}; a=0,b=3 | Six-stop track only for square mode; no boundary editor. |
| 5 | b in [1,4], initial 4; a=1 | Continuous candidate/settling, integer committed b. |
| 6 | Two selected curves; b in [1,4], initial 3; a=1 | Continuous commit; equal/reversed choices and b=1 valid. |
| 7 | Two selected curves; one of [0,1],[1,2],[0,2], initial [1,2] | Atomic interval selection; no boundary edits; explicit numeric Check. |

### 4.2 Selected regions versus locally ordered pieces

Keep `areaBetween(top,bottom,a,b)` as the strict analytic integral of an **ordered** piece. Add these activity-local readonly contracts (names are fixed technical choices; implementation may refine type syntax):

```ts
type CurveSelection = readonly [IntegrationFunction, IntegrationFunction];
type RegionSelection = Readonly<{ curves: CurveSelection; a: number; b: number }>;
type OrderedPiece = Readonly<{
  a: number; b: number; top: IntegrationFunction; bottom: IntegrationFunction;
}>;
type RegionAnalysis = Readonly<{
  selection: RegionSelection;
  pieces: readonly OrderedPiece[];
  crossings: readonly number[];
  area: number;
  identical: boolean;
}>;
```

The selected pair and interval are canonical; `top` and `bottom` are **derived per piece**, never student-defined global facts. Replace the current duplicated `state.selection` plus global ordered `state.region` with one `RegionSelection` in the active/saved panel. Introductory stages select their known function/axis pair. `effectiveRegion` returns a selection with the active continuous boundary, without rounding. Scene/presentation/record preparation all analyse that same effective or committed selection as appropriate.

Implement `analyseRegion(selection)`:

1. Validate known IDs, finite endpoints and a≤b; stage policy separately limits the permitted domain.
2. Equal functions or a=b produce area 0, no filled pieces and no height arrow. Preserve the actual choices and interval in records.
3. Subtract coefficient vectors and solve their polynomial difference for real roots. Handle constant, linear, quadratic, double-root and identically-zero cases explicitly.
4. Retain strictly interior roots; sort/deduplicate them; partition [a,b]. For each nonzero interval, determine upper/lower using its midpoint and validate the entire ordered gap analytically.
5. Integrate each ordered piece using the existing difference-of-powers formula; sum the **non-negative pieces**. Do not compute `abs(integral(f−g))`.
6. Return finite immutable plain data. Negative results beyond numerical tolerance are a defect, not a value to mask with `abs` or broad clamping.

For this bounded quadratic family use a stable quadratic-root calculation (q-formula with a repeated-root fallback), linear fallback and scale-aware discriminant tolerance. Root merging tolerance: `1e-12 × max(1, |a|, |b|)`; do not shift a user's boundary onto a crossing. Explicitly test values just below/at/above 3 and ensure a tolerance never suppresses an ordinary visible lobe. Display rounding and assessment tolerance are separate.

The default Stage 6 pair has height `4x−x²` throughout [1,4]. Axis/parabola below/at 3 has `3x−x²`; above 3 over a crossing interval prepare `h(x) = |x² − 3x|` and the **approved crossing sentence**. This is the compact, mathematically derived distance expression; do not leave `3x−x²` claiming a negative height after 3, and do not add a permanently visible piecewise integral. For same curves omit the formula as currently approved and show the exact zero-gap explanation.

### 4.3 Stage 4 lower/upper sums

For f(x)=x² on [0,b], Δx=b/n:

```text
L_n = b³ (n−1)(2n−1) / (6n²)
U_n = b³ (n+1)(2n+1) / (6n²)
Exact area = b³/3
U_n − L_n = b³/n
```

Use analytic formulas for values and explicit endpoint rectangles for geometry. Independently test against direct sums of endpoint heights times Δx. At b=3 the audit independently obtained:

| n | Lower sum | Upper sum | Required one-decimal outputs |
| --- | ---: | ---: | --- |
| 4 | 5.90625 | 12.65625 | 5.9 / 12.7 |
| 8 | 7.3828125 | 10.7578125 | 7.4 / 10.8 |
| 16 | 8.173828125 | 9.861328125 | 8.2 / 9.9 |
| 32 | 8.58251953125 | 9.42626953125 | 8.6 / 9.4 |
| 64 | 8.7901611328125 | 9.2120361328125 | 8.8 / 9.2 |
| 128 | 8.894805908203125 | 9.105743408203125 | 8.9 / 9.1 |

Map the native range index 0…5 to the six counts. Arrow keys change one stop; Home/End reach 4/128; tapping the track works. Preserve reducer-owned transaction/cancel semantics and record only a changed committed count. Keep this separate from Stage 2's continuous logarithmic track and all integer counts.

### 4.4 Precision and mathematical display

- **Stage 1 preserved exception:** continuous geometry; displayed b rounded to one decimal; the displayed calculation uses that displayed b, as explicitly approved. Do not export this simplification to other stages.
- **Stage 2:** existing exact internal right sums, at most two displayed decimals, `≈` for non-exact estimates.
- **Stage 3:** analytic factors 2/4/8; numerical quadratic before/after areas and `b³/3` are absent from visible content, SVG descriptions, accessibility labels and hidden sizing nodes. Symbolic function heights and the approved scaling explanation remain allowed.
- **Stage 4:** one decimal for both estimate outputs; show them as estimates/with approximation notation, never exact finite proofs. Exact formulas and fractions remain exact.
- **Stage 5:** one continuous effective b drives marker, shading and mathematics through drag and settlement. At integer settlement use the specified exact fractions/mixed numbers. During fractional motion use the same at-most-two-decimal boundary formatting throughout, with `≈` when rounded; keep symbolic `b × b` in a calculation where rounded numeric substitution would falsely imply exact equality. Compute whole and wanted areas from the unrounded effective b, format independently with `≈`, and retain exact removed ½. Preserve the existing dynamic symbolic-b technique; do not silently substitute a rounded whole b into the graph's true calculation.
- **Stage 6:** full real b internally, at most two decimals with `≈` in readouts; exact small rational results where they are established. Include denominator 6 for 31/6. Do not reconstruct canonical area from a formatted label.
- **Stage 7:** all supported results are integers. Preserve full-string finite decimal/scientific parsing and acceptance tolerance `1e-9 + 1e-9 × max(1, |expected|)`. Accept 5, +5.0 and 5e0; reject 5.01 for 5, non-finite values and partial strings. Empty input gets the newly specified empty message. Nonempty invalid input can retain the existing approved numeric-validation wording; it is not an attempt.

Normalise negative zero in display/records. Approximation flags must not leak into the exact assessment calculation. No generic symbolic algebra or quadrature dependency is required.

### 4.5 Independent mathematical verification cases

The planning arithmetic agrees with both approved tables:

| Stage 6 pair | [1,3] | [1,4] |
| --- | --- | --- |
| x / (x²−3x) | 22/3 | 9 |
| x / 0 | 4 | 15/2 |
| (x²−3x) / 0 | 10/3 | 31/6 = 10/3 + 11/6 |
| Each identical pair | 0 | 0 |

For crossing verification at b=4, the **signed** parabola integral is −3/2; its absolute total 3/2 is wrong. The required geometric result is 31/6. This is a strong regression against the forbidden shortcut.

| Stage 7 pair | [0,1] | [1,2] | [0,2] |
| --- | ---: | ---: | ---: |
| (9+2x) / 3x² | 9 | 5 | 14 |
| (9+2x) / 0 | 10 | 12 | 22 |
| 3x² / 0 | 1 | 7 | 8 |
| Each identical pair | 0 | 0 | 0 |

Test all **27 ordered selector/interval combinations**, not just the 12 displayed result categories: 3×3 curve selections ×3 intervals. Test both orders for each distinct pair and each of the three identical pairs separately. Stage 5 settled table remains `(whole, removed, desired)` = `(½,½,0)`, `(2,½,1½)`, `(4½,½,4)`, `(8,½,7½)` for b=1,2,3,4.

## 5. State, navigation, transactions and records

### 5.1 Keep one semantic owner

**TECHNICAL DECISION:** retain the existing pure `integrationReducer`; no second drag store, D3 transition owner or effect-inferred assessment. Separate concepts in its types/helpers without introducing a general learning engine.

The active `IntegrationPanel` retains stage-specific values and a canonical `RegionSelection`. Keep `previousPanels`/`nextPanels` as inactive snapshots, with exactly one navigation panel per outer stage. Enter a new stage with its approved initial values once; revisiting restores that stage's saved selections/counts/boundaries/answer state. Remove the final-stage `region` and `limits` parts. New Stage 7 has only task versus finished recap; its three titled sections are presentation, not learning transitions.

Stage 2 and new Stage 4 maintain independent rectangle counts. Stage 3 and Stage 4 maintain independent function selections; the initial Stage 4 tab is always rising on first entry, regardless of the Stage 3 selection. Function switching within Stage 4 preserves its last quadratic count; initial first entry uses four. Navigating back from Stage 7 goes directly to Stage 6; forward returns to the same Stage 7 problem and valid checked state unless its own choices changed.

`revision` continues to invalidate stale input/timer actions. `problemRevision` identifies the current final calculation. Every actual curve or interval change increments it, clears draft/feedback/checked outcome and closes the hint—even if the curve order merely reverses, the area happens to stay equal, or the student later returns to old choices. Re-selecting the currently selected value is a no-op.

### 5.2 Stage 3 comparison state

Store an immutable cache for the three functions containing first prediction/outcome and a comparison identity; the currently displayed animation progress remains one reducer-owned scalar. Do not duplicate answers in component state. Selecting a previously answered function replays its animation from b=2 to b=4, then restores its previously selected answer and feedback. Keep that function's Next eligibility throughout the replay. Do not request another answer or record another prediction. Returning to Stage 3 through outer Previous/Next restores the completed comparison immediately at b=4, without replay or duplicate prediction events.

The function-change action increments revision/comparison identity so old animation frames cannot complete the new function's run. A cold entry starts at p=0; a new run waits **4280ms**, then uses the established 900ms ease-out animation. Reduced motion shows p=1 immediately. Animate before accepting a new answer. Reserve the below-graph question/answer space; the approved question becomes available after the demonstration. Preserve the selected answer visibly after it is recorded. The current graph's first answer cannot be overwritten by another choice.

Pause the timer on host suspension or page hiding; resume an unfinished run from its mathematical progress without counting invisible frames as an answer. Keep timer elapsed time in the browser adapter, tagged to the run identity; only progress belongs to the reducer. A completed run produces one `comparison-demonstrated` fact, never animation-frame history. Replaying a preserved comparison must not resubmit its answer or completion evidence.

### 5.3 Stage 5/6 manipulation

Retain begin → preview → release/settle → commit/cancel. Graph pointer release uses final pointer coordinates; native range release uses the final input value. Preserve grab offset, capture transfer guard (`event.target === event.currentTarget`), secondary-pointer rejection, stale revision/transaction guards, viewport/visibility/blur interruption and restoration of the last committed value.

Only new Stage 5's release starts the 150ms reducer-owned easing transaction towards the nearest allowed integer. Reduced motion commits immediately. Cancel during settlement restores the previous committed boundary and emits no placement. Keyboard/native non-drag changes settle directly to the permitted integer. New Stage 6 retains any finite clamped real release value; keyboard increments remain 0.1 (with the existing larger-step policy if supported). No Stage 1 or Card 1 snapping policy changes.

Crossing analysis must use the **current candidate**, including when b first passes 3. It cannot wait until release to correct top/bottom, shading or area. Numeric mathematics, paths and arrow use the same effective revision.

### 5.4 Stage 7 assessment and lifecycle

All three sections remain editable on the one task screen. Curve/interval changes are free choices; no correctness state attaches to them.

| Accepted action | State/evidence effect |
| --- | --- |
| Edit answer | On an actual draft change, clear feedback and current Finish eligibility. Preserve earlier checked submissions in historical records, but require another Check even if the student edits back to the same text. No learning event per keystroke. |
| Check empty | Show exactly `Enter an area before checking.` No attempt/event/completion; cannot establish Finish eligibility. |
| Check other invalid text | Existing numeric validation; no attempt. |
| Check finite number | Record submitted value, exact expected value, correctness, assistance-at-submission and problem identity. Show exact approved feedback. Enable Finish irrespective of correctness. |
| Show hint after wrong Check | Mount the existing anchored Tooltip, record actual first request under existing evidence rules and retain assistance across retries/problem changes. No numerical answer disclosure for distinct curves. |
| Change curve/interval | Clear draft, feedback, checked value and open hint; disable Finish. Preserve historical attempts/assistance. |
| Finish | Guard both current problem identity and that no answer edit has occurred since the most recent Check. Complete once using the most recently checked answer; never use an earlier submission or an unchecked draft. Present the approved recap with wrong submitted answer where applicable. |
| Previous/Next outer navigation | Preserve stage memory and history; no assessment or extra setup screens. |
| Restart/explicit exit/suspend | Preserve established session/archive/callback semantics. No persistence or refresh restoration. |

Use a reducer-owned answer revision (or equivalent explicit invalidation) alongside `problemRevision`: increment it when the draft actually changes, and capture it in the current checked submission. Finish requires a Check matching both revisions. Editing invalidates current eligibility without deleting historical Check records. Checking the revised draft enables Finish regardless of correctness; empty or invalid submissions cannot restore eligibility. Reject stale Finish actions after an edit, including an edit followed by restoration of the old text. This eligibility metadata is separate from the submitted mathematical values retained in the learning record.

The new specification names the assessment action **Check calculation** throughout. Keep that label on repeated submissions; do not carry forward `Check again` merely because the older renderer uses it. Preserve existing **Your area calculation**, **Start again**, **Your answer:** and **Correct area:** recap wording where the approved design permits the existing completion pattern.

### 5.5 Record contract and compatibility

**TECHNICAL DECISION:** emit `schemaVersion: 2`, `activityVersion: 2` for the seven-stage activity. Its region represents a selected pair plus interval and, where materialised, ordered pieces; it must never describe a crossing region as globally `top/bottom`. Use `stage: 1…7` and an additional stable semantic stage ID in v2 records to avoid future renumbering ambiguity.

Keep immutable mathematical values, opaque attempt IDs and session-wide ordered event IDs. Add Stage 4 tab/count facts; extend Stage 3 function and multiplier unions. Record committed region/boundary selections with enough information to reconstruct their pieces. Do not record derived path data, pointer/animation frames, cancelled transactions or keystrokes.

Retain the v1 definitions as explicitly named legacy types and expose discriminated v1/v2 public record unions where the existing callback names are exported. The live new reducer owns v2 records only. Existing notification delivery is envelope-based and can deliver either version without reinterpreting old stage numbers. Preserve old archived fixtures and add v2 tests; do not fabricate migration or page-refresh recovery. No main application currently consumes Integration-specific region internals; still document the version distinction for future consumers. A typed consumer that previously assumed only v1 must narrow by version before reading new region fields.

The callback sequence remains accepted `onEvent`, interleaved `onComplete` after the completion event, accumulated `onRecordsChange`, then explicit `onExit`. Check never calls onComplete. Incorrect Finish yields `outcome: incorrect`, `successMode: null`, submitted final calculation and true area. Correct Finish is independent unless calculation assistance was requested; explanatory tooltips in Stages 2/4/5 are not final-calculation assistance. Completed/partial archives survive Start again. Preserve Strict Mode/reentrancy/late-subscription safeguards and production console silence.

## 6. Pure graph/layout and annotation decisions

### 6.1 Frame profiles

Prepare a `frameProfile` from stage and the explicitly selected comparison mode, then memoise plane geometry by `{size, frameProfile}`. Never key it to feedback, n, b or pointer state. Stage 1–2 retain their current plane exactly.

| Profile | Planned mathematical domains/ticks | Reason |
| --- | --- | --- |
| Intro 1–2 | Existing x=[−0.5,4.5], y=[−3,5] | Preserve approved rendering. |
| Stage 3 flat/rising | Same existing domains | Extend the current interaction safely. |
| Stage 3 square | x=[−0.5,4.5], y=[−3,18]; explicit y ticks 0,4,8,12,16 | Show y(4)=16 truthfully; stable throughout the animation and feedback. |
| Stage 4 rising | x=[−0.2,3.3], y=[−0.3,3.3]; y ticks 0,1,2,3 | Enclosing rectangle to (3,3). |
| Stage 4 square | Same x; y=[−0.9,9.9]; y ticks 0,3,6,9 | Enclosing rectangle to (3,9). These proportional y ranges keep the zero axis at the same physical location between tabs. |
| Stages 5–6 | x=[−0.5,4.5], y=[−3,5] | Preserve meaningful continuity, include parabola minimum −2.25 and intersection at x=4. |
| Stage 7 | x=[−0.2,2.3], y=[−1,14]; x ticks 0,1,2 | Existing valid assessment domain, with local annotation gutters. Curves evaluated/rendered over [0,2]. |

These are technical framing choices, not changed mathematical domains of allowed student input. Unit scales may differ, as approved; visibly label the changed vertical scale. Do not auto-fit to the selected area or n. Physical graph boxes remain identical through each stage's modes, responses, movement and tooltip states; Stage 4 tabs may change labelled y scale but not graph position/dimensions. Stage-specific graph heights may differ to fit their approved compositions.

### 6.2 Scene composition

`integrationGraphLayout` composes pure plane, curve, area-piece, rectangle, boundary-label and annotation preparation. Output owned readonly data only. Use local D3 scales/`area`/`line`/linear paths; React owns all SVG nodes. Keep stable per-instance clip/arrow IDs in the renderer.

- Each ordered piece gets its own clipped filled path; include exact interval/crossing endpoints and quadratic landmarks. Reverse selectors must produce equivalent canonical geometry, not swapped fill semantics.
- Remove the exploratory parabola's obsolete clip at x=3 for new Stage 6; render it through x=4 and the frame's contextual extent, retaining true offscreen samples and clipping rather than y-clamping.
- Stage 4 enclosing rectangle is an actual mathematical rectangle, not a decorative bounding box. Draw the linear diagonal or the quadratic curve and under-curve region in the same plot. For square mode, prepare left- and right-endpoint rectangle arrays together; lower fill and upper outline/contrasting restrained fill must remain distinguishable at n=4 and converge visibly at n=128. No new legend text or selector is needed beyond the approved labelled outputs.
- Render identical-curve/zero-width areas as no fill paths. Do not retain a stroked degenerate area that appears to be a nonzero strip.
- Sampling error for a quadratic coefficient q over step h is at most `|q|h²/4` mathematical units; convert to pixels using the actual y scale. Require <0.25 CSS px in supported sizes. The existing 200 samples should comfortably meet this for the finite family; test it rather than relying on appearance. Area boundaries share the same landmarks; no smooth spline overshoot.

### 6.3 Thin distance arrows and correct curve labels

Replace `IntegrationStripScene.caps` with a thin line and two inward-facing endpoint arrowhead segments. Use ~1.25px stroke and small arrowheads; inset each end approximately 3 CSS px from the selected curve. Arrowhead size must shrink if necessary without extending through the curves. Arrow location/length is derived from the local ordered piece; record its mathematical x/height in the scene for tests.

Evaluate interior candidate x positions (midpoint, quarter/three-quarter positions, gap extrema and additional interior candidates when a short gap requires them). Score projected gap length and clearance from curve labels/boundaries; keep candidates inside the selected interval. Use deterministic tie-breaking and a stable preferred candidate where legible. Do not put the arrow at a crossing simply because it is the interval midpoint. Omit only for identical functions, zero width or a mathematically positive gap too small to draw safely at pixel resolution; never invent a minimum mathematical height. The textual exact height/area remains available.

Stage 7 upper-line label uses its upper-left area; the 3x² label is anchored near the middle of the parabola, with a short leader only if needed. Compute label/arrow clearance in layout data, not render-time algebra. Selected curves use existing emphasis; unused functions remain visible but subdued through `selected` roles. When the axis is selected, distinguish its selected role without changing the shared coordinate plane.

### 6.4 Boundary and region label lanes

New Stages 5–7 place a/b labels below the x-axis, anchored to the true x coordinate/guide. Reserve a local bottom annotation gutter rather than changing the shared `coordinatePlaneLayout` for Card 1. For 5–7 construct the compatible plain `CoordinatePlaneScene` locally with enough bottom clearance (initial budget 52px), using the same D3 projection conventions. Preserve the 1–2 branch exactly.

Use separate tick and boundary-label baselines. At b=a=1, retain both labels in two stable lanes; only the b handle is interactive. Test the entire range and 200% text, not just b=4. Stage 7 has guides and labels but no circles suggesting dragging and no slider/hit regions.

Stage 5's exact labels **Area left out** and **Area we want** must identify their actual regions when b>1. The small triangle cannot contain a full label at phone size: use compact external label positions inside the graph with restrained leader lines to its centroid and the desired region. At b=1, do not draw a desired-area fill or an **Area we want** label/leader. Instead, prepare a small restrained arrow pointing to the coincident boundaries with the exact label **Area we want = 0**. Keep **a = 1** and **b = 1** individually legible in their boundary-label lanes, and retain the actual excluded triangle and its **Area left out** label. Derive this state from the effective mathematical b, including settlement, rather than a rounded readout; b>1 retains the two original region labels. Give these labels priority over secondary curve-label positions and use local collision checks.

### 6.5 Performance and immutability

The existing `core/immutable.ts` recursively freezes newly prepared scenes in production as well as development. Preserve that shared policy in this task; do not change Card 1 behaviour to optimise Integration speculatively. Copy selected input data into owned scene/record objects before freezing, rather than freezing caller-owned state through a shared reference.

Memoise the plane and static labels by size/profile, rectangle geometry by function/count/frame, and each active stage's mathematical scene by its actual inputs. Do not build every stage's explanation on each pointer frame. Active drag/animation updates must retain the records reference and must not traverse, copy or append event history. At maximum Stage 4 refinement, only 256 rectangle primitives are required; no canvas or imperative D3 renderer is justified without a measured bottleneck.

Add focused layout/render timing diagnostics for continuous Stage 5/6 motion and Stage 4 at 128 rectangles, reporting the device/runtime and sample distribution rather than claiming a desktop result guarantees phone frame rate. If profiling shows unacceptable work, optimise the local preparation/cache boundaries first while retaining one reducer-owned mathematical state and final-coordinate/cancellation guarantees. Physical iPhone responsiveness remains a manual verification item.

## 7. Stage-by-stage fidelity checklist

The source column identifies the authoritative section; all quoted copy is a locator/check anchor, not permission to omit the other sentences in that section. Phase 2 must add implementation/test/screenshot evidence to every row in the existing fidelity review.

### Shared and preserved stages

| ID / class | Source and locked requirement | Implementation / acceptance |
| --- | --- | --- |
| G1 S | Approved B/C: seven ordinary numbered titles; visible activity Integration | One stage-title table from exact approved strings. Existing menu/route unchanged. |
| G2 S | One screen including feedback/tooltips; no extra controls/substages | Section 8 budgets and screenshot matrix; no overflow-hidden workaround. |
| G3 S/T | Mathematical truth, accessible alternatives, reduced motion, independent hosting | Pure analysis/scenes, native controls, existing lifecycle; no application imports. |
| G4 P | Previous/Next, explicit Finish/restart, evidence and menu suspension | Seven outer stages; preserved drag cancellation and archives. |
| 1a P | Approved §1 and old spec §3: y=2, b=1; continuous [0,4] slider/direct drag | Preserve intro renderer, range adapter and readout policy. |
| 1b P | Existing instruction, Shaded area calculation with inline square units, fixed-height insight | Exact existing string assertions and rendered baseline. |
| 1c P | No Set field/assessment; stable labels/one screen | Existing introductory browser tests retained. |
| 2a P | Approved §2/old §3: b=3, initially constant/four rectangles; constant/rising selector above graph | Preserve labels with `(constant)` / `(rising)` suffixes here. |
| 2b P | One logarithmic width control, all n=1…128; estimate versus exact | Existing estimate formulas, ≈ rule, repeated refinement and keyboard behaviour. |
| 2c P | Both clickable estimated terms and exact tooltip | Reuse Tooltip unchanged; current layout/closing tests. |

### Stage 3 — How area grows

| ID / class | Approved §3 requirement | Implementation / acceptance |
| --- | --- | --- |
| 3a S | Exact heading/instruction; selector order `y = 2`, `y = x`, `y = x²`; initial x | Growth-specific tabs; no Stage 2 suffixes. |
| 3b S/T | b2→4 automatic, existing delay +2000ms; persistent original/additional regions | 4280ms delay and 900ms motion; original dashed/light, final solid; no draggable control. |
| 3c S | y(4)=16, explicit truthful scale | Square frame profile; no auto-rescale during motion/result. |
| 3d S | Question below graph; `It doubled`, `It quadrupled`, `It increased eightfold` | Single horizontal row; third label may wrap within its button, not onto a separate control row. Minimum touch height 44px. |
| 3e S | One selection; no Check; any answer enables Next; first answer retained | Pure reducer guard and per-function evidence; chosen button stays identifiable. |
| 3f S | Exact flat/rising correct and incorrect headlines/calculations/explanations | Existing math renderer, literal approved strings, Before/After fractions for rising. |
| 3g S | Exact four-sentence quadratic explanation; no 8/3,64/3 or b³/3 | Dedicated square result scene, answer-leak tests across DOM/accessibility/sizing. |
| 3h S | Exact transition after feedback | Render approved transition in reserved result area, including longest quadratic state. |
| 3i S | Final decision §11.1: replay an answered function, then restore its answer/feedback | Preserve Next eligibility during replay; no second answer or prediction event. Outer Previous/Next restores the completed comparison immediately without replay. |

### Stage 4 — Why do we divide?

| ID / class | Approved §4 requirement | Implementation / acceptance |
| --- | --- | --- |
| 4a S | Single screen; visible x/x² tabs; initially x; fixed b3 | New local component; no internal Next/reveal or assessment. |
| 4b S | Same graph placement and horizontal scale; rectangle heights3/9 labelled | Two explicit frame profiles; rendered bounding boxes identical. |
| 4c S | Exact linear instruction, rectangle split, 3×3=9, ½×9=4½, Area=b²/2 | Linear scene; no width slider in this mode. |
| 4d S | Exact quadratic instruction; both lower/upper rectangle constructions | Paired endpoint rectangles and differentiated roles; no construction selector. |
| 4e S | `Rectangle width`, Wider/Narrower, N rectangles; six stops, first n4 | New six-stop native adapter, remembered n on tab/navigation return. |
| 4f S | Side-by-side `Estimate from below` / `Estimate from above`; one decimal | Independent sum tests and all six displayed pairs. |
| 4g S | Exact conclusion, Area=b³/3 and final observed-pattern sentence | Literal approved text, visible throughout quadratic exploration; no reveal button. |
| 4h S | `Why exactly one-third?` and all five approved tooltip passages including derivative | Composed fractions/derivative, anchored accessible Tooltip; no generated antiderivative lesson. |
| 4i S | Next always available | No tab/count visit requirement or assessed event. |

### Stage 5 — Changing the area

| ID / class | Approved §5 requirement | Implementation / acceptance |
| --- | --- | --- |
| 5a S | Exact opening; y=x, a1 fixed, b4 initially | Relocate old Stage 4 with preserved transactions. |
| 5b S | Distinct `Area left out` / `Area we want` for b>1; a/b below graph; final decision §11.3 at b=1 | At b1, no desired fill or `Area we want` label; restrained arrow labelled `Area we want = 0` points to coincident boundaries, with both a1/b1 identities readable. |
| 5c S | Exact instruction near control; slider and graph drag [1,4] | Preserve control inventory; approved continuous then smooth integer release only here. |
| 5d S | Three vertically stacked causal explanations and exact settled table | Revised pure math labels; fractions/mixed numbers; no narrow columns. |
| 5e S/T | Consistent fractional preview, exact settlement | Precision policy §4.4, live pointer/release assertions. |
| 5f S | Entire main constant sentence and visible C=−½ | Inline clickable `constant of integration`; equation not hidden in tooltip. |
| 5g S | `Why is it a constant?` exact body/formula | Existing Tooltip with prepared rich math; old Fixed term trigger removed. |
| 5h S/T | Optional transition only if uncrowded | Omit the optional transition at phone sizes; this omission is expressly allowed. No extra panel. |
| 5i S | Free exploration, no target/Check | Next always available outside active editing. |

### Stage 6 — Area between curves

| ID / class | Approved §6 requirement | Implementation / acceptance |
| --- | --- | --- |
| 6a S | Exact instruction; initial line/parabola [1,3], fixed a1 | New stage number, existing initial mathematical region. |
| 6b S | First/Second curve stacked LEFT, slider RIGHT ~40/60; full labels | Explicit grid variant, native selectors, no horizontal-selector/full-width-slider fallback at target sizes. |
| 6c S | `Right boundary: b`, current value, ends1/4; continuous/no snap | Updated local slider and graph drag; b=4 and crossing tested. |
| 6d S | Thin double arrow, h(x), local gap, no arrow for equal/zero width | New annotation scene; no caps/oversized I marker. |
| 6e S | Exact ordinary explanation, default full height identity and 7⅓ | Prepared region analysis, height and area; unchanged mathematical authority. |
| 6f S | Crossing parabola/axis beyond3; exact replacement explanation | Split paths/sums and absolute distance expression; no permanent piecewise integral. |
| 6g S | Reverse/equal choices valid, b1 zero, no assessment | All permutations/range endpoints; exact same-curve text replaces ordinary explanation. |
| 6h S | All truth-table values, stable fit on switches | Independent numeric tests and screenshots for crossing/equal/longest content. |

### Stage 7 — Choose and calculate an area

| ID / class | Approved §7 requirement | Implementation / acceptance |
| --- | --- | --- |
| 7a S | Exact title/opening, graph then all three headings/sections simultaneously | Remove wizard parts; no internal Next buttons. |
| 7b S | Selected region strictly between curves; unused context visible, labels correctly associated | Selected roles, local label positions, thin arrow, below-axis limits, no handles/drag. |
| 7c S | First/Second curve on ONE horizontal row; all choices including equal | Native controls; no grading of setup. |
| 7d S | Three equal-width interval choices on ONE horizontal row; default1→2 | Existing native radios rendered in explicit 3-column grid; atomic action. |
| 7e S | Immediately generated unsolved integral, `Your answer`, `Check calculation` | New label and consistent action; no numeric answer in graph/a11y/hidden DOM. |
| 7f S | Exact correct/incorrect/empty feedback; empty is not attempt | Separate validation state, valid Check evidence, reserved feedback slot. |
| 7g S | Both exact optional hints; close on choice changes | Keyed anchored Tooltip; no page expansion, persistent assistance record. |
| 7h S | Any numerical Check enables Finish; answer edits or selection changes invalidate it | Guard problem and answer revisions; edits clear feedback, preserve historical submissions and require another Check. Recap uses only the most recently checked answer. No correctness gate. |
| 7i S/P | Approved recap, wrong submitted answer plus actual area; existing restart | Existing compatible recap copy/records, explicit Finish only. |
| 7j S | All truth-table cases; no crossings on [0,2] | 27 combination tests, expression/region/integral agreement and wrong-answer Finish. |

## 8. Mobile layout, keyboard and accessibility plan

### 8.1 Budget before completing the reducer migration

**TECHNICAL DECISION:** use Integration-local grid profiles per stage, reserving the longest approved ordinary state and assigning the remainder to the graph. At 390px width the existing lab provides about **366px content width** after side padding. Its header is 53px; host padding and the collapsed records inspector also consume height. Use the existing host sizing variable, including safe areas; do not budget against a raw 844px activity height.

Keep normal body text at the existing 14px/1.4 baseline or larger, math about16px, input/select text at least16px to avoid iOS focus zoom, and essential controls at least44px high. Use 4–6px local gaps and remove obsolete reserved empty rows before reducing the graph. Begin with a **200px graph minimum** (the current Integration layout contract), allocating spare height above it. If exact content cannot fit legibly at that minimum, it is a fidelity conflict: report measured excess and ask before hiding content, shrinking type or splitting the stage.

Provisional content budgets at 390×844 (not claims of future rendered fit):

| Stage | Dominant fixed content / budget target | Strategy |
| --- | --- | --- |
| 1–2 | Previously approved composition; not reverified interactively in this planning phase | Leave current frame and reservation intact. |
| 3 | Header/instruction/tabs ≈130px; question/choices + longest quadratic result/transition ≈280–310px; navigation44px | Reserve the quadratic branch even for short flat feedback; graph uses remaining ~200–250px. Three answers on one row with wrapped longest label. |
| 4 | Header/instruction/tabs ≈140px; quadratic slider/readouts/conclusion/formula/observation/trigger ≈285–315px; navigation44px | Reserve the maximum of both modes; same graph box. Estimates side by side. Linear mode leaves spare content space instead of enlarging graph. |
| 5 | Header/opening ≈90px; control instruction/range + three explanation/formula pairs + main constant ≈360–385px; navigation44px | Remove the old empty top row; compact 4px gaps; omit expressly optional transition; preserve vertical explanations. |
| 6 | Header/instruction ≈110px; side-by-side control group ≈135px; longest context/expression/area ≈105px; navigation44px | Selectors stacked left, slider vertically centred right; graph receives remainder. |
| 7 | Header/instruction ≈90px; two setup sections ≈170px; calculate section/integral/answer/check ≈140px; reserved feedback/hint ≈45px; navigation44px | Single screen. Pair answer field and Check on one row where feasible, with the label above the input; graph ~200px+. No extra explanatory sentence or units row beyond approved/preserved necessities. |

The first engineering prototype after approval must render the **exact longest content** for Stages 3, 4, 5 and 7 with the real graph and real controls. These are not new lab preview modes or student controls: use test setup/fixtures, not an alternate product interface. Do not let hidden sizing fixtures mount answers before assessment. Prefer explicit em/px reservations validated from rendered content; neutral sizing data only when needed.

A read-only browser canvas measurement at 366px/14px Arial found the new Stage 5 opening occupies two lines, its near-control instruction one line and its constant sentence two lines before rich math/trigger styling. Stage 3's quadratic body uses six lines and its transition two lines. These are useful lower-bound text measurements, not a verified screen composition; rich fractions, controls and spacing must still be measured in the actual implementation.

### 8.2 Control placement and labels

Stage 6 starts with `grid-template-columns: minmax(145px, 0.4fr) minmax(0, 0.6fr)` and a small gap, adjusted within the approved flexible ratio to fit full native option text. Measure the actual selected text plus native disclosure/padding at16px. Do not truncate `y = x² − 3x` or `x-axis (y = 0)`. Right slider gets the remaining majority where feasible and a44px touch surface. At enlarged accessibility text, reflow is allowed, but preserve left/right grouping at the normal target sizes.

Stage 7 uses explicit two-column selectors and three equal-width interval controls. Avoid `auto-fit`, which can silently create a second row. Label text may wrap within its control while the approved row remains one row. Stage 3 likewise uses three explicit columns; wrapping `It increased eightfold` is acceptable inside the button, not moving it below the others.

Tooltip rich content uses inline spans/fraction tokens compatible with its current `<p>` wrapper. Do not nest block paragraphs inside that paragraph. It remains portalled, anchored, dismissible and within visual-viewport bounds. Opening it must not alter graph measurement. Verify pointer capture is not stolen by accidental overlay targets.

### 8.3 Stage 7 soft keyboard

Keep the initial screen at normal layout height; do not autofocus the answer or open the keyboard on entry. Use `inputMode="decimal"`, `enterKeyHint="done"`, a16px input and a local form. Enter and Check submit the same pure action.

When the keyboard opens, preserve mathematical state and graph geometry. A browser-only adapter may pan/scroll the focused answer/Check group into the visual viewport if native focus positioning leaves it obscured; this is transient keyboard accommodation, not a second stage or hidden educational control. Do not compress the graph or hide any of the three sections. On accepted Check, blur the answer, allow the keyboard to close, then expose the reserved feedback and normal Previous/Finish row without changing the problem. Empty/invalid input retains focus and shows the approved validation message near it. Tooltips use actual visual-viewport bounds.

The normal-zoom one-screen acceptance applies with the keyboard closed; during keyboard occupation verify the input, Check and validation remain reachable and no content becomes trapped. If the user requires the full graph, every control and navigation simultaneously visible **above an open keyboard**, report the exact physical-height conflict rather than assuming that stronger requirement. Physical Safari keyboard/focus behaviour must be reviewed; Chromium emulation alone does not certify it.

### 8.4 Focus and announcements

Outer stage changes, Finish and restart move focus to the heading with `preventScroll` after the intended page positioning. Tab/function/curve/interval selection keeps focus on the active control. Feedback uses a polite live region once per accepted action; do not focus the heading on every answer change or announce drag/animation frames. Closing a keyboard-operated tooltip returns/retains trigger focus; no trap or modal. Keyboard slider placement follows the same mathematics as touch.

Use native range track tapping and accessible increment/decrement semantics as the approved non-drag alternative. Keep the existing deferred Card 1 accessibility issue outside this task. Test menu interruption, Escape, focus loss, zoom and reduced motion; do not claim complete screen-reader or physical touch verification from these automated checks.

## 9. Implementation sequence for Sol after approval

1. **Establish baseline and scope.** Recheck branch/status, preserve staged work, verify the actual running server/route and hydration, read this plan plus approved source. Capture Stage 1–2 current behaviour and one Card 1 journey. Do not rerun the architecture investigation.
2. **Prove the demanding compositions early.** Implement the local stage renderers with exact approved content and current/fixed scene inputs, including Stage 3 square feedback, Stage 4 square mode, Stage 5 main constant and the complete Stage 7 screen. Inspect real390×844 and393×852 rendering. If legibility/fit fails after the technical adjustments allowed here, stop only that layout decision and provide measured evidence.
3. **Mathematical layer.** Add square, segmented area analysis, paired endpoint sums and precision helpers. Verify independent numerical tables/invariants before connecting changing visuals. Add no general numerical engine.
4. **Scene layer.** Add frame profiles, enclosing rectangle/bounds, piecewise shading, below-axis labels, region callouts, selected/context roles and thin distance arrow. Keep Stage 1–2 default paths/profile stable. Validate plot error and annotation bounds.
5. **State/navigation and versioned evidence.** Introduce the new stage and state contracts; remove final setup parts; implement the locked replay-then-restore comparison policy, Stage 4 count/mode, Stage 5 release/zero-area policy, Stage 6 crossings and final calculation invalidation on both problem changes and answer edits. Preserve snapshots/archives and callback order. Update callers/tests atomically enough that stale old-stage gates cannot survive.
6. **Wire input and exact content.** Connect renderers, animation, native sliders/selects/radios, prepared math, tooltips and final form. Migrate every old stage-number condition; verify no dormant old controls/copy remain. Use the approved source as the copy checklist, not memory of the earlier six-stage task.
7. **Complete responsive/accessibility checks.** Reserve longest feedback, inspect both normal phone sizes,200% text, mobile keyboard/focus and wider screens. Verify geometry invariants and no answer leaks across all channels.
8. **Run final verification once the source is stable.** Pure tests, focused/full relevant Chromium regressions, production build, post-build tsc and scoped lint. Do not run WebKit in this environment. Capture production-rendered evidence if the build/runtime differs.
9. **Update only the authorised activity documents.** Replace superseded active requirements in `experience-specification.md` with a concise seven-stage map referencing the approved source. Append dated decisions/results and per-requirement fidelity evidence to `approval-b-fidelity-review.md`, retaining historical audits. Never edit the primary Approval A document to legitimise a failure.
10. **Handoff and stop.** Verify actual localhost/LAN URL, leave an appropriate server running, give screenshots and measured viewport fit, separate physical-device limitations, list any unresolved fidelity failure. No commit/push; Approval B is human review.

Each step is a reviewable engineering checkpoint, not an additional automatic product approval gate. The user-approved plan authorises routine execution; consequential departures still require a precise question.

## 10. Verification plan and required evidence

### Pure mathematics/layout

- Preserve existing Stage 1 rounded-display versus continuous-geometry and Stage 2 right-estimate tests.
- Square evaluation/primitive and factor8 scaling; no collision with existing `parabola=3x²`.
- All six Stage 4 sums, independent direct sums, L≤9≤U, monotonic convergence, gap27/n, exact rectangle extents and stable frame at n4/128.
- Piece splitting, midpoint order validated over each interval, sum additivity, inverse selector invariance, same curves, zero width, crossings at endpoints versus interior, b=3±ε and b4.
- Stage 5 exact table, continuous previews and final integer commit/cancel. At b1, assert no desired fill or `Area we want` label, the exact `Area we want = 0` arrow points to coincident boundaries and both a1/b1 labels remain clear. At b>1 restore the two region labels; do not select zero-area presentation by rounding a positive width. Continuous Stage 1/6 policies remain intact.
- All27 Stage 7 combinations; correct integrands, exact answers, expected zero-height scenes.
- Graph/sampling error<0.25px; exact crossings/limits; true clipping; selected-region paths never fill to the axis unless the axis is selected; no false min-height arrow.
- Boundary labels/region labels/arrowheads remain in permitted scene bounds and clear essential labels at tested sizes; typed plain data serialises and is immutable without freezing caller-owned objects.

### Reducer, records and presentation

- All seven first-entry states; stage numbering and Previous/Next restoration; independent counts/functions across2/3/4.
- All nine Stage 3 function/choice outcomes; first answer protection; answered-function replay from b2 to b4 with feedback restored only on completion, Next eligibility retained throughout and no duplicate prediction; outer Previous/Next restoration without replay; reduced-motion completion, stale run actions and no repeated history on frames.
- Stage 4 free exploration never gates Next or becomes final-calculation assistance.
- Every Stage 7 choice immediately regenerates the integral and invalidates a previous checked problem, including reversed selector order and changing back.
- Empty/invalid Check is not an attempt; finite wrong/right checks recorded; any valid Check enables Finish. Editing clears feedback and disables Finish until rechecking, including edit-then-revert; earlier submissions remain in history. Reject stale Finish after an edit. After rechecking, recap uses the most recently checked answer for both correct and incorrect outcomes, never an earlier submission or unchecked draft.
- Assistance persists, incorrect attempts alone remain independent, Finish completes once, restart/exit archives remain available, v1/v2 notification delivery remains safe.
- Exact locked copy assertions for every branch and tooltip; new titles/options replace old ones. Final input label is Your answer, action remains Check calculation.
- No hidden sizing/accessibility/tooltip/graph-description answer leakage before approved revelation. No quadratic numerical areas/formula in Stage3. Diagnostics remain explicitly lab-owned.

### Browser interactions and fidelity

Use existing Chromium infrastructure and real application components. Extend `integration.browser.ts`, `integration-intro.browser.ts`, `integration-refinements.browser.ts`; add focused `integration-seven-stage.spec.ts` and `integration-seven-stage.browser.ts` if needed to keep coverage readable. Preserve current notification and input tests; update superseded stage-number/copy/wizard assertions, not their surviving behavioural guarantees. Extend `isolation.spec.ts` for new pure files.

Required screenshots at **390×844 and393×852**, with normal text, collapsed diagnostics and actual viewport/document measurements for each:

| Stage | Required rendered states |
| --- | --- |
| 1–2 | Existing initial/moved boundary; constant/rising/refinement/estimated tooltip regressions. |
| 3 | Initial pre-animation; intermediate/final square at b4; each function's correct and incorrect result; longest square explanation+transition; answered return and reduced motion. |
| 4 | Linear initial; square n4 and n128; both estimates; mathematical tooltip; return to linear. |
| 5 | b4 initial; b1 with `Area we want = 0` arrow, no desired fill/label and legible coincident boundary labels; b2,3 and b>1 labels restored; real fractional pointer candidate and settling; visible constant sentence; constant tooltip. |
| 6 | Initial; reversed pair; each equal pair; b1; parabola/axis b3 and b4; noninteger b>3; full left/right controls and arrow. |
| 7 | Initial complete screen; other intervals; reversed/equal functions; empty feedback; wrong result; hint; correct result; checked answer edited (feedback cleared, Finish disabled); rechecked latest answer and matching wrong/correct recap; selection changed after Check. |

For every capture record `innerWidth/Height`, `visualViewport.width/height/offsetTop`, document `scrollWidth/Height`, scroll position, graph bounding box, frame domains/ticks and essential-control boxes. Assert no normal target overflow and no accidental graph movement for the same stage/profile. Stage4 tab changes retain physical box and x scale; y-scale changes are the explicitly allowed ones. Screenshot files and a **persisted JSON measurements file** must be retained under a named artifact directory; an inline attachment discarded by the list reporter is insufficient as the only durable measurement evidence.

Check desktop/tablet sizes (768×1024,1280×900), shorter phones for controlled overflow,200% text reflow, native track taps/keyboard, direct pointer movement/release/cancel, menu interruption, focus visibility, tooltip outside/Escape/repeat dismissal and scroll-independent placement. Synthetic Chromium touch tests and screenshots do not verify physical Safari. The user's no-WebKit instruction remains in effect.

Include unchanged Card 1/lab regression selections: `lab-network.browser.ts`, `lab.browser.ts`, `manipulation.browser.ts`, `learning.browser.ts`, `retrieval.browser.ts`; include sparkline tests if a changed shared layer could affect them. Use the actual LAN origin in the network test: HTTP200 alone is not hydration evidence.

### Commands and environment

No new dependency or test framework is planned. Existing packages include Next16.2.6, React19.2.4, d3-array, pinned d3-scale/d3-shape and Playwright1.58.1. Preserve the feature-local ESM package file.

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure
SPV_TEST_BASE_URL=http://127.0.0.1:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium integration-seven-stage.browser.ts integration.browser.ts integration-intro.browser.ts integration-refinements.browser.ts lab-network.browser.ts lab.browser.ts manipulation.browser.ts learning.browser.ts retrieval.browser.ts
node_modules/.bin/eslint src/app/step-visuals
npm run build
node_modules/.bin/tsc --noEmit
git diff --check
```

Only include test filenames that exist after implementation. Do not race build and tsc against generated Next types. Use `/private/tmp/…` or the existing ignored test artifact directory for generated output. Verify the actual server before running browser commands; port3171 is the inspected listener, not a guarantee for a later session. Start command if needed after approval: `npm run dev -- --hostname 0.0.0.0 --port 3171`. Do not stop unrelated servers or claim an old Wi-Fi address is still valid.

## 11. Final approved educational decisions

These three user decisions override conflicting wording in the earlier plan. They are locked requirements for Sol, not open questions.

### 11.1 Stage 3 — Replay, then restore

When selecting a previously answered function, replay its animation from b=2 to b=4. On completion, restore its previously selected answer and feedback. Do not require another answer or record another prediction. Preserve Next eligibility throughout. Returning to Stage 3 through outer Previous/Next restores the completed comparison immediately without replay.

This resolves the former QUESTION 1. The comparison cache retains the answer while the presentation waits for replay completion; animation progress must not erase that evidence or temporarily remove Next eligibility.

### 11.2 Stage 7 — Recheck an edited answer before Finish

Editing a checked answer clears its feedback and disables Finish until another **Check calculation**. Earlier checked submissions remain in historical learning records. A new numerical Check enables Finish regardless of correctness. The recap must use the most recently checked answer, never an earlier answer or an unchecked draft. The problem/answer revision guards in §5.4 enforce this without deleting history or recording keystrokes.

### 11.3 Stage 5 — Zero-area boundary

At b=1, show no false desired-area shading and no **Area we want** label pointing to an absent region. Show a small, restrained arrow pointing to the coincident boundaries, labelled exactly **Area we want = 0**. Keep both identities clear: **a = 1** and **b = 1**. For b>1 retain **Area left out** and **Area we want**. The excluded triangle remains mathematically unchanged.

There are no remaining educational questions. The runtime baseline and mobile-fit checks below remain verification obligations for implementation.

## 12. Risks, escalation thresholds and readiness

| Risk | Mitigation / acceptance gate |
| --- | --- |
| Longer exact copy exceeds one-screen space | First prototype the longest states with real components; preserve14px body/16px inputs/44px controls and readable graph. Measure excess; ask before removing copy, adding substages or reducing legibility. |
| Stage 6 crossing still uses global ordering | Canonical selected pair plus exact segments; independent31/6 check and pixel evidence of both lobes. Never simply widen current b bounds. |
| Stage numbers accidentally change earlier gestures | Semantic policy helpers, explicit1/2/5/6/7 tests and end-to-end navigation. No global snapping or integer native range step for continuous dragging. |
| x² confused with existing3x² | New `square` ID, typed mode inventories, coefficient and final truth-table tests. |
| Scale changes hide growth | Fixed profile through animation/result; explicit y ticks include16; Stage4 exact enclosing rectangles; no result-driven auto-fit. |
| Labels/arrows imply wrong mathematics | Pure collision/arrow preparation, actual projected endpoints, zero-gap omission, below-axis gutters and manual screenshot inspection. |
| Record consumers reinterpret old stage/region data | Version2 payload, explicit legacy union, callback-order tests, no retroactive mutation or persistence migration. |
| Hints remain visible after a new problem | Key Tooltip by problemRevision; reducer clears eligibility; verify DOM/a11y answer masking. |
| Final-stage keyboard obscures required controls | Local focus/visual-viewport adapter and16px input; physical-iPhone check. Do not invent an extra modal/substep. |
| Browser baseline/server is stale or unhydrated | Verify real menu/drag on localhost and LAN before implementation evidence. Preserve unrelated listeners; repair only an established environment issue within later authorisation. |
| Planning evidence mistaken for approval | Arithmetic audit/text metrics are labelled; seven-stage screenshots/tests are future acceptance work. Approval B belongs to the user. |

The user has approved this plan with all three final decisions incorporated. It is ready for the next implementation phase by GPT-6.1 Sol; this document-update task stops here. Sol has authority to tune scoped spacing, label offsets, sample counts and other technical values within these requirements. Sol does not have authority to rewrite copy, choose different controls, revert to the final-stage wizard or mark an overflowing state as accepted.

[approved]: ../../../../../design/features/step-visuals/puckle-integration-seven-stage-approved-design.md
[experience]: ../../../../../design/features/step-visuals/activities/integration-area/experience-specification.md
[quality]: ../../../../../design/features/step-visuals/great-maths-visuals.md
[support]: ../../../../../design/features/step-visuals/ai-maths-visuals-support-guide.md
[engineering]: ../../maths-visuals-engineering-guide.md
[review]: approval-b-fidelity-review.md
