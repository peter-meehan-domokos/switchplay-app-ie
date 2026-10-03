# Project Guidelines & Coding Standards

## Functional Programming & Architecture

### 1. Architectural Due Diligence & Safety First
* **Understand Before Editing:** Always inspect and understand the surrounding file architecture, data flow, and pipeline boundaries before implementing fixes or new code.
* **Respect Existing Patterns:** Never bypass established architectural layers (e.g., domain layout pipelines like `*Layout.ts`). Route updates through pure pipeline helpers rather than manually patching state downstream in React components.
* **Ask When Uncertain:** If an architectural boundary, data contract, or solution approach is ambiguous, stop, present the trade-offs, and ask for clarification.

### 2. Component & Visual Layout Architecture (Universal Rule)
> **CRITICAL DISAMBIGUATION:** 
> 1. This pattern applies to **ALL visual components, UI views, and rendered components across the entire codebase** (e.g., standard React components like `CardLayout`). It is **NOT** restricted to D3 visualization code.
> 2. This has **NOTHING** to do with Next.js route layout files (`layout.tsx`).

* **Universal Applicability:** Every rendered UI view or component that displays derived or structured data must receive its presentational structure from a dedicated layout pipeline.
* **Pattern Reference (D3 Methodology):** This architecture is inspired by the recommended D3 visualization pattern—where raw state/data is converted into a pure layout structure before rendering—but it is the mandatory standard for **all visual rendering code**, including standard React components that do not use D3 (such as `CardLayout` serving React card views).
* **Single Source of Truth:** The layout pipeline must always compute and contain the absolute most up-to-date presentational and rendering state.
* **File & Naming Conventions:**
  - All component layout logic must reside in a dedicated file named `[ComponentName]Layout.ts` (e.g., `cardLayout.ts`, `deckLayout.ts`), alongside small pure helper functions used exclusively for that layout (e.g., `withUpdatedSignalReading`).
  - Main layout transformation functions must strictly follow the naming convention `build[ComponentName]Layout` (e.g., `buildCardLayout`, `buildDeckLayout`).
* **Strict Unidirectional Flow & Immutability:** Whatever is returned by `build[ComponentName]Layout` is a read-only presentational projection. **Never mutate, spread-patch, or modify layout objects downstream** inside React components, child views, or event handlers. Interactions must update the top-level state/data, which then flows back down through the layout pipeline (or pure `withXxx` layout helpers) to generate a fresh projection.
* **Isolated Ephemeral State Exception:** The only permitted exception is transient, self-contained UI state (such as an uncommitted text input draft while typing), provided it is strictly internal to that component, cannot leak in or out, and no other component requires knowledge of it.

### 3. Immutable & Functional Programming
* **Zero In-Place Mutation:** Never mutate variables, objects, or arrays in-place (`let` reassignment, `array.push()`, `obj.key = val`). Treat all data structures as strictly immutable.
* **Non-Mutating JavaScript Methods:** Always prefer non-mutating/functional methods over mutating equivalents:
  - `toSorted()` instead of `sort()`
  - `toReversed()` instead of `reverse()`
  - `toSpliced()` instead of `splice()`
  - `concat()`, `map()`, `filter()`, `reduce()`, and spread operators (`{ ...obj }`, `[...arr]`).
* **Pure Functions:** Write side-effect-free pure functions wherever possible. Functions should depend solely on their explicit inputs and produce deterministic outputs.
* **Single Source of Truth:** Avoid storing duplicated or derived state in component memory. Derive display values and transformed structures on the fly or via pure memoized projections.

### 4. Data Manipulation & Aggregations
* **Prefer D3.js:** Prefer D3 utility modules (`d3-array`, `d3-scale`, `d3-shape`, etc.) for array manipulations, mathematical aggregations (means, medians, extents), and layout scaling over manual loops.
* **Null & Edge-Case Safety:** Ensure data accessors cleanly handle missing or `null` values as expected by D3 APIs without prematurely filtering out data unless explicitly required.

### 5. SOLID Principles & React Architecture
* **Separation of Concerns:** Keep React components light, declarative, and UI-focused. Move business logic, data normalization, and layout derivation into pure external helper modules.
* **Single Responsibility:** Each module, hook, or pure helper should do one thing clearly.
* **Immutability in React State:** State updates must always replace references with newly derived structures from layout helper functions rather than inline object mutation.


# Build & Verification Instructions
- Note: `npm run build` connects to MongoDB during Next.js module evaluation and requires network access.
- For quick type checks alone, prefer running `npx tsc --noEmit`.