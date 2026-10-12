# Card 1 guided activity and stage-preview lab

The default selector option mounts the independently reusable guided activity.
The lab and its direct stage previews remain available in development and deployed
previews, but are not exported with the activity.

The genuine sequence is Explore → Predict → Test → Explain → Try (retrieval
entry). One changed committed placement enables the compact footer Next action; the student then
chooses when to proceed. The selected orientation root is preserved through the
next two stages. Only a settled placement at −3 reveals the explanation. The moving
factor is masked in prediction and positioning. Continue retains −3, displays
`(x + 4)` and enables adjustment, without Check, assistance or completion in C4.

`RootsFactorsActivity` owns one composed reducer: portable `learningReducer`
delegates root transactions to the existing `manipulationReducer` before evaluating
lesson transitions. There is no effect-driven assessment or duplicate gesture system.

When inspecting a preview, the guided state owner stays mounted but renders no
view. Hiding or opening navigation cancels editing, advances the input revision,
and preserves the settled root and lesson. Returning restores that session; preview
interaction never dispatches to it. Restart guided activity is an explicit lab
mounting action. Leaving the actual experience (including Exit or Sparkline preview)
still ends the session according to the original navigation contract.

The lab-header selector selects authored fixtures:

- A — Explore: orientation at root 3.
- B — Predict: prediction at root 3, manipulation visually locked.
- C — Reveal: incorrect prediction and both substitutions at root −3.
- D — Retrieve: masked factor, target `(x + 4)`, retry feedback at root −3.
- E — Help: expanded retrieval explanation, preserving root −3.

Root dragging and keyboard adjustment work in A and D. B, C and E are
locked. Preview learning actions remain disabled. Choosing another fixture loads
its reference root and cancels any old input transaction; it does not represent
a learner's transition or a learner-controlled stage skip.

Pointer dragging uses a finite real-valued candidate in the reducer-owned editing
transaction. `math.movingRoot` remains the previous settled integer until release.
The graph's curve, root landmarks, vertex, marker, halo and hit region all use the
same continuous candidate. Cancellation discards it; release computes the final
pointer coordinate and commits its nearest permitted integer immediately.
Keyboard Arrow keys, Home and End continue to make whole-integer placements.
Visible adjustment buttons and the separate root-position strip have been removed;
the pure adjustment preparation and reducer placement actions remain available.
A touch-only learner who cannot drag needs an alternative input method. A labelled
position input opened on request is recommended, pending product approval.

`RootsFactorsScene.graphicalRoot` describes the actual geometry;
`displayRoot` is its nearest integer (half steps round away from zero). The
expression, root badge and slider announcements use `displayRoot`.
`expressionIsRounded` explicitly identifies the temporary presentation mismatch,
without adding new visible approximation notation. No independent display or
graphical state is stored. Graph accessibility text explains the rounding when
the graphical value is fractional, rather than describing the factor as exact.

`RootsFactorsLayoutPreview` retains its manipulation-only controller and mounts
the same `RootsFactorsView`, `ActivityFrame`, graph, expression, prompt and footer
navigation renderers as the guided activity. The selector, fixtures, restart control,
disclaimer and collapsed session-note probe are lab-only.
The selector and all five options must remain until the user explicitly authorises
removal. Any future teacher/student stage navigation is a separate product decision.
The session probe exists solely to test preservation and reset boundaries.

Checkpoint 5 extends the retrieval-entry lesson and explicit actions; it must not
teach renderers to assess answers or turn the lab selector into learner progression.
Root/lesson session assertions now supplement the original session-note probe.

Stage changes focus the new instruction heading, whose description contains the
instruction. Eligibility is announced through a polite status region. Pointer
movement does not refocus or continuously announce state. Returning from a preview
leaves focus on the selector so keyboard preview navigation remains predictable.

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
the longest normal prompt, expression and footer navigation. All non-whitespace
prompt calibration characters, including signs and correctness labels, are replaced
with neutral tabular glyphs. Expression/navigation calibration is neutral too;
hidden sizing DOM does not retain solution text.
The graph absorbs remaining height (210px minimum, 480px maximum); stage content
cannot alter its geometry. Extra lab diagnostics sit below the activity surface.
