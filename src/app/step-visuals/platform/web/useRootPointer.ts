"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type PointerEvent, type RefObject } from "react";
import { affineFromCalibration, pointerCandidate, screenToMath, type Affine2D, type RootInputPolicy } from "../../core/interaction/rootInteraction";
import type { ProjectionSpec } from "../../core/graph/types";
import type { ManipulationAction, ManipulationState } from "../../activities/roots-factors/manipulation";

const screenMatrix = (svg: SVGSVGElement | null): Affine2D | null => {
  if (!svg) return null;
  // WebKit can omit ancestor CSS scale/rotation from getScreenCTM(). Browser geometry
  // of three inert probes supplies the actual affine basis, including those transforms.
  const probes = [...svg.querySelectorAll<SVGCircleElement>("[data-spv-calibration] circle")];
  if (probes.length !== 3) return null;
  const points = probes.map((probe) => { const box = probe.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; });
  return affineFromCalibration(points[0], points[1], points[2], { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height });
};
type Ownership = {
  pointerId: number; sessionId: number; revision: number; geometryKey: string;
  target: HTMLDivElement; projection: ProjectionSpec; grabOffset: number; lastEmitted: number;
};

/** Browser ownership and capture only. React/reducer own all semantic root values. */
export const useRootPointer = (input: {
  svgRef: RefObject<SVGSVGElement | null>; projection: ProjectionSpec;
  state: ManipulationState; policy: RootInputPolicy; dispatch: Dispatch<ManipulationAction>;
}) => {
  const { svgRef, projection, state, policy, dispatch } = input;
  const owner = useRef<Ownership | null>(null);
  const counter = useRef(0);
  const geometryKey = [...projection.xDomain, ...projection.yDomain, ...projection.xRange, ...projection.yRange].join("|");

  const release = useCallback((notify: boolean) => {
    const previous = owner.current;
    owner.current = null; // Clear before release: intentional lostcapture cannot undo a commit.
    if (!previous) return;
    if (notify) dispatch({ type: "cancel", revision: previous.revision, sessionId: previous.sessionId });
    if (previous.target.hasPointerCapture(previous.pointerId)) previous.target.releasePointerCapture(previous.pointerId);
  }, [dispatch]);

  useLayoutEffect(() => {
    const previous = owner.current;
    if (previous && (!policy.enabled || previous.revision !== state.revision || previous.geometryKey !== geometryKey)) release(true);
  }, [policy.enabled, state.revision, geometryKey, release]);
  useEffect(() => {
    const interrupt = () => release(true);
    const visibility = () => { if (document.hidden) interrupt(); };
    window.addEventListener("resize", interrupt);
    window.visualViewport?.addEventListener("resize", interrupt);
    window.addEventListener("blur", interrupt);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("resize", interrupt);
      window.visualViewport?.removeEventListener("resize", interrupt);
      window.removeEventListener("blur", interrupt);
      document.removeEventListener("visibilitychange", visibility);
      release(false);
    };
  }, [release]);

  const owned = (event: PointerEvent<HTMLDivElement>) => {
    const current = owner.current;
    if (!current || current.pointerId !== event.pointerId) return null;
    if (!policy.enabled || current.revision !== state.revision || current.geometryKey !== geometryKey) { release(true); return null; }
    return current;
  };
  const candidate = (event: PointerEvent<HTMLDivElement>, current: Ownership) => pointerCandidate(
    { x: event.clientX, y: event.clientY }, screenMatrix(svgRef.current), current.projection, current.grabOffset, policy.bounds,
  );
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (!policy.enabled || owner.current || state.edit || !event.isPrimary || event.button !== 0) return;
      const point = screenToMath({ x: event.clientX, y: event.clientY }, screenMatrix(svgRef.current), projection);
      if (!point) return;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { return; }
      counter.current = Math.max(counter.current, state.lastSessionId) + 1;
      owner.current = { pointerId: event.pointerId, sessionId: counter.current, revision: state.revision, geometryKey,
        target: event.currentTarget, projection, grabOffset: state.math.movingRoot - point.x, lastEmitted: state.math.movingRoot };
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      dispatch({ type: "start", revision: state.revision, sessionId: counter.current });
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const current = owned(event);
      if (!current) return;
      const root = candidate(event, current);
      if (root === null) { release(true); return; }
      if (root !== current.lastEmitted) {
        current.lastEmitted = root; // Emission deduplication only; never used for rendering/commit.
        dispatch({ type: "preview", revision: current.revision, sessionId: current.sessionId, root });
      }
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const current = owned(event);
      if (!current) return;
      const root = candidate(event, current); // Final coordinates, not the previous move event.
      if (root === null) { release(true); return; }
      release(false);
      dispatch({ type: "commit", revision: current.revision, sessionId: current.sessionId, root });
    },
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => { if (owned(event)) release(true); },
    onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => { if (owned(event)) release(true); },
  };
};
