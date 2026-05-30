---------------------


I investigated without making code changes.

**Most Likely Cause**

The flash is most likely a Motion/render-timing issue caused by the focused shared-layout card being mounted inside a parent that starts at `opacity: 0`.

The key path is:

- [DeckDetail.tsx](/Users/peterdomokos/projects/switchplay-app/src/components/decks/DeckDetail.tsx:188): `openFocusMode()` sets `activeCardIndex` and `isFocusModeOpen`.
- [DeckDetail.tsx](/Users/peterdomokos/projects/switchplay-app/src/components/decks/DeckDetail.tsx:315): `FocusedCardView` mounts inside `AnimatePresence`.
- [DeckCard.tsx](/Users/peterdomokos/projects/switchplay-app/src/components/decks/DeckCard.tsx:70): deck card keeps `layoutId="week-card-${card.id}"`.
- [FocusedCardView.tsx](/Users/peterdomokos/projects/switchplay-app/src/components/decks/FocusedCardView.tsx:253): `.focused-card-layer` mounts with `initial={{ opacity: 0 }}`.
- [FocusedCardView.tsx](/Users/peterdomokos/projects/switchplay-app/src/components/decks/FocusedCardView.tsx:266): focused stage mounts with the same `layoutId`.

Frame sampling showed that, immediately after click, the focused shared-layout stage already exists, but its parent layer is still `opacity: 0`. So Motion is doing the shared-layout handoff while the destination card is composited through an invisible parent. That is a prime candidate for the “flash/pop before open.”

**Answers To The Investigation Questions**

1. `FocusedCardView` mounts; `DeckCard` does not unmount. The active deck card remains in `CardStack`.
2. Yes, the deck card remains visible while the focused card mounts. Motion later crossfades/hides the duplicate source.
3. Yes. The focused card can initially be effectively invisible because `.focused-card-layer` opacity is `0`. On flipped/back-side entry, the focused stage also briefly reported opacity `0`, then faded up.
4. I did not find a one-frame `AnimatePresence` gap. The focused stage mounts quickly. The problem is more that it mounts under opacity/initial animation.
5. Yes. The scrim/overlay layer begins appearing while the focused layout target is still settling, and because the whole layer fades, the card itself is included in that fade.
6. Yes, there is a temporary duplicate `layoutId`: deck source and focused target both exist for `week-card-${card.id}`. That is expected for shared layout, but the target is inside an opacity-animated parent.
7. Yes. `FocusedCardView` has `initial="enter"` on the shared-layout `motion.article`. That conflicts conceptually with shared layout on first open, especially for opacity/y.
8. `initial={false}` on `.focused-card-object` only affects the inner rotate/scale object. It does not stop the layer opacity fade or the stage `initial="enter"`.
9. Deck-scene scaling is involved in measurement: source is inside `.deck-scene-scaler`, target is fixed/unscaled. Motion appears to measure and project it, but this likely makes the handoff more fragile and visually sensitive. I do not think it is the primary cause.
10. I did not see evidence of unstyled/wrong-side card content as the main cause. On flipped entry, the focused object had `is-flipped` and `rotateY(180deg)` from the start.
11. It happens on the front side too. Flipped/back entry appears more exposed because the stage opacity also fades from `0`.
12. Likely all active cards, not media-specific. The sampled flash happens before content loading differences would matter.
13. Not dev-only. I reproduced the same parent-opacity sequence against the production static export served from `out/`.

**Safest Minimal Fix**

Do not animate opacity on the wrapper that contains the shared `layoutId`.

Concretely, the likely safe direction is:

- Make `.focused-card-layer` mount at full opacity, or use `initial={false}` / no opacity animation on that parent.
- Move fade behavior to the scrim/backdrop only.
- Consider disabling `initial="enter"` for the first focus-open shared-layout handoff, while preserving it for focused-card traversal.

**Risk**

The main risk is losing the nice backdrop fade or focused traversal feel if the fix is too broad. The fix should be scoped so the shared-layout card is never faded by an ancestor during open, while the scrim can still animate independently.

**How To Test**

Test front and flipped/back entries in both dev and production:

- Frame-sample first 300ms after active card click.
- Assert `.focused-card-stage` exists with visible effective opacity on the first mounted frame.
- Assert `.focused-card-layer` is not fading the card itself.
- Manually verify no flash on front open, flipped open, and cards with back/media content.

I’d attempt the fix now rather than defer. The diagnosis is concrete enough: the shared-layout destination is mounted under an opacity-animated parent, and production shows the same behavior.



----------------------



Implemented the minimal focus-open flash fix.

