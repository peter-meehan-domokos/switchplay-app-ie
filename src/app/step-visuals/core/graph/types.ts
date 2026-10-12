export type Bounds = readonly [number, number];
export type Size = Readonly<{ width: number; height: number }>;
export type Point = Readonly<{ x: number; y: number }>;
export type Rect = Readonly<Point & Size>;
export type Segment = Readonly<{ start: Point; end: Point }>;
export type PositionedLabel = Readonly<{ position: Point; text: string; anchor: "start" | "middle" | "end" }>;
export type ProjectionSpec = Readonly<{ xDomain: Bounds; yDomain: Bounds; xRange: Bounds; yRange: Bounds; plot: Rect }>;
export type CoordinatePlaneScene = Readonly<{
  projection: ProjectionSpec;
  axes: readonly Segment[];
  grid: readonly Segment[];
  ticks: readonly Segment[];
  tickLabels: readonly PositionedLabel[];
  axisLabels: readonly PositionedLabel[];
}>;
export type PlotSample = Readonly<{ math: Readonly<{ x: number; y: number | null }>; position: Point | null }>;
export type FunctionPlotScene = Readonly<{ path: string; clip: Rect; samples: readonly PlotSample[] }>;
export type RootMarkerScene = Readonly<{
  id: string;
  center: Point;
  visibleRadius: number;
  role: "fixed-root" | "moving-root";
  positionLabel: PositionedLabel;
  labelBackground: Rect | null;
  haloRadius: number | null;
  movementCue: readonly Segment[];
  hitRegion: Rect | null;
}>;
export type MarkerPresentation = "orientation" | "available" | "locked";
export type RootMarkerGroupScene = Readonly<{ markers: readonly RootMarkerScene[]; coincident: boolean }>;
export type GraphScene = Readonly<{
  size: Size;
  plane: CoordinatePlaneScene;
  curve: FunctionPlotScene;
  roots: RootMarkerGroupScene;
  accessibleDescription: string;
}>;
