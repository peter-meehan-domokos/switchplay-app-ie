# Outstanding Tasks

## 1. Signal Continuity Model

### Current State
Signals currently exist per-card only. There is no stable continuity model across cards within a deck.

### Open Decision
Determine whether decks should use:
- fully evolving signals
- stable continuity lanes with evolving week-specific expressions
- or a hybrid of both

### Preferred Current Direction
The leading concept is:

- a deck may contain broader stable developmental lanes
- each week may express those lanes differently

Example:

Lane:
- Primary Progress

Week expressions:
- Strict pull-ups
- Chest-height pull-ups
- Band-assisted muscle-ups

### Outstanding Work
If this model is adopted:
- introduce `signalKey`
- define stable signal lanes per deck
- preserve week-specific titles separately
- ensure layout/history systems aggregate by lane, not by title

### Important Principle
Narrative truth and ecological integrity take priority over technical continuity systems.

The conceptual model should not be distorted purely to support animation or analytics.

---

# 2. Temporal Signal History

## Current State
Temporal history implementation was reverted after discovering ambiguity in signal continuity.

## Future Direction
Potential future layout support for:
- previous readings
- historical signal continuity
- ecological progression states
- temporal field behaviour

### Outstanding Questions
- Should continuity exist only within stable lanes?
- Should continuity be atmospheric rather than metric?
- Should some signals intentionally break continuity?
- How should missing/null periods behave?

### Important Principle
Animation and temporal systems must emerge from the conceptual truth of the signals rather than forcing artificial continuity.

---

# 3. Future Pulse Field Temporal Behaviour

## Current State
No temporal animation currently implemented.

## Potential Future Directions
Possible future concepts:
- atmospheric continuity
- field memory
- residue persistence
- historical field drift
- signal settlement behaviour
- ecological carryover between weeks

### Important Principle
Avoid:
- dashboard animation
- progress-bar semantics
- linear interpolation between unrelated measurements

The system should remain:
- ecological
- atmospheric
- emotionally rich
- authored rather than analytical

---

# 4. Near-Right Coherence Experiment

## Current State
A subtle rendering experiment was implemented for high-right signal states.

High-right fields now feel:
- calmer
- more coherent
- more surface-integrated

without explicit endpoint signalling.

## Outstanding Task
Continue reviewing the experiment across:
- dense cards
- sparse cards
- high-performing states
- emotionally ambiguous states
- low-left fragile states

### Key Question
Does the effect:
- subtly improve settlement
or
- reduce atmospheric richness by over-smoothing?

No final decision yet.

---

# 5. Sparse Ecology Behaviour Expansion

## Current State
Basic sparse/no-media redistribution exists.

Comment positioning adapts when:
- media is absent
- retained comment exists

## Outstanding Work
Continue testing:
- multi-line comments
- no-media/no-reflection states
- reflection-only states
- comment-only states
- extremely sparse cards
- emotionally difficult weeks
- contradictory ecological states

### Important Principle
Sparse states are not broken layouts.
They are meaningful emotional/ecological states.

---

# 6. Signal Endpoint / Asymmetry Exploration

## Current State
No explicit endpoint communication exists.

The asymmetry of the fields is intentional.

## Outstanding Exploration
Investigate whether high-right states need:
- subtle qualitative settlement
- surface coherence
- environmental integration
- other non-analytic cues

without introducing:
- success markers
- hard endpoints
- dashboard semantics

### Important Principle
Users are expected to develop perceptual literacy over time.

The system should support:
- intuition
- emotional recognition
- ecological familiarity

rather than explicit score-reading.

---

# 7. Signal Semantics & Lane Philosophy

## Outstanding Questions
Need clearer articulation/design rules around:
- what a signal fundamentally represents
- whether signals are ecological lenses vs metrics
- whether lanes are stable identities or temporary authored focuses
- whether some decks should intentionally violate continuity

