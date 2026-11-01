# Group Experiences — Phase 4 UX and Product Specification

**Product:** Switchplay  
**Date:** 30 October 2026  
**Status:** Approved product requirements; the initial slice and iPhone refinements are accepted. Checkpoint 8 creation/settings is authorised as recorded in P12. Later phases remain deferred.
**Source:** The Phase 4 Read-Only Implementation Plan commission and its documentation amendment. These requirements supersede conflicting earlier Group Experience UX/aggregation statements.  
**Companion:** `docs/engineering/features/group-experience/group-experience-phase-4-engineering-plan.md`. The overarching engineering plan remains in place.

## P1. Purpose, vocabulary and ownership

The interface presents authorised perspectives on the same underlying Card. `CardTemplate` is canonical; `DeckTemplate` orders CardTemplate references; personal `CardData` belongs to one user/CardTemplate; `DeckData` holds personal Deck-level state. Access through multiple personal Decks or Group Experiences reuses that same personal CardData. Group-controlled learning and contributions remain separately scoped to each Group Experience. Each experience retains independent version adoption; stable Step identity, privacy and shared-learning rules remain mandatory.

Use **Admin** and **Follower** throughout application copy. Admins have equal authority. An admin may independently also be a follower; their follower perspective behaves like any other follower perspective. There is no implicit personal follower record for an admin-only user.

Phase 4 delivers the early perspective interface, the progress/confidence presentation specified here, and necessary correctness/authorisation foundations. Full assessments, media, Info Card and reflection contributions remain later phases. Requirements for those features are recorded below so that Phase 4 does not prevent them.

## P2. Perspectives, permissions and restoration

| Perspective | Read authority | Learning editing |
| --- | --- | --- |
| Group | Current authorised experience participant | Admins only, changing group-controlled values |
| Own follower | Current active follower, including dual-role admin | Owner only, changing authoritative personal values |
| Another active follower | Admin; or active follower when peer visibility is enabled | None |

First-entry default: Admin → Group; Follower → own perspective. A dual-role user follows the Admin default. Subsequent visits restore the last selected authorised perspective, otherwise fall back to the role default. Selection is specific to the viewer and experience, not a global selection for every participant.

The group-wide setting **“Can followers view each other's Cards?”** defaults to Off and is admin-controlled. Turning it off or changing membership must revoke affected server permissions and invalidate previously authorised client state. The exact guarantee for a remote browser already holding data requires the explicit clarification in P15; downloaded data cannot physically be recalled.

Nobody may edit another person's personal learning. In another person's perspective, remove editing affordances entirely; do not merely disable them. Temporary loading/verification of an otherwise editable own/group perspective may suspend interaction without implying a foreign-user edit capability.

## P3. Compact identity picker

Both ordinary Deck and Focused Card views have a compact Card-shaped picker at bottom-right, consistent with existing design. It shows only the current identity:

- Group: group-of-people icon and actual informal experience name, for example `Galway U18`.
- Individual: initials avatar and username, for example `Alice`.

Truncate long names. Do not add “Group”, “Group perspective”, a repeated experience-name line, a replacement header or a new badge. The Group identity is always the first option; eligible active followers follow alphabetically by username. The user's own follower identity participates in this ordering.

Zero followers: keep the named Group picker visible as a persistent indication of group context. With no other authorised identity it need not be interactive. `All followers` is available when multiple perspectives are available and the viewer may inspect them. A follower with peer visibility Off must still be able to select Group and self through the compact two-option treatment approved in P15; never expose unauthorised peers.

## P4. Focused Card comparison grid

Selecting `All followers` expands a three-column, vertically scrollable grid of identity Cards **underneath the main focused Card**. It occupies approximately the lower 35–40% of available mobile viewport height. The main Card moves smoothly upwards to make room. Leave a small tappable part of the surrounding Deck above it so existing outside-tap dismissal remains available.

Each tile shows the relevant icon/initials and name. The first tile uses the group icon and actual name, never the generic word “Group”. Highlight the selection; subdue other tiles slightly while keeping them recognisable. At top-left of the expanded grid use a subtle contextual heading such as `Galway U18 · Alice`. Include a simple collapse control.

Selecting an identity updates the main Card and leaves the grid open. Vertical navigation between CardTemplates preserves the selected perspective, expanded state and grid scroll position. Collapsing the grid restores compact-picker presentation and original focused-Card position without changing perspective.

