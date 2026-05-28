## Incoming Future-to-Active Transition Jerk

- see file

## Focus Transition Flash

When tapping the active card into focus mode, a flash/pop still occurs during the shared-layout transition.

Attempted fix:
- removed parent opacity fade from focused-card-layer
- moved fade to focused-card-scrim only

The issue remains, so it likely involves deeper Motion layout sequencing, duplicate mounted cards, style mismatch, or shared-layout timing.

Do not keep iterating blindly with Codex. Revisit manually later.

##  Card movement order when swiping up

When swiping up from a card on the table, that card should move first, and then the current active card should slot back. It's currently animates the same as if the user swiped up on the active card which is conceptually a different thing.

# Single user
## MongoDB and API

- check what this means for mobile - for prod, remove wildcard IP address from access list and replace with heroku one