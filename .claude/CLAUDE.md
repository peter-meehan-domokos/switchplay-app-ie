# Project Guidelines & Coding Standards

## Functional Programming & Architecture

### 1. Architectural Due Diligence & Safety First
* **Understand Before Editing:** Always inspect and understand the surrounding file architecture, data flow, and pipeline boundaries before implementing fixes or new code.
* **Respect Existing Patterns:** Never bypass established architectural layers (e.g., domain layout pipelines like `*Layout.ts`). Route updates through pure pipeline helpers rather than manually patching state downstream in React components.
* **Ask When Uncertain:** If an architectural boundary, data contract, or solution approach is ambiguous, stop, present the trade-offs, and ask for clarification.

### 2. Immutable & Functional Programming
* **Zero In-Place Mutation:** Never mutate variables, objects, or arrays in-place (`let` reassignment, `array.push()`, `obj.key = val`). Treat all data structures as strictly immutable.
* **Non-Mutating JavaScript Methods:** Always prefer non-mutating/functional methods over mutating equivalents:
  - `toSorted()` instead of `sort()`
  - `toReversed()` instead of `reverse()`
  - `toSpliced()` instead of `splice()`
  - `concat()`, `map()`, `filter()`, `reduce()`, and spread operators (`{ ...obj }`, `[...arr]`).
* **Pure Functions:** Write side-effect-free pure functions wherever possible. Functions should depend solely on their explicit inputs and produce deterministic outputs.
* **Single Source of Truth:** Avoid storing duplicated or derived state in component memory. Derive display values and transformed structures on the fly or via pure memoized projections.

### 3. Data Manipulation & Aggregations
* **Prefer D3.js:** Prefer D3 utility modules (`d3-array`, `d3-scale`, `d3-shape`, etc.) for array manipulations, mathematical aggregations (means, medians, extents), and layout scaling over manual loops.
* **Null & Edge-Case Safety:** Ensure data accessors cleanly handle missing or `null` values as expected by D3 APIs without prematurely filtering out data unless explicitly required.

### 4. SOLID Principles & React Architecture
* **Separation of Concerns:** Keep React components light, declarative, and UI-focused. Move business logic, data normalization, and layout derivation into pure external helper modules.
* **Single Responsibility:** Each module, hook, or pure helper should do one thing clearly.
* **Immutability in React State:** State updates must always replace references with newly derived structures from layout helper functions rather than inline object mutation.


# Build & Verification Instructions
- Note: `npm run build` connects to MongoDB during Next.js module evaluation and requires network access.
- For quick type checks alone, prefer running `npx tsc --noEmit`.