Outside-tap dismissal leaves Focused Card view, automatically collapses the grid and retains perspective. Each new entry into Focused Card view starts with the grid collapsed. Scrolling the grid must not trigger Card traversal or outside dismissal. Identity tiles are lightweight representations, not separate heavy Card scenes or video players.

## P5. Ordinary Deck perspective list

Ordinary Deck view uses the same compact picker. `All followers` opens a compact vertically scrollable list upwards from it, not the comparison grid. Group is first; individual rows show initials and username.

Choosing an identity closes the list, switches the **whole Deck**, preserves active CardTemplate and face/orientation, and keeps ordinary Deck view active. The transition must convey a physical whole-Deck exchange, not merely replace labels.

## P6. Three navigation motions and object continuity

| Action | Required motion |
| --- | --- |
| Between CardTemplates | Existing vertical Card gestures and animations, preserving their meanings and thresholds |
| Between perspectives while focused | Very short, subtle diagonal/depth exchange of the corresponding Card, conceptually from the identity grid below; never a straight vertical traversal slide; end at the same location and orientation |
| Between Deck perspectives in ordinary view | Brief depth exchange of the entire stack; incoming Deck subtly suggests an upper-left origin associated with My Decks, without travelling across the screen |

Perspective exchange must be understated and quick enough for rapid comparison of around 15 followers. Exact motion will be refined during later iPhone review. Use existing motion/gesture architecture and restrained visual language. Do not invent navigation gestures or rewrite unrelated animations.

Cards and placed Cards must remain physically coherent with the Deck environment when opening the grid, switching perspectives, focusing, dismissing or traversing. Obscuring existing objects is acceptable; teleporting or abruptly removing them is not. Preserve the main scene and meaningful Card identities. User input, pending edits, focus, face and current Card must not be reset merely by changing perspective.

Accessibility, reduced motion, keyboard use, mobile browser viewport changes and scroll ownership must be accommodated. Reduced motion may simplify travel while retaining clear object/selection continuity.

## P7. Front progress and neutral-skipped semantics

In Group perspective, every one of the three Steps shows the existing editable group progress bar followed immediately on its right by follower counts on **one horizontal line**:

`[existing progress bar]  3  2`

Centre counts vertically with the bar. Count text is secondary/subdued and approximately the size of creator attribution text at the bottom of the Card. Preserve the bar's normal dimensions; do not introduce two lines or redesign it. Individual perspective uses that person's normal progress; only the owner receives editing affordances.

The approved iPhone-review refinement uses a 24px visible bar column and an initial 6px gap to counts, with the same row geometry in ordinary and Focused views. Keep the effective 52×24px editable target clear of the counts, instructional content and neighbouring controls. Counts use the existing neutral metadata colour `#aeb5c1`, compact sizing and regular weight, without a separate opacity or decorative treatment. The gap remains subject to physical iPhone review.

For each Step, consider active followers only:

- `inProgress` contributes one doing count.
- `done` contributes one done count.
- `todo`/legitimately unstarted contributes to the eligible denominator, neither numerator.
- `skipped` contributes to neither numerator **nor denominator**. It is neutral, never doing/completed.
- Malformed state must not be silently classified as skipped or unstarted.

For 12 followers with 3 doing, 2 done, 1 skipped and 6 unstarted, display `3  2`: doing first, done second. Keep the existing eligible denominator of 11 in calculations, but do not display denominators, words, dots, icons, tooltips or explanations. The compact neutral numbers remain in the existing non-flowing annotation 6px to the right of the bar; progress geometry, hit targets and Step spacing are locked. Exclude admin-only users; count dual-role followers once. Existing personal completion counts even if acquired before group assignment.

With no followers or all followers skipped for the Step, hide that Step's follower counts entirely; retain its group progress bar. Denominators may differ between Steps. The same neutral rule must govern Group Experience Card/Deck follower aggregates; exact multi-Step category derivation is an engineering policy to specify explicitly and consistently with existing personal neutral semantics, not infer from rounded percentages.

Correct the earlier engineering statements/tests that equate all-skipped with completed. Avoid changing unrelated personal progress calculations unnecessarily. This correction is mandatory in eventual implementation even where it changes Phase 2 code.

## P8. Front confidence

