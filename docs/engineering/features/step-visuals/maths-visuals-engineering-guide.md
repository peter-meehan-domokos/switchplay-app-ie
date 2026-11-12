# Maths Visuals Engineering Guide

Version: 1.2

Status: current authoritative engineering guide

Updated: 25 October 2026, following the approved Integration engineering retrospective.

This is the current successor to [the preserved historical guide][previous-guide]. The historical file's original version/status metadata is retained as evidence, not a competing statement of current authority. Existing references to `maths-visuals-engineering-guide.md` resolve to this version.

Reference implementations: Roots and Factors (Card 1, the root–factor relationship) and the seven-stage Integration activity. Evidence references identify implemented patterns and tests; this documentation revision does not claim fresh application, physical-device or assistive-technology verification.

Scope: technical standards for Step Visuals and future interactive mathematical activities.

This guide defines how to implement reliable mathematical experiences. It is not a specification for a universal visualisation framework, nor a requirement to reproduce the quadratic activity's component tree.

## Contents

1. Scope, authority and implementation readiness
2. Architecture, ownership and dependency boundaries
3. Reuse and extension decisions
4. Mathematical models and numerical contracts
5. Pure layout preparation and declarative rendering
6. Interaction transactions and state management
7. Platform adapters, hosting and lifecycle
8. Responsive geometry and presentation
9. Accessibility implementation
10. Compact and static representations
11. Learning records and integration contracts
12. Verification, performance and maintenance

## 1. Scope, authority and implementation readiness

### 1.1 Responsibilities of the three guides

| Document | Authority |
| --- | --- |
| [Great Maths Visuals][quality-guide] | Mathematical and educational quality, including accessibility and clarity. |
| [AI Maths Visuals Support Guide][support-guide] | Educational design, collaboration, decision authority, approval and review. |
| This guide | Architecture, computational methods, technical contracts, implementation and verification. |

Follow [AGENTS.md][agents] for repository-wide instructions, including installed Next.js documentation requirements. Do not duplicate its generic rules here. This guide does not grant permission to change dependencies, application source, storage or integration scope.

Implement the current authoritative experience specification within the authority mode and autonomy contract defined by the Support Guide. During autonomous educational design, AI may develop, evaluate and revise educational decisions within its delegated authority. During implementation, preserve wording, interactions and layouts **only as protected by the current contract**; a contract may expressly delegate their revision. An implementation plan or passing test cannot silently expand that authority or turn an unresolved proposal into a requirement.

Before the first collaborative review, the original brief and standing guides can supply that authority without a separate autonomy-contract document, as the Support Guide defines. The acceptance map below does not add a contract or approval requirement to that phase.

Engineers own algorithms, component boundaries, numerical methods, rendering techniques and verification within the agreed scope. Make routine technical decisions independently; this guide creates no additional mandatory human review gate. If a missing consequential educational requirement or conflict cannot be resolved within delegated authority, stop only the affected decision and present the specific conflict. Do not silently weaken mathematics or treat existing code as the requirement.

Historical plans are evidence of earlier reasoning, not current authority. For example, the [original Card 1 plan][historical-plan] contains subsequently replaced integer-dragging, adjustment-button, assistance and sparkline decisions. It must not override later approved behaviour.

### 1.2 Convention and evidence labels

- **Mandatory:** a boundary or correctness requirement. Departures require an explicit, documented decision; missing implementation is not compliance.
- **Recommended:** the default technical choice. Use another approach when its benefits and verification justify it, within approved scope.
- **Activity-specific:** valid for a named activity; do not impose it on another mathematical model.
- **Unvalidated generality:** a pattern with useful potential, but no evidence yet that it works for substantially different activities or platforms.

These labels describe obligations separately from evidence. A pattern covered by Card 1 or Integration tests is established for those tested cases, not automatically for arbitrary functions, mobile hardware or React Native. Source and test links below identify evidence locations, not a claim that every test was rerun when this document was edited.

### 1.3 Technical readiness before substantial implementation

**Mandatory:** inspect the current specification and applicable authority brief/contract for enough detail to implement the mathematical objects, domains, continuous/release behaviour, controls, progression, feedback, assessment, assistance, accessible alternatives and meaningful evidence. Use the Support Guide's handoff; do not create a second educational design process. Resolve missing educational decisions within delegated authority or raise the specific consequential decision; do not fill a gap by inventing an unapproved learner workflow.

Translate it into a short implementation note covering:

- Canonical values, derived quantities and numerical methods.
- Ownership of editing, learning, camera and lifecycle state.
- Reuse decisions and public component/record contracts.
- Required presentation states, geometry invariants and failure handling.
- Verification of the central interaction and any demonstrated external requirements.

Include a compact **acceptance map** in that note or an existing plan/review. Its expected behaviour comes from the authoritative specification and current contract, not from the implementation subsequently chosen. Use enough traceability to detect a faithful implementation of the wrong interpretation:

| Requirement source and authority | Implementation obligation | Independent acceptance evidence |
| --- | --- | --- |
| Current scene and mathematical contract | Initial values, domains, notation roles, variable/invariant relationships and supported special cases. | Independently justified mathematical expectations and scene assertions. |
| Copy and control inventory | Exact protected titles, causal wording, labels and instructions; allowed actions and availability. | Literal checks where protected, expected control presence **and absence**, and correct accessible meaning. |
| State-dependent learner journey | Response, progression, assessment/reveal timing and non-ideal/return paths. | Accepted/rejected transition and browser-action checks, not UI enablement alone. |
| Current spatial relationships | Control grouping/order, mathematical working structure and graph/navigation invariants, with their protection/delegation status. | Actual rendered geometry plus visual review of significant states (§12). |

Record positive and negative requirements where relevant. For example, a specified slider without a separate Set action requires checking both slider operation and the absence of an unauthorised Set control. A green test for an invented control does not legitimise it. Keep expected protected phrases independent of the production copy they test; updating both because the implementation chose different wording is not a requirement change.

The map is not a design freeze or an approval mechanism. Educational decisions made or revised legitimately during autonomous design remain revisable within that mandate; keep the current specification, map and affected expectations in agreement. Collaboration protects only what the subsequent contract protects. Do not require a separate document or one test for every sentence; use the smallest map that makes consequential requirements checkable.

**Mandatory:** validate the minimal central interaction before expanding the full guided journey. Include actual mathematics, representative phone rendering and the essential accessible alternative. Also render the most demanding intended mathematical/feedback states early, using genuine components and the actual approved experience or educational decisions validly made within the autonomous phase. Do not invent instructions, controls, extra stages or mathematical behaviour to complete a prototype. A fixture can select a real state without becoming another student-facing experience or leaking hidden solutions.

This validation is an engineering step, not an automatic extra human review or disposable duplicate interface. Combine interaction and composition checks when practical; revisit them when substantive requirements or constraints change, not after every routine edit. Apply §12's distinction between generating a render, asserting geometry and visually inspecting it.

### 1.4 Durable activity documentation

**Recommended default:** keep the current educational specification at `docs/design/features/step-visuals/activities/<activity-id>/experience-specification.md`. If an activity already has an authoritative location, retain and link it rather than creating a competing copy. Follow Support Guide §13 for the living specification, lightweight decision log and authority contract; they may use existing documents/sections. Keep an implementation note beside the feature or under `docs/engineering/features/step-visuals/activities/<activity-id>/` when useful.

Before substantial handoff, check that current values, exact protected copy, control inventory, interaction policies and scope agree. Consolidate superseding decisions into the current specification at natural checkpoints; keep historical approvals, plans and evidence clearly historical, with a pointer to current requirements. A plan must not require the next agent to reconcile an ever-growing amendment stack. Mark technical plans implemented/superseded as appropriate, and refresh their current source maps rather than leaving removed files or old state contracts apparently current.

Distinguish a code regression from an approved requirement change, a fresh-default error, a restoration error and an unknown cause. Check source/history before attributing one. Integration's later b=3 fresh-entry decision replaced an earlier explicit b=4 requirement; that alone was not proof of a restore defect. The [retrospective][retrospective] records the evidence and its limits.

Use lowercase, hyphenated names for new files. Link existing mixed-case implementation files by their actual names; do not undertake a naming migration as incidental work. Document status as approved, proposed, deferred or superseded, following the Support Guide. Record technical choices here or in implementation notes, not as additions to the educational specification's scope.

## 2. Architecture, ownership and dependency boundaries

### 2.1 Ownership, not a compulsory reducer hierarchy

**Mandatory:** give each concern a clear owner and a defined update path.

| Concern | Responsibility | Must not become |
| --- | --- | --- |
| Mathematical model | Authoritative quantities, constraints and derived relationships. | A collection of separately stored strings, paths and coefficients that can drift apart. |
| Interaction transaction | Active candidate, ownership, commit/cancel and input validity. | A second independently rendered mathematical model. |
| Learning state | Accepted answers, progression, feedback and assistance under the approved specification. | An effect that guesses outcomes from current DOM or pointer movement. |
| Lifecycle/hosting | Suspension, resumption, restart, exit and allocated space. | Lab navigation embedded in a reusable activity. |
| Presentation | Visible precision, notation roles, masking, geometry and accessibility descriptions. | The authority deciding mathematical truth. |
| Optional camera | Viewport, pan or zoom independent of the mathematical object. | An untracked transform owned simultaneously by React and a gesture library. |

