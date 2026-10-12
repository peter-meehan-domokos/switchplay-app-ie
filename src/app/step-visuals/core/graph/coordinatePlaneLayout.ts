import { scaleLinear } from "d3-scale";
import { immutable } from "../immutable";
import { finiteNumber, formatNumber } from "../math/realFactors";
import type { Bounds, CoordinatePlaneScene, Point, ProjectionSpec, Size } from "./types";

const validateBounds = (bounds: Bounds) => {
  bounds.forEach(finiteNumber);
  if (bounds[0] >= bounds[1]) throw new RangeError("Domains must be increasing and non-degenerate.");
};

export const projectPoint = (projection: ProjectionSpec, point: Point): Point => immutable({
  x: scaleLinear(projection.xDomain, projection.xRange)(finiteNumber(point.x)),
  y: scaleLinear(projection.yDomain, projection.yRange)(finiteNumber(point.y)),
});

export const unprojectPoint = (projection: ProjectionSpec, point: Point): Point => immutable({
  x: scaleLinear(projection.xDomain, projection.xRange).invert(finiteNumber(point.x)),
  y: scaleLinear(projection.yDomain, projection.yRange).invert(finiteNumber(point.y)),
});

export const coordinatePlaneLayout = (size: Size, xDomain: Bounds, yDomain: Bounds): CoordinatePlaneScene => {
  validateBounds(xDomain);
  validateBounds(yDomain);
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 160 || size.height < 160) {
    throw new RangeError("Graph dimensions must be finite and at least 160 pixels.");
  }
  if (xDomain[0] > 0 || xDomain[1] < 0 || yDomain[0] > 0 || yDomain[1] < 0) {
    throw new RangeError("This coordinate plane requires both domains to contain zero.");
  }
  const plot = { x: 34, y: 24, width: size.width - 54, height: size.height - 52 };
  const projection: ProjectionSpec = {
    xDomain: [...xDomain], yDomain: [...yDomain],
    xRange: [plot.x, plot.x + plot.width], yRange: [plot.y + plot.height, plot.y], plot,
  };
  const x = scaleLinear(projection.xDomain, projection.xRange);
  const y = scaleLinear(projection.yDomain, projection.yRange);
  const xTicks = x.ticks(12);
  const yTicks = y.ticks(Math.max(2, Math.floor(plot.height / 52)));
  return immutable({
    projection,
    axes: [
      { start: { x: plot.x, y: y(0) }, end: { x: plot.x + plot.width, y: y(0) } },
      { start: { x: x(0), y: plot.y }, end: { x: x(0), y: plot.y + plot.height } },
    ],
    grid: [
      ...xTicks.filter((value) => value !== 0).map((value) => ({ start: { x: x(value), y: plot.y }, end: { x: x(value), y: plot.y + plot.height } })),
      ...yTicks.filter((value) => value !== 0).map((value) => ({ start: { x: plot.x, y: y(value) }, end: { x: plot.x + plot.width, y: y(value) } })),
    ],
    ticks: xTicks.map((value) => ({ start: { x: x(value), y: y(0) - 3 }, end: { x: x(value), y: y(0) + 3 } })),
    tickLabels: [
      ...xTicks.map((value) => ({ position: { x: x(value), y: y(0) + 19 }, text: formatNumber(value), anchor: "middle" as const })),
      ...yTicks.filter((value) => value !== 0).map((value) => ({ position: { x: plot.x - 8, y: y(value) + 4 }, text: formatNumber(value), anchor: "end" as const })),
    ],
    axisLabels: [
      { position: { x: plot.x + plot.width, y: y(0) - 10 }, text: "x", anchor: "end" },
      { position: { x: x(0) + 10, y: plot.y - 8 }, text: "y", anchor: "start" },
    ],
  });
};
