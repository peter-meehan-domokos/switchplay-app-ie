# Focus Mode Philosophy

## Focus mode is immersive progression traversal

Focus mode is not intended to behave like a traditional modal, detail page, or overlay screen.

The user should feel like they are moving through progression time, not opening and closing separate views.

The focused card remains:
- the same authored object
- the same semantic structure
- the same progression artifact

only with:
- more attention
- more space
- deeper interaction potential.

## Temporal navigation continuity

Future interaction direction:

- swipe down:
  move the current card into the past and continue into the next focused card

- swipe up:
  revisit previous/future progression cards while remaining in focused mode

This preserves:
- temporal continuity
- physical card metaphor
- progression flow
- immersion

rather than fragmenting the experience into separate screens.

## Focus mode exit

Because progression traversal should eventually be gesture-driven, the visible close control should only serve as:
- an exit from immersive focus mode itself

not:
- a per-card dismiss button.

The close control should therefore belong to the focus environment, not the card anatomy.

## Why this decision was made

Traditional modal interaction patterns:
- weaken the physical card metaphor
- fragment temporal continuity
- make focus mode feel like a separate app screen

Switchplay instead treats focus mode as:
- deepened attention within the same progression space.

## Temporal Continuity vs Scroll State

Current focus mode preserves some sense of temporal continuity because the background deck remains partially visible during focused-card viewing.

However, the exact visibility of:
- past cards
- future cards
- stack silhouettes

currently depends on the scroll position of the deck page before entering focus mode.

This creates inconsistency:
- sometimes future cards are visible
- sometimes past cards are visible
- sometimes both are partially visible

Despite this inconsistency, the experience still feels spatially connected and object-continuous.

At this stage, this behavior is intentionally accepted rather than aggressively engineered around.

### Why this decision was made

Attempting to fully stabilize temporal visibility right now would likely require:
- artificial background stack rendering
- scroll freezing
- viewport pinning
- special focus-layer composition logic

This would prematurely lock in architectural assumptions before the long-term interaction model is fully understood.

The current implementation is considered:
- philosophically incomplete
- but experientially coherent enough for MVP exploration.

## Temporal Continuity vs Scroll State

Current focus mode preserves some sense of temporal continuity because the background deck remains partially visible during focused-card viewing.

However, the exact visibility of:
- past cards
- future cards
- stack silhouettes

currently depends on the scroll position of the deck page before entering focus mode.

This creates inconsistency:
- sometimes future cards are visible
- sometimes past cards are visible
- sometimes both are partially visible

Despite this inconsistency, the experience still feels spatially connected and object-continuous.

At this stage, this behavior is intentionally accepted rather than aggressively engineered around.

### Why this decision was made

Attempting to fully stabilize temporal visibility right now would likely require:
- artificial background stack rendering
- scroll freezing
- viewport pinning
- special focus-layer composition logic

This would prematurely lock in architectural assumptions before the long-term interaction model is fully understood.

The current implementation is considered:
- philosophically incomplete
- but experientially coherent enough for MVP exploration.

### Long-term direction

Switchplay may eventually evolve toward:
- stable viewport-based deck composition
- reduced reliance on scrolling
- gesture-driven progression traversal
- persistent temporal awareness during focus mode

At that point, this inconsistency may naturally disappear as part of a broader spatial interaction model.


## Focus Traversal Uses Canonical Active State

Focus traversal is real progression traversal, not detached inspection.

When the user moves to another card while in focus mode, that card becomes the canonical active card. The deck’s past, active, and future states update around that same active index.

Why:
A card must never exist in two places at once. If Week 2 is focused, it cannot also remain visible as a past card underneath.

This also prepares the system for future gesture consistency: swipe-down should mean the same progression action whether the user is in deck mode or focus mode.