In Group perspective, replace the single central confidence value with a collectively centred pair: group confidence with superscript `G`, follower confidence with superscript `F`. Do not use verbose labels or disturb the original confidence area.

For both personal and Group Cards, Card-level confidence uses neutral metadata `#aeb5c1` and weight 500, preserving the existing `0.8rem` font size, location and superscript arrangement. Back confidence must not vary according to assessment-indicator presence; retain the back's existing overall scale. No change to readings, calculations or editing is implied.

The follower value is a mean of underlying valid signal readings, each equally weighted, rounded only at the final result. It is not a mean of per-person means. Exclude unset/null readings. Both Group Card G/F positions remain present, including with zero followers; a missing value uses a very thin, quiet horizontal placeholder rather than a prominent typographic dash. Missing is not zero. G/F superscripts are significantly quieter than the actual values. Individual perspective displays only that individual's normal value. Skipped completion is not itself a reason to discard an otherwise valid confidence reading.

The approved clarification retains existing centring, the 12px inter-slot gap and each state's existing intrinsic width; do not introduce fixed-width slots to equalise different numeric/missing states. All four set/unset combinations retain their current layout footprints. Quiet missing marks are paint only; actual numeric colour, font size, weight and positions remain unchanged. This treatment applies only to Group Card pairs, not personal confidence or individual Step readings/dashes.

## P9. Card back

Preserve the existing back layout, hierarchy and symmetry with the front.

- Add the existing style of progress marker beside each of the three Step titles. These markers are always read-only; progress editing stays on the front.
- Group: after the Step title show the same raw doing/done pair, followed by the existing marker, e.g. `Prepare  3  2  [marker]`. No denominator, words or punctuation. Hide counts when the Step has no eligible followers. Reordering must preserve title positions, heading heights, signal graphics/controls and the established back layout/scaling; do not compensate for conflicts with extra layout CSS.
- Individual: only that person's marker; no aggregate counts.
- The Card-level G/F pair appears only in the top header. Do not add Step-level G/F numbers beside individual Step headings. This approved iPhone-review correction supersedes the earlier per-signal aggregate requirement. Retain Step titles, progress markers, compact doing/done counts, existing signal graphics and existing signal-editing interactions. Group signal editing is admin-only; own signal editing is owner-only. Compact progress counts use the same neutral metadata treatment as the front.
- Group test indicators represent group-scoped tests. Personal test indicators/history are owner-only, including counts. Foreign payloads must not reveal their existence. Group assessment implementation and group-context assessment integration belong to Phase 5; do not present fake zero group test totals in Phase 4.

## P10. Owner-private content and source identity

An owner viewing their own follower perspective may see their existing personal target dates, private media, private Personal Info Cards, private reflection and personal tests associated with the same CardTemplate. These remain personal even when accessed through a Group Experience. Use a consistent small private/lock indication where appropriate. Group assignment must not set a personal deadline; existing dates persist and ordinary personal scheduling remains unchanged.

An admin or peer inspecting that person receives only explicitly permitted learning and group-scoped contributions. Private values, IDs, counts, timestamps/history and provider locators must be absent from the authorised response, not removed only in React. A group-only viewer without personal Deck membership still has their authoritative personal row; access must be checked against actual current context and ownership.

A group-scoped Info Card addressed only to its author is **not** a private Personal Info Card: group admins can inspect saved group contributions under their existing rules. Never label both as equivalent private content.

The same user can exceptionally have both a private reflection and a distinct group reflection for one CardTemplate. Preserve both sources. Editing one never overwrites or shares the other. Reuse small Add/Edit controls where feasible; exact later-phase coexistence treatment is not approved merely by this suggestion. Document the reason and permissions in eventual code comments and source-specific regression tests.

Media and Info Cards likewise retain their personal/group source IDs for editing, detaching and deletion. Phase 4 must establish typed ownership/capability interfaces, owner date presentation and privacy tests. Full owner/group media composition is Phase 7 after Phase 6 protection; group Info domain/UI is Phases 8–9; reflection coexistence/carousel is Phase 10; assessments are Phase 5. These deferrals do not negate the agreed final owner access requirement. Any proposed deferral of existing owner-private display in the early slice must be explicit in the engineering coverage map.

## P11. Removed followers

Only active followers appear in the compact picker, ordinary list and focused comparison grid or contribute to current aggregates. Removed followers never appear in ordinary perspective navigation.

