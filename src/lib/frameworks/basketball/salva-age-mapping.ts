import { range } from "d3-array";
import type { CustomFilter } from "../customFilters";

// First age at which each skill appears in the Salva Revised worksheet.
// The spreadsheet uses U9-U11, U12, U13, U14-U15, U16-U18 and U20.
// Here U20 is interpreted as ages 19-20.
// Once introduced, a skill remains available at subsequent ages.
// An Item with no entry here is intentionally unaffected by the age filter.
export const itemMinimumAge: Readonly<Record<string, number>> = {
  // Age 9 (42 skills)
  "basic-defensive-position": 9,
  "use-of-hand-steal-interception": 9,
  "line-pass-defense": 9,
  "defense-movements": 9,
  "defense-man-between-man-and-basket": 9,
  "man-to-man-defense-half-court": 9,
  "man-to-man-defense-full-court": 9,
  "transition-defense": 9,
  "dribbling-static-dynamic-both-hands": 9,
  "in-out-dribble": 9,
  "crossover": 9,
  "lay-up-s-both-hands": 9,
  "two-foot-finish-jump-stop-stride-stop": 9,
  "reverse-lay-up": 9,
  "pass-and-cut": 9,
  "pass-and-exchange": 9,
  "work-reception": 9,
  "catch-and-attack": 9,
  "open-exit-open-first-step": 9,
  "cross-exit-cross-first-step": 9,
  "exit-fakes": 9,
  "shooting-fakes": 9,
  "shoting-stationary": 9,
  "jump-stop": 9,
  "1-2-stop": 9,
  "shot-after-dribble": 9,
  "chest-pass-bounce-pass-overhead": 9,
  "fast-break-pass": 9,
  "pass-to-player-moving-cutting": 9,
  "act-react-defense-to-offense": 9,
  "fast-break": 9,
  "occupied-the-right-spot": 9,
  "1x0": 9,
  "1x1": 9,
  "1x1-1": 9,
  "2x0": 9,
  "2x2": 9,
  "2x1": 9,
  "2x2-1": 9,
  "3x0": 9,
  "3x2": 9,
  "3x3": 9,

  // Age 12 (12 skills)
  "bump-and-defense": 12,
  "recuperation-position-once-i-have-been-beaten": 12,
  "use-of-the-court-line-as-a-defensive-tool": 12,
  "defensive-rebound": 12,
  "advanced-dribble-moves": 12,
  "1-hand-passing-baseball-under-arm-behind-the-back": 12,
  "pass-off-dribble": 12,
  "defensive-rebound-offensive": 12,
  "defensive-rebound-offensive-collective": 12,
  "4x0": 12,
  "4x4": 12,
  "5x5": 12,

  // Age 13 (16 skills)
  "1x1-defense-from-help-side-recovering": 13,
  "helps-on-defense": 13,
  "strong-and-weak-side-concept": 13,
  "first-help-concept": 13,
  "cut-defense-bump": 13,
  "man-to-man-defense-trap": 13,
  "lay-up-s-change-step-s": 13,
  "lost-step-1step": 13,
  "bomb-lay-up": 13,
  "euro-step": 13,
  "pro-hop-step-through": 13,
  "pass-and-screen-away": 13,
  "offense-against-man-to-man-by-concepts": 13,
  "offense-against-zone-press": 13,
  "3x3-1": 13,
  "4x4-1": 13,

  // Age 14 (15 skills)
  "second-help-concept": 14,
  "defensive-concept-of-help-and-switch-rotation": 14,
  "pick-and-roll-defense": 14,
  "screen-defense": 14,
  "pick-and-roll-defense-hedge": 14,
  "pick-and-roll-defense-trap": 14,
  "indirect-screen-defense-following": 14,
  "indirect-screen-defense-switch": 14,
  "indirect-screen-defense-cutting": 14,
  "low-post-defense-three-quarters": 14,
  "press-zone-1-2-1-1": 14,
  "low-post-movements-stop-and-cross-body-fakes": 14,
  "transition": 14,
  "offense-against-zone-defense-by-concepts": 14,
  "organized-offense-against-man-to-man-defense": 14,

  // Age 16 (8 skills)
  "pick-and-roll-defense-switch": 16,
  "indirect-screen-defense-body-check": 16,
  "low-post-defense-in-front": 16,
  "zone-defense": 16,
  "organized-offense-against-zone-defense": 16,
  "offense-movements-against-man-to-man-defense": 16,
  "offense-movements-against-zone-defense": 16,
  "5x0": 16,

  // Age 19 (1 skill)
  "mix-defense-3and-2-box-and-one": 19,
};

/** An Item is available once the selected age reaches its minimum age.
 *  Items with no mapping are always available. */
export function isAvailableAtAge(itemId: string, age: number): boolean {
  return !Object.hasOwn(itemMinimumAge, itemId) || age >= itemMinimumAge[itemId];
}

export const salvaAgeFilter: CustomFilter = {
  id: "age",
  label: "Age",
  options: range(9, 21).map((age) => ({ value: String(age), label: String(age) })),
  defaultValue: "20",
  // An unrecognised value cannot narrow the table, so it leaves every Item visible.
  includesItem: (itemId, value) => !Number.isInteger(Number(value)) || isAvailableAtAge(itemId, Number(value)),
};
