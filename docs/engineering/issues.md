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

- handle, no target date set gracefully in the UI and in the code

- card.defaultTargetDate should be derived from today's date, and the property which determines whether it's daily weekly et cetera.  This may not be defined and if not, then we need a manual way of storing a default target date on each card as well. Basically this is all to do with our card gets its default target date in the deck template. You can simply be defined, or it can be calculated from the property mentioned above plus today's date, what is a fallback option could be today's date plus weekly increase. Essentially, saying that that property should have a default value of weekly.


## LATER
- consider a categories record




 