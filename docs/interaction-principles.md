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