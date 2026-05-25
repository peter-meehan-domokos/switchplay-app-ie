## A.3 Gesture and Motion Architecture

Switchplay gesture design follows this principle:

**Gestures suggest intent → authored cinematic transition completes the action.**

Gestures should not feel like raw physics demos or hyper-responsive social-media swipes. The user gives directional intent; the app responds with calm, restrained, physically believable motion.

### Motion tone

Gesture-driven transitions should feel:

* calm
* weighted
* deliberate
* physically motivated
* emotionally continuous
* authored rather than playful

They should avoid:

* bouncy easing
* exaggerated elasticity
* Tinder-style flick energy
* aggressive snapping
* accidental high-velocity transitions
* novelty motion for its own sake

### MVP gesture behaviour

For MVP, gestures do not need to control every frame of animation continuously.

Preferred pattern:

1. User begins gesture.
2. Card gives light direct-manipulation feedback.
3. Gesture crosses a clear threshold.
4. Authored cinematic transition completes the action.

Distance should matter more than velocity. Fast, tiny flicks should not accidentally trigger major state changes.

### Emotional distinction between gestures

Traversal gestures move through time.

Focus gestures deepen attention.

Flip gestures move between action and reflection.

These should not all feel identical. Flip and reflection-related gestures should be calmer and more intentional than basic traversal.

### Code ownership

Use restrained timing and damped easing for progression, focus, defocus, flip, restore, and cancel transitions. Committed transitions should settle through the same calm deck motion language.

Gesture thresholds live in `src/components/decks/gestures/gestureThresholds.ts`.
Motion timings live in `src/components/decks/motion/deckMotion.ts`.
