## AI Prompting Principle

Implementation prompts should provide:
- important architectural constraints
- key entry points
- important data locations
- interaction principles

Avoid over-specifying implementation details that the AI can infer from the existing project structure.

Preferred prompt style:
- high-level structure
- clear constraints
- explicit architecture rules
- minimal micromanagement

## Mock Data Location

Mock data should live in `src/mocks/`.

Mock data should not be defined inside pages or UI components.

Components should receive data through props or through a service layer so that mock data can later be replaced by API data without rewriting the UI.

Initial mock dataset:
- `src/mocks/switchplayMockData.ts`

Future structure:
- `src/types/` for shared TypeScript models
- `src/services/` for mock/API access functions
- `src/mocks/` for temporary development data

## State Management Philosophy

State should live as close as possible to the components that use it.

Prefer:
- local component state for UI interactions
- isolated state ownership
- minimal global coordination

Use `useState` for:
- gesture state
- selected items
- animation triggers
- temporary UI state
- expanded/collapsed state

Use Context only for genuinely shared application state such as:
- authenticated user
- theme
- application-wide settings

Avoid introducing global state prematurely.

## Deck Gesture And Motion Boundary

Deck navigation is split across three small ownership areas:
- components render card state
- gesture hooks interpret user intent
- motion modules define transition feel

`src/components/decks/gestures/` owns gesture phases, intent, vectors, commitment thresholds, and reusable pointer handlers.

`src/components/decks/motion/` owns calm transition constants and small transition-state helpers for active card index, focus mode, side, traversal locks, and transition direction.

Gesture constants should not be mixed into layout constants such as `src/constants/cardStack.ts`. Layout constants describe geometry and stack choreography; gesture constants describe input interpretation.


## Phase 1 Implementation State

The app currently uses local component state for deck selection.

The first implementation should remain API-free and auth-free, using mock data from `src/mocks/switchplayMockData.ts`.

The component structure is:
- `AppShell`
- `HomePage`
- `DeckGrid`
- `DeckTile`
- `DeckDetail`
- `CardStack`
- `DeckCard`

Do not introduce global state until real cross-component state pressure emerges.


# Layout Architecture Principles

## Core Principle

A major architectural principle of the system is the separation between:
- raw authored data
- layout-derived presentation state
- rendering/UI concerns

The goal is to preserve:
- conceptual clarity
- future extensibility
- ecological flexibility
- presentation independence

while avoiding presentation logic leaking into authored content.

---

# Layout Functions as the Seam

The introduction of:
- `buildDeckLayout`
- `buildCardLayout`

creates a dedicated layout seam between domain data and rendering.

The layout layer is responsible for:
- deriving presentation-ready state
- ecological interpretation
- spatial/contextual preparation
- future temporal interpretation
- signal normalization
- sparse-state interpretation
- retained-content selection

The raw authored data should remain presentation-agnostic wherever possible.

---

# Ownership Boundaries

## Raw Data Responsibilities

Raw authored/mock data should contain:
- authored progression content
- reflections
- comments
- media references
- signal readings
- authored metadata
- temporal sequencing
- human meaning

Raw data should NOT contain:
- layout positioning
- backside placement logic
- spatial offsets
- retained-selection logic
- normalized values
- ecological redistribution rules
- component-specific presentation state

---

## Layout Responsibilities

The layout layer is responsible for:
- converting authored data into presentation-ready state
- ecological interpretation
- spatial adaptation
- normalized signal value derivation
- sparse-state handling
- retained artifact selection
- contextual composition logic

Examples:
- selecting retained comments
- selecting retained media
- calculating signal value positions
- redistributing sparse backside spacing
- future temporal interpretation

The layout layer should become the single source of truth for derived presentation state.

---

## Rendering Responsibilities

Rendering/components should primarily:
- display layout-derived state
- animate
- compose
- transition
- respond to interaction

