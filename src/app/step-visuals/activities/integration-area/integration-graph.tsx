"use client";

import { memo, useId, useMemo, useRef, type Dispatch } from "react";
import type { CoordinatePlaneScene, Segment } from "../../core/graph/types";
import { useGraphMeasurement } from "../../platform/web/measurement";
import { frameProfile, integrationGraphLayout, integrationPlaneLayout } from "./graph-layout";
import { boundaryBounds, effectiveRectangleCount, effectiveRegion, type Boundary, type IntegrationAction, type IntegrationState } from "./learning";
import { useBoundaryPointer } from "./use-boundary-pointer";
import styles from "./integration.module.css";

const Segments = ({ lines }: { lines: readonly Segment[] }) => <>{lines.map(({ start, end }, index) => <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />)}</>;
const Plane = memo(function Plane({ plane }: { plane: CoordinatePlaneScene }) {
  return <g aria-hidden="true" data-integration-plane>
    <g className={styles.grid}><Segments lines={plane.grid} /></g>
    <g className={styles.axes}><Segments lines={plane.axes} /><Segments lines={plane.ticks} /></g>
    <g className={styles.tick}>{[...plane.tickLabels, ...plane.axisLabels].map((label, index) => <text key={index} x={label.position.x} y={label.position.y} textAnchor={label.anchor}>{label.text}</text>)}</g>
  </g>;
});

