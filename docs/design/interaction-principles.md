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