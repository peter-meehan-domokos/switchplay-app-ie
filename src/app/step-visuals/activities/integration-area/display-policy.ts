import { formatValue } from "./model";

/** Approved Stage 1 readout policy, not the continuous region used for geometry. */
export function stageOneReadout(position: number) {
  if (!Number.isFinite(position)) throw new RangeError("The boundary must be finite.");
  const boundary = Math.round(position * 10) / 10;
  return Object.freeze({ boundary, area: 2 * boundary,
    boundaryText: formatValue(boundary, 1).text, areaText: formatValue(2 * boundary, 1).text });
}