This area is conceptually rich but not yet formally documented enough for implementation consistency.

---

# 8. Mock Data Evolution

## Current State
Mock data now supports:
- signals
- media traces
- reflections
- retained comments
- sparse states
- comment ecology
- media absence variation

## Outstanding Tasks
Expand mock ecology coverage:
- contradictory emotional states
- socially rich weeks
- difficult regression weeks
- fragmented weeks
- recovery weeks
- emotionally dense weeks
- extremely empty weeks
- plateau states
- unstable improvement

### Important Principle
Mock data is increasingly becoming behavioural design infrastructure rather than placeholder content.

---

# 9. Media Trace System

## Current State
Single media type structure unified.
Layout currently selects the first media item only.

## Outstanding Work
Future exploration:
- multiple media traces
- temporal media accumulation
- retained media ecology
- media emotional weighting
- video-specific behaviour
- motion/media interplay with signals

No immediate implementation required.

---

# 10. Comment Ecology

## Current State
Retained comments derive correctly through layout.

## Outstanding Exploration
Potential future rules:
- social density
- emotionally supportive vs corrective comments
- creator vs peer distinctions
- comment emotional tone
- multiple retained comments
- social rhythm across decks

Currently only:
- the first retained external comment is surfaced.

---

# 11. Reflection System

## Current State
Single reflection string implemented and layout-driven.

## Outstanding Exploration
Potential future directions:
- reflective density
- emotional tone classification
- temporal reflection continuity
- authored vs auto-generated reflections
- reflection absence as meaningful state

---

# 12. Layout Architecture Evolution

## Current State
`buildDeckLayout`
`buildCardLayout`

exist as the core layout seam.

## Outstanding Architectural Work
Need clearer future rules for:
- deck-level derived state
- card-level derived state
- temporal derived state
- ecological interpretation responsibilities
- ownership boundaries between:
  - raw data
  - layout
  - rendering

### Important Principle
Presentation concepts should not leak into raw authored data.

---

# 13. FocusedCardView Cleanup & Future Refactor

## Current State
FocusedCardView now consumes layout-derived:
- signals
- media
- reflections
- retained comments

## Outstanding Work
Eventually:
- reduce presentation complexity
- formalise ecological slot responsibilities
- reduce positional hardcoding
- potentially introduce ecological positioning systems

Not urgent yet.

---

# 14. Card/Deck State Architecture

## Current State
Some card state still exists locally inside `DeckDetail`.

## Outstanding Future Work
Later review:
- whether cards should remain stateful there
- whether layouts should move to context/store
- persistence integration
- server-backed deck/card evolution

Currently intentionally deferred to avoid premature architecture complexity.

---

# 15. Design Documentation Consolidation

## Outstanding Task
Consolidate recent discoveries into permanent design documentation:
- asymmetry philosophy
- ecological UI philosophy
- sparse-state philosophy
- signal continuity philosophy
- layout seam philosophy
- atmospheric rather than dashboard progression
- perceptual literacy over explicit analytics

These concepts are now central to the product identity and should become canonical design principles.

---

# 16. Organic Progression Rhythm

## Current State
The three-step progression structure currently preserves:
- clarity
- calmness
- readability

but still feels slightly too mechanically aligned in places.

Some variation has already been introduced, but not yet enough.

## Outstanding Polish Work
Future refinement work may include:
- tiny spacing variance between progression fragments
- subtle emphasis decay down the sequence
- small rhythm asymmetries
- softened separator treatment
- slight progression-strip variance

### Important Principle
The goal is NOT:
- randomness
- instability
- visual inconsistency

The goal is:
- authored rhythm
- atmospheric softness
- human cadence

while preserving memorability and structural clarity.

### Why
SwitchPlay progression should feel:
- human
- authored
- emotionally paced

rather than:
- enterprise productivity software
- rigid task-list infrastructure
- machine-aligned workflow UI

### Priority
Future polish / non-MVP.

