# Info Card Improvements — Engineering Plan

**Status:** Updated with approved product decisions D0–D10 (12 November 2026). Awaiting review before implementation. Nothing in Phases 2–4 has been implemented.
**Specification:** [Info Card Improvements — Product Specification and Engineering Planning Brief](../../../design/features/group-experience/info-cards-integration-spec.md)
**Branch:** `feat/group-experience`

This plan turns the specification into checkpoints. It keeps the specification's phase boundaries and numbering (checkpoints 5–10, then Phase 4). The approach is proportionate to an MVP with few trial users and no published Info Cards needing backward compatibility: no feature flags, no new services, no large refactors.

- Approved decisions are recorded in [section 6.1](#61-approved-decisions).
- Open questions are in [section 6.2](#62-open-questions) and referenced inline as **Q1**, **Q2** and so on. They match the specification's open product questions.

---

## 1. Current implementation assessment

### 1.1 Phase 1 — implemented, manually accepted and pushed

| Item | How it was done | Where |
| --- | --- | --- |
| 1. Merge `main` | Merged `origin/main` into the branch, reconciled conflicts, then independent review corrections and a merge handoff. | `6abeda4`, `4212690`, `0cb5ee5`, `20c7d67`; [merge handoff](merge-main-into-group-experience-HANDOFF.md) |
| 2. Decks and Creator recovery | Verified only. Creator upload recovery from `6176ce8` was confirmed present after the merge; its browser spec passes 4/4. | No new code |
| 3. Preview media uploads | Cloudflare R2 CORS policies for `path-assets` and `path-user-data` updated to add the stable Preview origin while keeping existing origins. | Cloudflare only; no Git change |
| 4. Personal Info Card creation and recovery | **Series dropdown:** the Personal editor uses an in-page listbox instead of a native `<select>`; the Creator editor keeps the native select. **Form fields:** the dialog focus-retention hook checked focus in a microtask, which stole focus back during a native tap; it now waits one task. **Upload recovery:** the chosen file is kept after failure, with Retry upload and Cancel upload; network failures are classified as transfer failures; leaving is blocked with an accurate message; stale messages are cleared. **Index:** the non-unique `users` index `cardsData.personalInfoCardIds_1` was installed in the shared Atlas database with `scripts/setup-info-cards.ts`. Readiness checks pass and a before/after snapshot showed no other change. | `d31edeb`, `13ab03a`; Atlas index |

### 1.2 Git state

- `feat/group-experience` is at `13ab03a` and matches `origin/feat/group-experience`. All Phase 1 code is pushed.
- The specification and this plan are committed together as one documentation commit (D0), and are not pushed.

### 1.3 Environment facts that affect every checkpoint

- Local development, Preview and production all use the same production Atlas database `switchplay` (`SWITCHPLAY_DATABASE_MODE=production` in `.env.local`). **Any write from a local dev server or phone is a production write.**
- Automated tests never touch Atlas. They run against disposable in-memory replica sets through `scripts/test-phase2.ts` (browser) and the `*.integration.ts` suites.
- Manual iPhone review of unfinished work should use the disposable review runner rather than `npm run dev`.

---

## 2. Architecture and dependencies

### 2.1 Info Card presentation

| Concern | Module | Notes |
| --- | --- | --- |
| Card face | [InfoCardFace.tsx](../../../../src/components/info-cards/InfoCardFace.tsx), [InfoCardFace.module.css](../../../../src/components/info-cards/InfoCardFace.module.css) | Fixed `height: 204px`, `padding: 12px 12px 60px`, `box-sizing: border-box`. Header is 33px (12px top padding, about 12px line, 9px gap); text area 109px; the footer reserve is 60px and holds the media button, creator credit (24px) and three-dot menu (32px). Creator colour is a `#303947 → #252d39` gradient; Personal is currently `#263b36`. The only type flag is `personal`. |
| Stack | [InfoCardPhysicalStack.tsx](../../../../src/components/info-cards/InfoCardPhysicalStack.tsx) | Renders up to **two generic backing strips** (`stepStyles.backing`, flat `#2c3543`) whatever the upcoming cards are, plus only the current card and, during a turn, the next card. |
| Step View geometry | [StepView.module.css](../../../../src/components/decks/StepView.module.css) | `.preview` places the stack at `left/right: 6px; bottom: 15px`; `.backing` offsets are −3px and −6px. |
| Consultation dialog | [InfoCardConsultation.tsx](../../../../src/components/info-cards/InfoCardConsultation.tsx) | Full-screen transparent native modal. The empty state is a full card-sized `.empty` box (240 × 204) with a "+" button and a × Close button. Opening and closing animations live in `InfoCardPhysicalStack`. |
| Pouch | [InfoCardPouch.tsx](../../../../src/components/info-cards/InfoCardPouch.tsx) | Shown with zero cards only when `allowEmpty` (Personal context). |
| Focus handling | [useInfoCardDialog.ts](../../../../src/components/info-cards/useInfoCardDialog.ts) | Shared by both editors, the consultation and the media viewer; fixed in Phase 1. |

### 2.2 Info Card content and capacity

- **New Info Cards are always maths-format** (`bodyFormat: "latex-v1"`): the editor controller sets it for every new card. The plain-text path survives only for legacy test cards.
- **Maths cards** render through the shared [MathsRenderer](../../../../src/components/maths-renderer/MathsRenderer.tsx), using the parser in [parseContent.ts](../../../../src/components/maths-renderer/parseContent.ts).
  - Fit is measured in the browser by [infoCardMaths.ts](../../../../src/components/info-cards/infoCardMaths.ts) against the header and the footer's top edge.
  - The server's Chromium rendering check mounts the **same `InfoCardFace`** through [/internal/info-maths](../../../../src/app/internal/info-maths/Host.tsx), so face changes reach the server check automatically.
  - At publish, the server runs only a syntax check (`prepareContent`).
- **Legacy plain-text cards** are measured by the server-side model in [capacity.ts](../../../../src/lib/infoCards/capacity.ts), using fixed constants (`innerHeight: 131`, `mediaHeight: 36`, …) derived from the 204px face.
- **Renderer behaviour relevant to checkpoint 9:**
  - Display maths is forced to `text-align: left` with a 1em indent.
  - Any run of blank lines is collapsed into one paragraph break: `split(/\n[ \t]*\n(?:[ \t]*\n)*/)`.
  - Info Cards are its only production consumer; `/dev/maths-renderer` and `/dev/maths-fonts` also use it. D4 forbids changing it.

### 2.3 Info Card media and publishing

- **Editor and controller:** [InfoCardEditor.tsx](../../../../src/components/info-cards/InfoCardEditor.tsx) and [infoCardEditorController.ts](../../../../src/components/info-cards/infoCardEditorController.ts).
  - Autosave is debounced at 250ms.
  - `ensureCreated` → `PATCH` drafts → `publish` (Creator) or `save` (Personal).
  - A `sessionStorage` journal records submitted commands for recovery.
- **Upload:** [infoCardUpload.ts](../../../../src/components/info-cards/infoCardUpload.ts). Images use a presigned R2 PUT; videos use a Cloudflare Stream direct upload. Info video items do not reliably store `width`/`height`.
- **Video status:** [useInfoVideoStatus.ts](../../../../src/components/info-cards/useInfoVideoStatus.ts) polls `GET /api/info-cards/:id/media/status` every 2s while processing.
- **Media section today:** up to eight independently conditional elements:
  - a file input, or a disabled placeholder button;
  - an "Image attached" or "Video attached" line;
  - an uploading status;
  - Retry upload, Cancel upload and Remove media buttons;
  - an upload error;
  - a video status, plus a video error.
- **Publish:** `publishVersion` in [repository.ts](../../../../src/lib/infoCards/repository.ts) calls `mediaSecurity.assertReady` **before** publishing.
  - Stream video must be `readyToStream`; otherwise `INFO_MEDIA_NOT_READY_OR_UNPROTECTED`.
  - R2 images are verified immediately, so only **video** can be "still processing".
- **Background mechanisms:** none. There are no Stream webhooks, no Vercel cron jobs (`vercel.json` has none) and no queues.

### 2.4 Info Card attachment viewer (portrait video bars)

- Tapping an Info Card's video opens [InfoCardMediaViewer.tsx](../../../../src/components/info-cards/InfoCardMediaViewer.tsx), a full-screen dialog. Remote publications open through [InfoCardRemoteMediaViewer.tsx](../../../../src/components/info-cards/InfoCardRemoteMediaViewer.tsx).
- The video is wrapped in `mediaStyles.videoArea` from [CardMediaViewer.module.css](../../../../src/components/media/CardMediaViewer.module.css). The player shell is stretched to `width: 100%; height: 100%` with `object-fit: contain`.
- The shared player (`.cloudflare-stream-player` in `globals.css`) has a near-black background `#05070a`.
- **Cause, by inspection:** a portrait video is contained inside a box the size of the whole viewer. On an iPhone the viewer is taller relative to its width than a 9:16 video, so the remaining height is painted near-black above and below.
- The previous Step View investigation (all intro videos store portrait dimensions) was about Card introductions and does not apply here.

### 2.5 Personal media and reflections in Group Experiences (D7 investigation)

The authoritative rules are in the [Group Experience engineering plan](group-experience-engineering-plan.md) §11 ("Option B", approved 2 November 2026).

**Storage:**

| Content | Personal origin | Group origin (created inside a Group) | Group-owned |
| --- | --- | --- | --- |
| Media | `users.cardsData[].mediaItems` (CardData) | `groupMediaContributions`: author-owned, immutable `experienceId` + `cardTemplateId` origin, `groupVisible` (default `true`) | None |
| Reflection | `CardData.reflection` | `groupReflections`: unique `(authorUserId, cardTemplateId, experienceId)`, `groupVisible` (default `true`) | Collective reflection on `groupCardData` `(experienceId, cardTemplateId)`, edited by all current admins |
| Personal Info Cards (today) | `cardsData[].personalInfoCardIds` + `infoCards` roots (`kind: "personal"`) | Not supported | None |

**Visibility by perspective:**

| Perspective | Media | Reflections |
| --- | --- | --- |
| Ordinary personal Deck | Owner's personal media plus all their Group-origin uploads for that Card, unlabelled | Personal reflection |
| Owner's own Card within Group X (Me) | Owner's whole history; anything not currently shared with Group X is marked **Private** | Owner's Group X reflection only |
| Group perspective | Only contributions currently shared with Group X, from any member | Collective note plus visible member contributions |
| Admin inspecting a follower | Only that follower's contributions currently shared with Group X | Only that follower's visible Group X reflection |

**Permissions:**
- The author deletes their own content from any context.
- A Group admin can only **hide** content from the Group. Hiding is not deletion.
- Foreign reads are narrow and visibility-filtered.
- Admin-only users may have no CardData.

**Findings that matter for Info Cards:**
1. **Group-origin content is shared by default.** Under the established pattern, a member's media or reflection created inside a Group is a separate record shared with that Group. Applying that literally to Personal Info Cards would make them shared Group content. That conflicts with the specification ("private to their owners", "follow the user's CardData", "must not automatically become shared Group content"). **Q1.**
2. **Personal-origin content never leaves the owner's own views.** Personal media and reflections do not appear in the Group perspective or when an admin inspects a follower. This gives a consistent rule for Personal Info Cards. **Q2.**
3. **There are two Group-content patterns.** Media has no Group-owned item, only author-owned contributions. Reflections have the collective Group note, owned by the Group and edited by all admins. D9 ("belong to the Group context, not to the admin's personal CardData") matches the **collective reflection** pattern. **Q3**, **Q4**.

These are reported rather than resolved, as D7 requires.

### 2.6 Group Experiences and Info Cards today

- Group Cards are `ExperienceCardPresentation` (`surface: "experience"`).
- In `FocusedCardView`, `personalEnabled` requires `hasPersonalCard(card)`, which is false for any presentation with a `surface`. **Personal Info Cards are absent in every Group perspective today.**
- Group Cards carry canonical `infoCardIds`, and the consultation requests them in canonical mode, so Creator Info Cards are expected to appear in Groups. No Group browser test covers this.
- **Server:** `createPersonal` and the first `savePersonal` validate the Card through `consultationCardVersion(..., { mode: "working", deckTemplateId, version })`. That requires the user's own non-archived `decksData` membership for the Deck, with a matching working version. A Group follower may not hold the Deck personally, and the Group's pinned version may differ.
- **Storage is version-independent:** `users.cardsData[].personalInfoCardIds` is keyed by `cardTemplateId` only, which satisfies D8 as it stands.
- **Group Info Cards:** the earlier Group plan §11.3 and Phases 8–9 designed a large `kind: "group"` model with per-member audiences, audience epochs and private per-editor drafts. None of it is implemented. Section 3 proposes a much smaller model (**Q6**).

### 2.7 Project conventions applied

- **Layout pipeline rule** ([.claude/CLAUDE.md](../../../../.claude/CLAUDE.md)): new presentational logic goes into small pure `*Layout.ts` modules with `build…Layout` functions. Existing components are not refactored beyond the checkpoint's scope.
- Immutable data, D3 where aggregation is needed, no in-place mutation.

---

## 3. Checkpoint-by-checkpoint plan

Every checkpoint follows the execution strategy in [section 8](#8-execution-strategy).

### Phase 2 — Improve the Info Card experience

#### Checkpoint 5 — Card height, stack and colours

**Approach:**

1. **Type and colour.** Introduce one Info Card type, `"creator" | "personal" | "group"`, derived from existing data. Today that is the `personal` flag; `group` arrives in Phase 4B.
   - Add `infoCardTypeLayout.ts` with `buildInfoCardTypeLayout(type)`. It returns the face class, strip colour and type label.
   - Colours as specified: Creator keeps the slate gradient, Personal changes from `#263b36` to `#305047`, and Group is `#147D6C` with white text (`#FFFFFF` for all text on the face, including secondary text).
   - Measured contrast: light text `#c9d0da` on `#305047` is 5.7:1; white on `#147D6C` is 5.0:1. Both pass WCAG AA for the small 8.8–9.5px card text. Tinted secondary text on teal (for example `#d9f2ec`, 4.3:1) would fail, so it is not used.
   - **Not by colour alone:** add a short type label to the focused card's footer (for example "Personal" before the credit; a Group label in Phase 4B). The exact wording is part of the visual review. Strips are too small for text, so they are a supplementary cue only.
2. **Strips.** Add `infoCardStackLayout.ts` with `buildInfoCardStackLayout(cards, index)`.
   - It returns up to **four** upcoming cards (wrapping, excluding the current one) as strips `{ id, type, offsetY, inset }`, each revealing about **5px**.
   - `InfoCardPhysicalStack` renders these instead of the two generic `backing` divs.
   - Turn, drag, open and close keyframes are unchanged; the existing "settle" nudge applies to every strip.
   - The strips sit in existing space above the card, so the Step View does not grow.
3. **Dimensions (D1).** Header 33px (unchanged), text area 93px, footer 45px, overall about 173px, width 240px.
   - Re-lay out the footer in 45px: media button, type label, credit and three-dot menu. The menu keeps its 32px tap target.
   - Update `capacity.ts` geometry (`innerHeight`) to the new text area. No compatibility is kept for legacy test content (D1).
   - Update the maths measurement, which reads the footer's top edge, and therefore the server Chromium check, automatically.
   - Update the editor preview, which uses the same face.
4. **Visual review.** Before committing, take Chromium and WebKit screenshots at 390 × 844 of a mixed stack (Creator and Personal, plus a Group fixture card).

**Likely files:**
- `InfoCardPhysicalStack.tsx` and `.module.css`
- `InfoCardFace.tsx` and `.module.css`
- new `infoCardStackLayout.ts` and `infoCardTypeLayout.ts`
- `StepView.module.css`
- `capacity.ts`
- `InfoCardConsultation.module.css` (`.empty` height until checkpoint 6)

**Acceptance:**
- A stack of three Creator and two Personal cards shows four strips in order, each in its card's colour.
- Strips update while browsing. A one-card stack shows none; a three-card stack shows two.
- The focused card names its type in text.
- Card dimensions match the targets.
- Interaction and animation are unchanged.
- No vertical scrolling at 390 × 844 or in short landscape.

**Tests:**
- Unit tests: `buildInfoCardStackLayout` (order, wrap-around, counts 1, 2, 5 or more, unavailable cards, all three types) and `buildInfoCardTypeLayout`.
- Update `info-cards-capacity.test.ts` to the new geometry.
- Update geometry assertions in `info-card-consultation.browser.ts` and `personal-info-cards.browser.ts`.
- Run `info-maths.browser.ts` and `info-maths-performance.browser.ts`.

**iPhone checks:** strip legibility and colours, card height, text contrast, type label, swipe feel.

#### Checkpoint 6 — Empty pouch animation

**Approach:**
- Replace the card-sized `.empty` box in `InfoCardConsultation` with a small panel containing **Add Personal Info Card**.
- **Animation (D2):** the panel animates out of the pouch using the **same opening sequence as the stack**: the hidden pouch position, 12° rotation and the 0.48s two-stage ease, with reduced-motion handling. Extract that geometry and sequence from `InfoCardPhysicalStack` into a small shared helper so the two cannot drift. The close animation reverses it.
- There is no × button. The existing `dismissSurface` closes on an outside tap, and Escape keeps working.
- The action calls the existing `edit()`.
- **After the first save (D2):** the new card opens as the focused card. The current post-save refresh already selects the saved card; the change is that the stack replaces the panel using its normal opening animation.
- Focus containment, the pouch toggle and editor return focus are reused unchanged.

**Likely files:**
- `InfoCardConsultation.tsx` and `.module.css`
- `InfoCardPhysicalStack.tsx` (extract the opening animation)
- new small `infoCardPouchMotion.ts` helper

**Acceptance:**
- An empty pouch tap animates the compact panel out of the pouch: no empty card and no Close button.
- An outside tap or Escape dismisses it.
- The action opens the existing editor.
- After the first save, that card is focused in the stack.
- Pouches with cards are unchanged.

**Tests:**
- Update "empty pouch creates a private note…" and "last Remove shows the true empty plus…" in `personal-info-cards.browser.ts`.
- Add Chromium and WebKit touch tests for the open animation phase, outside-tap dismissal, the action, and focus after the first save.

**iPhone checks:** animation feel compared with the stack opening, panel size, tap target, dismissal.

#### Checkpoint 7 — Media attachment UI

**Approach:**
- Add `infoCardMediaLayout.ts` with `buildInfoCardMediaLayout({ mediaItem, uploading, failedFile, uploadError, videoStatus, ready, pendingPublication })`. It returns exactly one state plus its permitted actions:

  | State | Message (draft wording) | Actions |
  | --- | --- | --- |
  | `unavailable` | Choose a series and title first. | none |
  | `empty` | Add an image or video (optional). | Choose file |
  | `uploading` | Uploading… your text keeps saving. | Cancel |
  | `processing` | Video processing (n%) | Replace, Remove |
  | `ready` | Image attached / Video ready | View, Replace, Remove |
  | `failed-upload` | Upload failed. Your text is saved. | Retry, Choose another, Cancel |
  | `failed-processing` | The video could not be processed. | Choose another, Remove |

  The `pendingPublication` input is used from checkpoint 10 onwards.
- Replace the editor's media `<section>` with one `InfoCardMediaArea` component that renders the layout. It reuses `UploadIcon`, `uploadInfoCardMedia`, `useInfoVideoStatus` and the Phase 1 `chooseMedia`, `cancelUpload` and `failedFile` logic. **No new upload system.**
- The Step-media components (`CreatorMediaUploadSlot`, `UserCardMediaUploadPanel`) are bound to other pipelines; only their visual patterns are reused.
- Keep the `infoCardErrors.ts` mapping and add friendly processing messages. Technical codes are never shown.
- **Scope:** both Info Card editors (same component). Step media, Deck introductions and user Card media are untouched.

**Likely files:** `InfoCardEditor.tsx`, new `InfoCardMediaArea.tsx` and `infoCardMediaLayout.ts`, `InfoCardEditor.module.css`, `infoCardErrors.ts`.

**Acceptance:**
- One media area: never conflicting messages, never duplicate controls.
- Every state is reachable and shows only its actions.
- Phase 1 recovery is preserved.
- Text is preserved through every failure.

**Tests:**
- Unit tests for every state and these transitions:
  - ready → replace → uploading → failed → retry → ready;
  - remove during processing.
- Update the Phase 1 failure and retry browser tests to the new labels.
- Add a processing-state test using mocked Stream status.
- Run `creator-upload-recovery.browser.ts`, `info-cards-authoring.browser.ts` and `info-card-upload.test.ts`.

**iPhone checks:**
- Photo library and camera.
- Airplane-mode failure, then Retry.
- Replace and remove.
- A real video through processing on Preview (the harness mocks Stream).

#### Checkpoint 8 — Portrait video black bars (Info Card attachment viewer)

**Approach (straightforward; no repeat investigation):**
- In `InfoCardMediaViewer` only, size the video area to the video's own aspect ratio and centre it, instead of stretching the player over the whole viewer.
  - The ratio comes from the media item's stored `width`/`height` when present.
  - Otherwise it comes from the `<video>` element's `videoWidth`/`videoHeight` on `loadedmetadata`.
  - The box is limited by the viewer's width and height, so it never crops.
- The change is an Info-viewer-scoped wrapper and CSS module rule. `CloudflareHlsVideoPlayer`, `CardMediaViewer.module.css` and `globals.css` are not changed.
- **Fallback (D3):** if this proves not straightforward (for example, the shared player resists being sized), stop and defer to the separate media-presentation task described below. Do not alter shared video infrastructure.

**Likely files:** `InfoCardMediaViewer.tsx`, `InfoCardConsultation.module.css` (viewer rules).

**Acceptance:**
- A portrait Info Card video fills its height with no near-black bands above or below.
- Its ratio is preserved and nothing is cropped.
- Landscape Info Card videos and images are unchanged.
- Step, Card-introduction and Deck-introduction videos are unchanged.

**Tests:**
- Browser geometry test: with a mocked portrait and a mocked landscape video in the viewer at 390 × 844, the player box ratio equals the video ratio.
- Run `info-card-consultation.browser.ts`, `step-multimedia.browser.ts` and `video-source-transition.spec.ts`.

**If deferred, record a separate media-presentation task covering:**
- black bars above and below Info Card portrait videos in the attachment viewer;
- unwanted borders to the left and right of images elsewhere in the application.

#### Checkpoint 9 — Content formatting

All changes stay in the Info Card layer (D4). The shared maths renderer is not modified.

**Display maths:**
- Info-scoped overrides in `InfoCardMaths.module.css` cancel the renderer's forced `text-align: left` and 1em indent inside Info Card faces.
- KaTeX's own `.katex-display` centring and alignment (including `aligned` environments) then apply across a full-width container.

**Alignment tags and blank lines:**
- Add `infoCardContentLayout.ts` with `buildInfoCardContentLayout(body)`, which:
  - splits the source into segments `{ source, centre, vCentre }` on `[[centre]]…[[/centre]]` and `[[v-centre]]…[[/v-centre]]`;
  - interprets nesting and combining consistently in either order;
  - converts extra blank lines into explicit spacer segments, because the renderer collapses them;
  - reports unmatched or malformed tags as editor diagnostics, never silently dropping text;
  - ignores tags inside maths delimiters.
- `InfoCardFace` renders one `MathsRenderer` per segment inside a column body, with spacers between:
  - `centre` segments get `text-align: center`;
  - a `vCentre` segment is a flex item that takes the free space in the body area (between header and footer, already excluding the media button and fixed elements) and centres within it.
- `infoMathsMeasurement` combines per-segment results: safe only if every segment is safe and the stacked content fits the same body box.
- Untagged content renders as now: left-aligned, with existing spacing.
- **Legacy plain-text test cards:** normal rendering is preserved and no new syntax is added (D4).

**Server:** publish syntax validation runs on the tag-stripped segments, so tags never reach KaTeX as text. The Chromium rendering check inherits the change through `InfoCardFace`.

**Likely files:**
- `InfoCardFace.tsx` and `.module.css`
- `InfoCardMaths.module.css`
- `infoCardMaths.ts`
- new `infoCardContentLayout.ts`
- `repository.ts` (segment validation)
- `InfoCardEditor.tsx` (diagnostics)

**Acceptance:**
- Display maths centres per KaTeX.
- Untagged text stays left-aligned.
- `centre`, `v-centre` and both combined behave as specified, with and without media.
- Intentional blank lines are preserved.
- Nothing overflows or overlaps fixed elements.
- Cards, Steps and Decks are unaffected.

**Tests:**
- Unit tests for the content layout: nesting, combining, unmatched tags, tags inside maths, blank-line runs.
- Browser geometry and screenshot tests in `info-maths.browser.ts`.
- Run `tests/maths-renderer` unchanged, to prove the renderer is untouched.
- Run `info-maths-trusted.test.ts` and `info-maths-performance.browser.ts`.

**iPhone checks:** centred, vertically centred and blank-line examples, with and without media.

### Phase 3 — Improve publishing

#### Checkpoint 10 — Automatic publication

**Facts:**
- Only Stream video can be "processing".
- The server already refuses to publish unready media, so a premature publication is impossible.
- There is no background mechanism today.

**Approach — one mechanism for Creator Publish and Personal Save (D5, D6):**

1. **Record the intent.** When Publish or Save is pressed while the draft's video is processing, the client calls the existing `publish`/`save` route with `whenMediaReady: true`.
   - The server checks everything except readiness.
   - It stores `pendingPublication: { revision, requestedAt, context? }` on the `infoCards` root. Personal Saves keep their first-save context.
   - It returns `202 { status: "waiting" }`.
   - The field is optional. Missing means none; no index and no migration.
2. **Complete it.** One shared `completePendingPublication(actor, id)` helper in `repository.ts`:
   - checks readiness;
   - if ready, publishes through the existing `publishVersion` (idempotent through its `sourceRevision` receipt);
   - if failed, clears the intent and records `lastPublicationFailure`;
   - if still processing, does nothing.

   For a Personal first save, it reads the current `personalInfoRevision` itself, because the revision belongs to the same user.
3. **Editor open.** The existing `useInfoVideoStatus` poll calls the status route, which runs the helper. The client then shows "Published" or "Saved" (a small status or toast), or the named failure with Retry and Choose another file.
4. **Editor closed.**
   - Leaving no longer blocks. The editor says "Will publish when the video is ready."
   - The helper also runs, bounded, on the owner's next relevant request: the My Drafts list, the editor load, the consultation snapshot and the Creator Info list. My Drafts shows "Publishing when video is ready", "Published" or "Video failed: retry".
5. **Edits cancel the intent.** The intent is bound to `revision`. Any later draft save clears it, so edited content is never published without a fresh press.
6. **After the browser closes (Q7):**
   - **Baseline:** completion happens on the owner's next visit, with no new infrastructure.
   - **Optional low-cost addition:** a Vercel Cron route that calls the same helper for intents older than a minute. It needs one `crons` entry in `vercel.json` and a `CRON_SECRET` environment variable; cron frequency depends on the Vercel plan.
   - Stream webhooks are not recommended: they need registration, signature verification and a public route.

**Likely files:**
- `repository.ts`, `model.ts`
- the `publish`, `save` and `media/status` routes
- `infoCardEditorController.ts`, `InfoCardEditor.tsx`, `infoCardMediaLayout.ts`
- the My Drafts entry loader
- for the optional cron: one route and `vercel.json`

**Acceptance:**
- One press publishes once the media is ready.
- A ready video publishes immediately.
- A processing failure never publishes, keeps the draft or previous version, and shows a named error and a retry path.
- An edit after pressing cancels the intent.
- Closing and returning completes the publication.
- Duplicate or concurrent completions produce exactly one version.
- Personal and Creator behave the same.

**Tests:**
- Integration tests with the injected `InfoMediaSecurity`, covering:
  - intent recorded;
  - ready → one completion;
  - concurrent completions → one version;
  - failure → cleared and nothing published;
  - an edit invalidates the intent;
  - Personal first save with a stale `personalInfoRevision`.
- Browser test with mocked Stream status: press while processing, see the pending state, then the confirmation.
- Run the `info-cards-release` and `personal-info-cards` suites.

**iPhone and Preview checks:**
- A real video: press, wait.
- Press, close Safari, reopen.
- A failed or rejected video.

### Phase 4 — Info Cards within Group Experiences

The specification separates **4A — Personal Info Cards in Groups** from **4B — Group Info Cards**. Below, confirmed requirements are listed apart from recommendations. Nothing here starts until Q1–Q6 are answered.

**Confirmed requirements:**
- Personal Info Cards are private, attached to CardData, the same set wherever the Card template appears, never shared automatically, and follow personal media and reflection rules (D7, D8).
- Group Info Cards are created by admins on behalf of the Group, belong to the Group context and never to the admin's CardData, follow the Group reflection and media patterns, are teal with white text, and are distinguishable from Personal Info Cards (D9).
- Colours are the same in every perspective, and strips reflect actual card types (D10).

#### Checkpoint 4.1 — Verification (no behaviour change)

- Group browser coverage that Creator Info Cards appear correctly in the Group, Me and follower perspectives.
- Privacy assertions that one user's Personal Info Cards never reach another user, in any perspective or API.

#### Checkpoint 4.2 — Personal Info Cards in Groups (4A)

**Recommended (pending Q1 and Q2):**
- **Server:** extend `PersonalInfoContext` with `{ mode: "group", experienceId, version }`.
  - Validate it through the existing Group authorisation: the user is a current member, the access epoch matches, and the Card is in the Group manifest at that version.
  - Reuse the same `users.cardsData` attachment. The existing `working` path is not loosened, and unknown modes stay denied.
  - Followers already have CardData from Group-origin materialisation. Personal Info Cards are not offered in perspectives where the viewer has no own Card (Q2), so no admin CardData is created.
- **Client:** enable the pouch for the viewer's own Card within a Group (Me), passing the Group context.
  - Personal Info Cards show in Personal green with their text label. If Q1 keeps them private, they are marked private, as personal media is in own Group views.
  - They are not shown in the Group perspective or in follower inspection.

**Acceptance:**
- An owner sees the same Personal Info Cards in their personal Deck and in Me.
- No admin or follower sees another user's Personal Info Cards anywhere.
- Group removal does not delete them.

#### Checkpoints 4.3 and 4.4 — Group Info Cards (4B)

**Recommended data model**, following the collective Group reflection pattern and pending Q3–Q6:

| Element | Recommendation |
| --- | --- |
| Identity | Reuse `infoCards` and `infoCardVersions` with `kind: "group"`, `experienceId`, `originCardTemplateId` and `createdByUserId`. `ownerUserId` is not used for authority. |
| Attachment | An `infoCardIds` list (plus `infoCardAttachedAt` and an `infoRevision` counter) on existing `groupCardData` `(experienceId, cardTemplateId)`. This mirrors `personalInfoCardIds` on CardData and the collective reflection's home. |
| Authority | Current Group admins create, edit and delete (Q4), checked with the existing Group authorisation and fences, never with `ownerUserId === actor`. Current members read, per Q3. |
| Drafts | One shared draft on the root with revision compare-and-swap, as the collective reflection does. No per-admin private drafts. |
| Audience | Whole Group only. Per-member audiences and audience epochs from the earlier Group plan §11.3 are not built (Q6). |
| Visibility | Group perspective, plus members' own Cards within that Group if Q3 says so. Never in personal Decks or other Groups. |
| Media | The existing Info Card media pipeline, with delivery authorised for current Group members on the exact publication. |
| Series | The existing series selector with the acting admin's eligible series. |
| Credit | Group name or authoring admin (Q5), plus the Group type label. |
| Removal and lifecycle | Leaving or losing the admin role ends editing. The card stays with the Group. |

- **4.3 (backend):** a group branch in the Info domain (`model`, `domain`, `repository`, `queries`), Group routes reusing `infoRequest`, and integration tests:
  - admin-only writes and member reads;
  - foreign-Group denial;
  - removed admin;
  - concurrent admin edits conflict rather than overwrite;
  - no CardData is created.

  **Possible index:** deleting a Group Info Card checks references. That check needs either a `groupCardData` multikey index on `infoCardIds` or a bounded lookup by `(experienceId, cardTemplateId)`, which already has a unique index. Prefer the latter, so no new index is needed. If an index turns out to be required, stop for approval.
- **4.4 (client):** the Group perspective pouch and consultation include Group Info Cards in teal. Admins get New, Edit and Remove through the existing editor with a Group transport. Followers are read-only. Browser tests cover each perspective and the colours of mixed stacks.

**iPhone checks (4.2–4.4):**
- Follower Me: own Personal and Group cards are distinguishable.
- Admin Group perspective: create a Group Info Card.
- Follower sees it, read-only.
- No other user's Personal Info Cards are visible anywhere.

---

## 4. Testing strategy

| Layer | Command | Used by |
| --- | --- | --- |
| Unit | `npm run test:unit`; new `*Layout` unit tests | Every checkpoint |
| Integration | `node --import tsx --test --test-concurrency=1 tests/info-cards.integration.ts tests/info-card-attachments.integration.ts tests/personal-info-cards.integration.ts tests/info-cards-release.integration.ts`, plus the Group integration suites for Phase 4 | 9 (server validation), 10, Phase 4 |
| Browser (disposable) | `npm run test:phase2 -- --info-cards <files>` with an explicit file list; `--group-experiences` for Group specs | Every UI checkpoint |
| Static | `npm run typecheck`, `npx eslint <changed files>` | Every checkpoint |
| Regression gate per checkpoint | All Info Card browser specs (84 tests at Phase 1) plus `creator-upload-recovery.browser.ts`; video specs for checkpoint 8; Group specs for Phase 4 | Every checkpoint |

- **Device behaviour:** WebKit and Chromium touch emulation catches some iPhone issues but does not replace physical-device checks. Each approval report lists exactly what needs an iPhone.
- **Real media providers:** `info-cards-live-media.browser.ts` is restricted to authorised live runs. Real Stream processing and R2 verification are checked manually on Preview.

---

## 5. Dependencies and sequencing

1. **5 before everything else in Phase 2.** It introduces the type and colour layout that 6, 4.2 and 4.4 rely on, and it fixes the card dimensions that 6's panel and 9's measurements depend on.
2. **5 before 6.** Both change the consultation geometry. 6 also extracts the opening animation that 5 must leave unchanged.
3. **7 before 10.** The pending and failure states of automatic publication are shown in the new media area.
4. **9 after 5.** Both edit `InfoCardFace` and capacity geometry. 9's measurement uses the new 93px text area.
5. **8 is independent.** It is small and can run in any slot.
6. **Phase 4 last.** It depends on the Q1–Q6 answers and on stable editor, pouch and stack. 4.1 can run earlier as pure verification. 4.3 precedes 4.4.

---

## 6. Decisions

### 6.1 Approved decisions

| # | Decision | Effect on this plan |
| --- | --- | --- |
| D0 | Commit the specification and plan as one docs commit; do not push. | Done with this update. |
| D1 | Header 33px, text 93px, footer 45px, about 173px total, width 240px; four strips of about 5px in type colours; Creator gradient, Personal `#305047`, Group `#147D6C` with white text; no capacity compatibility for legacy test content; accessible contrast and not colour-only. | Checkpoint 5 |
| D2 | Compact panel with "Add Personal Info Card"; animates out of the pouch with the existing opening animation; outside tap dismisses; no Close; the first saved card opens focused. | Checkpoint 6 |
| D3 | The bars are in the Info Card attachment viewer, above and below portrait videos. Fix if straightforward; otherwise defer to a separate media-presentation task. | Checkpoint 8 (cause identified; simple scoped fix) |
| D4 | Formatting entirely in the Info Card layer; renderer unchanged; plain-text test cards need only normal function. | Checkpoint 9 |
| D5 | One press; complete after media is ready; no substantial new infrastructure; otherwise complete on next open; clear pending, success and failure states; never publish without the media; retry. | Checkpoint 10 (Q7 for the optional cron) |
| D6 | The same mechanism for Personal Save. | Checkpoint 10 |
| D7 | Personal Info Cards follow personal media and reflection rules in Groups; report inconsistencies. | Section 2.5; Q1, Q2 |
| D8 | They follow CardData across Decks and Groups; never duplicated. | 4.2; already true in storage |
| D9 | Admins create Group Info Cards on behalf of the Group; Group context, not admin CardData; follow Group reflection and media patterns. | 4.3, 4.4; Q3–Q6 |
| D10 | One palette everywhere; strips reflect actual types in every perspective. | Checkpoints 5 and 4.4 |

### 6.2 Open questions

| # | Question | Recommendation | Blocks |
| --- | --- | --- | --- |
| Q1 | The established pattern makes content created inside a Group Group-origin and shared by default. For Personal Info Cards this conflicts with privacy and D8. Should Personal Info Cards created in a Group stay private on CardData? | Yes: private, on CardData, marked private in own Group views. This is a deliberate, documented exception to the Group-origin rule, justified by the specification. | 4.2 |
| Q2 | Should Personal Info Cards appear only in the owner's own views (personal Deck, Me), never in the Group perspective or follower inspection? | Yes, matching personal media and reflections. | 4.2 |
| Q3 | Do Group Info Cards appear only in the Group perspective, or also on members' own Cards within that Group? | Both, so followers see them beside their own Personal Info Cards, as D9 implies. Not in personal Decks or other Groups. | 4.3, 4.4 |
| Q4 | Can every current admin edit or delete any Group Info Card? | Yes, like the collective Group reflection. | 4.3 |
| Q5 | What does a Group Info Card's credit show: Group name or authoring admin? | Group name. | 4.4 |
| Q6 | Should the simpler whole-Group model replace the earlier Group plan's §11.3 and Phases 8–9 design (audiences, epochs, per-editor drafts) for the MVP? | Yes; record it in that plan when implemented. | 4.3 |
| Q7 | Add a small Vercel Cron to complete publication after the browser closes (one `vercel.json` entry and a `CRON_SECRET`)? | Start with completion on next visit. Add the cron only if you approve it, and confirm that the Vercel plan allows a useful frequency. | Checkpoint 10 (optional part) |

---

## 7. Risks and uncertainties

- **Shared production database.** Local or phone testing outside the disposable runner writes production data.
- **Smaller text area (5).** Existing test cards may no longer fit and will show overflow states. This is accepted under D1; the editor already reports it.
- **Measurement complexity (9).** Per-segment rendering multiplies measurement callbacks, and the trusted Chromium check must combine them identically. This is the highest-effort Phase 2 checkpoint.
- **Shared opening animation (6).** Extracting it from the stack must not change the stack's timing. Existing motion tests guard this.
- **Lazy publication (10).** Without the optional cron, completion waits for the owner to return. My Drafts must make that state visible.
- **Phase 4 authorisation surface.** Adding Group context and a Group-owned kind touches ownership checks. Use explicit Group branches, keep unknown kinds denied, and never use `author === actor || isAdmin` checks.
- **Pattern inconsistency (Q1, Q3).** If the answers depart from the media and reflection rules, record the exception in the Group engineering plan so the patterns do not silently diverge.

---

## 8. Execution strategy

### 8.1 Every checkpoint

1. Investigate the relevant code, implement only the agreed scope, and add or update focused tests.
2. Run the checkpoint's focused tests, its regression gate (section 4), `npm run typecheck` and lint on changed files.
3. **Commit the checkpoint separately**, with a descriptive commit message without apostrophes, even when human review follows.
4. Record in the report: commit hash, summary of changes, test results, remaining risks.
5. Never push, merge or deploy without explicit authorisation.

### 8.2 Approval gates and model recommendations

| Checkpoint | Model | Effort | Human approval |
| --- | --- | --- | --- |
| 5. Card height, stack and colours | Sonnet | Medium | Yes |
| 6. Empty pouch animation | Sonnet | Medium | Yes |
| 7. Media attachment UI | Sonnet | High | Yes |
| 8. Portrait video black bars | Sonnet | Low | No, if straightforward |
| 9. Content formatting | Opus | High | Yes |
| 10. Automatic publication | Opus | High | No, if within agreed scope |
| Phase 4. Group integration | Opus | High | Yes |

- **Approval checkpoints:** test, commit, report the changes with a concise manual testing checklist, then **stop and wait** for approval.
- **Other checkpoints (8, 10):** test, commit, record the report, and **continue automatically** to the next checkpoint.
- **Phase 4:** stop for approval after 4.2 and after 4.4. 4.1 and 4.3 continue automatically when their tests pass.

### 8.3 Exceptions: stop and ask

Stop and ask for approval, at any checkpoint, if:

- a consequential product decision arises that the specification does not cover;
- a change would materially expand the agreed scope;
- a database migration, a new index or a potentially destructive operation becomes necessary;
- automated tests reveal a significant unresolved regression;
- new infrastructure would be needed beyond what was approved (for example the optional cron without a Q7 answer).

Do not stop for routine implementation decisions, minor technical trade-offs or issues adequately covered by automated tests.

### 8.4 Credit efficiency

- Use the recommended model and effort as a guide: Sonnet for straightforward implementation, Opus for complex reasoning.
- Avoid prolonged investigation of non-critical issues. Checkpoint 8 defers rather than digging.
- Reuse the existing disposable harness and fixtures; do not rebuild test infrastructure.

### 8.5 Implementation sequence

1. **Checkpoint 5:** card height, stack and colours. **Approval gate.**
2. **Checkpoint 6:** empty pouch animation. **Approval gate.**
3. **Checkpoint 7:** media attachment UI. **Approval gate.**
4. **Checkpoint 8:** portrait video bars in the attachment viewer. Continues automatically; defers if not straightforward.
5. **Checkpoint 9:** content formatting. **Approval gate.**
6. **Checkpoint 10:** automatic publication. Continues automatically if within scope. The optional cron is built only with a Q7 answer.
7. **Phase 4:**
   - 4.1 verification (automatic);
   - 4.2 Personal Info Cards in Groups, after Q1 and Q2 (**approval gate**);
   - 4.3 Group Info Card backend, after Q3, Q4 and Q6 (automatic);
   - 4.4 Group Info Card client, after Q5 (**approval gate**).