What changed:
- Removed opacity animation from `.focused-card-layer` in [FocusedCardView.tsx](/Users/peterdomokos/projects/switchplay-app/src/components/decks/FocusedCardView.tsx:256).
- Moved the fade to `.focused-card-scrim` and a new `.focused-card-vignette`.
- Replaced the old `.focused-card-layer::before` pseudo-backdrop with `.focused-card-vignette` in [globals.css](/Users/peterdomokos/projects/switchplay-app/src/app/globals.css:1149), so the backdrop can fade independently of the shared-layout card.
- Disabled Motion layout crossfade on the focused shared-layout target with `layoutCrossfade={false}`. This kept the flipped/back-side focused stage from starting at opacity `0`.
- Scoped `initial="enter"` so it does not run on the first focus-open handoff, but still applies to focused traversal after the focused view has mounted.

`.focused-card-layer` no longer animates opacity. Scrim/backdrop now owns the fade. Focused traversal behavior is preserved.

Tested:
- front-side focus open: first focused frame had `layerOpacity: 1`, `stageOpacity: 1`, scrim fading from `0`
- back-side/flipped focus open: first focused frame had `layerOpacity: 1`, `stageOpacity: 1`, scrim fading from `0`
- focus close: focused stage removed cleanly
- focused vertical traversal: worked
- focused horizontal flip: worked
- production static export via `out/`: front and back first visible samples both had `stageOpacity: 1`
- `npm run build`: passed

------------------------


Implemented one narrow fix in [FocusedCardView.tsx](/Users/peterdomokos/projects/switchplay-app/src/components/decks/FocusedCardView.tsx:143).

How it distinguishes first focus-open from traversal:
- `FocusedCardView` now has local state for the first mount only: `isInitialFocusScaleReleased`.
- On the first render after opening focus, the object animate target uses `scale: 1`.
- On the next animation frame, it releases to `focusedCardScale`.
- During focused traversal, the component is already mounted, so new card remounts keep the normal focused scale path and do not replay the first-open scale gate.

Initial scale handling:
- First focus-open: object starts at deck-sized `scale: 1`.
- Then animates to the measured focused scale.
- Rotate state still starts from `cardFlipState.rotationY`, so flipped deck focus opens at `rotateY: 180` without a front-to-back flip.

Verification:
- Front focus open first frame now had object rect matching stage rect, with `objectTransform: none`.
- Back/flipped focus open first frame also started deck-sized, with `matrix3d(-1, ...)`, then scaled up while staying flipped.
- Focused vertical traversal while flipped kept `focused-card-object is-flipped` and `rotateY: 180`.
- Focused horizontal flip still changed `is-flipped => front`.
- Focus close removed the focused stage cleanly.
- Deck scene remained present.
- `npm run build` passed.

Compromise:
- The object scale now intentionally animates from deck size to focused size on first open, so the focus open may feel slightly more “grown into place.” That is the narrow tradeoff for removing the full-size first-frame pop.

--------------------------------

The latest focus-open scale-gating fix did not solve the real-device flash bug, so I have reverted it.

Please do not reapply that approach.

## Important Updated Evidence

The flash behaviour differs by real mobile browser:

### Safari on real iPhone

* flash appears only when defocusing / closing focused mode
* focus open does not visibly flash
* deck open does not visibly flash

### Chrome on real iPhone

* flash appears more often / more visibly
* likely during focus open and/or close

### Safari responsive mode on Mac

* no flash visible

So this may be a real-device compositing/performance issue, not a deterministic desktop-emulation Motion state bug.

## What We Have Already Tried

We tried:

1. moving opacity fade off `.focused-card-layer`
2. scrim/vignette separation
3. disabling/adjusting some first-open initial behaviour
4. scale-gating `.focused-card-object` from `scale: 1` to focused scale on first open

None solved the real-device flash sufficiently.

## Please Re-evaluate

Do NOT implement another fix yet.

Please report whether this bug should now be deferred rather than chased further.

If you think there is still one worthwhile low-risk fix, propose it clearly, but do not implement.

## Investigation Direction

Given the evidence, please consider whether the issue is more likely:

* real iOS/Chrome compositing
* GPU/layer promotion
* nested 3D transform/backface rendering
* Framer Motion shared layout projection between transformed/untransformed ancestors
* source/target duplication during shared layout
* `box-shadow`/filter/backdrop rendering during projection
* `preserve-3d`/backface visibility on mobile
* the focused card’s large scaled child inside a shared-layout parent
* performance frame drop rather than incorrect state

## Required Report

Please provide:

1. Best current diagnosis after failed fixes.
2. Why Safari only flashes on defocus while Chrome flashes more.
3. Whether this is likely worth fixing now or should be deferred.
4. If worth fixing, one safest next fix only.
5. If deferring, what short note to add to the outstanding bugs list.
6. What not to touch because it risks destabilising the current working architecture.

Please prioritise stability over speculative polish.


----------------------------------

Local tree is clean, and the scale-gating change is reverted.

**Best Current Diagnosis**