Rendering should avoid:
- deriving ecological meaning
- performing normalization
- selecting retained content
- implementing layout interpretation rules

---

# Important Principle

Presentation concepts should not leak into raw authored data.

Examples of concepts that belong in layout rather than raw data:
- backside positioning
- normalized signal values
- sparse-state redistribution
- retained comment selection
- retained media selection
- ecological composition adjustments
- future temporal continuity interpretation

This separation preserves:
- conceptual cleanliness
- future flexibility
- easier experimentation
- easier redesign
- safer rendering iteration

---

# Ecological Rather Than Component-Driven Thinking

The backside is treated as an ecological composition system rather than a fixed UI template.

The emotional role of each artifact matters:
- signals
- reflection
- retained comment
- media trace

Sparse weeks are not considered broken or incomplete layouts.

They are meaningful emotional/ecological states.

As a result:
- layout adjustments are driven by emotional balance
- not rigid component symmetry

Example:
When no media exists but a retained comment does, the comment shifts into a more central ecological bridge role between signals and reflection rather than leaving an empty visual cavity.

---

# Layout Objects as Canonical Presentation State

Once data has passed through layout functions:
- layout objects become the canonical presentation state for the UI

Examples:
- `deckLayout`
- `cardLayout`

The rendering layer should consume layout objects rather than raw authored objects wherever possible.

This allows:
- presentation refactors without authored-data changes
- ecological reinterpretation
- future animation systems
- future temporal systems
- future adaptive composition systems

without corrupting the authored domain model.

---

# Future Architectural Directions

Potential future responsibilities for the layout layer may include:
- temporal continuity interpretation
- historical ecological state
- progression rhythm adaptation
- gesture-aware composition
- viewport-aware redistribution
- social density interpretation
- emotional weighting systems

These should continue following the same principle:
- authored meaning remains in raw data
- interpretation lives in layout
- rendering focuses on display and interaction

---

# Important Constraint

Avoid turning the layout layer into:
- arbitrary business logic
- persistence state
- interaction state
- backend/domain orchestration

The layout layer should remain focused on:
- interpretation
- ecological composition
- presentation preparation

rather than application control flow.

---

# Current Philosophy

The current architecture intentionally favours:
- flexibility over premature abstraction
- ecological interpretation over rigid schemas
- authored richness over dashboard reduction
- atmospheric continuity over analytic explicitness

The system should remain:
- human
- authored
- spatial
- emotionally literate

rather than:
- enterprise-structured
- metric-centric
- productivity-oriented
- mechanically deterministic

## Gesture and Motion Code Ownership

A.3 introduces a dedicated gesture and motion layer so deck components do not become overloaded with interaction logic.

### Folder structure

Gesture files live in:

`src/components/decks/gestures/`

Motion files live in:

`src/components/decks/motion/`

### Responsibility boundaries

Deck/card components should render state.

Gesture hooks should interpret user intent.

Motion modules should define how state changes feel.

Layout constants should remain separate from gesture constants.

### File ownership

`gestureTypes.ts`

Owns shared gesture type definitions.

`gestureThresholds.ts`

Owns gesture-specific numbers such as swipe thresholds, dead zones, axis locking, drag resistance, and velocity assist limits.

`useDeckGestures.ts`

Owns pointer/touch gesture interpretation. It should expose semantic callbacks such as settle to past, restore from past, flip, focus, and defocus rather than embedding component-specific transition logic.

`deckMotion.ts`

Owns motion timings, easing presets, and transition feel constants.

`transitionState.ts`

Owns small shared helpers/types for transition state, animation lock, active/focused/flipped state, and traversal direction.

### Guardrails

Do not place gesture thresholds in `src/constants/cardStack.ts`. That file should remain focused on stack layout and geometry.

Do not let `DeckDetail.tsx`, `CardStack.tsx`, or `DeckCard.tsx` become gesture/state dumping grounds.

If a component starts accumulating gesture interpretation logic, move that logic into the gesture layer.
