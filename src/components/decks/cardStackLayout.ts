export type CardStackZone = "past" | "active" | "future";

// Deck Cards are Framer layout elements inside the plain-CSS scene scaler. Without a layout
// dependency Framer re-snapshots every Card on every React render, and under a scene scale below 1
// that snapshot is wrong by (1 - scale) x the Card's own transform (Framer cannot see the scaler),
// so an unrelated render (resource refresh, resume, update check) animates the stack down and back.
// This value changes only when the Card's layout box or shared-layout role can really change:
// - its zone (past Cards use a different placement; zone changes are navigation),
// - whether it is the Card being focused (the Deck-to-focused-Card layoutId morph),
// - the scene scale (its on-screen box changes).
export function buildCardLayoutDependency({ zone, focusModeOpen, sceneScale }: { zone: CardStackZone; focusModeOpen: boolean; sceneScale: number }) {
  return `${zone}:${zone === "active" && focusModeOpen ? "focused" : "stack"}:${sceneScale}`;
}
