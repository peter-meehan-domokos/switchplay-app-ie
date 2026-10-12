"use client";

import { useId } from "react";
import type { CoordinatePlaneScene, FunctionPlotScene, GraphScene, RootMarkerGroupScene, Segment } from "../../core/graph/types";
import styles from "./MathUI.module.css";

const Segments = ({ segments }: { segments: readonly Segment[] }) => <>{segments.map((segment, index) => (
  <line key={index} x1={segment.start.x} y1={segment.start.y} x2={segment.end.x} y2={segment.end.y} />
))}</>;

const CoordinatePlane = ({ scene }: { scene: CoordinatePlaneScene }) => (
  <g aria-hidden="true">
    <g className={styles.spvGrid}><Segments segments={scene.grid} /></g>
    <g className={styles.spvAxes}><Segments segments={scene.axes} /><Segments segments={scene.ticks} /></g>
    <g className={styles.spvTicks}>{scene.tickLabels.map((label, index) => <text key={index} x={label.position.x} y={label.position.y} textAnchor={label.anchor}>{label.text}</text>)}</g>
    <g className={styles.spvAxisLabels}>{scene.axisLabels.map((label) => <text key={label.text} x={label.position.x} y={label.position.y} textAnchor={label.anchor}>{label.text}</text>)}</g>
  </g>
);

const FunctionPlot = ({ scene, clipId }: { scene: FunctionPlotScene; clipId: string }) => (
  <g clipPath={`url(#${clipId})`} aria-hidden="true">
    <path className={styles.spvCurve} d={scene.path} data-spv-curve />
  </g>
);

const RootMarkerGroup = ({ scene }: { scene: RootMarkerGroupScene }) => (
  <g aria-hidden="true" data-spv-roots>
    {scene.markers.filter((marker) => marker.haloRadius !== null).map((marker) => <circle key={marker.id} className={styles.spvHalo} cx={marker.center.x} cy={marker.center.y} r={marker.haloRadius!} data-spv-halo />)}
    <g className={styles.spvMovementCue} data-spv-movement-cue><Segments segments={scene.markers.flatMap((marker) => marker.movementCue)} /></g>
    {scene.markers.map((marker) => (
      <g key={marker.id} className={marker.role === "moving-root" ? styles.spvMovingRoot : styles.spvFixedRoot} data-spv-root={marker.id}>
        <circle cx={marker.center.x} cy={marker.center.y} r={marker.visibleRadius} />
        {marker.labelBackground ? <rect className={styles.spvPositionBadge} {...marker.labelBackground} rx={7} /> : null}
        <text x={marker.positionLabel.position.x} y={marker.positionLabel.position.y} textAnchor={marker.positionLabel.anchor}>{marker.positionLabel.text}</text>
      </g>
    ))}
  </g>
);

export default function MathGraph({ scene }: { scene: GraphScene }) {
  const id = useId();
  const clipId = `${id}-plot`;
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  return (
    <svg className={styles.spvGraph} viewBox={`0 0 ${scene.size.width} ${scene.size.height}`} role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <title id={titleId}>Quadratic graph</title>
      <desc id={descriptionId}>{scene.accessibleDescription}</desc>
      <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect {...scene.curve.clip} /></clipPath></defs>
      <CoordinatePlane scene={scene.plane} />
      <FunctionPlot scene={scene.curve} clipId={clipId} />
      <RootMarkerGroup scene={scene.roots} />
    </svg>
  );
}
