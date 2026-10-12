import { immutable } from "../immutable";
import type { LinearFactor } from "../math/realFactors";
import { coordinatePlaneLayout } from "./coordinatePlaneLayout";
import { functionPlotLayout } from "./functionPlotLayout";
import { rootMarkerGroupLayout } from "./rootMarkerGroupLayout";
import type { Bounds, GraphScene, MarkerPresentation, Size } from "./types";

export const graphLayout = (input: Readonly<{
  size: Size; xDomain: Bounds; yDomain: Bounds; evaluate: (x: number) => number;
  landmarks: readonly number[]; factors: readonly LinearFactor[]; accessibleDescription: string;
  markerPresentation?: MarkerPresentation;
}>): GraphScene => {
  const plane = coordinatePlaneLayout(input.size, input.xDomain, input.yDomain);
  return immutable({
    size: { ...input.size }, plane,
    curve: functionPlotLayout(plane.projection, input.evaluate, input.landmarks),
    roots: rootMarkerGroupLayout(plane.projection, input.factors, input.markerPresentation),
    accessibleDescription: input.accessibleDescription,
  });
};
