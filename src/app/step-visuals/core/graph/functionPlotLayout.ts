import { range } from "d3-array";
import { scaleLinear } from "d3-scale";
import { curveLinear, line } from "d3-shape";
import { immutable } from "../immutable";
import { finiteNumber } from "../math/realFactors";
import type { FunctionPlotScene, PlotSample, ProjectionSpec } from "./types";

/** Keep offscreen samples: clipping, not y-clamping, preserves the real curve. */
export const functionPlotLayout = (
  projection: ProjectionSpec,
  evaluate: (x: number) => number,
  landmarks: readonly number[],
  intervals = 200,
): FunctionPlotScene => {
  if (!Number.isInteger(intervals) || intervals < 2 || intervals > 100_000) throw new RangeError("Invalid sample interval count.");
  const [minimum, maximum] = projection.xDomain;
  landmarks.forEach(finiteNumber);
  const positions = [...new Set([
    ...range(intervals + 1).map((index) => minimum + (maximum - minimum) * index / intervals),
    ...landmarks.filter((value) => value >= minimum && value <= maximum),
  ])].sort((a, b) => a - b);
  const x = scaleLinear(projection.xDomain, projection.xRange);
  const y = scaleLinear(projection.yDomain, projection.yRange);
  const samples: PlotSample[] = positions.map((value) => {
    const result = evaluate(value);
    const position = Number.isFinite(result) ? { x: x(value), y: y(result) } : null;
    return { math: { x: value, y: Number.isFinite(result) ? result : null }, position: position && Number.isFinite(position.y) ? position : null };
  });
  const path = line<PlotSample>()
    .defined((sample) => sample.position !== null)
    .x((sample) => sample.position!.x)
    .y((sample) => sample.position!.y)
    .curve(curveLinear).digits(6)(samples) ?? "";
  return immutable({ path, clip: { ...projection.plot }, samples });
};
