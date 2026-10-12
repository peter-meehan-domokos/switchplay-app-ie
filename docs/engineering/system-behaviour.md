# System behaviour

This cumulative reference describes user-visible rules and important edge cases.
Entries below describe the behaviour delivered in Phases 6–7. Future checkpoints
should update the relevant sections as behaviour is delivered. Earlier phases are
not backfilled here.

## Framework organisation and mappings [Phase 6]

A Framework contains ordered Areas, each containing ordered Items. The configuration
determines their order. Only Items map to canonical Cards; Areas have no direct Deck
mappings. Item identities are globally unique, including across Frameworks.

One Card can have at most one effective Item mapping within a Framework. Another
Framework can map that same Card differently. Empty Frameworks, Areas, Items and
mappings are valid. [Phase 7] The application retains a sample Leaving Cert Higher
Level Maths Framework for development and manual acceptance, including Algebra,
Calculus and an empty Trigonometry Area. Its existing identities remain stable;
Card mappings can be entered manually. It is not a completed production curriculum.

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

Authenticated Framework summaries now provide these metrics and compact Item assessment
indicator data, in configuration order. Full assessment histories are read separately.
The reads use one consistent database snapshot, do not import content or initialise
personal records, and never advance adoption or restore archived Decks. An empty
catalogue returns an empty list; empty-catalogue coverage uses explicit test fixtures.

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

## Assessments and their original sources [Phase 6]

Assessment persistence, authenticated APIs and the Card assessment interface are available.
The reusable Item assessment interface is available from Progress [Phase 7]. Assessments record a pass/fail
result and a calendar date. Their identity and original creation timestamp remain fixed
when the result or date is edited.

A new Card assessment belongs to that learner's own CardData for the selected Card.
Creating one requires an existing active working Deck context and adopted CardData;
the operation never imports a Deck, creates CardData or adopts a newer version.
Existing personal results can be read, edited and deleted after archiving, removal from
a Deck or loss of access to canonical content.

Forking does not copy tests. Source tests stay on the original CardData and continue
to be exposed through the existing personal-history links. New tests on a fork belong
to the fork. Editing or deleting an inherited result targets its original Card identity
and result ID. For example, editing a source result through a fork changes the one
source-stored result; all currently mounted assessment histories and indicators for that
learner refresh after the save, including other forks exposing the same result.
Canonical fork ancestry never grants access to another learner's personal results.

A direct Item assessment belongs to the learner and globally unique Item ID, separately
from CardData. It needs a configured Item but no Card or Deck membership. Removing an
Item or changing its mappings does not delete or move existing results; retained Item
results remain readable, editable and deletable. [Phase 7] Configured sample Items
can receive direct results even before any Card mappings are entered. Assessment
creation does not add Cards, Deck memberships or curriculum content.

Each Card assessment list has its own revision. The learner's direct Item assessment
list has one revision across all Items. Missing existing counters mean zero. Conflicting
edits require refresh and retain the caller's intended command rather than overwriting
newer results. An identical retry can acknowledge the current matching result without
duplicating it or changing its timestamp. A delayed Add retry cannot resurrect a deleted
result. Lost responses are reconciled by reading persisted state before replay.

Writes preserve unrelated completion, readings, reflections, dates, media, chats,
adoption and membership. Results are private to the authenticated learner. Invalid or
ambiguous stored assessment lists and database failures produce explicit errors rather
than fabricated empty history. Lists sort by assessment date newest first, then creation
timestamp, with result identity providing a stable tie-breaker for equal values.

## Combined assessment histories [Phase 6]

An Item combines its direct tests with tests on eligible mapped Cards and readable
source tests exposed through those Cards' personal-history links. Both active and
archived Decks qualify. Unmapped Cards and orphan CardData do not independently
establish eligibility, even when the learner owns them. Retained source results can
still be exposed through an eligible fork. An Item with no qualifying Cards can still
show direct Item results. Retired Items with retained direct results remain readable.

Each event appears once per combined history, identified by its original storage
source and result ID. For example, one source test visible through three forks appears
once; two different Cards' tests with identical result IDs remain separate events.
Originals and forks still contribute independently to completion and confidence.
Canonical ancestry determines mappings; only the learner's own personal-history
relationships determine which source-stored assessments can be read.

