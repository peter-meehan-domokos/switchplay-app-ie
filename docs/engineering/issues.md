
## Current
 

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
- Phase 5 CP3: an advanced fork target or unavailable/corrupt/expired recovery journal fails safely rather than generating another identity. Review the saved owned draft in a separate tab before resolving the original tab's recovery conflict; advanced targets are not automatically merged or replayed. Unsent text and File bytes are deliberately not journaled. Attachment proofs expire after 30 minutes; unsuccessful expired/interrupting provider operations require explicit recovery/manual retry rather than automatic reallocation or unsafe attachment. Automatic browser-crash upload resumption and orphan-asset cleanup remain deferred.
- Phase 5 resilience deliberately excludes preserving unsent keystrokes after browser crash, automatic cross-reload file-upload resumption, guaranteed recovery of lost provider-allocation responses, and elaborate orphan-provider-asset cleanup. Submitted fork operations will use a small actor/session-scoped recovery journal; exceptional upload failures may require manual retry. Never silently attach unauthorized assets, delete uncertain/shared assets, or discard pending personal work. Revisit if real-user failures justify the additional complexity. See `phase-5-plan.md`.
- Phase 5: Creator may retain an older selected immutable foreign Card version while Deck publication records the Card's latest published version. The agreed publication review must identify this difference and require confirmation; a further relevant publication invalidates the review. Authoring selections, `cardVersionAtPublish` and personal adoption remain separate. Revisit whether this distinction causes user confusion after the workflow has been exercised; it is not a Phase 5 blocker and does not authorize silently refreshing draft selections or changing adoption semantics.
- consider a categories record
- Phase 4 Checkpoint 5 manual review: Card creator attribution appears in Library but not My Decks. Investigate later with multiple users; no investigation performed for the Library Edit/Fork amendment.
- Phase 4 Checkpoint 5 manual review: verify real Cloudflare playback later using real uploaded assets. Synthetic Stream IDs in the disposable Phase 2 environment cannot establish live playback correctness.




 