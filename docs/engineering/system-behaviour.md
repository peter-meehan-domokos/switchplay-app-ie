# System behaviour

This cumulative reference describes user-visible rules and important edge cases.
Entries below describe the behaviour delivered in Phases 6–8. Future checkpoints
should update the relevant sections as behaviour is delivered. Earlier phases are
not backfilled here.

## Production migration and media delivery [Phase 8]

The repository now supports explicit Atlas application configuration alongside the
unchanged disposable-local development flow. Production mode requires the approved
`switchplay` database/host and protected media presentation; it refuses test-media
settings. The production migration completed on 14 October 2026. The five original
collections remain intact under `legacy_` names; the new collections contain the
reviewed canonical content and embedded personal records. Approved original demo
learning state was reset, while user identities, ownership, sharing metadata and
uploaded personal media were preserved. This reset does not apply to future learning
state. Vercel remains paused pending a separately approved compatible deployment.

Protected delivery checks the signed-in learner before serving stored R2 image
references or issuing Stream playback tokens. Another creator's personal uploads
are not accessible through canonical fork ancestry. Retained own source/archived
media remains readable. Canonical published-version visibility and ownership still
apply. Delivery changes do not rewrite stored media keys, IDs or URLs.

### Card-back media viewer and downloads [Phase 8 integration]

Personal media thumbnails open one full-screen gallery from the working Card back,
in either the stack or focused view. The row still shows at most five thumbnails;
the gallery navigates the complete ordered current and inherited personal-media
list. Original/fork items keep their source Card identity, including when media IDs
repeat. Opening pauses underlying playback and locks Card gestures; closing restores
focus and scroll without restarting playback. Assessment controls remain back-only
and focused-only, with their existing appearance.

Images support fit, zoom and pan. Each selected Stream video starts paused from the
beginning, using the existing player and frame-presentation handoff. Navigation or
closing stops and releases the selected gallery video; it does not prepare other
gallery videos. Existing instructional-video grant and thumbnail preparation is
unchanged. Library/Creator presentations do not acquire personal media.

Viewing and downloading use only the signed-in learner's CardData and permitted
personal-history sources. Public templates, Deck ownership and admin status do not
grant another learner's uploads. Reads do not create memberships, change adoption
or write learning state. Missing sources fail without substituting another item.
Images download through authorized same-origin responses using preserved current or
historical R2 references. Stream downloads are encoded MP4s, prepared only by an
explicit action and delivered with download-enabled signed tokens; playback tokens
do not gain download permission. Safari retains its file-sharing flow, explicit
second-tap/retry handling, cancellation, 32 MB memory limit and same-origin new-tab
fallback. A prepared download or closed share sheet does not prove a file was saved.
Real iPhone sharing and provider delivery require separate manual acceptance.

Card introduction/Step playback reuses an authorized manifest-and-thumbnail grant
for up to ten minutes within the mounted learner/Card/version context. Grants are
kept only in memory and refreshed after expiry or context changes; the same grant
serves the thumbnail and video. New grants check the exact adopted or public Card
version. Access changes may take until the reuse window ends to be rechecked.
When the focused Card opens, its video grants prepare independently in the background;
selected playback waits only for its own grant. Near-expiry grants refresh during
navigation or return to the tab while valid grants remain usable. Preparation stops
when the Card closes, changes, flips to its back or the tab is hidden. There are no
idle refresh timers or extra video players.
Each returned grant independently starts downloading and decoding its thumbnail.
The focused Card retains those image nodes for selection and return navigation,
using the same signed URLs without a second display download. Unfinished image
preparation stops with the Card's background preparation; Step images are released
when focus closes. Until a thumbnail or video frame is ready,
the video area shows a visible loading message; an unavailable thumbnail does not
block video playback. Loading and failure messages sit outside the concealed player.
Library Cards also prepare one readiness check per video; videos still processing
are polled only when selected for playback.
Switching videos still conceals the outgoing frame immediately. The incoming
thumbnail stays opaque while the decoded video paints beneath it; its fade starts
only after current-source frame presentation and a rendering boundary. Browsers
without frame callbacks use rendering boundaries after current-frame data arrives.
Paused navigation does not require playback. Reuse does not retain multiple players
or video buffers.

