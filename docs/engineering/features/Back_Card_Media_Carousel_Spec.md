# Back-card media carousel — functional and visual specification

## Purpose

Replace the current single, wide horizontal media rendering on the back of a focused card with a calm, portrait-friendly media strip. It must support an ordered list of image and video media items while preserving the card’s existing visual rhythm:

> media glimpse → three progress signals → weekly reflection

The strip is a physical part of the card, not an expandable media section or a separate gallery screen.

## Scope and non-goals

### In scope

- Render every existing media item attached to a user card.
- Support image and video items; videos render as poster/thumbnail previews.
- Display one, two, or up to three clear previews in the card itself.
- Let users swipe/drag through media when more than three items exist.
- Let users tap any visible media item to inspect it full-screen.
- Show conventional, practical navigation once an item is open.

### Explicitly out of scope

- Grouping several files into a submission or multi-page work item.
- Tags, media albums, version history, or linking an original upload to teacher feedback.
- Changing upload, deletion, storage, authorization, or persistence semantics.
- A collapsible media drawer, an in-card gallery view, carousel dots, or a numerical count on the card.

Teacher feedback may continue to replace an existing media item. The carousel only changes presentation and inspection.

## Information model

The component receives the card’s existing ordered `MediaItem[]`. No data-model migration is required.

Each item must expose enough existing data to render:

- a stable ID;
- media type (`image` or `video`);
- a thumbnail/poster source; and
- the full-resolution source or existing viewer/player inputs.

Use the existing ordering. Do not introduce grouping in this work.

## Card-level media strip

### General rules

- The strip is located in the current media position at the top of the card back.
- It is not a framed panel or a nested card.
- Previews use a portrait-biased crop and `object-fit: cover`; the opened viewer shows the complete asset.
- The established soft fade into the card surface is retained, particularly at the lower edge, so media leads naturally into the signals below.
- There are no permanent gallery controls, dots, count labels, or heavy borders.
- Image and video previews share the same visual frame. A video uses one small, unobtrusive play affordance.

### Layout by item count

| Item count | Layout |
| --- | --- |
| 0 | Preserve the existing quiet “Add media” state. |
| 1 | A deliberate solo composition: one larger portrait-biased preview, aligned to the card’s left-hand content grid rather than centred in empty space. |
| 2 | Two medium previews in the same media band. |
| 3 | Three clear previews, composed as one restrained strip. |
| 4+ | The same three-item visible composition, with swipe/drag navigation and overflow traces at the relevant edges. |

### Height and aspect treatment

The visual media area is responsive to item count, but only modestly:

- one item: about 20–30% taller than the three-item baseline;
- two items: an intermediate height;
- three or more: the baseline height, approximately the current strip height;
- swiping among four or more items never changes height.

Do **not** enforce an identical mathematical aspect ratio at every item count. Preserve a consistent portrait character instead. This allows the solo item to have enough presence without doubling the strip height or moving the signals too far down the card.

The precise CSS dimensions should be responsive tokens/clamps, not hard-coded device pixels. The first visual pass should test `4:5` and `3:4` portrait-biased previews.

### Visual hierarchy

All visible items are clear, active and directly tappable.

The item closest to the centre may be the compositional focal point, but only subtly. Central emphasis may come from position, a tiny scale variation (maximum about 4%), or slightly higher opacity. It must never make adjacent items look blurred, disabled, unavailable or merely decorative.

The calmness comes from limiting the visible set, generous spacing and edge/lower fades—not from hiding two of the three items.

## Overflow behaviour

For four or more items, the media is a continuous physical strip.

- Mobile: swipe horizontally within the media area.
- Desktop: horizontal pointer drag and trackpad scrolling; minimal previous/next controls may appear only on hover or keyboard focus where needed for discoverability/accessibility.
- A normal tap/click opens the touched item immediately.
- A drag above the standard movement threshold is treated as a swipe and must not open an item.
- Snap movement should be direct and gentle, not a crossfade, a reorder, or a change of view.

### Overflow cue on the card

Do not show `2 / 5`, carousel dots or a `+2` badge on the card.

Instead, if additional items exist beyond the three-item window, reveal a narrow trace of the actual next or previous item at the applicable edge:

- next item available: a small real-media sliver at the right edge;
- previous item available: a matching sliver at the left edge;
- both are shown when the user is in the middle of the ordered list;
- the sliver fades into the existing edge mask.

This is both a discoverability cue and an object-continuity cue: the user sees that another photograph/video physically continues beyond the visible card area. It is not a generic decorative line.

## Opening an item

