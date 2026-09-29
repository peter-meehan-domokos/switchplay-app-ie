Implement the complete card-back image and video viewer described below, including image zoom and downloads.

Use your earlier investigation as a starting point, verify its findings against the current code, and carry the work through implementation, relevant testing, and a final self-review in this run. Make routine implementation decisions yourself within this specification.

First save this specification in the repository’s appropriate feature documentation location. Then implement it without waiting for another approval between phases. Preserve unrelated work. Leave changes uncommitted and do not deploy.

## 1. Required experience

The card back currently shows up to five media thumbnails. Its complete `backMediaItems` array can contain any number of R2 images and Cloudflare Stream videos in any mixed order.

- Tapping a thumbnail opens the viewer on that exact item.
- Opening must work from both the deck stack and the focused card wherever those thumbnails are interactive.
- The viewer covers the application viewport.
- Navigate through the complete array in its existing order, including items beyond the fifth.
- Show one selected item at a time.
- Preserve the thumbnail row’s existing appearance and five-item limit.
- Closing returns to the same underlying card state and scroll position.

Do not introduce editing, deletion, reordering, or a thumbnail filmstrip inside the viewer.

## 2. Visual design

Build a restrained, polished gallery optimised for phones and also usable on desktop.

- Use an opaque or nearly opaque dark neutral background.
- Provide a stable top toolbar: clear close control, position indicator such as `3 of 8`, and download control.
- Keep toolbar controls visible and reachable while viewing, playing, or zooming.
- Use existing icon and typography conventions, with accessible labels and touch targets of at least 44 × 44 CSS pixels.
- Fit the entire image or video into the remaining media area, preserving aspect ratio. Do not crop content.
- Support portrait, landscape, square, very tall, and very wide media.
- Provide previous/next buttons in consistent locations clear of video controls. Mobile users must be able to navigate without swiping.
- Disable unavailable directions at the ends; do not wrap. Hide unnecessary navigation for a single item.
- Account for mobile safe areas, changing browser viewport height, and device rotation.

Use a short entrance/exit animation: approximately 180–250 ms backdrop fade with a modest content fade/scale or vertical movement. Respect reduced motion. Do not implement a complex thumbnail-to-viewport expansion in this version.

Navigation should feel smooth without retaining two mounted video players. Stop playback immediately on close, even if the empty shell continues its exit animation.

## 3. Image zoom

Image zoom is required, particularly for photos of handwritten work.

- Initially fit each image within the viewer.
- Support pinch to zoom on touch devices and double-tap to zoom/reset.
- Provide accessible zoom-in, zoom-out, and reset controls so zoom is usable without gestures.
- Support panning when zoomed, with sensible bounds.
- Use a practical maximum zoom, approximately 4× the fitted size.
- While zoomed, dragging pans the image and must not navigate the gallery.
- At the fitted size, horizontal swipes may navigate the gallery.
- Multi-touch interactions must never accidentally navigate.
- Reset zoom/pan when changing items or reopening the viewer.
- Recalculate bounds on viewport changes; resetting to fit on rotation is acceptable.
- Scope gesture handling to the image surface. Do not globally disable browser zoom or intercept toolbar interaction.

Use existing project dependencies if suitable. Avoid introducing a new library unless it materially improves reliability; explain any addition.

## 4. Video behaviour and reuse

The investigation identified `CloudflareHlsVideoPlayer` as a suitable candidate because its declarative `mediaItem` path reportedly loads with `shouldPlay: false`. Verify that before reuse.

Prefer a small viewer-specific wrapper using that existing path.

- Every selected video starts paused and requires a user tap to play.
- This applies on initial opening, video-to-video navigation, image-to-video navigation, and revisiting a previously played video.
- Revisiting a video starts from the beginning.
- Use usable playback controls, including seeking, and inline playback on mobile where supported.
- Mount only the selected video, keyed by stable media ID.
- Pause/reset and release the previous video immediately on navigation, close, or unmount.
- Clean up HLS instances, event listeners, timers, and pending work.
- Do not keep an outgoing video mounted for a transition.
- Check whether a deck/introduction player could remain playing behind the viewer. If so, pause it through the existing scoped playback mechanism. Do not automatically restart it on viewer close or indiscriminately pause every video in the document.

