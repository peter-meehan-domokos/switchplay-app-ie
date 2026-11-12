"use client";

import { useId, useMemo } from "react";
import { card1SparklineLayout, type SparklineGraphScene, type SparklineVariant } from "../core/sparklines/card1SparklineLayout";
import type { FactorExpressionScene } from "../core/expressions/factorExpressionLayout";
import { useSparklineWidth } from "../platform/web/sparklineMeasurement";
import styles from "./Sparkline.module.css";
import { createCard1Math, type RootInteger } from "../activities/roots-factors/model";

export type Card1SparklineProps = Readonly<{
  /** Static v1 snapshots use settled integer roots from −5 to 5. */
  movingRoot?: RootInteger;
  variant?: SparklineVariant;
  width?: number;
  graphHeight?: number;
}>;

function SparklineGraph({ scene }: { scene: SparklineGraphScene }) {
  const id = useId();
  const clipId = `${id}-sparkline-clip`;
  const titleId = `${id}-sparkline-title`;
  const descriptionId = `${id}-sparkline-description`;
  return <svg className={styles.spvSparklineGraph} width={scene.size.width} height={scene.size.height}
    viewBox={`0 0 ${scene.size.width} ${scene.size.height}`} preserveAspectRatio="xMidYMid meet"
    role="img" aria-labelledby={titleId} aria-describedby={descriptionId} data-spv-sparkline-graph>
    <title id={titleId}>Quadratic sparkline</title>
    <desc id={descriptionId}>{scene.accessibleDescription}</desc>
    <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect {...scene.curve.clip} /></clipPath></defs>
    <g className={styles.spvSparklineAxes} aria-hidden="true">
      {scene.axes.map((axis, index) => <line key={index} x1={axis.start.x} y1={axis.start.y} x2={axis.end.x} y2={axis.end.y} />)}
    </g>
    <g clipPath={`url(#${clipId})`} aria-hidden="true"><path className={styles.spvSparklineCurve} d={scene.curve.path} data-spv-sparkline-curve /></g>
    <g aria-hidden="true">{scene.roots.map((root) => <circle key={root.id} cx={root.center.x} cy={root.center.y} r={root.radius}
      className={root.role === "fixed-root" ? styles.spvSparklineFixedRoot : styles.spvSparklineMovingRoot} data-spv-sparkline-root={root.id} />)}</g>
    <g className={styles.spvSparklineRootLabels} aria-hidden="true">
      {scene.rootLabels.map((label, index) => <text key={index} x={label.position.x} y={label.position.y}
        textAnchor={label.anchor} data-spv-sparkline-root-label>{label.text}</text>)}
    </g>
  </svg>;
}

function SparklineNotation({ scene }: { scene: FactorExpressionScene }) {
  return <p className={styles.spvSparklineNotation} role="math" aria-label={scene.accessibleDescription}>
    <span aria-hidden="true">{scene.prefix}</span>
    {scene.factors.map((factor) => <span key={factor.id} aria-hidden="true"
      className={factor.role === "fixed-root" ? styles.spvSparklineFixedFactor : styles.spvSparklineMovingFactor}>{factor.text}</span>)}
  </p>;
}

/** Static presentation only. Mathematical state and any controls belong to its host. */
export default function Card1Sparkline({ movingRoot = 3, variant = "complete", width = 240, graphHeight = 112 }: Card1SparklineProps) {
  createCard1Math(movingRoot);
  if (!Number.isFinite(width) || width < 48 || !Number.isFinite(graphHeight) || graphHeight < 48) throw new RangeError("Invalid sparkline dimensions.");
  const { ref, width: availableWidth } = useSparklineWidth(width);
  const scene = useMemo(() => card1SparklineLayout(movingRoot, { width: availableWidth, height: graphHeight }, variant), [movingRoot, availableWidth, graphHeight, variant]);
  return <div ref={ref} className={styles.spvSparkline} style={{ width, maxWidth: "100%" }} data-spv-sparkline={variant} data-spv-sparkline-value={movingRoot}>
    {scene.graph ? <SparklineGraph scene={scene.graph} /> : null}
    {scene.expression ? <SparklineNotation scene={scene.expression} /> : null}
  </div>;
}
