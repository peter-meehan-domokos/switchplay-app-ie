## Incoming Future-to-Active Transition Jerk

### Current Status

The outgoing active-card-to-past transition path was successfully refined by reducing the exaggerated swipe-down preview offset.

However, the incoming future-card-to-active transition still contains a slight visual jerk when the next card takes active position after swipe-down.

### Investigation Findings

Initial assumption:
- issue might be caused by spring timing / transition stiffness

This was incorrect.

Diagnostics showed:
- targeted Motion spring overrides *were* activating correctly
- however they had little/no visible effect on the movement

Reason:
- the visible transition is primarily driven by immediate React style transform changes (`x`, `y`, `scale`, `rotate`)
- not by a Motion `animate` target or layout transition spring

As a result:
- the incoming card remains in future geometry until the transition resolves
- then immediately receives active-card transform values on the first active frame
- causing the perceptual “jump”

### Important Architectural Constraint

Semantic behaviour is already correct and should NOT be changed:
- role assignment timing
- active card ownership
- z-index ordering
- stack ordering semantics
- transition phase semantics

A previous attempt to move the incoming card into active geometry early caused regressions and unclear stack continuity.

### Likely Future Fix Direction

A proper refinement will likely require:
- animating the incoming card’s `x/y/scale/rotate` through a targeted Motion animate/layout path
- while preserving existing semantic timing and stack ownership

Potential future approaches:
- targeted animate path for only the incoming future-to-active movement
- Motion values for transform interpolation
- isolated layout animation override for this transition only

### Important Warning

Do NOT:
- move future cards into active geometry early
- change active-card timing semantics
- change z-index ownership
- alter transition-phase ownership logic globally
- change shared stack layout constants casually

The problem is animation-layer continuity, not semantic stack logic.