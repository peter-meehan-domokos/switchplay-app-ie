import { lazy } from "react";

// Explicit compiled imports only. Creator input never becomes a module path or URL.
const Roots = lazy(() => import("@/app/step-visuals/activities/roots-factors/HostedRootsFactors"));
export function interactiveVisualComponent(id: string) {
  return id === "roots-and-factors" ? Roots : null;
}
