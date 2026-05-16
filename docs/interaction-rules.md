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