Open My Decks and Library Decks also prepare neighbouring Card introduction images.
Decks of up to seven Cards prepare every introduction; larger Decks use two behind
and four ahead, shifting unused capacity at either end to fill seven positions.
The cold active Card keeps its existing lazy image path. Neighbour work waits for
that image to decode or fail, then runs at most two low-priority grant/image jobs.
Opening a Card video cancels neighbour work until the video view closes; it never
blocks active playback. Neighbours prepare no Step images or video data.
Prepared introduction images and valid grants are shared with the focused Card;
small Card-front canvases preserve simultaneous stack/focused/poster presentation
without downloading another copy. Proactive decoded images are limited to the
window (plus the focused Card's Step images). Images leaving the window are
released, while valid grants remain reusable within the open Deck. Existing lazy
loading outside the window remains unchanged; already-painted small Card-front
copies may remain visible. Deck/learner/version changes invalidate the appropriate
resources, and closing the Deck releases them all. This adds no persistent storage.

Stream tokens expire after one hour; a copied token remains usable until expiry.
R2 images use session-authorized requests without public redirects. Existing provider
origins/assets must be configured separately before this protects direct old URLs;
those changes and real-provider acceptance remain pending approval. Local mocks
retain their previous behaviour. The explicitly discarded gym-trace mock illustration
is omitted from new personal lists during migration, while original references remain
in the backup/legacy users. Other bundled public artwork remains public.

## Deck action menus

My Decks places Archive directly below Edit in the Deck menu. Archive opens a
confirmation naming the Deck; Cancel makes no changes. Confirmation retains the
existing archive operation, keeps learning progress, blocks duplicate submissions
and leaves failures available for retry. Archived Decks can still be restored.

Library places Add to My Decks, Open in My Decks or Restore to My Decks in the same
Deck menu, beneath Edit where editing is permitted. These retain their existing
explicit actions, version checks and Progress return context. Selecting an action
closes the menu; browsing never adds or restores content automatically.

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
rows retained and an unknown total. Card indicators suppress a latest-three claim because
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

Working Card backs show up to three compact assessment symbols next to the Card
label: a blue tick for Pass and a red dot for Fail, with the newest result on the right.
There are no placeholder results. With no tests, a small subdued outlined + Test
control appears beside the Card label. [Phase 7] Assessment controls appear only on
the back and are interactive only after the Card is focused; an unfocused back keeps
its visible metadata but cannot open the assessment dialog. The focused control opens
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

Area expansion uses its own chevron control. An Area title is clickable when at least
one child Item has configured Card mappings; it uses the same brighter text, pointer
cursor and hover/focus treatment as a clickable Item. Areas without mappings retain
subdued non-clickable titles. Their expansion chevrons remain independent and usable
when they contain Items. Clicking a mapped Area title opens a separate Deck-selection
dialog without changing expansion. An Item title opens its Card-selection
dialog when it has explicitly configured Card mappings. Such titles are slightly brighter
and show a pointer cursor and hover underline. This is a configuration rule, not a guarantee
of accessible destinations: missing or unavailable mapped Cards remain inspectable through
the dialog's empty/incomplete states. Items without mappings have subdued non-clickable
titles; their Tests cells remain fully usable. Browsing the table never restores, imports
or updates learning content.

Item rows are indented beneath their Area. Blank completion/confidence values mean no
eligible personal content or unset readings; no extra distinction is made between an
unmapped Item and a mapped Item without eligible work. Zero and 100% remain numeric.
Unavailable calculations remain blank with accessible unavailable labels rather than
fabricated scores. A fully resolved calculation can still show unfinished learning.

The whole Tests cell is an assessment entry point. It displays the combined history's
latest three blue Pass ticks/red Fail dots, newest on the right. With no results, it shows
a subdued + Test control. Incomplete histories keep the normal presentation: the latest
three known readable results, or + Test when none are known. A small subdued ! in the
cell's bottom-right corner warns that other results may be missing; it never replaces
the control or inserts guessed results. Ordering and original-source deduplication are
unchanged. A failed summary refresh also warns on the retained known results. The Item
dialog shows ! Some assessment history may be missing. and retains all readable rows,
Add test and authorised Edit/Delete actions, including when no rows can be read.
Complete histories show no warning. Area rows do not display assessments. This Progress
presentation does not change the Card-back indicator's incomplete-history treatment.

Opening a Tests cell loads the existing Item assessment dialog on demand. Adding records
a direct Item test; editing/deleting an inherited Card result still changes its original
personal-data source. Configured Items need no mapped or eligible Cards for direct tests.

Assessment saves refresh mounted Progress indicators. Background refresh preserves an
open assessment form and its entered values, including revision-conflict recovery. Reads
are actor-bound, ignore superseded requests and keep personal results isolated. Progress
refreshes on focus/return and offers explicit retry after a failed read; previously loaded
rows retain their structure; stale scores remain unavailable and known assessment indicators
carry a warning. Continuous
cross-tab synchronization is not provided.

With no configured Frameworks, Progress displays a deliberate empty message. A Framework
with no Areas also has an explicit empty state. The table and assessment dialog support
keyboard operation, usable touch targets and narrow-screen layouts.

## Area Deck selection and returning to Progress [Phase 7]

An Area lists adopted and published Library Decks containing at least one Card mapped
to one of its Items, including Cards mapped through canonical fork ancestry. My Decks
starts expanded; Archived and Library start collapsed. Each section has its own count.

Decks use the same front visuals as the existing Deck tiles, with personal completion
and confidence where available. These are static selection representations: no video
player or working Card controller is mounted. Simply viewing them changes no learning
state. Decks are ordered by descending distinct matching-Card count, then title and
stable Deck identity. Repeated references count once; an original and its fork count
separately. Unmapped Cards still contribute to the Deck's ordinary personal metadata.
The adopted Deck composition and independently adopted Card versions remain authoritative
in My Decks and Archived. Library uses the current public Deck composition and current
public Card versions. Discovery considers the complete public set before matching and
ranking, so an ordinary Library page boundary cannot hide a relevant Deck.

A Deck appears in at most one Progress section: relevant active memberships under
My Decks, relevant archived memberships under Archived, and matching published Decks
without either membership under Library. Exclusion uses the canonical Deck template identity, not
the title, shared Cards or publication version. Distinct Deck forks remain separate.
Reopening the Area modal refreshes membership placement and section counts after
adding, archiving or restoring. This rule applies only to Progress: the main Library
continues showing all eligible publications, including personally adopted Decks.
The Progress Library front shows only canonical public content and creator attribution,
never personal completion, confidence or assessment state. Selecting a Library front opens that exact published
Deck in the existing Library interface, where its Cards can be browsed before deciding
whether to add it. Selection does not import, restore or update anything. Add, Restore
and Open in My Decks remain explicit actions in Library, not duplicate Area-modal actions.
Returning to Progress refreshes the section counts after an Add or Restore.
Existing personal Card and Deck versions are preserved; public and working versions
may differ. Publication or membership changes require refresh and review before retrying.
The existing Library workflow handles import recovery; reopening the Library Deck
checks its membership before offering another action.

Missing required data is distinguished from an empty section. Readable matches remain
visible, unavailable Decks cannot be opened, and an uncertain total is shown as unavailable.
A failed database read offers retry rather than presenting an empty list. Unavailable
public content makes Library discovery incomplete when its relevance cannot be established;
valid matches remain visible and inaccessible content is not offered as a destination.

Selecting an active Deck opens it directly, preserving its valid Deck-specific active
Card. Selecting an archived Deck first reveals Restore and open; only that explicit
action restores it. Membership and access are rechecked before entry. If restoration
succeeds but opening fails, the Deck remains restored and the learner can retry opening
or return to Progress. No automatic reversal discards a successful restoration.

Progress-origin working and Library views use the same Back to Progress control in
the same Deck-header position. Adding a Deck in Library, or explicitly continuing to
My Decks from Library, retains this return destination. Return waits for outstanding
personal work and restores the selected Framework, session-scoped Area expansion and
scroll position where the browser permits it. Progress rereads saved completion,
confidence and assessments. Creator retains its established My Decks origin, with the
Progress return context carried through rather than replacing Creator origin semantics.
Ordinary My Decks and Library navigation keep their existing return destinations.

## Item Cards and Deck contexts [Phase 7]

A configured Item opens a scrollable column of static Card fronts before navigation,
even when only one Card is available. The visuals retain Card content and creator
attribution, without working controls, assessments or media playback. Cards are
identified by their template identity: repeated references collapse into one visual,
while originals and forks remain separate even when their titles match. Canonical
fork ancestry supplies the Item mapping; personal-history inheritance is unchanged.
Selection Cards are approximately 5% narrower and horizontally centred, with 12px
of additional space below the modal header and 8px above each caption. A single destination's
caption names its context and actual Deck title; multiple destinations show a neutral
choice caption, with Deck names on the subsequent Deck fronts. Captions omit version
numbers; underlying version checks and context-specific opening remain unchanged.

Only Cards with an accessible Deck context are offered. An unmapped Item or a mapped
standalone Card has no content destination; direct Item assessments remain independent
and usable. Incomplete discovery retains available choices with a warning; a failed
read offers retry rather than claiming the Item is empty.

The visual prefers an accessible personal adopted Card version, including archived
work, and otherwise shows a current public version. Version differences between
available contexts are noted. Choosing a Deck uses that context's version, never an
implicit update. A Card retained in an adopted Deck can remain reachable after removal
from its current publication. As in Area selection, any personal Deck membership
excludes the same Deck identity from Progress Library choices. A Card appearing only
in that Deck's newer public composition therefore needs another accessible Deck
context to be offered here; it remains browsable through the main Library.

A Card with one active or Library context opens that Deck at the selected Card.
Multiple contexts reveal visual Deck fronts inside the same modal, with My Decks,
Archived and Library distinguished. Back to Cards restores the list's scroll and focus.
Archived choices require explicit Restore and open; the initial selection does not
restore anything. A successful restoration remains committed if working entry fails.
Library choices open the existing published Deck and target the selected Card without
importing it. Add remains an explicit Library action. Stale or inaccessible destinations
require refresh rather than opening another Card or silently changing versions.
Item navigation carries the chosen Card version into entry checks. If adoption or
publication changes between selection and opening, the learner must refresh choices;
ordinary Deck entry retains its existing behaviour.

Progress return context is retained for all these routes. The shared Back to Progress
control restores the selected Framework, Area expansion and scroll where practical,
and rereads saved progress. Ordinary content entry keeps its existing Back behaviour.
