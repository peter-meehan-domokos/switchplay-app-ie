# Temporary Card 1 layout preview

This is a Checkpoint 2 visual assessment surface, not a learning controller.
It is deliberately available in the standalone lab in development and deployed
previews, but is not exported with the independently reusable activity.

The lab-header selector selects authored fixtures:

- A — Explore: orientation at root 3.
- B — Predict: prediction at root 3, manipulation visually locked.
- C — Reveal: incorrect prediction and both substitutions at root −3.
- D — Retrieve: masked factor, target `(x + 4)`, retry feedback at root −3.
- E — Help: expanded retrieval explanation, preserving root −3.

All learning actions and adjustment buttons are genuinely disabled. No pointer
handlers, snapping, answer assessment, progress state or pedagogical reducer
exist here. Choosing a fixture does not represent a learner's transition.

`RootsFactorsLayoutPreview` mounts the same `RootsFactorsView`, `ActivityFrame`,
graph, expression, adjustment and prompt renderers used by the activity entry.
The selector, fixtures, disclaimer and collapsed session-note probe are lab-only.
The session probe exists solely to test preservation and reset boundaries.

When Checkpoints 3–5 provide real activity state and policy:

1. Retain the shared view, renderers, pure layout functions and plain contracts.
2. Replace the activity entry's static initial presentation with reducer-driven
   data and semantic dispatch; replace hardcoded inactive action flags with
   explicit policy inputs. Do not teach the renderers to assess answers.
3. Remove the lab fixture selector, fixture module, preview wrapper, disclaimer
   and session probe, or retain the fixtures only as clearly separated developer
   regression examples. Restore normal mounting of `RootsFactorsActivity`.
4. Replace the lab session-probe assertions with real activity-state assertions.
   Menu preservation and actual experience-change resets must stay unchanged.

Deep freezing remains active in production for newly prepared scenes. The view
memoizes preparation by mathematics, measured dimensions and display policy;
the cache is only a performance convenience, not a correctness dependency.
`layoutPerformance.spec.ts` reports local diagnostic timings, not device targets.
