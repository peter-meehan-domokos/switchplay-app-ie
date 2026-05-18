# Switchplay Design System

## Core Principles
- Dense but readable UI
- Minimal chrome
- Focus on progression and interaction
- Fluid animated transitions
- Strong visual hierarchy

## Layout Rules
- Use CSS Grid for main layouts
- Sidebar collapses below tablet width
- Max content width: 1400px

## Components
### Cards
- Rounded corners: 16px
- Subtle hover elevation
- Minimal borders

### Buttons
- No gradients
- Use motion instead of flashy styling

## Typography
- Clean sans-serif
- Large section headings
- Tight vertical rhythm

## Animation
- Framer Motion only
- Fast transitions
- No bounce physics

## Content Principle

Mock content should never be generic filler.

Even placeholder content should feel like it belongs to the Switchplay product world: football development, gym progression, calisthenics skills, body composition, teamwork, encouragement, and weekly achievement.

## Deck and Card Visual Metaphor

Decks and cards should be represented using standard React HTML and CSS, not SVG or canvas.

A deck is a visual stack of rectangular cards.

A card is a rounded rectangle surface with a clear header area.

The UI should feel like handling physical cards:
- layered
- tactile
- slightly offset
- spatially coherent
- touch-friendly

In overview mode, deck tiles show a small decorative stack where detailed card content is not readable.

In detail mode, the selected deck expands into a larger stack of weekly cards.

## Phase 1 Visual Direction

The initial deck grid should use large, tactile deck tiles with readable titles and small physical card-stack thumbnails.

The deck detail screen should feel like the selected deck has expanded into a focused physical stack.

The design direction is dark, athletic, mobile-first and card-based, with strong emphasis on object continuity and progression.

## Interaction Geometry Constants

Important spatial interaction values should be centralised in reusable constants files.

Examples include:
- card stack offsets
- scale reductions
- compressed stack spacing
- animation timing values
- interaction geometry

These values are part of the interaction language of the app and should be easy to tune globally.

Do not prematurely create a full design-token system.

## Weekly Card Header Rule

In deck detail view, the active card and the next two context cards should show readable header information.

Visible headers should include:
- target date
- week title

The week title and date should feel like compact metadata, not large page headings.

Cards beyond the next two context cards may compress into visual slivers and do not need readable text.

## Focus Mode Continuity

Focus mode should preserve the same semantic anatomy as active mode.

The focused card is not a separate modal or different content view. It is the same authored card entering attention.

Active and focused states should share the same core card structure wherever possible:
- card header
- intro media/title
- progression fragments

Focus mode may increase space, clarity, and interaction depth, but it should not replace the card’s internal content structure.