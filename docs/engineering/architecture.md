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


# Switchplay — Backend & Persistence Architecture

## Overview

Switchplay will use a lightweight full-stack Next.js architecture for the MVP.

The app will use:

- Next.js App Router
- React frontend
- Next.js Route Handlers for backend/API logic
- MongoDB Atlas for persistence
- HTTP-only cookie-based authentication
- REST-style API endpoints

The system will remain intentionally lightweight during the MVP phase.

Primary goal:

```txt
sign in
-> open deck
-> track progression
-> persist state
-> return later with state restored
```

The architecture is optimised for:

- minimal infrastructure complexity
- low debugging overhead
- fast iteration
- animation-safe frontend integration
- future scalability without premature abstraction

---

## Architectural Direction

### Single Full-Stack Next.js Application

Switchplay will NOT use a separate Express backend server during the MVP phase.

Instead:

```txt
Next.js frontend
+
Next.js backend route handlers
```

will live inside the same application.

This avoids:

- running multiple local servers
- CORS configuration complexity
- cross-origin cookie/session issues
- duplicated deployment pipelines
- frontend/backend environment mismatches

The frontend and backend remain tightly integrated inside one codebase.

---

## Backend API Strategy

Backend logic will use Next.js Route Handlers inside:

```txt
/app/api/
```

Example structure:

```txt
app/
  api/
    auth/
      login/
        route.ts
      logout/
        route.ts
      me/
        route.ts

    switchplay/
      decks-data/
        route.ts

      decks-data/
        [userDeckId]/
          route.ts
```

These route handlers function similarly to lightweight Express endpoints.

The API style will remain REST-oriented and pragmatic.

---

## Database Choice

Switchplay will use:

```txt
MongoDB Atlas
```

as the primary persistence layer.

MongoDB is a strong fit because Switchplay data is naturally document-oriented:

```txt
user
  -> decksData
      -> cards
          -> steps
```

MongoDB also supports:

- flexible schema evolution
- rapid MVP iteration
- nested progression structures
- future social/community systems
- template libraries
- creator ecosystems
- reflections/comments/media extensions

without requiring early rigid relational modelling.

---

## Authentication Strategy

Authentication will remain intentionally lightweight during MVP.

The system will use:

- email/password authentication
- password hashing with `bcrypt` or `argon2`
- HTTP-only cookie sessions

Authentication routes will likely include:

```txt
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Important principles:

- never store raw passwords
- sessions should remain server-controlled
- authentication should stay simple until social/community systems exist

Complex auth features are intentionally deferred.

---

## GraphQL Decision

Switchplay will NOT use GraphQL during the MVP phase.

Reasoning:

- REST is simpler for current requirements
- current persistence needs are straightforward
- GraphQL would add unnecessary complexity at this stage
- avoiding premature abstraction reduces debugging risk

Current MVP requirements are primarily:

```txt
user state persistence
session handling
deck progress updates
```

rather than complex relational querying.

GraphQL may be reconsidered later if the application evolves into:

- large template libraries
- complex creator ecosystems
- social graphs
- followers/friends
- shared progression systems
- highly relational client queries

The architecture should remain compatible with adding GraphQL later if genuinely beneficial.

---

## Persistence Philosophy

The backend should persist only essential user progression state.

Persisted state includes:

- step statuses
- active card
- user-adjustable dates

Derived state should NOT normally be persisted.

Instead:

```txt
step statuses
-> derive card progress
-> derive deck progress
```

This keeps the system semantically clean and avoids state desynchronisation.

---

## Frontend State Philosophy

Switchplay already contains sophisticated animated deck interactions using:

- Framer Motion
- shared layout transitions
- gesture systems
- active/past/future card architecture

Persistence systems must integrate around this architecture rather than replacing it.

Frontend interaction should remain:

- optimistic
- responsive
- animation-safe
- locally immediate

Backend synchronization should happen behind the interaction layer rather than controlling it directly.

---

## MVP Philosophy

This phase is intentionally:

- single-user
- lightweight
- infrastructure-first
- low-overhead
- minimally abstracted

The priority is reliability and iteration speed rather than enterprise-scale architecture.

The system should remain conceptually clean enough to evolve later without requiring major rewrites.


## Route Mutation Shape Safety

When extending shared API routes that support multiple mutation types, always review mutation-shape discrimination before adding a new branch.

New request shapes must not be capable of being misclassified as an existing mutation branch.

Example:

A signal-reading mutation:

```ts
{
  cardId,
  signalId,
  reading,
}
```

was initially at risk of being classified as a target-date mutation because both shapes contained `cardId`.

When adding new mutation types:

1. Define the complete shape explicitly.
2. Review all existing branch-detection logic.
3. Ensure each mutation shape is mutually exclusive.
4. Prefer positive validation of required fields rather than partial matching.
5. Add validation that prevents overlapping request shapes.

This check is mandatory whenever a new PATCH/POST mutation shape is introduced.


## Optimistic Mutation Pattern

Interactive user edits should follow a consistent optimistic-update architecture.

Pattern:

```txt
User action
↓
Local state update
↓
Background persistence
```

The UI should not wait for network confirmation before reflecting the user's action.

Current examples:

* active card updates
* completion status updates
* target date updates
* signal reading updates

Guidelines:

1. Update local state immediately.
2. Persist in the background.
3. Avoid page refreshes.
4. Avoid blocking interaction on network completion.
5. Prefer a single persistence call per completed user action.

For drag interactions:

```txt
dragging
↓
local updates only

drag end
↓
single persistence operation
```
