# Card 1 stage-preview and manipulation lab

This is a Checkpoint 3 visual/input assessment surface, not a learning controller.
It is deliberately available in the standalone lab in development and deployed
previews, but is not exported with the independently reusable activity.

The lab-header selector selects authored fixtures:

- A — Explore: orientation at root 3.
- B — Predict: prediction at root 3, manipulation visually locked.
- C — Reveal: incorrect prediction and both substitutions at root −3.
- D — Retrieve: masked factor, target `(x + 4)`, retry feedback at root −3.
- E — Help: expanded retrieval explanation, preserving root −3.

Root dragging, keyboard adjustment and buttons work in A and D. B, C and E are
locked. Learning actions remain disabled: no prediction, Check assessment,
completion or pedagogical reducer exists yet. Choosing another fixture loads
its reference root and cancels any old input transaction; it does not represent
a learner's transition or a learner-controlled stage skip.

Pointer dragging uses a finite real-valued candidate in the reducer-owned editing
transaction. `math.movingRoot` remains the previous settled integer until release.
The graph's curve, root landmarks, vertex, marker, halo and hit region all use the
same continuous candidate. Cancellation discards it; release computes the final
pointer coordinate and commits its nearest permitted integer immediately.
Keyboard and adjustment buttons continue to make whole-integer placements.

`RootsFactorsScene.graphicalRoot` describes the actual geometry;
`displayRoot` is its nearest integer (half steps round away from zero). The
expression, root badge, readout and slider announcements use `displayRoot`.
`expressionIsRounded` explicitly identifies the temporary presentation mismatch,
without adding new visible approximation notation. No independent display or
graphical state is stored. Graph accessibility text explains the rounding when
the graphical value is fractional, rather than describing the factor as exact.

`RootsFactorsLayoutPreview` mounts the same `RootsFactorsController`, `RootsFactorsView`, `ActivityFrame`,
graph, expression, adjustment and prompt renderers used by the activity entry.
The selector, fixtures, disclaimer and collapsed session-note probe are lab-only.
The selector and all five options must remain until the user explicitly authorises
removal. Any future teacher/student stage navigation is a separate product decision.
The session probe exists solely to test preservation and reset boundaries.

When Checkpoints 3–5 provide real activity state and policy:

1. Retain the shared view, renderers, pure layout functions and plain contracts.
2. Replace the activity entry's static initial presentation with reducer-driven
   data and semantic dispatch; replace hardcoded inactive action flags with
   explicit policy inputs. Do not teach the renderers to assess answers.
3. Keep the lab selector and its separate fixture/input boundary. Do not map it
   to learner progression or remove it without explicit approval.
4. Supplement the session-probe assertions with real activity-state assertions.
   Menu preservation and actual experience-change resets must stay unchanged.

Deep freezing remains active in production for newly prepared scenes. The view
memoizes preparation by mathematics, measured dimensions and display policy;
the cache is only a performance convenience, not a correctness dependency.
The fixed coordinate-plane scene is prepared separately by measured size, reused
by the pure compositor, and rendered by a memoized React component. Unchanged
prompt components are also memoized. Polynomial sampling validates the real root
once and avoids allocating factor arrays for every curve sample. Pointer events
still dispatch directly to React: no imperative SVG loop or frame-delayed second
mathematical state owner is introduced. Deep freezing remains enabled; local
fractional-layout timings are measured before considering additional optimisation.
`layoutPerformance.spec.ts` reports local diagnostic timings, not device targets.

The viewport-filling frame uses overlapping inaccessible, inert sizing slots for
the longest normal prompt, expression and adjustment strip. Calibration digits
are neutralised and tabular, so sizing does not expose a masked live factor.
The graph absorbs remaining height (210px minimum, 480px maximum); stage content
cannot alter its geometry. Extra lab diagnostics sit below the activity surface.
