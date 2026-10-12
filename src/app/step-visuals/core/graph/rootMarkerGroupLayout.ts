import { immutable } from "../immutable";
import { formatNumber, type LinearFactor } from "../math/realFactors";
import { projectPoint } from "./coordinatePlaneLayout";
import type { MarkerPresentation, ProjectionSpec, RootMarkerGroupScene, Segment } from "./types";

export const rootMarkerGroupLayout = (projection: ProjectionSpec, factors: readonly LinearFactor[], presentation: MarkerPresentation = "orientation"): RootMarkerGroupScene => {
  const coincident = factors.length > 1 && factors.every((factor) => factor.root === factors[0].root);
  const fixedCenter = factors.length ? projectPoint(projection, { x: factors[0].root, y: 0 }) : null;
  return immutable({
    coincident,
    markers: factors.map((factor, index) => {
      const center = projectPoint(projection, { x: factor.root, y: 0 });
      const moving = index !== 0;
      const closeToFixed = moving && fixedCenter !== null && Math.abs(center.x - fixedCenter.x) < 60;
      const fixedCloseToMoving = !moving && factors.slice(1).some((other) => Math.abs(projectPoint(projection, { x: other.root, y: 0 }).x - center.x) < 60);
      const labelX = Math.max(projection.plot.x + 26, Math.min(projection.plot.x + projection.plot.width - 26, center.x));
      const labelY = moving ? Math.max(projection.plot.y + 20, center.y - 46) : center.y + (coincident || fixedCloseToMoving ? 38 : -18);
      const movementCue: Segment[] = [];
      if (moving && presentation === "orientation") {
        for (const direction of [-1, 1]) {
          const startX = center.x + direction * 12;
          const endX = center.x + direction * 24;
          const crossesFixed = closeToFixed && !coincident && fixedCenter !== null && Math.abs(fixedCenter.x - center.x) < 34 && Math.sign(fixedCenter.x - center.x) === direction;
          if (crossesFixed || endX < projection.plot.x + 2 || endX > projection.plot.x + projection.plot.width - 2) continue;
          movementCue.push(
            { start: { x: startX, y: center.y }, end: { x: endX, y: center.y } },
            { start: { x: endX - direction * 4, y: center.y - 3 }, end: { x: endX, y: center.y } },
            { start: { x: endX - direction * 4, y: center.y + 3 }, end: { x: endX, y: center.y } },
          );
        }
      }
      return {
        id: factor.id, center, visibleRadius: moving ? 6 : coincident ? 9 : 4.5,
        role: index === 0 ? "fixed-root" as const : "moving-root" as const,
        haloRadius: moving && presentation !== "locked" ? 17 : null,
        movementCue,
        hitRegion: moving ? { x: center.x - 24, y: center.y - 24, width: 48, height: 48 } : null,
        labelBackground: moving ? { x: labelX - 26, y: labelY - 16, width: 52, height: 22 } : null,
        positionLabel: {
          position: { x: moving ? labelX : center.x, y: labelY },
          text: `x = ${formatNumber(factor.root)}`, anchor: "middle" as const,
        },
      };
    }),
  });
};
