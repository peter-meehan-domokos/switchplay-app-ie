# System behaviour

This cumulative reference describes user-visible rules and important edge cases.
Entries below describe Phase 6 foundations implemented so far; the Progress interface
is not yet available. Future checkpoints should update the relevant sections as
behaviour is delivered. Earlier phases are not backfilled here.

## Framework organisation and mappings [Phase 6]

A Framework contains ordered Areas, each containing ordered Items. The configuration
determines their order. Only Items map to canonical Cards; Areas have no direct Deck
mappings. Item identities are globally unique, including across Frameworks.

One Card can have at most one effective Item mapping within a Framework. Another
Framework can map that same Card differently. Empty Frameworks, Areas, Items and
mappings are valid. The real catalogue is deliberately empty until curricula are
agreed; it does not contain invented permanent content.

A Card fork inherits its source Card's mapping, including through successive forks.
This follows explicit canonical Card ancestry, never a Card's position or neighbours
in a Deck. Personal history links serve a different purpose and are not mapping inputs.

Explicitly mapping a fork and its ancestor to different Items in one Framework is a
configuration conflict, not an override. Missing, malformed or cyclic ancestry is
unresolved rather than silently treated as unmapped. Conflicts or unresolved required
configuration prevent trustworthy scores for the affected Framework.

## Which learning contributes [Phase 6]

Cards referenced by both active and archived My Decks memberships establish personal
Framework eligibility. Archiving removes work from the active workload, not its
achievements. Calculations use the adopted Deck composition and the learner's current
adopted Card state; archiving does not freeze a historical snapshot.

The same Card in several active or archived Decks contributes once. Originals and
forks have different Card identities and contribute independently. For example, an
original with three unfinished Steps and its fork with three completed Steps contribute
50% completion together, even when the original's Deck is archived.

Owning content, finding it in Library, or retaining CardData without any qualifying
Deck relationship does not establish eligibility. Unmapped Cards remain useful in
Decks and contribute to their Deck's own progress and confidence, but not Framework
Item or Area scores.

## Completion and confidence [Phase 6]

Item completion combines the underlying Steps of its distinct eligible Cards. Area
completion combines distinct eligible Cards mapped to its child Items. Neither is an
average of displayed Card or Item percentages.

Completed Steps count in numerator and denominator. Todo and in-progress Steps count
only in the denominator. Skipped Steps count in neither. If all eligible Steps are
skipped, completion is 100%; existing Card and Deck calculations follow this rule too.
Empty Step text does not remove a structural Step from calculation: Cards contain
exactly three Steps and can have sparse content.

Confidence averages all explicitly set raw readings and rounds only the final result.
Unset readings do not count. A set reading still counts when its Step is skipped.
With no set readings, there is no confidence score.

Only the actual Steps in the adopted Card version contribute. Retained values for
obsolete Step identities do not affect current calculations. Reordering Steps does
not change their identity or which values are used.

## Empty and unavailable calculations [Phase 6]

No eligible Cards means no completion percentage. Eligible unfinished Steps mean 0%.
All eligible Steps skipped mean 100%. An empty Deck shows no completion percentage
and is not labelled completed.

When a required contributor is missing or unavailable, affected completion and
confidence scores are suppressed and marked incomplete. For example, a missing Card
version can prevent its Item and Area scores without suppressing an unrelated valid
Item's score. Unknown Deck composition or ancestry can affect more summaries because
the missing contribution cannot safely be assigned.

Individual absent Step status/readings use the established todo/unset defaults.
Missing required records, malformed arrays, ambiguous identities and inaccessible
adopted versions are not empty learning. Database read failures propagate as errors
instead of silently producing empty or successful partial results.
