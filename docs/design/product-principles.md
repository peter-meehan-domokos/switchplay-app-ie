# Switchplay Product Principles

## Core User

Switchplay is primarily designed for ambitious younger users aged roughly 16–25 who are highly motivated by progression, self-improvement, performance, and skill development.

The initial core user archetype is:
- football-focused
- gym-focused
- interested in athletic performance
- interested in physique/body composition
- interested in calisthenics or movement skills
- socially connected through sport/training culture
- mobile-native in behaviour and expectations

The user is not primarily motivated by productivity or organisation.

They are motivated by:
- progression
- momentum
- achievement
- skill mastery
- visible improvement
- social encouragement
- consistency over time

## Product Feel

The app should feel:
- modern
- tactile
- energetic
- smooth
- progression-focused
- spatial
- touch-first
- mobile-native

The interaction model should feel closer to:
- handling physical decks/cards
- progressing through stages
- advancing through milestones

rather than:
- managing spreadsheets
- filling in forms
- using enterprise dashboards

## Interaction Philosophy

Interactions should prioritise:
- object continuity
- gesture-friendly movement
- spatial relationships
- smooth transitions
- tactile layering
- quick recognition
- momentum

Avoid:
- abrupt screen replacements
- excessive text-heavy layouts
- corporate productivity aesthetics
- cluttered desktop-style interfaces
- overly childish gamification

## Design Philosophy

The UI should balance:
- focus
- athletic energy
- clarity
- depth
- movement
- emotional feeling of progression

Animations should support:
- continuity
- spatial understanding
- physical/tactile feeling

rather than decorative spectacle.

## Preserve Rich State, Simplify Presentation

Where possible, Switchplay should preserve richer underlying state than is currently displayed.

The application should avoid throwing away information simply because the current interface chooses not to show it.

Example:

Signal readings are stored with decimal precision but currently displayed as whole numbers.

Storage:

```txt
1.83
```

Display:

```txt
2
```

This allows presentation choices to evolve without data migration or loss of user intent.

Prefer:

```txt
Rich storage
↓
Simplified display
```

Over:

```txt
Simplified storage
↓
Simplified display
```