Tapping any visible image or video opens it immediately. There is no “tap once to focus, tap again to open” behaviour.

The opened media view is the expected inspection state, not an expanded card-media section:

- image: full asset, uncropped, with appropriate zoom/pan where currently supported or feasible;
- video: the existing video player at a useful viewing size;
- navigation: swipe/arrows between every item in the card’s media list;
- filmstrip: conventional thumbnail rail along the bottom;
- count: an exact indicator such as `2 of 5` is allowed here, because the user has explicitly chosen to browse media;
- close: returns to the same focused card and the same carousel position.

## Motion and continuity

- Media list changes may animate gently between the one-, two- and three-item compositions.
- Adding a second item should make the solo item settle into its new position rather than abruptly transform.
- The card itself must not flip, collapse, or become a different layout mode.
- Swipe motion is transform-based and does not reflow the rest of the card.
- Respect reduced-motion preferences.

## Accessibility and resilience

- Every preview has an accessible name identifying media type and position where useful.
- Video previews announce that they are videos.
- Keyboard users can open visible items and navigate overflow on desktop.
- The media strip’s horizontal gesture must not interfere with the separate horizontal progress-signal controls below it.
- Failed/absent thumbnails must preserve layout using the existing fallback treatment.
- Lazy-load off-screen media where appropriate; avoid downloading full-resolution assets solely for card previews.

## Acceptance criteria

1. A focused card with one uploaded portrait image looks intentional and substantial, not like a centred orphan thumbnail.
2. Two items form a calm pair; three items remain individually clear and tappable.
3. Four or more items are discoverable through real-media edge traces and can be reached by swiping/dragging.
4. The card has no numeric count, dots, `+N` badge, collapsible media panel or tap-to-focus requirement.
5. Tapping any preview directly opens that exact item.
6. Opened media has conventional filmstrip/count navigation and returns to the same card/strip position on close.
7. The signal controls and reflection remain visually subordinate to neither an oversized single preview nor a busy thumbnail gallery.
8. Existing upload, deletion, persistence and media authorization behaviour remains unchanged unless a defect is separately identified.

# Codex implementation phases

Each prompt below is intentionally bounded. Paste one phase at a time, review its report and manually test before beginning the next.

## Phase 0 — current-state audit only

```text
Before changing code, investigate the current focused-card back media implementation and report a concrete implementation plan for the media-carousel specification below. Do not edit any files in this phase.

Find:
1. the focused card-back component that currently renders only one image/video;
2. the exact media item type and how a card’s ordered media list is obtained and persisted;
3. existing image/video thumbnail, full-screen/lightbox, and video-player components that should be reused;
4. existing gesture, carousel, Framer Motion, accessibility and test patterns in this repository;
5. whether tapping a media item already opens it, and how close/return state works.

Constraints for the eventual feature:
- Do not change uploads, deletion, storage, permissions, persistence or the media data model.
- Do not add grouping, tags, versions, a collapsible media section, dots, a card-level count, or a tap-to-focus step.
- Card previews will show one, two, or three clear items; more items are reached by horizontal swipe/drag.
- Tapping any visible item must open it directly.

Return:
- files/components to change and why;
- existing code to reuse;
- risks or ambiguities that need a decision;
- a phase-by-phase implementation plan matching these constraints.
Do not implement anything yet.
```

## Phase 1 — static presentation layer

```text
Implement only the static card-back media presentation layer from the approved media-carousel specification. Do not implement swiping, a new full-screen viewer, or any upload/data-model changes in this phase.

First, inspect the existing focused card-back media renderer and reuse the existing MediaItem type, thumbnail generation and media-opening callback. Extract a small, testable presentational component if that makes the behaviour clearer.

Required static states:
- 0 items: preserve the existing quiet “Add media” state exactly.
- 1 item: render a deliberate solo portrait-biased preview aligned to the card’s left-hand content grid. It must be substantially larger than a three-item preview and must not look centred and orphaned.
- 2 items: render a calm medium-sized pair.
- 3 or more: render the first three clear portrait-biased previews as one restrained strip.

Visual constraints:
- Keep media integrated into the card, not inside a new panel/card/gallery grid.
- Preserve the current soft lower fade into the progress signals.
- Use cover crops for previews; do not try to show every asset uncropped here.
- Use the same frame treatment for image and video thumbnails; give videos one restrained play affordance.
- All visible items must be equally tappable. Do not implement click-to-focus, blur, heavy scaling, dots, counts, +N badges, arrows or a collapsible section.
- The one/two/three layouts may have modestly different heights: solo about 20–30% taller than the three-item baseline, two intermediate, three+ baseline. Do not force exact identical aspect ratios across these states.
- Do not change upload, deletion, persistence, authorization, media APIs or existing full-screen behaviour.

Add focused tests for the 0, 1, 2 and 3+ rendered states using existing test conventions. Run the relevant tests, lint/typecheck if available, and report changed files, test results and a manual visual-test checklist. Stop after this phase.
```