Existing frozen historical learning remains available only under its admin rules. The eventual admin entry belongs inside a collapsed **`Removed / Left Group`** section of Group settings. This is a settings/history presentation dependency, not an extra everyday picker option. Do not reveal later personal learning through a frozen snapshot or restore snapshot values over live learning on rejoin.

## P12. Creation, settings and My Decks identity conventions

Agreed entry points are `Add as Group` on a publicly published Library Deck, and `Group…` in the existing Deck three-dot menu for administration. Settings use one full-screen modal with name, Admins, Followers and the single peer-visibility setting. No new management dashboard or Organisations/Groups system is implied.

Creation permits zero followers and returns to My Decks, not directly into the new Deck. The informal experience name appears in the tile's existing top-right attribution position; normal category remains top-left. My Decks summaries always use admin-controlled group progress/confidence, regardless of the remembered individual perspective. Restore perspective only when opening the experience. Personal and multiple group entries for the same Deck remain distinct; a dual-role member gets one experience entry.

The original Phase 4 was a seeded early slice; the subsequent creation/settings commission now authorises the full workflow below. Removed-history access remains deferred. Registered-user selection reuses the lightweight username directory; identity tiles use initials, not an assumed profile-photo system.

Checkpoint 8 is now authorised following accepted iPhone review. The full-screen form uses an alphabetical registered-user directory without search and a selected-identity Card grid. Admin and Follower selections are independent; the creator starts selected as Admin, not Follower. Keep all edits local until explicit Create/Save; Cancel discards unsaved edits. Visibility defaults Off. Creation returns to My Decks with the new Group first without reordering other entries or opening it. Editing uses one atomic Save for name, visibility and all roles: all changes commit or none do. Preserve draft selections on failure/conflict and resolve uncertain requests by exact retry. Successful self-removal is permitted if another Admin remains: return to My Decks if access is lost; otherwise preserve the existing mounted Deck context and valid Card, face and perspective. Removed-follower history remains deferred.

## P13. Data readiness, changes and failures

Use existing loading/error/retry conventions. A prepared perspective switches without waiting for another content request; an unprepared perspective must not display a new person's identity over the prior person's values. Rapid switching, Card traversal, adoption and account changes must discard obsolete responses. Pending writes remain bound to their original owner/group, Card, stable Step, version and membership context.

Recheck perspective authority after membership/visibility changes; clear revoked subject data and fall back appropriately. Restore only authorised selection. Preserve active Card/face through perspective changes; when actual Deck adoption removes the active Card, reconcile against the current composition without reviving historical navigation. Empty groups retain Group identity; empty Decks must not fabricate a focused Card. Absent confidence and zero eligible progress denominators follow P7–P9.

## P14. Verification and delivery boundary

Automate defaults/restoration, On/Off permissions, revocation, own/foreign privacy, all write/read-only rules, aggregates/nulls/skips/empty cases, expanded-grid persistence, dismissal/collapse, active Card/face continuity, gesture regressions, rapid-response races, shared learning and independent adoption. Inspect real DTOs and database projections, not only rendered elements.

Later iPhone review assesses motion quality, legibility, actual touch/scroll feel and browser viewport behaviour. Do not substitute manual checks for reliable automated assertions. Eventual implementation handoff supplies a working isolated phone-review URL and exact steps. No live data/provider configuration, deployment or real participant enablement is authorised by this planning task.

## P15. Approved implementation decisions — 30 October 2026

The initial Phase 4 slice is now authorised, with checkpoint 8 excluded and no production enablement. The implementation commission resolves the earlier questions:

1. Immediate fresh server denial, approximately five-second visible authority polling/lease, immediate local invalidation, focus/re-entry verification and hiding peer values when verification fails/expires. Previously downloaded bytes cannot be erased remotely; no realtime infrastructure.
2. Seeded disposable experiences for the initial slice and iPhone review. Full Add as Group/Group… creation/settings follows the first accepted phone review and precedes Phase 5; no temporary management UI.
3. Without peer inspection, tapping the compact picker opens named Group/self choices. Authorised All followers opens the focused grid or ordinary upward list. A sole Group identity stays visible and noninteractive.

All other product requirements above remain authoritative. Exact motion refinement belongs to the agreed iPhone review.
