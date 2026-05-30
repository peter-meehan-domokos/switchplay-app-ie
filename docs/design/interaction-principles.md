## Card Stack Visibility Rule

In deck detail view, the weekly cards should be stacked to balance context and focus.

The active card should occupy most of the screen.

The next two cards behind the active card should remain visibly readable enough to show:
- card title
- target date
- basic header context

Any cards beyond the next two should be compressed into closer slivers. These later cards do not need readable detail; they only need to show that more cards remain in the deck.

Do not space all cards evenly.

This creates a sense of progression while preserving screen space for the current card.

## Motion Architecture Philosophy

In Switchplay, motion is part of the interaction structure rather than a decorative layer.

Use Motion for React from the beginning of implementation to establish:
- object continuity
- spatial relationships
- spring-based layout behaviour
- animated transitions between states

Prioritise:
- layout animations
- shared element transitions
- simple spring motion

Delay advanced gesture complexity until layout and interaction structure are stable.

## Navigation Gesture Philosophy

Deck gestures should interpret user intent rather than simulate every frame of card physics.

The intended interaction model is:
- user drag provides a light preview
- crossing a conservative threshold commits intent
- the authored cinematic transition completes the action

Distance matters more than velocity. Velocity may assist a nearly committed gesture, but should not overpower short accidental flicks.

Keep gesture logic out of deck/card rendering components. Components render card state; gesture hooks interpret intent; motion files define how state changes feel.

## Active Card Principle

At any moment, one weekly card is considered the active card.

The active card:
- occupies the primary visual focus
- sits closest to the user
- contains the most readable content
- drives the surrounding stack geometry

Changing the active card should smoothly reposition the stack while preserving spatial continuity.

## Temporal Stack Principle

The card stack represents temporal progression through a deck.

Spatial positioning should reinforce time direction:

- future/upcoming cards sit behind and above the active card
- completed/past cards settle below the active card
- the active card remains central and dominant

This should feel like:
- progressing through a physical deck
- laying completed cards down onto a surface
- moving forward through stages over time

Past cards may gradually compress and reduce detail as the completed stack grows.

## Semantic Anchor Stability

Cards should preserve stable semantic anchor regions across all zoom levels and interaction states.

Core identity elements should remain spatially consistent:
- week number
- date
- completion/progress strip

Cards should reveal or suppress detail through semantic zooming rather than reflowing or reorganising identity regions.

The user should perceive:
- the same object
- at different scales of information density

NOT:
- different UI layouts replacing one another.

## Card Progress Strip

Each card has a compact progress strip under the week label.

The strip represents rough completion progress for that card.

Initial calculation:
- completed items / total items
- completed means `completionStatus === "done"`
- rounded to nearest whole percentage

The strip should be a single compact horizontal indicator, not a full-width dashboard bar and not separate task segments.

It should function as a persistent semantic anchor across card states.

## Stable Card Anatomy

All cards should render the same core anchor structure across states:

- week label in the top-left
- compact progress strip below the week label
- date in the top-right

These elements should remain part of the card anatomy even when they become partially hidden, scaled down, overlapped, clipped, or difficult to read.

Semantic zoom should happen through scale, opacity, clipping, overlap, and progressive reduction of detail layers — not by changing the core card layout.

Detailed content may fade or disappear, but core identity anchors should remain structurally present.

## Gesture Interaction Principles

The deck is not a generic swipe interface. Gestures should preserve the feeling of handling memory objects in an atmospheric physical space.

### Core principle

**Gestures suggest intent → authored cinematic transition completes the action.**

The gesture should not feel like throwing cards away or flicking through disposable content. It should feel like moving through a personal journey.

### Swipe down on active card

Swipe down means the present card settles into history.

It should feel:

* weighted
* calm
* slightly resistant
* intentional
* absorptive rather than ejective

It should not feel like:

* dismissal
* rejection
* closing a modal
* Tinder-style card throwing
* mechanical pagination

For MVP:

* use partial drag follow, not 1:1 finger tracking
* use a follow ratio around 35–50%
* use a commitment threshold around 120–180px or 18–28% of viewport height
* prioritise distance over velocity
* allow velocity to assist slightly, but not dominate

In deck mode, this gesture maps to the semantic intent `settleToPast` and advances to the next card in deck order.

### Swipe up on active card

Swipe up should feel like restoring a past/table card into presence. In deck mode, this maps to the semantic intent `restoreFromPast` and moves to the previous card in deck order.

### Focus

Focusing a card should feel like deepening attention on the same object, not opening a separate modal. The card should remain continuous with the deck world.

### Defocus

Defocus should feel like releasing attention back into the deck environment, not closing a window.

### Flip

Flip should feel intimate and intentional. It is a transition between action and reflection, not a card trick. Avoid overly playful 3D rotation or velocity-driven flipping.


## Relative Interaction Principle

Where possible, Switchplay should favour relative manipulation over absolute manipulation.

Example:

Signal editing uses relative drag.

The user begins from the current state and adjusts it through movement.

Avoid interactions that immediately jump an object to the pointer location.

Preferred:

```txt
Current state
↓
User drags
↓
State changes relative to movement
```

Avoid:

```txt
Touch location
↓
Object jumps to touch position
```

Relative interaction preserves object continuity and strengthens the feeling that users are manipulating an existing object rather than issuing commands to software.