One reducer may represent several concerns; several composed reducers may be clearer. Separate reducers, stores or component layers are not requirements. Card 1's [manipulation][manipulation], [learning][learning] and [recording][recording] composition is an established example, not a generic engine to instantiate for every activity.

### 2.2 Portable processing and platform rendering

The recommended processing arrangement is:

```text
model + effective interaction value + learning/presentation policy + dimensions
    → pure mathematical analysis and composed layouts
    → readonly component-specific scene data
    → platform renderer

platform input → coordinate adapter → semantic action → authoritative state
```

**Mandatory:** portable mathematical, layout and transition modules do not import React, Next.js, CSS, DOM APIs, browser event types or application-specific services. Platform adapters translate native/browser information into plain inputs. Pure modules receive dimensions and coordinate coefficients, not elements or observers.

For the existing web feature, React owns rendering and semantic state. D3 prepares data, scales, geometry and paths; it does not select or mutate React-owned elements. A different renderer may be appropriate for a future platform or demonstrated workload, but it must preserve these ownership boundaries rather than silently introducing another state owner.

### 2.3 Dependency direction and containment

**Mandatory:** genuinely shared processing does not depend on a particular activity's model. An activity may compose shared primitives and activity-local processing. Lab modules may import activities; reusable activities and renderers must not import the lab. The host consumes public contracts, not internal reducers.

All feature source, styles, tests and lab additions currently remain within `src/app/step-visuals/`. Documentation uses its approved documentation paths. No existing Puckle/Switchplay component, gesture utility, data model, authentication or persistence is required. Shared dependencies and tooling changes remain explicit exceptions requiring authorization.

Use the existing [public entry point][public-api] for supported mounts and types. Do not export every internal helper merely to make reuse easier. Introduce a processing entry point only if an actual consumer needs one; avoid importing a React barrel into pure tests.

## 3. Reuse and extension decisions

### 3.1 Decide before copying or generalising

**Mandatory:** inspect existing contracts, imports and tests; directory names alone do not establish suitability. For each substantial capability, choose:

| Decision | Use when | Verification |
| --- | --- | --- |
| Reuse unchanged | Model, semantics, dimensions and platform assumptions match. | Existing coverage plus a focused new-consumer test. |
| Adapt safely | A small explicit policy/configuration change supports both consumers without distorting either. | Preserve existing consumers' defaults and test both policies. |
| Extract a primitive | A demonstrated second use exposes an independently meaningful operation hidden inside activity logic. | Test the primitive and both compositions; eliminate activity imports from the shared layer. |
| Build new | Mathematical object, interaction or representation is fundamentally different. | Reuse lower-level projection/input ideas where valid, but give the new capability its own contract. |

**Recommended default for the current activity-building phase:** prioritise faithful, isolated experiences over shared-component reuse. Keep activity-specific state, composition, interactions and styling local when reuse would distort the design or risk a completed visual. Modest duplication is acceptable where semantic differences or coupling costs outweigh extraction benefits. Do not modify shared defaults or styles to fit a new activity without demonstrable compatibility and relevant consumer regression checks.

This is not a ban on purposeful abstractions: reuse or adapt genuinely compatible primitives, and extract a clear boundary when its benefit and verification justify it. A second use is useful evidence, not an absolute prerequisite. The current project strategy is to review common patterns after approximately five distinct visuals; that is a planning point, not a universal extraction threshold or a reason to postpone obvious safe reuse. Do not build registries, plug-in systems, universal lesson engines or a diagram language for hypothetical consumers.

### 3.2 Current reuse map and limitations

| Capability | Current evidence | Reuse decision criteria |
| --- | --- | --- |
| [Real-factor helpers][real-factors] | Linear-factor helpers; Integration reuses finite-number validation, not a root-based mathematical model. | Inspect individual contracts. The module is not a symbolic algebra or calculus engine. |
| [Projection and coordinate plane][coordinate-plane] | Linear projection used by both activities; Integration composes [local frame profiles/axes][integration-graph-layout]. Existing base assumptions include zero-containing domains and minimum dimensions. | Reuse coordinate contracts where suitable. Adapt tick/padding/domain policy before off-origin or differently scaled plots; do not force the quadratic's frame onto another activity. |
| [Function plotting][function-plot] | Both activities use sampled evaluation, exact supplied landmarks, finite gaps and clipping. Integration supplies polynomial roots/vertices/intersections. | Reuse after the function family's error and discontinuity analysis in Section 4; a finite polynomial family does not validate arbitrary functions. |
| [Root marker layout][root-markers] | First factor fixed, later factors moving, labels and horizontal cues. | Root-specific, not an arbitrary-handle layout. Tangent points and interval endpoints need their own contracts. |
| [Card 1 graph renderer][graph-renderer] and [Integration graph renderer][integration-graph] | Separate declarative root and area/partition/strip renderers, composed over suitable pure primitives. | Reuse compatible layers or build locally; do not label calculus as “Quadratic graph” or require one renderer for every scene. |
| [Root pointer adapter][pointer-adapter] and [Integration boundary adapter][integration-pointer] | Activity-specific transactions reuse affine calibration/conversion and capture/cancellation principles. The root hook still imports Card 1 manipulation types. | Reuse safeguards and genuinely plain coordinate helpers; build a local adapter or extract only a demonstrated common boundary. Do not import the root reducer to obtain interval dragging. |
| [ActivityFrame][activity-frame] and [Integration frame][integration-styles] | Card 1 sizing slots and Integration-local stage reservations both support stable mathematical surfaces. | Choose the composition that fits the actual approved content. Reservation sizes and stage count are not shared contracts. |
| [Card 1 prompt preparation][presentation] and [Integration presentation][integration-presentation] | Different activity-local copy, actions, masking, notation roles and progression policies. | Reuse compatible presentation techniques, not a compulsory stage schema or general lesson engine. |
| [Sparkline preparation][sparkline-layout] | Card 1 fit and equal-scale policy; imports its model despite living in `core/`. | Keep activity-specific composition local when extending; extract only genuine framing primitives. |
| [Card 1 notifications][notifications] and [Integration notifications][integration-notifications] | Parallel activity-typed delivery with ordering, duplicate guards and archives. | Preserve lifecycle guarantees; do not force incompatible payloads into one schema merely to remove modest duplication. |
| [Tooltip][tooltip] and [pure placement][tooltip-layout] | Shared anchored, dismissible rich explanations; optional width configuration serves the Stage 7 hint without changing other consumers. | Reuse interaction/placement where compatible. Local content/width needs do not justify a glossary framework or unrequested collision avoidance. |

The present `core/` directory is therefore not a certified general-purpose library. Existing exceptions are not permission to add new shared-to-activity dependencies. Generalise or relocate only the affected capability during authorized implementation, with compatibility tests; this guide itself requires no refactor.

### 3.3 Substantially different activities

Differentiation may need a point constrained to a curve, a secant pair, tangent geometry or linked function/derivative plots. Integration now demonstrates selected intervals, locally ordered area pieces and rectangle partitions. Neither experience validates all future accumulation, multi-handle or linked-plot interactions. These are not variations of “move one root”.

**Recommended:** reuse scalar/point types, validated projections, clipping and transaction principles. Create activity-appropriate mathematical models and layers. Extract multi-handle selection, interval preparation or linked-plot framing only when the approved interaction needs them. Do not make a mathematical interval depend on a root-factor model to obtain dragging support.

## 4. Mathematical models and numerical contracts

### 4.1 Mathematical authority

**Mandatory: presentation requirements never determine mathematical truth.** Store the smallest adequate model, validate at its boundary and derive dependent values through pure functions. Formatting, pixel position and rounded text must not become inputs to evaluation or assessment.

Define the following distinctions for each activity, even when some values coincide:

| Value | Contract |
| --- | --- |
| Canonical model | Authoritative mathematical parameters and constraints. |
| Continuous candidate | Proposed value during an active transaction; real-valued when the interaction requires it. |
| Committed value | Accepted value after release/confirmation; not necessarily integer. |
| Effective value | The explicit choice of candidate or committed value used for current mathematical rendering. |
| Derived quantity | Calculated from the effective/canonical inputs, not independently maintained. |
| Display value | Formatted or rounded view of a quantity, with its mathematical role identified. |
| Assessment value | The approved submitted value or object; never inferred from a rounded label or last rendered sample. |

In Card 1, [the model][card1-model] distinguishes integer settled roots from real graphical roots. [Its compositor][card1-layout] derives curve/marker geometry from the continuous candidate and notation from a rounded display root. That separation is explicit, but its visible approximation policy has the limitation in Section 8.4. Integer roots, symmetric half-step rounding and snap-on-release are **activity-specific**.

