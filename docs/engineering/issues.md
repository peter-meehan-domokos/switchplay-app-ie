## Known Bug: Focus Transition Flash

When moving a card from active to past the wrong card animates down to the table

## Known Bug: Focus Transition Flash

When tapping the active card into focus mode, a flash/pop still occurs during the shared-layout transition.

Attempted fix:
- removed parent opacity fade from focused-card-layer
- moved fade to focused-card-scrim only

The issue remains, so it likely involves deeper Motion layout sequencing, duplicate mounted cards, style mismatch, or shared-layout timing.

Do not keep iterating blindly with Codex. Revisit manually later.

## Deck active-card state resets when switching decks

Status: unresolved

Description:
When switching away from a deck and returning to it, the deck resets to Week 1. The past/active/future state is not preserved per deck.

Why it matters:
Each deck should eventually remember its current active card so users return to the correct point in their progression.

Likely direction:
Store activeCardIndex by deck ID rather than as one shared transient state.

Priority:
medium