This now looks less like a deterministic React/Motion state bug and more like a real-device iOS compositing issue during shared-layout projection, especially when the focused card exits back into the deck.

The likely ingredients are:

- shared `layoutId` source/target duplication
- transformed deck ancestor vs fixed focused overlay
- nested 3D transforms: `preserve-3d`, `rotateY`, `backface-visibility`
- large scaled focused card child
- heavy shadows/gradients during projection
- mobile WebKit GPU layer promotion/teardown timing

Safari responsive mode on Mac not reproducing is the strongest signal: desktop emulation is not exercising the same GPU/compositor path as a real iPhone.

**Why Safari Defocus vs Chrome More Often**

Chrome on iPhone still uses WebKit, but it runs inside a different browser shell with different viewport, scrolling, process, and compositing timing. So it can expose the same underlying WebKit layer issue more often.

Safari only flashing on defocus suggests the worst moment may be layer teardown/relegation: Motion is returning the focused card to the deck source while unmounting the fixed overlay and re-promoting the deck source. Chrome may be more sensitive both on promotion and teardown, so open and close both show it.

**Should This Be Fixed Now?**

I recommend deferring for now.

We have already tried several plausible state/animation fixes, and the bug now appears device/compositor-specific. More attempts risk destabilising the working shared-layout architecture without a high-confidence target.

**One Safest Next Fix, If You Do Continue**

The only next fix I’d consider is a very narrow real-device test branch that reduces expensive compositing during focus enter/exit:

- avoid animating large `boxShadow` during the shared-layout handoff
- keep the shadow static or move it to a non-shared wrapper/pseudo-layer
- test only on real iPhone Safari and Chrome

I would not implement that blind. It needs real-device visual confirmation.

**Outstanding Bugs Note**

Add something like:

```md
## Real iOS Focus/Defocus Compositing Flash

Status: deferred

On real iPhone browsers, a brief visual flash can occur during focused-card shared-layout transitions, especially defocus in Safari and more broadly in Chrome iOS. Desktop Safari responsive mode does not reproduce it reliably.

Likely cause is mobile WebKit compositing during Framer Motion shared-layout projection across transformed/untransformed ancestors, combined with 3D card transforms, backface rendering, large shadows, and fixed overlay teardown.

Do not keep iterating with state-only fixes unless testing on real iPhone hardware.
```

**Do Not Touch For Now**

Avoid changing:

- `layoutId`s or shared layout structure
- deck-scene scaling
- deck flip logic
- focused traversal logic
- gesture thresholds
- broad opacity or scale gates
- moving scale onto the shared-layout stage
- large CSS “GPU hack” sweeps across the app

Stability wins here. The architecture is coherent; this looks like a polish bug that needs real-device compositor-focused testing rather than another speculative Motion rewrite.



CORRECTION!!!!!!!!!!!!! --------------------------

Chrome = Android Chrome, not Chrome on iOS.
Safari = real iPhone Safari.



-----------
Note there was a flash bug when we introduced. Click to show signal number below is the copied conversation with copilot in case this assists:

I’ll do a read-only trace through the signal row plus surrounding motion/gesture wrappers to isolate what can visually flash before reveal, then I’ll give you a report with likely cause and safest non-invasive fix direction.

Searched for regex FocusedSignalRow|focused-card-signal-slot|onPointerDown|onClick|onKeyDown|AnimatePresence|layout|whileTap|tap|focus-visible|webkit-tap-highlight (**/src/**/*.{ts,tsx,css}), 193 results

Read 

Read 

I’ve confirmed the 4C row/timer code; next I’m checking parent gesture handlers and focused-card CSS states to identify whether the flicker is coming from focus/tap styling versus motion re-layout.

Searched for regex :focus(?!-visible)|:active|tap-highlight|focused-card-signal-slot|focused-card-object|focused-card-back-shell|focused-card-signal-value|transition (**/src/app/globals.css), 20 results

Read , lines 1400 to 1705

Read , lines 240 to 368

Read , lines 712 to 752

I’ve narrowed the strongest suspect to touch/click feedback styling rather than mount logic; I’m quickly checking nearby interaction components to confirm whether propagation/layout patterns match and then I’ll give you the report-only diagnosis.

Read , lines 248 to 310

Read , lines 1368 to 1412

Read 

Reproduction Summary

I did a read-only investigation and did not change code.

I cannot directly confirm the visual frame-by-frame flicker in-browser from this pass, but the reported symptom strongly matches tap/click feedback appearing before the reveal state update.

Most likely visible sequence on tap:

Row receives touch/click feedback momentarily.

Click handler runs and sets visibility true.

Number opacity transition starts.

This creates a perceptible pre-reveal flash.

Current 4C Implementation Trace

Visibility state is local per row in FocusedSignalRow at BackCardFaceContent.tsx.

