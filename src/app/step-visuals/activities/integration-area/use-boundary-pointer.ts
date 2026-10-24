"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type PointerEvent, type RefObject } from "react";
import { affineFromCalibration, screenToMath } from "../../core/interaction/rootInteraction";
import type { ProjectionSpec } from "../../core/graph/types";
import { boundaryBounds, type Boundary, type IntegrationAction, type IntegrationState } from "./learning";

const mapping = (svg: SVGSVGElement | null) => {
  if (!svg) return null;
  const probes = [...svg.querySelectorAll<SVGCircleElement>("[data-integration-calibration] circle")];
  if (probes.length !== 3) return null;
  const points = probes.map((probe) => { const box = probe.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; });
  return affineFromCalibration(points[0], points[1], points[2], { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height });
};
type Owner = { pointer: number; id: number; revision: number; geometry: string; boundary: Boundary; offset: number; target: HTMLDivElement; last: number };

/** Platform capture/calibration only. The reducer owns both settled and candidate values. */
export function useBoundaryPointer(svgRef: RefObject<SVGSVGElement | null>, projection: ProjectionSpec, state: IntegrationState, active: boolean, dispatch: Dispatch<IntegrationAction>) {
  const owner = useRef<Owner | null>(null);
  const counter = useRef(0);
  const geometry = [...projection.xDomain, ...projection.yDomain, ...projection.xRange, ...projection.yRange].join("|");
  const release = useCallback((cancel: boolean) => {
    const current = owner.current;
    owner.current = null;
    if (!current) return;
    if (cancel) dispatch({ type: "cancel", revision: current.revision, id: current.id });
    if (current.target.hasPointerCapture(current.pointer)) current.target.releasePointerCapture(current.pointer);
  }, [dispatch]);
  useLayoutEffect(() => {
    const current = owner.current;
    if (current && (!active || current.revision !== state.revision || current.geometry !== geometry)) release(true);
  }, [active, state.revision, geometry, release]);
  useEffect(() => {
    const cancel = () => release(true);
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener("resize", cancel);
    window.visualViewport?.addEventListener("resize", cancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("resize", cancel);
      window.visualViewport?.removeEventListener("resize", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
      release(false);
    };
  }, [release]);
  const currentOwner = (event: PointerEvent<HTMLDivElement>) => {
    const current = owner.current;
    if (!current || current.pointer !== event.pointerId) return null;
    if (!active || current.revision !== state.revision || current.geometry !== geometry) { release(true); return null; }
    return current;
  };
  const value = (event: PointerEvent<HTMLDivElement>, current: Owner) => {
    const point = screenToMath({ x: event.clientX, y: event.clientY }, mapping(svgRef.current), projection);
    const bounds = boundaryBounds(state, current.boundary);
    return point && bounds ? Math.max(bounds[0], Math.min(bounds[1], point.x + current.offset)) : null;
  };
  return (boundary: Boundary) => ({
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (!active || owner.current || state.edit || !boundaryBounds(state, boundary) || !event.isPrimary || event.button !== 0) return;
      const point = screenToMath({ x: event.clientX, y: event.clientY }, mapping(svgRef.current), projection);
      if (!point) return;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { return; }
      const id = counter.current = Math.max(counter.current, state.lastEditId) + 1;
      owner.current = { pointer: event.pointerId, id, revision: state.revision, geometry, boundary,
        offset: state.region[boundary] - point.x, target: event.currentTarget, last: state.region[boundary] };
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      dispatch({ type: "begin", revision: state.revision, boundary, id });
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const current = currentOwner(event);
      if (!current) return;
      const candidate = value(event, current);
      if (candidate === null) { release(true); return; }
      if (candidate !== current.last) {
        current.last = candidate;
        dispatch({ type: "preview", revision: current.revision, id: current.id, value: candidate });
      }
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const current = currentOwner(event);
      if (!current) return;
      const candidate = value(event, current);
      if (candidate === null) { release(true); return; }
      release(false);
      dispatch({ type: "release", revision: current.revision, id: current.id, value: candidate });
    },
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => { if (currentOwner(event)) release(true); },
    onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => { if (event.target === event.currentTarget && currentOwner(event)) release(true); },
  });
}