Full histories sort by assessment date newest first, then immutable creation time,
then stable originating source and result identity. The latest three distinct results
are projected in the reverse order for an oldest-left, newest-right indicator.
Rows retain the source identity and list revision needed to edit/delete the original
result. Source dependencies describe the storage lists contributing to the history.

Card histories distinguish the viewed Card's own results from inherited Source Card
results. Item histories identify direct Item tests and distinguish eligible contributing
Cards' own results from other inherited sources. Originating titles use the learner's
adopted, authorised Card version, not a draft, latest publication or guessed event-time
title. If the title is unavailable, the result remains with a neutral “Card title
unavailable” fallback. Identical titles never merge result identities.

Missing or corrupt required history sources produce an incomplete history with readable
rows retained and an unknown total. The latest-three projection is suppressed because
an unavailable source could contain newer results. A missing title alone does not make
personal results unreadable. Missing adopted content can suppress an Item/Area's metrics
while its retained assessments remain readable. Database failures are errors, not empty
histories. An unaffected Item or Framework can retain trustworthy results.

[Phase 7] Item assessment histories scope canonical mapping diagnostics to the
Items they can affect. A missing Card mapped to Quadratic Equations does not make
an unmapped Factor Theorem Item's direct tests unavailable. An unmapped Item can
have an empty or populated direct history independently of canonical Cards.
Unresolved eligible ancestry still makes mapped Item histories incomplete where
the missing chain could conceal contributors. Framework validation diagnostics
remain available through progress results; completion/confidence rules are unchanged.

## Assessment interface and refresh [Phase 6]

Working Card headers show up to three compact assessment symbols next to the Card
label: a blue tick for Pass and a red dot for Fail, with the newest result on the right.
There are no placeholder results. With no tests, a subdued plus button opens the history;
on the Card back this is a small outlined + Test control beside the Card label. It opens
the normal history dialog without creating a result or starting the Add form. Loading,
failed reads and incomplete histories use a neutral status entry instead of an uncertain
latest-three sequence.
Canonical Library previews never load personal assessments or offer assessment writes.

The history dialog shows a newest-first Date / Result / Card / Actions table. Inherited
rows have a muted originating title and an explicit Source Card label, even when source
and fork titles are identical. Direct Item assessments show Item test. Unavailable titles
use the neutral fallback while retaining readable results. Narrow screens wrap titles
and stack row actions; the dialog scrolls and supports keyboard focus and Escape.

Adding from a Card stores the result on that Card; adding in Item mode stores it directly
against the Item. Editing and deleting target the original storage source. Delete requires
confirmation. Retained archived results remain manageable, while new Card tests still
require an active working context. The reusable Item dialog supports results without any
Cards or memberships. [Phase 7] Item rows expose this same dialog through their Tests cell.

Successful saves, including reconciliation after a lost response, notify every mounted
assessment view for that learner to reread its history. For example, editing a test from
source A through fork B also updates a mounted fork C's history and latest-three indicator.
This is in-session refresh; real-time synchronization with other tabs is not provided.

On a revision conflict, the dialog retains the entered date and result, shows the current
saved state and requires explicit reviewed resubmission. This also applies when another
Item's change advances the shared Item-list revision. A test deleted elsewhere cannot be
recreated through Edit. A reviewed new addition after a conflicting Add uses a new identity
rather than resurrecting an uncertain prior result ID. Network retries retain the exact
original command and check persisted state before replaying it.

Closing an unsaved form asks whether to discard the entered changes. An in-flight save
cannot be dismissed. An uncertain failed save must be checked before it can be safely
abandoned; cleanup never cancels unrelated uploads or a newer save. Partial histories keep
readable rows with an unavailable-history notice. A failed refresh keeps previously readable
rows marked as potentially out of date, suppresses indicators and offers Refresh history.

## Card header confidence [Phase 6]