In [Integration's model][integration-model], the canonical region is the selected curve pair plus interval. Higher/lower order is derived locally, not inferred from the first/second selector positions. Its continuous candidate, optional settlement and numerical display have separate policies. Derive graph, labels, calculations and assessment from the same applicable mathematical revision; do not reconstruct mathematics by parsing a formatted expression or SVG path.

### 4.2 Exactness, approximation and validity

**Mandatory:** document domains, units, constraints, singularities and the meaning of exact/approximate output before choosing an algorithm.

- Prefer known analytic relationships when they meet the approved task; distinguish an exact identity from its floating-point evaluation.
- Specify display precision separately from computational precision. Do not round repeatedly during accumulation or feed formatted values back into calculations.
- Define absolute and relative tolerances appropriate to magnitude, units and conditioning. A common comparison is `|a-b| <= absoluteTolerance + relativeTolerance * max(|a|, |b|)`, but its tolerances and applicability require justification.
- Keep numerical error, graphical interpolation error, input resolution and assessment acceptance tolerances distinct. Changing a graph's pixel density must not change whether a mathematical answer is correct.
- Validate finite inputs and non-degenerate projections. Normalise negative zero when appropriate for notation. An undefined result is not numerical zero.
- Treat expected undefined mathematics with a typed unavailable/undefined result and a prepared presentation policy. Invalid public configuration may fail explicitly; ordinary student movement through an allowed special case must not crash the activity.

For costly/approximate operations, a contract should state the value, method or approximation status, validity and any justified error estimate. Do not describe an estimated error as a rigorous bound unless it is one. Do not fabricate a universal result schema before it has a consumer.

Assessment must use a justified acceptance rule and account for uncertainty. If numerical uncertainty prevents a reliable decision, improve the computation or report that assessment is unavailable; do not silently widen tolerance until an answer passes. Changes to accepted mathematical answers are consequential experience decisions.

### 4.3 Numerical calculus

**Mandatory when applicable:** select and verify a method for the particular function family and objective; no differentiation or integration algorithm is universally prescribed.

| Capability | Decisions and checks |
| --- | --- |
| Derivative | Analytic versus numerical evaluation; finite-difference scheme and step size if used; truncation/roundoff balance; boundary handling; non-differentiability and domain restrictions. |
| Secant/tangent | Distinct-point requirements; near-coincident points; undefined or unbounded slope; how direction is represented without inventing a finite gradient. |
| Definite integral | Analytic versus numerical evaluation; orientation for reversed bounds; signed accumulation versus geometric area; subdivisions/tolerance; convergence budget; permitted improper cases. |
| Area representation | Split at relevant zeros, domain gaps and sign changes; show the approved signed/unsigned quantity; distinguish displayed quadrature rectangles from a more accurate computed integral. |
| Linked calculus views | Shared mathematical parameters and units; independently justified plot scales; all dependent views tagged to the same input revision. |

Validate against analytic examples and independently justified invariants: constants/polynomials, stationary points, domain boundaries and relevant sign/cancellation cases. Check convergence where appropriate; merely increasing subdivisions once is not proof of accuracy. Finite differences at a corner and quadrature over a singularity require deliberate handling, not smoothing or a plausible-looking number.

D3 may prepare samples, scales, areas and paths. It is not the mathematical authority for derivatives or integration. Ordinary pure mathematical functions are appropriate; do not add artificial D3 calls to satisfy a naming convention.

**Established Integration example, not a universal algorithm:** [region analysis][integration-model] finds the supported polynomial intersections, derives an ordered piece on each side and adds their non-negative analytic areas. [Mathematical tests][integration-math-tests] independently verify reversals, equal curves, zero width and crossing boundaries. On [1,4], the parabola/axis example has area `10/3 + 11/6 = 31/6`; taking the absolute value of its signed total gives `3/2`, not geometric area. An integral of the **pointwise absolute distance**, such as `∫ |x² − 3x| dx` with limits, is mathematically valid; do not confuse it with `|∫ (x² − 3x) dx|`.

Preserve the distinction between selected identities and derived order when geometry changes topology. Reuse the finite quadratic analyser only within its verified family; other functions may need different intersection/domain methods and validation. Any new student-facing piecewise or absolute-value notation must follow the current educational authority, not be silently introduced to accommodate an algorithm.

### 4.4 Plotting correctness

**Mandatory:** justify sampling for the permitted function family and maximum supported display size. Preserve exact known landmarks where appropriate. Keep true offscreen geometry and clip it; do not clamp function values into false flat segments or bridge unrelated valid points across a gap.

[The existing plot layout][function-plot] adds supplied roots/vertex to uniform samples and uses a linear D3 path. For a monic quadratic, interpolation over spacing `h` has maximum vertical error `h²/4` mathematical units; convert this through the y-scale to check pixel error. [Layout tests][layout-tests] exercise this relationship. Its default 200 intervals are not a general accuracy guarantee.

Non-finite samples break the existing path, but that does not detect a discontinuity lying between finite samples. Functions with poles, excluded intervals, sharp features or oscillation need explicit segmentation and/or suitably validated adaptive sampling. Do not rely on a decorative spline to conceal inadequate sampling. Additional numerical algorithms and curve types are proposals until implemented and verified.

## 5. Pure layout preparation and declarative rendering

### 5.1 Layout contracts

**Mandatory:** pure preparation functions are deterministic for their explicit inputs, do not mutate caller data, and return component-specific readonly data. Pure evaluators may be inputs; output scene contracts contain no evaluators, callbacks, JSX, mutable D3 scales or platform objects.

**Recommended:** compose layouts for meaningful components: coordinate plane, curve, annotations, expression and prompt, coordinated by an activity layout. Tiny SVG primitives need not acquire a dedicated module. Related helpers may share a file; file proliferation is not architectural quality.

Use semantic appearance roles, positions, segments, tokens and descriptions. Renderers translate these into platform markup and styles. Browser focus targets and SVG IDs belong to rendering; the renderer supplies stable per-instance IDs rather than a layout generating random values.

[Graph composition][graph-layout], [scene types][scene-types] and [factor-expression preparation][factor-layout] illustrate the pattern. Scene coordinates are rendering coordinates derived from mathematical values; never reuse them as learning evidence.

### 5.2 Mathematical expressions and worked sequences

**Mandatory where mathematical expressions are generated:** state the supported function/input family, operations, ordering/parentheses rules, exact/approximate formatting and unavailable cases. Derive mathematical meaning from the canonical model, then prepare notation and accessible descriptions. Do not hand-maintain a different formula in each JSX branch, infer algebra from a display string, or assume one illustrative example covers all selections.

Verify meaningful intermediate steps independently as well as the final answer. Bounds, powers, signs, zero terms, coefficient simplification, fractions, units and substitutions must describe the same calculation. Ordinary permitted equal/zero cases need honest working; do not fabricate non-zero steps to fit a template. Use independent analytic values, directly summed constructions or another justified oracle (§12), rather than the same formatting helper as both producer and expected result.

**Recommended:** use the smallest semantic representation that supports the actual task. Integration's [text/fraction tokens and bounded worked-area scene][integration-math-presentation], [math renderers][integration-math-renderers] and [worked renderer][integration-worked] are examples. Its final-task helper deliberately accepts a finite polynomial family with integer primitive coefficients and appropriate bounds; its [tests][integration-worked-tests] cover all 27 ordered pair/interval choices. That is not a general symbolic engine or evidence for arbitrary fractional primitives. A general AST, computer algebra system, TeX library or shared maths framework is not required without a demonstrated need.

Notation layout also carries structure: distinguish prose, inline values/units, standalone equations and a connected working block. Keep any required equals-sign column and common expression origin within the block rather than independently centring its rows. Bounds and fractions remain associated with their operators. The approved experience determines which steps appear; four lines, a particular alignment offset and centred equations everywhere are not universal policies. Section 8 covers rendered fit and Section 12 covers visual evidence.

### 5.3 React and D3 division

For the current web stack:

- **Mandatory:** React owns the DOM/SVG tree. No `d3.select`, imperative axis construction, transition-driven stage changes or independent marker transforms on React-owned elements.
- **Recommended:** use installed focused D3 packages for scales/ticks, data preparation and paths. Instantiate/configure mutable D3 helpers locally inside pure computation and expose only their results.
- **Recommended:** React SVG rendering for the present workload. Canvas or another renderer requires a demonstrated need and explicit state/lifecycle/accessible-output boundaries, not a second owner added as an optimisation shortcut.

Mathematical calculations and layout belong in processing, not JSX. Rendering branches that map a prepared role to a CSS class are normal presentation work and do not need a layout abstraction. Essential boundaries matter more than requiring every component to call D3.

### 5.4 Immutability and caching

**Mandatory:** readonly contracts, input non-mutation and immutable accepted state. **Recommended:** memoise stable coordinate planes and unchanged presentation separately from moving geometry, keyed by all relevant model, policy and size inputs. Caches are conveniences; correctness must not depend on a cache surviving.

The current [recursive freezer][immutable] runs in production for prepared scenes. It offers runtime mutation protection but traverses nested objects, including already-frozen shared children. It is not a universal performance requirement. Do not freeze caller-owned objects, cyclic structures or growing historical data on every frame. Use owned new data and structural sharing; measure whether recursive freezing, selective checks or another strategy fits a larger scene before changing established behaviour.

## 6. Interaction transactions and state management

### 6.1 Transaction contract

**Mandatory for editable gestures:** distinguish begin, preview, commit and cancel. A transaction identifies its owner and applicable context/revision. The effective mathematical value comes from that transaction, not an independently moving DOM element.

- Begin validates permission, input identity and coordinate conversion; preserve the grab offset.
- Preview applies the approved constraints to current absolute coordinates and updates the candidate. Continuous motion stays continuous unless quantisation itself is specified.
- Commit uses final release/confirmation coordinates, validates current constraints and applies the approved snapping/precision rule atomically.
- Cancel discards the candidate and restores the committed model without recording a changed placement.
- Discrete accessible controls dispatch equivalent semantic placements, respecting the same bounds and validation.

Reject stale revisions, wrong owners, invalid coordinates and actions from locked stages. Unexpected secondary contacts must not steal a transaction; an explicitly designed multi-pointer gesture may own a defined set of contacts. Restart must not reuse transaction identities in a way that admits old events. An unchanged or cancelled edit must not count as a changed placement. A deliberate submission of an unchanged value may still be meaningful if the approved assessment permits it, as Card 1's initial Check does.

[Root calculations][root-interaction], [the manipulation reducer][manipulation] and [input tests][input-tests] demonstrate these safeguards for a one-dimensional handle. Two-dimensional points, multiple handles and interval crossings need activity-specific constraints and ownership policies; do not assume the root reducer already supports them.

Where release includes visible settlement, keep the candidate and target in the same owned transaction until final commit; graph and associated live quantities use that same candidate. Cancellation/interruption must still restore the committed value. Integration's [boundary transaction][integration-learning] tracks continuously and requests integer settlement only in Stage 5; Stages 1 and 6 retain continuous commits. Do not add a global snapping rule to a reused adapter. Integer snapping, settlement duration and rounding are activity-specific policies.

### 6.2 Learning and assessment

**Mandatory:** implement explicit accepted transitions. UI enablement is not a substitute for transition guards. Assessment uses the approved submission action and authoritative value; a transient correct position is not a submission unless the specification explicitly says so.

Use a reducer or another explicit, testable state-transition model. Avoid effects that watch a root/answer and infer progression or completion. Card 1's [learning reducer][learning] advances the reveal on an accepted settled placement and assesses retrieval only on Check. Those are different policies, not a universal trigger.

Separate feedback visibility from retained evidence. Clearing a message must not erase attempt counts, assistance use or previous submissions. Do not duplicate derived mathematical/assessment state in multiple stores. Where an immutable record materialises evidence alongside live state, update it from the same accepted transition and test their agreement.

For assessed editable constructions, keep a checked answer associated with the applicable mathematical problem and submitted answer, using revisions or another explicit validity check. Under Integration's approved policy, changing the region or editing the draft invalidates current Finish eligibility, even if the draft is edited back; historical submissions remain. [Reducer][integration-learning] and [tests][integration-learning-tests] establish this particular rule. Other tasks may have different approved invalidation or completion rules; do not infer them from a convenient button state.

### 6.3 Fresh entry, return and local exploration memory

**Mandatory where applicable:** define the retained, reset, invalidated and replayed state for the activity's actual navigation paths. Use a small state table in the existing implementation note, not a new universal lifecycle framework.

| Operation | Technical contract to settle and test |
| --- | --- |
| Fresh entry | Current specified defaults, domains, controls and initial evidence; no stale saved state. |
| Subsection/function switch | Shared versus per-subsection settings, answers, feedback and animation policy. Reselecting the current item may be a specified no-op. |
| Outer Previous/Next return | Restore valid prior state before deriving presentation and arrival facts; do not reapply fresh defaults over it. |
| Problem/draft change | Invalidate the specified current answer/feedback/eligibility without deleting retained attempts or assistance. |
| Restart | New attempt identity and specified reset, distinct from navigation and suspension. |
| Suspend/resume/exit | Apply the hosting distinctions in §7.2 without inventing learning transitions. |

Test with non-default choices, backward/forward returns, interrupted edits and relevant edit-then-revert cases. Do not mandate per-subsection memory universally: Integration Stage 2 intentionally shares its rectangle count, Stage 4 preserves the quadratic count through The rule, and Stage 3 caches first answers per function. Its [navigation/refinement tests][integration-refinement-tests] cover actual restored views. Snapshot stacks are an implementation choice, not a common lesson engine.

### 6.4 Animation and timed-state contracts

**Mandatory when animation affects mathematical presentation or learning:** identify its semantic state owner and separately define start delay, running duration/easing, completion, replay, interruption, pause/resume, reduced motion and answer visibility. Platform time may dispatch progress to that owner; it must not independently transform the graph or decide assessment through a D3 transition.

Give each run an identity/context sufficient to reject obsolete callbacks after navigation, switching, restart or suspension. Cancel scheduled work/listeners on cleanup. Distinguish an animation completion fact from a student answer, and avoid duplicate facts during replay. Reduced-motion output must preserve the mathematical comparison and meaningful final state without requiring the student to watch motion. Do not infer a new pedagogical transition merely because an animation finished.

Integration's [motion adapter][integration-motion] separates comparison delay/duration from boundary settlement; its [clock-controlled browser tests][integration-browser-tests] check waiting, actual intermediate geometry, completion and replay. Selecting an answered function replays then restores feedback, whereas outer return restores it immediately. These are approved activity policies, not a default for every visual. Use controlled clocks where available rather than timing-sensitive arbitrary sleeps. Changing a requested delay is not permission to alter duration, easing or assessment availability.

### 6.5 Camera, zoom and expensive processing

**Mandatory when present:** camera state changes the view, not the mathematical object. Store its domain/transform explicitly and prepare projection from it. Gesture libraries may translate input but must not maintain a competing untracked camera transform. Card 1 has no zoom; the current project contains no validated zoom implementation to reuse.

**Recommended:** React-owned camera state and pure pan/zoom calculations for a future web activity. A closed high-frequency native/canvas circuit is not a general exception: introduce it only after profiling, with one active owner, consistent linked views and explicit commit/cancel/revision handoff. Native worklet compatibility is not established by ordinary TypeScript purity.

For expensive numerical analysis, distinguish pending computation from accepted results. Tag asynchronous work with input revision, reject stale responses and never combine one revision's curve with another's assessed result. Workers, throttling or approximate previews require a demonstrated need and an honest accuracy policy; none is assumed implemented now.

## 7. Platform adapters, hosting and lifecycle

### 7.1 Browser adapter responsibilities

**Mandatory:** browser modules own measurement, event objects, pointer capture, focus, visibility and cleanup; portable processing receives plain values.

Use absolute pointer coordinates, a validated mapping and mathematical grab offsets. Clear ownership before intentional capture release so the resulting capture-loss event cannot cancel a commit. Cancel on unexpected capture loss, incompatible geometry changes, suspension, visibility/focus interruption and invalid mapping. Restrict `touch-action` to the necessary target rather than blocking page scrolling or browser magnification globally.

The [current adapter][pointer-adapter] uses three measured SVG probes because WebKit may omit ancestor CSS transforms from `getScreenCTM()`. This is an established workaround for tested affine transforms, not justification for probes in every renderer or support for arbitrary perspective transforms. Preserve transformed-coordinate regression tests when adapting it.

Test native browser behaviour as well as pure actions when controls change across stages: focus, Enter/Space, form submission/default actions, pointer capture and DOM identity can affect the outcome. Integration's [navigation regression][integration-restoration-browser-tests] checks that returning to a calculation with a valid draft does not submit it. Its historical correction required distinct navigation/submit identities, not a new assessment rule. Never treat a correct reducer test as proof that one browser activation cannot dispatch the wrong action.

### 7.2 Host lifecycle

**Mandatory:** distinguish these operations in any public hosting contract:

| Operation | Required distinction |
| --- | --- |
| Suspend/hide | Cancel active editing, block input, preserve committed mathematics and learning. |
| Resume | Restore that session without making a learning transition. |
| Restart | Begin a new attempt, reset its learning state, preserve supported prior records. |
| Explicit exit | End interaction and deliver available final/partial evidence before navigation. |
| Unmount/shutdown | Clean up platform ownership; do not claim guaranteed evidence delivery. |

[Card 1's public activity][activity] exposes `visible`, `restartKey`, `exitKey`, callbacks and optional `onExit`. Request keys are its current host-control convention, not a compulsory API for all activities. Their initial values are inert and changed values are explicit requests. Consult the [current contract][records-document] rather than guessing lifecycle order.

Integration's [public activity][integration-activity] follows the same visible/request-key boundary with its own state and records. Restoring a stage or subsection is not a restart; cancelling a live edit before suspension must not erase committed exploration or create a placement event.

The lab's A–E and sparkline dropdown previews preserve the mounted Guided owner; their interactions cannot change Guided evidence. A real experience change has a different mounting boundary. Preserve that distinction when adding lab entries. The two-level [experience registry][registry] remains lab-only; no student skipping feature is implied by preview navigation.

### 7.3 Hosting and React Native readiness

**Mandatory:** activities bring their own feature styles and do not require lab navigation, application CSS variables, authentication or card data. Hosts supply viable layout space and handle persistence/navigation outside the activity. CSS Modules prevent outgoing class-name collisions, not arbitrary inherited global styles; verify actual host typography, box sizing, overflow and safe areas during later integration.

**Recommended:** portable numeric coordinates and SVG-compatible path/segment data allow a future native renderer to retain computation. Native text metrics, SVG primitives, measurement, gestures, focus and accessibility still require adapters and tests. The current implementation is structured for a port, not verified as React Native-ready. Do not install native infrastructure in anticipation alone.

### 7.4 Verify the actual host before diagnosing interaction

**Mandatory before relying on a browser baseline:** verify the intended listener, route and actual origin, then perform a real hydrated action. HTTP 200, a server-rendered graph, a hit-testable button or a screenshot alone does not establish a working client. Include the host's real navigation/lifecycle around the activity rather than an imitation interface where that context matters.

When the interface is inert, separate listener/route errors, script/runtime or hydration failures, origin/development-server policy, overlays/hit testing and event handling before changing application code. Correlated HMR errors are diagnostic evidence, not proof of one cause for all phone failures. Do not transplant another feature's modal/gesture system without evidence it addresses this failure.

The [LAN-origin smoke test][lan-tests] checks touch menu use, real root movement and independent activity mounts. Run such checks against the actual permitted localhost/LAN origin when phone access is in scope; preserve unrelated servers. Confirm the address/port rather than reporting an assumed phone URL. Specific development-origin configuration and coordinate workarounds are environment-specific, not universal application requirements.

## 8. Responsive geometry and presentation

### 8.1 Stable mathematical frame

**Mandatory:** state the physical and mathematical invariants for the approved comparison. At a fixed allocated size, stage or feedback changes must not move/resize/rescale the graph when students are meant to compare states. Deliberate camera or scale changes require an explicit mathematical purpose and presentation policy.

Specify plot rectangle, domains, ticks, unit ratios and linked-view relationships independently from prompt content. Equal horizontal/vertical unit scales are necessary when the intended geometric interpretation requires them, not for every graph of different quantities. A camera/domain change must not be confused with movement of the mathematics.

Card 1 fixes domains `x = [-6,6]`, `y = [-10,10]` and graph geometry across stages. Its sparklines intentionally use a separate fit policy. Neither frame is a mandatory domain/aspect ratio for other activities.

Integration uses explicit [frame profiles][integration-graph-layout] where different functions/learning comparisons justify different scales, then preserves the relevant frame through movement and feedback. Do not generalise either “all stages identical” or “resize to fit each prompt.” For a scoped correction, record the graph, axes, control/text relationships and navigation that must remain unchanged; compare them with the pre-change baseline at the same allocated size. A page still fitting is not evidence that its protected graph or navigation did not move. Prefer meaningful relational assertions; fixed pixel coordinates are appropriate only where exact geometry is an intended invariant.

### 8.2 Content-aware phone composition

**Recommended:** use a content-aware frame that reserves the longest normal instruction/notation/action requirements and gives the mathematical surface the remaining usable height. Test 320 × 568, 360 × 640 and approximately 390 CSS-pixel-wide portrait screens early, then tablet/desktop and 200% text scaling. Treat these as reference cases, not the only supported devices.

Budget the actual host header, safe areas and available surface, not the full nominal device height. Early demanding-state renders (§1.3) must include the actual mathematical typography, control inventory, instruction/feedback and navigation; plain text/canvas estimates are only preliminary measurements. Before shrinking a graph, reducing type, hiding content or introducing scroll, inspect unused allocated space and intrinsic control/equation widths. A slider should use its available column without truncating its associated function names or readout. Keep approved grouping and placement intact rather than solving crowding with unapproved extra screens or controls.

Allow controlled vertical scrolling on short screens or enlarged text rather than clipping controls or shrinking the mathematical surface until it is unreadable. Set sensible larger-screen maxima. Avoid hardcoded aspect-ratio changes to solve each new prompt independently.

An explicit one-screen criterion at a normal target viewport remains an acceptance requirement, not a preference that a passing build can waive. If it cannot be met legibly after reasonable technical adjustment, report measured excess and the affected protected requirement; resolve within delegated authority or escalate the conflict before substituting an experience. Distinguish normal layout from enlarged text, browser chrome and an open software keyboard. Check focus/input visibility without silently compressing the mathematical frame. Keyboard-closed captures do not certify real iPhone keyboard behaviour.

[ActivityFrame][activity-frame] and [its CSS][frame-css] use overlapping sizing slots and a bounded graph row. This technique is established for Card 1's content but its sizing text approximates actual text widths; it needs rendered geometry checks as content, fonts or translations change. Alternative compositions may use another explicit reservation strategy. Do not copy its pixel limits into unrelated multi-graph experiences.

Integration's stage-local reservations and the 390×844 / 393×852 [rendered checks][integration-render-tests] are another example, not universal panel sizes or breakpoints. Changing content can require deliberate reallocation only within current constraints; preserve an expressly protected graph/navigation frame and use available content space first. Keep decorative developer inspectors separate from the student fit criterion.

### 8.3 Presentation roles, labels and masking

**Mandatory:** preparation identifies whether notation represents current mathematics, a target, prediction, explanation or unavailable answer. Keep target quantities separate from current equations when they differ. [The root task layout][root-task] illustrates this separation without claiming the plotted function contains the target factor.

Prepare annotation positions, boundary handling and collision policy in layout functions. Keep mathematical marker centres exact. Visible markers, larger hit regions and finger-safe labels serve different purposes. Use stable identities and shape/outline cues; avoid unnecessary annotation jumps. Labels should render above curves when intended as surfaces, with tested contrast and restrained backing where needed.

Mask answer-bearing content in visible text, SVG titles/descriptions, accessible names, live regions, tooltips and hidden sizing nodes. Hidden or `aria-hidden` content is still in the DOM. Use neutral calibration content rather than hidden solutions; mount diagnostics only on explicit lab request. [Card 1 presentation preparation][presentation] and [masking tests][presentation-tests] are representative evidence. This prevents unintended disclosure through the rendered interface; it is not a security boundary against inspecting client code or explicitly opening authored lab previews.

Standalone calculations may be centred while their labels/prose remain left-aligned; a working sequence may instead require one centred block with a shared equality axis (§5.2). Preserve operator/bounds association, expression origin, inline units and readable longest lines. A horizontal-only change must not alter surrounding line heights or section allocation: changing inline/flex display can move adjacent baselines even when fonts are unchanged. Verify the relationship requested, not simply that the document has no overflow. Alignment choices remain activity-specific.

For optional anchored explanations, distinguish accepted temporary overlay from accidental clipping or document reflow. Use existing Tooltip behaviour when suitable and scope content/width changes to the actual consumer. Do not add protected rectangles, new viewport observers or collision avoidance merely because an approved tooltip temporarily covers a control. Test the applicable containment, trigger/dismissal, focus and enlarged-text behaviour instead; a separate interaction system requires a demonstrated requirement.

### 8.4 Existing precision limitations and approved exceptions

**Activity-specific, not a general exception:** Card 1 currently uses a continuous curve with nearest-integer root/factor displays during dragging. `expressionIsRounded` and the graph description record that distinction, but the visible factorised equation has no approximation cue. It can temporarily differ from the function drawn.

This was explicitly approved during Card 1 development. It is not evidence that all current representations satisfy Great Maths Visuals Section 2.1's exact-versus-approximate requirement. Keep it visible as an existing mathematical-presentation discrepancy requiring a separate product review; do not silently alter that approved activity in a documentation task or reproduce the mismatch in new visuals.

Integration Stage 1 has another **activity-specific** policy: [its readout preparation][integration-display-policy] rounds the displayed boundary to one decimal and computes the displayed area from that same rounded value, while geometry/committed state remain continuous. Its accessible description identifies that policy; the displayed equation has no explicit visible approximation cue relative to the unrounded graph. A display-only derived calculation is not the canonical model or an assessment input. This approval does not establish a general exception to the current visible-precision standard.

For new work, define an honest visible approximation/presentation policy before implementing precision reduction. The display may simplify information, but must not assert false exact equality. Keep these existing discrepancies explicit until separately reviewed/resolved under the applicable authority; this guide update does not authorise changing either activity or reproducing the mismatch in a new one.

## 9. Accessibility implementation

### 9.1 Essential operations and equivalent input

**Mandatory:** new activities provide accessible alternatives for essential mathematical gestures, including students who cannot drag and have no keyboard. All input methods feed equivalent semantic actions and constraints, without automatically submitting or changing the mathematical task. Keyboard arrows alone do not establish adequate touch access.

Choose alternatives appropriate to the approved control inventory: for example, an accessible value-entry/control surface or discrete selection mechanism. These are examples, not authorization to add unexplained controls. Do not automatically restore Card 1's removed visible arrows or implement an alternative without resolving any consequential experience choice under the Support Guide.

For scalar controls, use suitable slider/value semantics with prepared names, bounds and value descriptions. Point/interval interaction may require different semantics. Preserve visible focus and stable identities, and distinguish graphical mark size from an operable target. The existing root uses a 48 CSS-pixel target; use at least the project's 44 CSS-pixel touch-target baseline for essential controls unless an explicit layout requirement demands a justified alternative.

### 9.2 Focus, feedback and visual accessibility

**Mandatory:** specify focus when a control disappears or a stage changes. Do not move focus on every pointer preview. Announce accepted feedback and relevant transitions without flooding live regions during dragging. Keep locked controls and their explanations consistent across pointer, keyboard and assistive technologies.

Use native buttons and semantics where applicable. When an unavailable action must explain its prerequisite on attempted activation, an `aria-disabled` control may be appropriate, but its handler and transition guard must still block progression. Test touch, mouse, Enter, Space, dismissal and enlarged-text tooltip overlap. [Navigation hint tests][hint-tests] demonstrate this specialised case; native disabled remains suitable when no activation explanation is needed.

Test mathematical labels and controls against backgrounds, grid and curves. Measure relevant contrast rather than trusting palette names; the current graph axes exceed the project's 3:1 essential-graphics threshold with a margin. Use non-colour cues, readable reflow, reduced-motion preferences and unrestricted browser text/zoom access. Automated geometry and contrast checks do not establish full accessibility compliance.

### 9.3 Known limitation and evidence status

Card 1's touch-only non-drag alternative remains explicitly deferred. It affects students unable to drag without another usable input method. Keyboard support does not close that requirement. Its development milestone acceptance is not full accessibility readiness, and future activities must not inherit the exception.

Record unresolved accessibility requirements with impact, affected users, approval/status and required verification. Physical iOS/Android and VoiceOver/TalkBack checks remain necessary where automated coverage cannot establish behaviour. Distinguish simulated text scaling, browser emulation, keyboard tests and real assistive-technology evidence in reports.

Integration uses native range/select/form alternatives as well as graph keyboard controls. That is implementation evidence, not completed physical touch-assistive-technology verification or a waiver of §9.1. Keep known exceptions and verification gaps activity-specific; do not repeatedly reopen an authorised deferral without changed scope/risk, and do not treat milestone acceptance as full compliance.

## 10. Compact and static representations

**Mandatory:** compact representations have explicit mathematical inputs, size constraints, semantics and framing. They do not mount an interactive learning controller or inherit its transient/pedagogical state implicitly. Their values must describe the state they claim to represent.

**Recommended:** prepare a dedicated compact layout rather than shrinking the full activity SVG. Fit important landmarks, use an intentional unit-scale policy, retain essential labels and omit only genuinely secondary furniture. Compare variants at the same mathematical state and identical graph geometry where applicable. A notation-only variant must not reserve an invisible graph region.

[Card1Sparkline][sparkline-component] has three static variants, independent styling and a runtime-validated integer root contract from −5 to 5. Its graphical variants have numerical labels below true root positions; coincident roots share a label. [Sparkline tests][sparkline-tests] cover framing, equal unit scales and labels, including 160-pixel reference widths.

These are **Card 1 policies**. A derivative thumbnail may need a tangent rather than roots; an integral thumbnail may need signed area and interval endpoints. No paired snapshots, three variants, integer inputs or equal-unit framing are mandatory for unrelated concepts. Changes to public input support need runtime validation, types, tests and deliberate compatibility treatment—not fractional labels bolted onto an integer-only contract.

## 11. Learning records and integration contracts

### 11.1 Activity facts, host persistence

**Mandatory:** Step Visuals owns learning decisions and produces structured facts. Puckle/Switchplay owns persistence, user identity, card associations and retention policy. No activity needs those services to compute or complete its task.

Expose clear typed public contracts for results and supported callbacks. Return mathematical values and semantic identifiers, not formatted expressions, SVG paths, React elements or screen coordinates. Records are immutable, serialisable and versioned. Expected unavailable values have explicit representations; `NaN`/`Infinity` must not silently become misleading JSON nulls.

Use an opaque attempt identity, distinguish restarts, and identify ordered events. Keep schema version separate from activity/task revision when interpretation can change. Different activities may share envelope conventions, but their prediction, construction, integral estimate or assessment payloads must remain appropriate to their mathematics. [Card 1 record types][record-types] are a concrete contract, not a common schema to force onto every activity.

Integration's [v1/v2 public union][integration-records] preserves historical six-stage records while the live seven-stage activity emits v2 selected-curve regions and stable stage identifiers. Do not reinterpret old stage numbers or payloads as new semantics. Add compatible fields deliberately, distinguish optional historical data from guarantees of newly emitted events, and test old/new consumers or fixtures as relevant. No runtime migration, refresh recovery or generic event framework is implied by a versioned type.

### 11.2 Events, results and partial attempts

**Mandatory when recording is supported:** record accepted meaningful actions specified by the experience: committed choices, predictions, submissions, requested assistance and outcomes. Do not record every pointer frame, cancelled edit, rejected/stale action or lab preview as learner evidence. Produce accepted facts alongside state transitions, not by observing rendered state afterwards.

Individual assessments retain the submitted mathematical value, correctness and relevant assistance state at submission. Preserve the task's definition of independent/assisted success; a failed attempt must not silently become assistance. In Card 1, a Check evaluates the target linear factor, not the plotted quadratic, which is zero at every movable root.

**Mandatory:** document event meanings, accepted triggers, no-op/revisit semantics and exclusions. Distinguish accepted navigation/selection, mathematical interaction, submitted answer, assistance and outcome. A field/event named “viewed” records the accepted visit under its contract, not proof that the browser painted it or the student read/understood it. Do not infer predictive timing from an event name without its defined stage semantics, or infer mastery from completion.

When reconstructing visited graphs/subsections is part of the approved evidence contract, include the actual initial and restored arrival context rather than relying on undocumented fresh defaults or emitting duplicate selection events. Integration adds `view` to new `attempt-started` / `stage-changed` events after restoration, and `division-rule-viewed` for accepted rule entry; unchanged selections add no event. [Tests][integration-refinement-tests] distinguish returns, interactions, animation completion and predictions. This does not require extra analytics, view-duration tracking, rendering acknowledgements or a complete replay of unrecorded frames/settings.

Keep completion, correctness and independent/assisted outcome separate where the task distinguishes them. Integration may Finish after an incorrect numerical Check: a completed result then has `outcome: incorrect` and no success classification. Its earlier submissions survive editing even though current Finish eligibility is cleared. Card 1 instead requires a successful Check to reach its finished state. Neither completion policy is universal; the record contract must describe the actual activity without equating “finished” with “correct”.

Start again begins a new attempt and preserves completed snapshots for the mounted session. Make current/partial attempt information available to the parent and emit explicit restart/exit facts where those actions exist. Do not treat navigation previews, refresh or tab closure as guaranteed exits. Persistence or refresh restoration requires its own approved scope.

[The recorded reducer][recording] uses structural sharing and bypasses history processing during continuous previews. Accepted-action arrays grow and are copied on meaningful additions; their cost and session retention remain bounded by the intended short activity, not proven suitable for indefinitely running tools. Define a retention/delivery strategy before substantially longer sessions without silently deleting evidence promised by the public contract.

Integration follows the same hot-path boundary in [its reducer][integration-learning]; [its diagnostic test][integration-performance-tests] makes historical-array access fail during previews. Record only the meaningful accepted transitions promised by the contract; do not change the mathematical interaction to make recording easier.

### 11.3 Callback delivery

**Mandatory:** callbacks deliver already accepted facts outside render/reducer execution. Guard duplicate completion delivery within an attempt, Strict Mode replay, reentrant handlers and stale interactions. Callback failures must not corrupt mathematical/learning state. Document error handling and late-subscription behaviour; local duplicate suppression is not exactly-once durable storage across remounts or crashes.

The established order for Card 1 and Integration is:

1. Newly accepted ordered `onEvent` deliveries, with `onComplete(result)` interleaved immediately after each completion event, once per completed attempt.
2. `onRecordsChange(records)` after the event batch, with the resulting accumulated snapshot.
3. `onExit()` after final evidence, so the host can navigate/unmount.

Late event/completion subscribers receive future notifications, not historical replay; a late snapshot subscriber can inspect archives. Synchronous callback errors are reported without undoing evidence; asynchronous persistence/error handling belongs to the host. These details are defined in [the Card 1 interface documentation][records-document], [Integration delivery][integration-notifications] and their [Card 1][record-tests] / [Integration tests][integration-notification-tests]. Do not assume another interface has this order without an explicit contract. Activities do not promise durable exactly-once delivery merely by suppressing duplicates within a mounted session.

### 11.4 Lab diagnostics

**Recommended:** keep fixtures, record inspectors and logging in the lab, consuming the same public callbacks as a future host. Avoid a second evidence calculation for diagnostics. The existing [console consumer][console-logger] logs accumulated snapshots in collapsed groups only in development, batching related event/completion deliveries at the snapshot boundary. It adds no learner identity data and does not log pointer previews. The on-screen inspector mounts record JSON only when explicitly opened.

Do not add names, user IDs, storage or production telemetry as incidental diagnostics. Test both development output and production silence when changing environment-dependent logging.

## 12. Verification, performance and maintenance

### 12.1 Evidence appropriate to risk

**Mandatory:** verify mathematical contracts, accepted/rejected transitions, presentation and platform behaviour separately. Use independent mathematical expectations; comparing a renderer with the same layout helper alone cannot establish that the mathematics is correct.

| Layer | Required evidence where applicable |
| --- | --- |
| Mathematics/numerics | Known analytic cases, invariants, boundaries, signs/zero, special cases, convergence/error analysis and invalid/undefined inputs. |
| Pure layout | Deterministic outputs, non-mutation, projection/inversion, finite paths, landmarks, clipping/segmentation, label positions and justified interpolation error. |
| State/transactions | Continuous previews, exact commits under the specified policy, unchanged/cancelled edits, stale owners/revisions, locked actions and assessment timing. |
| Learning/records | Correct/incorrect/assisted journeys, retained evidence, restart/exit, immutable archives, serialisation and duplicate-delivery safeguards. |
| Experience fidelity | Current-specification expectations for protected copy, controls present/absent, grouping/order, feedback/reveal timing and free-choice versus assessment rules. |
| Browser | Hydrated real actions at the intended origin; intermediate movement, release/capture/cancellation, native default/form actions, transformed coordinates, keyboard/non-drag alternatives, focus, masking and lifecycle. |
| Responsive/accessibility | Representative phones/tablets/desktops, substantial-content states, 200% text, overflow, target sizes, permitted overlay/clipping distinction, geometry invariants, contrast and reduced motion. |
| Static representations | Actual intended sizes, full supported input range, coincident/special cases, variant geometry and independent mounting. |
| Boundaries | Portable imports, no lab dependency from reusable activity, no unauthorized application coupling and scoped public contracts. |

[Mathematical/layout tests][layout-tests], [browser manipulation tests][browser-input-tests], [learning tests][learning-tests], [retrieval tests][retrieval-tests] and [isolation checks][isolation-tests] are reference examples. Integration adds [independent area/rectangle oracles][integration-math-tests], [literal-copy checks][integration-copy-tests], [state/assessment cases][integration-learning-tests] and [worked-solution cases][integration-worked-tests]. Its finite final-task inventory makes all 27 ordered curve/interval combinations practical to enumerate; that is not a requirement to enumerate an unbounded function space. Use representative analytical cases/invariants and justified property/convergence checks appropriate to that space.

The current isolation checks scan feature imports and explicitly enumerate portable modules for **both** activities alongside `core/`. They are useful regression guards, not proof of every transitive dependency or native compatibility. Extend discovery/coverage for new modules and review actual import direction, including nominally shared `core/` modules.

Use existing Playwright projects before adding a new framework. Run relevant supported browser engines and report omissions; do not repeatedly invoke known-unavailable tooling as though it provides coverage. WebKit is explicitly excluded in the current environment by user instruction, not permanently unnecessary. Chromium native touch injection, an iPhone user agent and phone-sized rendering do not verify Safari touch or assistive technologies.

### 12.2 Significant-state renders and genuine visual review

**Mandatory:** derive visual verification from the current acceptance map (§1.3), not just one initial screenshot per stage. Select educationally significant states that change the mathematical representation, instruction, controls or feedback: relevant function/subsection selections, intermediate movement, special cases, correct/incorrect responses, requested hints, completion/working and navigation returns. Include the longest meaningful expressions and content states. Do not invent learner-facing content or interactions to obtain test coverage; fixtures must represent the intended experience.

Keep these evidence categories distinct in the verification record:

| Evidence | What to report | What it does not establish |
| --- | --- | --- |
| Generated render/capture | Actual state, source revision, viewport/text/motion settings and artifact location. | That anyone inspected the pixels or that the controls work. |
| Automated viewport/geometry assertions | Which bounds, overflow, axes, spatial relationships, alignment and interaction checks actually ran. | Mathematical readability, coherent hierarchy, clarity or complete accessibility. |
| Genuine visual inspection | Which actual rendered states were opened and examined for mathematical clarity, notation/labels, readability, grouping and learner experience; findings and limitations. | That every generated capture or physical device was inspected. |
| Physical-device verification | Actual device/browser and interactions exercised, including relevant keyboard/chrome/touch behaviour. | Verification of another device or assistive technology. |
| Assistive-technology verification | Actual screen reader/input configuration, journey, focus/announcements and mathematical output checked. | Full accessibility compliance beyond those checks. |

**For educationally significant states, perform genuine visual inspection of actual renders wherever the available tools permit.** Capturing images, reading CSS, asserting dimensions or receiving green tests is not that inspection. Use meaningful representative states where several cases share a presentation, and identify what was actually inspected. If tools cannot render or display the result, state that limitation and the affected unverified requirement; do not claim simulated visual verification. A visible problem found within delegated authority should be resolved before human review; protected compromises follow §1.1 rather than silent redesign.

Geometry assertions and visual review complement each other. Check common equality axes, integral-bound association, unclipped long expressions and stable graph/navigation relationships where required; document height alone misses those failures. A screenshot generated by `page.screenshot` is not automated pixel-regression coverage unless it is actually compared with a justified approved baseline. When image baselines are useful, review and update them only for legitimate requirement/presentation changes, not merely because new output differs.

Keep capture commands and meaningful geometry measurements reproducible. Prefer preserving a selected review set in the team's existing durable review/CI mechanism when available, with source revision and settings. `/private/tmp` output is temporary evidence, not a durable golden image; identify it as such and retain the means to regenerate it. No new storage service, all-images-in-Git policy or screenshot framework is required.

### 12.3 Proportionate checks and reproducible commands

**Recommended:** run affected tests during small changes; broad mathematical, interaction or lifecycle changes warrant the relevant regression suites. A copy-only edit normally needs affected assertions and focused rendering checks, not every gesture test. A documentation-only edit needs link/consistency/diff checks, not an application build unless configuration or executable examples changed in a way requiring it.

Before substantial implementation handoff, run appropriate pure and browser suites, feature isolation, TypeScript, scoped lint and a production build. Report unrelated environment/application failures separately rather than changing unrelated source. Coordinate build and standalone type checks: generated Next route types can change during build, so perform the final `tsc` after build rather than racing them.

For a scoped refinement, identify the changed requirements and neighbouring/shared behaviours that must remain invariant. Select tests that cover that risk, including existing consumers of changed shared code; full-journey regression is warranted when the shared change can affect it. Capture/measure a relevant baseline before layout changes and compare afterward. Update old assertions only for explicitly changed or legitimately revised requirements; preserve unaffected guards. No test count substitutes for this coverage argument.

Run from the repository root using the existing feature-local configuration:

```sh
SPV_PURE_ONLY=1 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=pure
SPV_TEST_BASE_URL=http://localhost:3171 node_modules/.bin/playwright test --config=src/app/step-visuals/tests/playwright.config.ts --project=chromium
node_modules/.bin/eslint src/app/step-visuals
npm run build
node_modules/.bin/tsc --noEmit
```

The URL above is an example of the previously used development origin, not a claim that a server is running. Use the actual verified URL/port in `SPV_TEST_BASE_URL`; without it the config may start its own dev server using a different origin. Apply a test-file filter for focused checks. Add the WebKit project only when supported and authorised in the environment; otherwise report that coverage gap. Respect existing servers and check actual interaction as well as route availability (§7.4).

The feature-local `package.json` marks ESM for the existing test/module boundary; it is not a separate dependency installation or a validated native package. Preserve it unless a concrete compatibility issue is demonstrated. Respect repository permissions for generated output and browser caches.

### 12.4 Performance without competing state

**Mandatory:** do not trade mathematical consistency for smooth-looking motion. Marker, curve and related live quantities must correspond to the same effective mathematical revision. If computation is not immediate, show an explicitly pending/approximate state rather than present mismatched results as current.

**Recommended:** measure representative work before optimisation. Separate coordinate preparation, evaluator cost, sampling, scene allocation/freezing, React rendering and browser layout. Cache stable planes and unchanged prompts, validate evaluators once per model where safe, and avoid history traversal or console work in preview handlers.

[Local layout diagnostics][performance-tests] and browser interaction diagnostics are not phone performance guarantees or universal frame budgets. Profile real representative hardware for demonstrated risks. Batching pointer updates may be considered if needed, but preserve the final release coordinates, cancellation semantics and one state owner. Do not add imperative D3 rendering or a second mathematical store to mask an unmeasured bottleneck.

Integration's [processing diagnostic][integration-performance-tests] additionally guards against historical-array access during previews and measures the 128-part paired-rectangle case. Passing it supports that specific processing boundary; it does not measure React/browser/finger latency or establish a phone frame rate. Repeated analysis, allocation or recursive freezing may be optimisation candidates only after a demonstrated bottleneck. Do not remove defensive checks or introduce a competing graphical state based on speculative performance concerns.

### 12.5 Completion of engineering work

Keep a concise verification record stating what actually ran, important behaviour established, exceptions and what remains unverified. Distinguish automated function/geometry checks, visual judgment, physical-device testing, assistive-technology testing and learning-effectiveness evidence. Follow the Support Guide for human review; do not ask reviewers to repeat adequately automated functional checks.

Use §12.2's explicit evidence categories rather than saying “visually verified” when only screenshots or dimensions were generated. Report failures/omissions as well as passes, and separate historical test results from checks actually run for the current change. Do not claim current phone URLs, physical-device success, accessibility compliance or educational approval from a previous engineering report. A deferred requirement remains open until resolved and verified.

At technical consolidation, update the authoritative experience specification with approved revisions, the public interface documentation with contract changes, and this guide only with genuinely reusable engineering lessons. Passing tests alone does not close a documented mathematical or accessibility discrepancy.

### 12.6 Maintain the guide as evidence grows

For an emerging reusable pattern, record its purpose, assumptions, implementation/test references, exceptions and evidence status. Promote it when its boundary is justified and supported by actual consumers; do not treat relocation into `core/` as validation. Keep activity-specific examples explicitly labelled and links current.

Before the next substantially different activity, review the reuse map, numerical requirements and known limitations. Extract only what that approved activity needs. When a convention changes, record the reason and compatibility implications; mark superseded guidance rather than preserving contradictory instructions. Change the educational quality guide or Support Guide only with the appropriate approval and only when the lesson belongs to that document.

Use evidence from both successful boundaries and expensive corrections. A useful lesson should improve another activity's engineering, not turn a single view's constants, component tree, annotation offset or workaround into a mandatory architecture. Maintain a current capability/evidence map and concise decision rationale rather than appending a separate retrospective to this guide. Historical reports remain evidence, not alternative instructions. A guide-only revision needs documentation validation, not a fresh application test/build claim.

Current issues to retain until separately resolved:

- Card 1 non-drag touch access: approved deferral, not full accessibility compliance.
- Card 1 rounded factor equation during continuous motion: approved earlier simplification requiring review against the current precision standard.
- Integration Stage 1 rounded boundary/area display versus continuous geometry: approved activity-specific policy with the visible-precision limitation in §8.4.
- Integration physical Safari/software-keyboard and assistive-technology behaviour: Chromium/pure evidence is not physical verification or human educational approval.
- Shared-module generality: root-specific and Card 1 dependencies remain as listed in Section 3.
- React Native and actual Puckle hosting: architectural preparation, not completed port/integration verification.

The aim is reusable boundaries and verifiable mathematics, not identical component trees, stage counts or algorithms across activities.

[quality-guide]: ../../../design/features/step-visuals/great-maths-visuals.md
[support-guide]: ../../../design/features/step-visuals/ai-maths-visuals-support-guide.md
[previous-guide]: maths-visuals-engineering-guide-v1-1.md
[retrospective]: engineering-retrospective1-1.md
[agents]: ../../../../AGENTS.md
[historical-plan]: ../../step-visual-1-plan.md
[public-api]: ../../../../src/app/step-visuals/public.ts
[card1-model]: ../../../../src/app/step-visuals/activities/roots-factors/model.ts
[card1-layout]: ../../../../src/app/step-visuals/activities/roots-factors/rootsFactorsLayout.ts
[manipulation]: ../../../../src/app/step-visuals/activities/roots-factors/manipulation.ts
[learning]: ../../../../src/app/step-visuals/activities/roots-factors/learning.ts
[recording]: ../../../../src/app/step-visuals/activities/roots-factors/recordedLearning.ts
[presentation]: ../../../../src/app/step-visuals/activities/roots-factors/presentationLayouts.ts
[activity]: ../../../../src/app/step-visuals/activities/roots-factors/RootsFactorsActivity.tsx
[real-factors]: ../../../../src/app/step-visuals/core/math/realFactors.ts
[coordinate-plane]: ../../../../src/app/step-visuals/core/graph/coordinatePlaneLayout.ts
[function-plot]: ../../../../src/app/step-visuals/core/graph/functionPlotLayout.ts
[graph-layout]: ../../../../src/app/step-visuals/core/graph/graphLayout.ts
[root-markers]: ../../../../src/app/step-visuals/core/graph/rootMarkerGroupLayout.ts
[scene-types]: ../../../../src/app/step-visuals/core/graph/types.ts
[root-interaction]: ../../../../src/app/step-visuals/core/interaction/rootInteraction.ts
[factor-layout]: ../../../../src/app/step-visuals/core/expressions/factorExpressionLayout.ts
[root-task]: ../../../../src/app/step-visuals/core/expressions/rootTaskLayout.ts
[immutable]: ../../../../src/app/step-visuals/core/immutable.ts
[graph-renderer]: ../../../../src/app/step-visuals/platform/web/Graph.tsx
[pointer-adapter]: ../../../../src/app/step-visuals/platform/web/useRootPointer.ts
[activity-frame]: ../../../../src/app/step-visuals/platform/web/ActivityFrame.tsx
[frame-css]: ../../../../src/app/step-visuals/platform/web/ActivityFrame.module.css
[notifications]: ../../../../src/app/step-visuals/platform/web/learningNotifications.ts
[registry]: ../../../../src/app/step-visuals/lab/experienceRegistry.ts
[console-logger]: ../../../../src/app/step-visuals/lab/learningConsole.ts
[sparkline-layout]: ../../../../src/app/step-visuals/core/sparklines/card1SparklineLayout.ts
[sparkline-component]: ../../../../src/app/step-visuals/sparklines/Card1Sparkline.tsx
[record-types]: ../../../../src/app/step-visuals/activities/roots-factors/learningRecords.ts
[records-document]: ../../../../src/app/step-visuals/learning-records.md
[layout-tests]: ../../../../src/app/step-visuals/tests/layout.spec.ts
[input-tests]: ../../../../src/app/step-visuals/tests/input.spec.ts
[presentation-tests]: ../../../../src/app/step-visuals/tests/presentation.spec.ts
[hint-tests]: ../../../../src/app/step-visuals/tests/navigationHint.browser.ts
[sparkline-tests]: ../../../../src/app/step-visuals/tests/sparkline.spec.ts
[record-tests]: ../../../../src/app/step-visuals/tests/records.spec.ts
[browser-input-tests]: ../../../../src/app/step-visuals/tests/manipulation.browser.ts
[learning-tests]: ../../../../src/app/step-visuals/tests/learning.spec.ts
[retrieval-tests]: ../../../../src/app/step-visuals/tests/retrieval.browser.ts
[isolation-tests]: ../../../../src/app/step-visuals/tests/isolation.spec.ts
[performance-tests]: ../../../../src/app/step-visuals/tests/layoutPerformance.spec.ts
[integration-model]: ../../../../src/app/step-visuals/activities/integration-area/model.ts
[integration-graph-layout]: ../../../../src/app/step-visuals/activities/integration-area/graph-layout.ts
[integration-graph]: ../../../../src/app/step-visuals/activities/integration-area/integration-graph.tsx
[integration-learning]: ../../../../src/app/step-visuals/activities/integration-area/learning.ts
[integration-pointer]: ../../../../src/app/step-visuals/activities/integration-area/use-boundary-pointer.ts
[integration-styles]: ../../../../src/app/step-visuals/activities/integration-area/later-stages.module.css
[integration-presentation]: ../../../../src/app/step-visuals/activities/integration-area/presentation.ts
[integration-math-presentation]: ../../../../src/app/step-visuals/activities/integration-area/math-presentation.ts
[integration-math-renderers]: ../../../../src/app/step-visuals/activities/integration-area/math-value.tsx
[integration-worked]: ../../../../src/app/step-visuals/activities/integration-area/worked-calculation.tsx
[integration-display-policy]: ../../../../src/app/step-visuals/activities/integration-area/display-policy.ts
[integration-motion]: ../../../../src/app/step-visuals/activities/integration-area/use-stage-motion.ts
[integration-activity]: ../../../../src/app/step-visuals/activities/integration-area/integration-activity.tsx
[integration-records]: ../../../../src/app/step-visuals/activities/integration-area/records.ts
[integration-notifications]: ../../../../src/app/step-visuals/activities/integration-area/notifications.ts
[integration-math-tests]: ../../../../src/app/step-visuals/tests/integration-math.spec.ts
[integration-learning-tests]: ../../../../src/app/step-visuals/tests/integration-learning.spec.ts
[integration-refinement-tests]: ../../../../src/app/step-visuals/tests/integration-final-refinements.spec.ts
[integration-worked-tests]: ../../../../src/app/step-visuals/tests/integration-six-corrections.spec.ts
[integration-copy-tests]: ../../../../src/app/step-visuals/tests/integration-locked.spec.ts
[integration-browser-tests]: ../../../../src/app/step-visuals/tests/integration.browser.ts
[integration-render-tests]: ../../../../src/app/step-visuals/tests/integration-final-refinements.browser.ts
[integration-restoration-browser-tests]: ../../../../src/app/step-visuals/tests/integration-refinements.browser.ts
[integration-performance-tests]: ../../../../src/app/step-visuals/tests/integration-performance.spec.ts
[integration-notification-tests]: ../../../../src/app/step-visuals/tests/integration-notifications.spec.ts
[tooltip]: ../../../../src/app/step-visuals/platform/web/tooltip.tsx
[tooltip-layout]: ../../../../src/app/step-visuals/core/presentation/tooltip-layout.ts
[lan-tests]: ../../../../src/app/step-visuals/tests/lab-network.browser.ts