export default function IntegrationGraph({ state, active, dispatch, className = "" }: { state: IntegrationState; active: boolean; dispatch: Dispatch<IntegrationAction>; className?: string }) {
  const { ref, size, ready } = useGraphMeasurement();
  const svgRef = useRef<SVGSVGElement>(null);
  const id = useId();
  const { stage, function: comparison, part } = state;
  const frame = frameProfile(stage, comparison);
  const plane = useMemo(() => integrationPlaneLayout(size, stage, comparison), [size, stage, comparison]);
  const { a, b, curves } = effectiveRegion(state);
  const rectangles = effectiveRectangleCount(state);
  const showReference = stage === 3;
  const aEnabled = active && ready && !!boundaryBounds(state, "a");
  const bEnabled = active && ready && !!boundaryBounds(state, "b");
  const interactive = useMemo(() => ([...(aEnabled ? ["a"] : []), ...(bEnabled ? ["b"] : [])] as Boundary[]), [aEnabled, bEnabled]);
  // Stable presentation/history changes do not prepare moving geometry again.
  const scene = useMemo(() => integrationGraphLayout({ a, b, curves, size, stage, comparison,
    rectangleCount: stage === 2 && part === "refine" || stage === 4 && comparison === "square" ? rectangles : undefined,
    showExcluded: stage === 5, showReference, showStrip: stage >= 6, interactive, plane }),
  [a, b, curves, size, stage, comparison, part, rectangles, showReference, interactive, plane]);
  const handlers = useBoundaryPointer(svgRef, plane.projection, state, active && ready, dispatch);
  return <div className={`${styles.graph} ${className}`} ref={ref} data-integration-graph>
    <svg ref={svgRef} className={styles.svg} data-frame={frame} data-x-domain={plane.projection.xDomain.join(",")} data-y-domain={plane.projection.yDomain.join(",")} viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>Area and boundaries graph</title><desc id={`${id}-description`}>{scene.description}</desc>
      <defs><clipPath id={`${id}-clip`}><rect {...plane.projection.plot} /></clipPath>
        {scene.curves.map((curve) => <clipPath key={curve.id} id={`${id}-${curve.id}-clip`}><rect {...curve.plot.clip} /></clipPath>)}
      </defs>
      <g data-integration-calibration opacity={0} aria-hidden="true" pointerEvents="none"><circle cx={0} cy={0} r={0.01} /><circle cx={size.width} cy={0} r={0.01} /><circle cx={0} cy={size.height} r={0.01} /></g>
      <Plane plane={plane} />
      <g clipPath={`url(#${id}-clip)`} aria-hidden="true">
        {scene.excluded ? <path className={styles.excluded} d={scene.excluded.path} data-integration-excluded /> : null}
        {scene.regions.map((region, index) => <path key={index} className={styles.region} d={region.path} data-integration-region />)}
        {scene.reference ? <path className={styles.reference} d={scene.reference.path} data-integration-reference /> : null}
        {scene.enclosing ? <rect className={styles.enclosing} {...scene.enclosing} data-integration-enclosing /> : null}
        {scene.rectangles.map(({ rect, role }, index) => <rect key={index} data-rectangle-role={role} className={role === "upper" ? styles.upperRectangle : role === "lower" ? styles.lowerRectangle : styles.rectangle} {...rect} />)}
        {scene.curves.map((curve) => <path key={curve.id} data-integration-curve={curve.id} data-selected={curve.selected} d={curve.plot.path} clipPath={`url(#${id}-${curve.id}-clip)`} className={`${curve.id === "lower" || curve.id === "parabola" ? styles.lowerCurve : styles.curve} ${stage >= 6 && !curve.selected ? styles.contextCurve : ""}`} />)}
        {stage >= 6 && curves.includes("axis") ? <g className={styles.selectedAxis}><Segments lines={[plane.axes[0]]} /></g> : null}
        <g className={stage === 3 ? styles.demonstrationBoundary : styles.boundary} data-integration-boundary-lines><Segments lines={scene.handles.map((handle) => handle.line)} /></g>
        {scene.strip ? <g className={styles.strip} data-integration-strip data-math-x={scene.strip.x} data-math-height={scene.strip.height}><Segments lines={[scene.strip.line, ...scene.strip.arrowheads]} /></g> : null}
      </g>
      <g aria-hidden="true" className={styles.label}>
        {scene.curves.map((curve) => <text key={curve.id} className={`${curve.id === "lower" || curve.id === "parabola" ? styles.lowerLabel : ""} ${stage >= 6 && !curve.selected ? styles.contextCurve : ""}`} x={curve.label.position.x} y={curve.label.position.y} textAnchor={curve.label.anchor}>{curve.label.text}</text>)}
        {scene.strip ? <text x={scene.strip.label.position.x} y={scene.strip.label.position.y}>{scene.strip.label.text}</text> : null}
        {scene.handles.filter(() => stage !== 2 && stage !== 3).map((handle) => <g key={handle.id} data-integration-boundary={handle.id}>
          {stage !== 4 && stage !== 7 ? <circle className={handle.id === "a" ? styles.handleA : styles.handle} cx={handle.center.x} cy={handle.center.y} r={7} /> : null}
          <rect className={styles.labelPlate} {...handle.labelBackground} rx={6} />
          <text x={handle.label.position.x} y={handle.label.position.y} textAnchor={handle.label.anchor}>{handle.label.text}</text>
        </g>)}
        {scene.annotations.map(({ label, line, arrow }) => <g key={label.text} className={styles.regionAnnotation} data-integration-annotation={label.text}>
          <Segments lines={[line, ...arrow]} /><text x={label.position.x} y={label.position.y} textAnchor={label.anchor}>{label.text}</text>
        </g>)}
      </g>
    </svg>
    {scene.handles.filter((handle) => handle.enabled).map((handle) => {
      const bounds = boundaryBounds(state, handle.id)!;
      return <div key={handle.id} className={styles.hit} style={{ left: handle.hitRegion.x, top: handle.hitRegion.y, width: handle.hitRegion.width, height: handle.hitRegion.height }}
        role="slider" tabIndex={0} aria-label={`${handle.id === "a" ? "Left" : "Right"} boundary${stage === 1 ? " on graph" : ""}`} aria-valuemin={bounds[0]} aria-valuemax={bounds[1]} aria-valuenow={handle.value}
        aria-valuetext={handle.label.text} aria-orientation="horizontal" data-editing={state.edit?.boundary === handle.id} {...handlers(handle.id)} onKeyDown={(event) => {
          if (event.key === "Escape" && state.edit) { event.preventDefault(); dispatch({ type: "cancel", revision: state.revision, id: state.edit.id }); return; }
          if (state.edit) return;
          const step = state.stage === 5 ? 1 : event.shiftKey ? 1 : 0.1;
          const value = event.key === "Home" ? bounds[0] : event.key === "End" ? bounds[1] : event.key === "ArrowRight" || event.key === "ArrowUp" ? state.region[handle.id] + step : event.key === "ArrowLeft" || event.key === "ArrowDown" ? state.region[handle.id] - step : null;
          if (value !== null) { event.preventDefault(); dispatch({ type: "place", revision: state.revision, boundary: handle.id, value, input: "keyboard" }); }
        }} />;
    })}
  </div>;
}
