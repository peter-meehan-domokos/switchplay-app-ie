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