Preserve existing deck/step autoplay, playback continuation, and iOS handling. Do not change existing defaults or call-site behaviour to accommodate the viewer.

If a shared player needs an additional capability, prefer a narrowly scoped optional prop/callback that preserves behaviour when omitted. Explain and test any shared-player modification. Avoid a broad player refactor.

Loading and error handling must reflect actual media readiness. The investigation found that the existing “renderable” callback may fire during setup; do not treat it alone as successful playback readiness. A video awaiting a play tap must not show an endless loading spinner.

## 5. State and integration

Use the inspected component tree to implement the following approach:

- `DeckDetail` owns viewer open state and the selected card/item identity.
- Pass an opening callback through the relevant card components to the thumbnail row.
- Use stable media IDs to select the item; do not derive viewer contents from the five-item thumbnail slice.
- Resolve selection against that card’s complete current media array.
- Preserve selection when items are appended or reordered.
- If the selected item disappears, select the nearest remaining position; close if the array becomes empty.
- Clean up when the owning deck/card disappears or the route changes.
- Avoid briefly displaying the first item before the tapped item.

Keep the DOM element used for focus return in a ref rather than persisted application data.

Render the viewer through a body portal, outside card clipping and transforms. Use the existing layering conventions to place it above the deck.

Make thumbnails accessible buttons without altering their established layout. Inspect existing ancestor click, pointer, keyboard, and gesture handlers, including capture handlers where relevant. Opening the viewer must not also focus, flip, or traverse the card.

React portal events can still reach React ancestors: isolate viewer events appropriately without breaking its own controls.

## 6. Modal, keyboard, and touch behaviour

- Give the viewer an accessible name and modal semantics.
- Move focus into it on opening and contain focus while open.
- Restore focus to the originating thumbnail on close if it still exists; otherwise use a suitable visible card control.
- Escape closes the viewer. Respect native fullscreen behaviour if the video enters browser fullscreen.
- Left/right arrows navigate where appropriate, without overriding native playback controls or other controls using those keys.
- Make the background inert and prevent background scrolling/gestures.
- Preserve and restore prior inert/scroll styles correctly, including if the viewer opens over an already focused card with its own scroll lock.
- Retain background isolation until the viewer has actually finished closing.
- Do not open over an active editor or stack conflicting modal focus traps.

Support horizontal gallery swipes with distance and direction thresholds. Ignore predominantly vertical movements and cancelled gestures. Avoid accidental taps after dragging.

Protect native video controls. Do not place an invisible swipe layer over the player. If swipe is unavailable over the video surface, the visible navigation buttons must provide an easy alternative.

## 7. Downloads

Every accessible media item must have a working download action.

### Images

Download the stored full image, preserving its format and using a sensible filename. Do not download the thumbnail or a screenshot of the viewer.

Do not rely solely on a cross-origin anchor’s `download` attribute. Use a reliable response or URL with appropriate download headers, consistent with the project’s R2 setup.

Avoid changing stored image response headers globally in a way that breaks inline image display.

### Videos

Download the Cloudflare Stream encoded MP4. Do not describe it as the original uploaded file.

Inspect the current Cloudflare integration and verify the download API against official documentation.

- Reuse an existing prepared download where available.
- If needed, request MP4 generation server-side.
- Show a clear preparing state and poll with bounded retries/backoff.
- Distinguish stream-playback readiness from MP4-download readiness.
- Prevent repeated clicks from launching duplicate preparation work.
- Provide useful failure and retry states.
- Once ready, start the download where supported and provide an explicit “Download ready” action as a fallback, particularly for mobile browsers that require a fresh user gesture.
- Do not claim the file was saved merely because a URL was generated or a browser download was initiated.
- Deliver the prepared video directly from Cloudflare where possible; avoid buffering a large video in browser memory or proxying the whole file through the application server.

Keep preparation state tied to the requested media ID. A late response must not update another item or trigger an unexpected download after navigation/close. Cancel obsolete client polling; preparation already running at Cloudflare may continue. A later request should discover and reuse it.

### Access control