## Phase 2 — overflow strip and direct interactions

```text
Implement the interaction layer for the card-back media strip. Build on the existing static one/two/three-item presentation; do not redesign uploads, the data model or the opened-media viewer in this phase.

Required behaviour:
- If a card has 0–3 items, retain the static layouts from Phase 1.
- If it has 4 or more items, present a continuous horizontal strip with at most three substantial visible previews.
- Swiping on touch, pointer-dragging on desktop, and appropriate trackpad interaction move through the ordered media list with gentle snap behaviour.
- A normal click/tap on ANY currently visible item must call the existing open-media behaviour for that exact item immediately. There is no preliminary “focus” tap.
- Use a conventional movement threshold so a drag does not accidentally open media.
- Keep the card’s media-stage height stable while moving through four or more items. Swipe transforms must not reflow the signals or reflection below.
- When additional items exist to the left/right, show a narrow, faded sliver of the real neighbouring item at that edge. Do not use carousel dots, numeric indicators, +N badges or permanent arrows.
- At the beginning/end, show overflow only on the direction that exists.

Interaction and accessibility constraints:
- The media gesture must not interfere with the horizontal signal controls below it.
- Preserve vertical page/card scrolling.
- Where required for desktop discoverability and keyboard access, minimal previous/next controls may appear only on hover or focus; keep them absent in the resting mobile design.
- Respect prefers-reduced-motion.
- Do not change upload, deletion, persistence, media APIs or authorization.

Add tests for overflow direction cues, direct open-on-tap, drag-versus-tap behaviour and stable layout state. Run relevant tests and report manual cases to test on touch and desktop. Stop after this phase.
```

## Phase 3 — opened-media inspection view

```text
Implement or adapt the existing opened-media experience so it supports browsing the full ordered list of media attached to the current card. Reuse existing lightbox/dialog/video-player code where possible. Do not alter the card-back strip behaviour, uploads, deletion, persistence or media data model.

Required behaviour:
- Tapping an item in the card strip opens that exact image/video.
- Images are shown uncropped at a useful size; retain or add sensible zoom/pan only if it fits existing project patterns.
- Videos use the existing player at a useful viewing size.
- The inspection view offers conventional previous/next navigation across all media items on the card.
- Add a restrained thumbnail filmstrip along the bottom of this opened view.
- An exact position indicator such as “2 of 5” is allowed here.
- Closing returns to the same focused card, with the card-media strip at the same scroll/index position it had before opening.
- Keyboard focus, Escape/close behaviour, accessible labels and focus restoration must follow existing dialog conventions.

Do not create a collapsible media section inside the card and do not add a count, dots or gallery chrome to the resting card back.

Add tests for opening the selected item, filmstrip navigation, video/image handling and return-state restoration. Run relevant tests and report changed files plus manual test cases. Stop after this phase.
```

## Phase 4 — motion, responsive polish and verification

```text
Finish the card-back media-carousel feature with visual polish, responsiveness and verification. Do not broaden scope into media grouping, tags, version history, upload redesign or server/API changes.

Review the implemented states against these requirements:
- One item is a purposeful larger, left-grid-aligned solo composition—not a small centred orphan.
- Two items form a calm pair; three items remain clear, directly tappable and visually integrated.
- Any central emphasis is extremely subtle; adjacent items must never look disabled, blurred or unavailable.
- One/two/three layouts have only modest height variation. Four or more items remain at the three-item baseline height while swiping.
- The lower media fade continues the visual flow into the three signals and then the reflection.
- Overflow is conveyed by real-media edge traces, never by dots, a card-level count or +N text.
- Animation is gentle and physical: list-size changes may settle between layouts, but carousel movement does not crossfade/reorder/reflow the rest of the card.
- The design works at the supported mobile widths and desktop focused-card widths, including portrait and landscape source media.
- Reduced-motion, keyboard interaction, focus states, error/thumbnail fallbacks and image-loading behaviour are sound.

Use the project’s existing visual/test workflow. Add or refine only tests that protect the specified behaviour. Run the relevant test suite, lint/typecheck and any available build. Report:
1. changed files;
2. exact commands and results;
3. any remaining limitations or decisions that genuinely require product input;
4. a concise manual test checklist.
Do not make unrelated cleanup changes.
```
