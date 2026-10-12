import { immutable } from "../immutable";
import type { LinearFactor } from "../math/realFactors";
import { coordinatePlaneLayout } from "./coordinatePlaneLayout";
import { functionPlotLayout } from "./functionPlotLayout";
import { rootMarkerGroupLayout } from "./rootMarkerGroupLayout";
import type { Bounds, CoordinatePlaneScene, GraphScene, MarkerPresentation, Size } from "./types";
import type { RootInputPolicy } from "../interaction/rootInteraction";

export const graphLayout = (input: Readonly<{
  size: Size; xDomain: Bounds; yDomain: Bounds; evaluate: (x: number) => number;
  landmarks: readonly number[]; factors: readonly LinearFactor[]; accessibleDescription: string;
  markerPresentation?: MarkerPresentation;
  inputPolicy?: RootInputPolicy;
  displayRoots?: Readonly<Record<string, number>>;
  /** Optional pure prepared frame, reused while only the polynomial changes. */
  plane?: CoordinatePlaneScene;
}>): GraphScene => {
  const plane = input.plane ?? coordinatePlaneLayout(input.size, input.xDomain, input.yDomain);
  if (plane.size.width !== input.size.width || plane.size.height !== input.size.height ||
      plane.projection.xDomain.some((value, index) => value !== input.xDomain[index]) ||
      plane.projection.yDomain.some((value, index) => value !== input.yDomain[index])) {
    throw new RangeError("Prepared coordinate frame must match the graph dimensions and domains.");
  }
  return immutable({
    size: { ...input.size }, plane,
    curve: functionPlotLayout(plane.projection, input.evaluate, input.landmarks),
    roots: rootMarkerGroupLayout(plane.projection, input.factors, input.markerPresentation, input.inputPolicy, input.displayRoots),
    accessibleDescription: input.accessibleDescription,
  });
};