Tap/click reveal is triggered via onClick at BackCardFaceContent.tsx.

Timer logic:

Clears existing timer in clearHideTimer at BackCardFaceContent.tsx.

Starts 3000ms timer in showValueTemporarily at BackCardFaceContent.tsx.

Cleanup on unmount at BackCardFaceContent.tsx.

Number is always mounted (not conditionally mounted/unmounted): span remains in DOM at BackCardFaceContent.tsx.

CSS hide/show:

Base hidden opacity + transition at globals.css.

Hidden class at globals.css.

Visible class at globals.css.

Likely Cause

Most probable cause: tap/click feedback flash on the interactive row before reveal state is applied.

Why this is likely:

Reveal is on click, which fires after pointer down/up, so there is a short delay window before number transition starts.

The row is button-like (role button + tabIndex) at BackCardFaceContent.tsx, but it does not explicitly neutralize mobile tap highlight.

There is a focus-visible outline rule at globals.css that can contribute visible feedback depending on device/input mode.

Secondary cause (lower probability): input-mode-dependent focus ring/default focus paint on the row.

Low probability causes:

Mount/unmount flicker (not happening; element stays mounted).

Motion layout jump (no direct AnimatePresence/layout around signal rows themselves).

Evidence

No mount/unmount path for number: BackCardFaceContent.tsx.

Reveal tied to click timing: BackCardFaceContent.tsx.

Row is interactive and focusable: BackCardFaceContent.tsx.

Focus-visible style exists on row: globals.css.

No row-specific tap-highlight reset, while another interactive control explicitly uses one at globals.css.

Parent motion/gestures exist at card-object level:

Motion container with gesture handlers: FocusedCardView.tsx.

Gesture onPointerDown path: useDeckGestures.ts.

But row already stops propagation on pointer down and click:

BackCardFaceContent.tsx

BackCardFaceContent.tsx

Recommended Fix (Conceptual Only, Not Implemented)

Keep current mounted-span strategy (already correct).

Make reveal start on pointer down for immediate response, then keep existing 3s timer reset behavior.

Neutralize touch highlight/default tap paint on the signal row for mobile input.

Preserve keyboard accessibility and keep dedicated focus-visible styling for keyboard paths only.

Keep stopPropagation minimal and local on row events as currently done.

Risk Check

Number positioning: unaffected by the conceptual fix, since positioning helper and CSS transform remain unchanged in PulseFieldSignal.tsx and globals.css.

Debug borders: unaffected; debug class remains in globals.css.

Future drag implementation: compatible, because local per-row visibility/timer ownership remains in place.

Card flip behavior: low risk if propagation boundaries stay local to row and no global gesture code is altered.

Persistence architecture: unaffected; no backend or persistence state involved.



2nd

I’m applying the two targeted changes now: move reveal to pointer down for immediate touch/mouse feedback, and add tap-highlight neutralization on the signal row while keeping keyboard reveal behavior intact.

Generating patch (13 lines) in [](file:///Users/peterdomokos/projects/switchplay-app/src/components/decks/BackCardFaceContent.tsx)


```

```


Generating patch (11 lines) in [](file:///Users/peterdomokos/projects/switchplay-app/src/app/globals.css)


```

```
The handler/CSS updates are in place with no extra behavior changes. I’m running a build now to verify everything still compiles cleanly.

Ran terminal command:  npm run build

I’ve finished implementation and build validation; I’m pulling exact line references for the event and CSS deltas so the report is precise.

Read [](file:///Users/peterdomokos/projects/switchplay-app/src/components/decks/BackCardFaceContent.tsx#44-44), lines 44 to 95

Read [](file:///Users/peterdomokos/projects/switchplay-app/src/app/globals.css#1568-1568), lines 1568 to 1588

Implemented only the two requested changes.

Files changed
- BackCardFaceContent.tsx
- globals.css

Exact event handler changes
- In BackCardFaceContent.tsx:
1. onPointerDown now calls showValueTemporarily() immediately.
2. onClick no longer calls showValueTemporarily(); it now only stops propagation.
- Keyboard behavior remains unchanged:
- Enter/Space still call showValueTemporarily() in onKeyDown at BackCardFaceContent.tsx.

Exact CSS changes
- Added mobile tap highlight neutralization on the signal row:
- -webkit-tap-highlight-color: transparent; in globals.css.
- Kept focus-visible styling intact in globals.css.

Click handling and keyboard accessibility
- Click handling remains, but now only for propagation control (no reveal trigger), so pointer users reveal on pointer down without click-delay/double-trigger.
- Keyboard accessibility remains via onKeyDown (Enter/Space) exactly as before.

Build result
- npm run build passed successfully.

Scope confirmation
- No timer changes.
- No positioning changes.
- No drag/persistence/gesture-shield changes.
- Debug borders remain.

Made changes.