---

# 17. Temporal Continuity vs Scroll State

## Current State
Focus mode currently preserves partial temporal continuity because the background deck remains partially visible during focused-card viewing.

However, the exact visibility of:
- past cards
- future cards
- stack silhouettes

depends on the scroll position of the deck before entering focus mode.

This creates inconsistency:
- sometimes future cards are visible
- sometimes past cards are visible
- sometimes both are partially visible

Despite this, the interaction still feels:
- spatially connected
- object-continuous
- experientially coherent enough for MVP exploration

## Important Decision
This inconsistency is currently intentionally accepted rather than aggressively engineered around.

### Why
Fully stabilising temporal visibility right now would likely require:
- artificial background stack rendering
- scroll freezing
- viewport pinning
- special focus-layer composition logic

This would prematurely lock in architectural assumptions before the long-term interaction model is fully understood.

### Current Philosophy
The implementation is considered:
- philosophically incomplete
- but experientially coherent enough

for the current exploratory stage.

## Long-Term Direction
SwitchPlay may eventually evolve toward:
- stable viewport-based deck composition
- reduced reliance on scrolling
- gesture-driven progression traversal
- persistent temporal awareness during focus mode

At that point, this inconsistency may naturally disappear as part of a broader spatial interaction model.

---

# 18. Future Polish: Corner-Led Flip Torque

## Current State
The current MVP flip works successfully, but behaves mostly as:
- a centered vertical-axis inversion

rather than a physically initiated corner-driven motion.

## Future Exploration
Later explore:
- subtle bottom-right initiation
- corner-led rotational torque
- more physical connection to the card-edge affordance

The goal is for the flip to feel:
- physically initiated
- edge-connected
- materially responsive

rather than mathematically inverted.

## Important Constraint
Do NOT prioritise now.

A previous attempt introduced:
- midpoint fade issues
- return instability
- visual discontinuity during inversion

Current flip behaviour is considered:
- good enough for MVP
- emotionally coherent
- technically stable

even if not yet physically ideal.

---

# 19. Integrated Card Dismissal / Removal of Modal Energy

## Current State
The close button currently introduces slight atmospheric inconsistency.

The circular “X” carries:
- generic modal energy
- overlay software energy
- prototyping-tool energy

It slightly breaks the otherwise embedded physicality of the card system.

## Future Direction
Eventually replace the explicit close button with a more integrated dismissal affordance.

Potential directions:
- embedded dissolve affordance
- edge-integrated dismissal
- softer physical escape cue
- gesture-led release
- contextual edge interaction

### Important Principle
Dismissal should feel:
- embedded
- spatial
- materially implied

rather than:
- modal
- overlay-driven
- detached from the object ecology

### Current Assessment
Small issue, but conceptually important.

The current implementation still slightly feels:
- “Figma prototype”
rather than:
- spatial object system.

### Other Improvements
Defocus interaction language refinement
Temporal continuity system
Traversal spatial consistency audit
Focus-mode ontology refinement
Interaction restraint calibration
Motion inheritance between deck states





# Atmospheric Polish

### Perspective Compression of Background Cards

Status: partially implemented

You already have:

stacking
opacity falloff
environmental depth

But the stack could still eventually gain:

slightly stronger spatial compression
more believable receding perspective
more grounded physical layering

Right now it is “good digital depth.”
Later it could become “physical cinematic depth.”

### Grounded Shadows / Table Interaction

Status: partially solved

You improved:

environmental grounding
lower-scene transmission

But the cards could still gain:

better contact relationship with the table plane
more coherent soft shadow stacking
stronger sense that the cards physically occupy space

This is subtle but high-value polish later.

###  Atmospheric Depth Polish

Status: underway

The scene is now much less flat than before.

Future polish could include:

slightly more nuanced fog/falloff behaviour
better separation between:
foreground
focused card
recent history cards
deep history cards

But again: this is advanced polish.