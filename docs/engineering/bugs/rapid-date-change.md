## Target Date Persistence — Rapid Sequential Updates

### Status

Resolved for normal usage.

### Background

Target date editing was added to focused cards using invisible left/right hit zones.

The initial implementation updated local card state optimistically and attempted to persist changes in the background. A React timing issue meant persistence could fail to fire even though the UI updated correctly.

### Root Cause

The persistence payload was being assigned inside a `setCards(...)` state updater and then read immediately afterwards.

Because React may defer execution of state updater functions, the payload could still be `null` when persistence logic ran.

Result:

```text
UI updates
Persistence does not fire
Refresh restores old value
```

### Fix Applied

Introduced `cardsRef` as an immediate optimistic source of truth.

Current flow:

```text
Read latest card from cardsRef.current
↓
Calculate next target date
↓
Build nextCards
↓
Update cardsRef.current immediately
↓
setCards(nextCards)
↓
Persist same payload to backend
```

This removes dependence on React updater timing and ensures persistence requests are reliably generated.

### Remaining Observation

During one manual test involving several very rapid date increments, the final persisted value appeared to be behind the UI value after refresh.

Example:

```text
UI reached 25 May
Persisted value after refresh was 23 May
```

This behaviour has only been observed once.

### Most Likely Explanation

Each date increment currently generates its own PATCH request.

Example:

```text
18 → 19
19 → 20
20 → 21
21 → 22
22 → 23
23 → 24
24 → 25
```

Rapid interactions may produce multiple in-flight requests.

Possible outcomes:

* request completion order differs from click order
* final requests are interrupted during navigation
* backend persists an earlier value than the final UI state

### Future Improvement (Optional)

Introduce debounced persistence for target date updates.

Potential approach:

```text
User taps repeatedly
↓
UI updates immediately
↓
Wait 250–400ms after final tap
↓
Send one PATCH containing final date
```

Benefits:

* fewer network requests
* reduced race-condition risk
* better support for future long-press acceleration

### Priority

Low.

Current implementation is considered stable for MVP and normal user interaction.
Only revisit if rapid-update persistence issues are observed again.