Personal Card confidence is centered independently of the label, assessments and date.
On working Card backs it uses the same subdued colour as the date, with a small medium-weight
numeral, so it remains part of the quiet metadata row above the media and signals.
It averages explicitly set raw readings for the Card's current Steps, including skipped
Steps, and rounds once to a whole number from 1 to 10. With no set readings, the center
contains no numeral and is labelled Confidence not set for accessibility. Signal changes
update the score using the same shared helper as other confidence calculations. Completion,
date controls, media areas and Card gesture geometry retain their existing roles.

## Progress table and Item assessments [Phase 7]

Progress displays one Framework at a time. Framework choices, Areas and Items follow
configuration order. Areas containing Items start expanded; each Area can be collapsed
independently without hiding its completion or confidence. Expansion choices are retained
per learner and Framework for the browser session, including after reload or switching
Frameworks. Empty Areas remain visible and have no expandable children.

Area expansion uses its own chevron control. Clicking an Area title opens a separate
Deck-selection dialog without changing expansion. Item content navigation is reserved
for a later checkpoint. Browsing the table never restores, imports or updates learning content.

Item rows are indented beneath their Area. Blank completion/confidence values mean no
eligible personal content or unset readings; no extra distinction is made between an
unmapped Item and a mapped Item without eligible work. Zero and 100% remain numeric.
Unavailable calculations have an explicit unavailable indication rather than a fabricated
score. A fully resolved calculation can still show unfinished learning.

The whole Tests cell is an assessment entry point. It displays the combined history's
latest three blue Pass ticks/red Fail dots, newest on the right. With no results, it shows
a subdued + Test control. Incomplete histories use an unavailable indication instead of
pretending that no tests exist. Area rows do not display assessments.

Opening a Tests cell loads the existing Item assessment dialog on demand. Adding records
a direct Item test; editing/deleting an inherited Card result still changes its original
personal-data source. Configured Items need no mapped or eligible Cards for direct tests.

Assessment saves refresh mounted Progress indicators. Background refresh preserves an
open assessment form and its entered values, including revision-conflict recovery. Reads
are actor-bound, ignore superseded requests and keep personal results isolated. Progress
refreshes on focus/return and offers explicit retry after a failed read; previously loaded
rows retain their structure but stale scores/indicators are marked unavailable. Continuous
cross-tab synchronization is not provided.

With no configured Frameworks, Progress displays a deliberate empty message. A Framework
with no Areas also has an explicit empty state. The table and assessment dialog support
keyboard operation, usable touch targets and narrow-screen layouts.

## Area Deck selection and returning to Progress [Phase 7]

An Area lists adopted Decks containing at least one Card mapped to one of its Items,
including Cards mapped through canonical fork ancestry. My Decks starts expanded;
Archived and Library start collapsed. Library discovery is not implemented in this
checkpoint; its section clearly indicates that integration is forthcoming.

Decks use the same front visuals as the existing Deck tiles, with personal completion
and confidence where available. These are static selection representations: no video
player or working Card controller is mounted. Simply viewing them changes no learning
state. Decks are ordered by descending distinct matching-Card count, then title and
stable Deck identity. Repeated references count once; an original and its fork count
separately. Unmapped Cards still contribute to the Deck's ordinary personal metadata.
The adopted Deck composition and independently adopted Card versions remain authoritative.

Missing required data is distinguished from an empty section. Readable matches remain
visible, unavailable Decks cannot be opened, and an uncertain total is shown as unavailable.
A failed database read offers retry rather than presenting an empty list.

Selecting an active Deck opens it directly, preserving its valid Deck-specific active
Card. Selecting an archived Deck first reveals Restore and open; only that explicit
action restores it. Membership and access are rechecked before entry. If restoration
succeeds but opening fails, the Deck remains restored and the learner can retry opening
or return to Progress. No automatic reversal discards a successful restoration.

Progress-origin working views offer Back to Progress. Return waits for outstanding
personal work and restores the selected Framework, session-scoped Area expansion and
scroll position where the browser permits it. Progress rereads saved completion,
confidence and assessments. Creator retains its established My Decks origin, with the
Progress return context carried through rather than replacing Creator origin semantics.
Ordinary My Decks and Library navigation keep their existing return destinations.