Use the application’s existing access model for the actual card media record.

Authorised viewers of those media items may download them. However, access to a shared deck template must not be assumed to grant access to another user’s private card uploads. Trace the ownership and sharing model before implementing shared access.

For new endpoints:
- authenticate and verify access to the requested card and media item;
- resolve asset IDs, R2 keys, and delivery URLs from trusted persisted data;
- do not accept arbitrary storage keys or upstream URLs from the client;
- keep credentials server-side;
- follow existing request validation and CSRF/origin protections;
- use appropriate HTTP methods for preparation versus status reads.

The existing Stream status endpoint may only recognise the owner’s data. Handle legitimately shared media correctly without broadening upload permissions or exposing unrelated user data.

Report missing Cloudflare permissions or configuration precisely. Implement all unaffected work and do not silently substitute a nonfunctional download button.

## 8. Loading, errors, and race conditions

Handle:
- slow and failed image requests;
- failed poster images;
- Stream processing, playback failure, and retry;
- download preparation failure or timeout;
- expired authentication or revoked access;
- rapid next/previous taps and repeated opening/closing;
- selection changes while media loads;
- item removal or an empty array;
- component unmount and viewport changes.

Keep close and navigation available during loading/errors. Failed media must not trap the user or disrupt the array’s order.

Key or cancel async work so stale events cannot change the currently selected item’s state. Reset item-specific errors on selection changes.

Load only the active full-size media/player; do not preload the entire collection.

## 9. Code quality and regression boundaries

Follow the project’s functional React/TypeScript style.

- Use immutable data transformations and functional state updates when needed.
- Prefer pure helpers for selection, bounds, and other calculations.
- Separate responsibilities sensibly: viewer shell/navigation, image zoom, video integration, and download handling.
- Keep effects necessary for playback, networking, focus, and scrolling explicit, local, and fully cleaned up.
- Avoid side effects during render, mutation of props/shared arrays, unnecessary duplicated state, and monolithic components.
- Use CSS modules or clearly viewer-scoped selectors. Do not introduce broad global rules.
- Preserve existing public component behaviour and defaults.
- Make the smallest integration changes necessary; avoid unrelated refactoring.
- Preserve existing upload/removal functionality and card state.

Do not promise zero regressions. Demonstrate the protections through scoped changes and relevant checks.

## 10. Implementation and verification

Work in manageable internal steps, but continue through the entire feature without stopping for approval after each one.

Inspect the starting branch/worktree and existing test setup. Preserve unrelated changes and distinguish pre-existing failures from failures introduced by this work.

Use focused automated checks for meaningful risks, including:
- exact clicked-item selection and full mixed-array order beyond five;
- bounded navigation and selection after removal;
- tap-to-play and stopping on close/navigation;
- obsolete async responses and cleanup;
- download preparation, retry, and media-specific state;
- authorised and unauthorised media access;
- existing player behaviour where shared code changes.

Perform browser checks where the environment supports them:
- open from deck stack and focused card;
- phone and desktop layout;
- portrait/landscape assets;
- close/download/navigation visibility;
- image zoom/pan and gesture conflicts;
- video seeking and control interactions;
- keyboard/focus/background isolation;
- real image and video downloads if authorised test assets and service access are available.

Use a mixed collection with at least eight items, including adjacent videos, plus single-item and failing-item cases.

Run the relevant existing tests, type checks/build, and diff checks. Review the final diff specifically for unintended shared CSS, playback, permission, and state changes. Fix issues caused by this implementation.

Do not spend the run repairing unrelated pre-existing failures. Do not claim iOS or real Cloudflare verification based solely on mocks or desktop emulation.

## 11. Final handoff

Leave changes uncommitted and provide:
1. What was implemented and where the specification was saved.
2. Any deviations and their reasons.
3. Shared components/functions changed and how existing behaviour was protected.
4. Checks run and their actual results.
5. Which playback/download checks were live, mocked, or not possible.
6. Any required configuration or unresolved blocker.
7. A short prioritised manual test checklist for me.

The target is a complete working viewer, including mixed-media navigation, image zoom, tap-to-play videos, smooth presentation, and downloads. Report incomplete requirements explicitly.