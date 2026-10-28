"use client";

// Copied into a temporary Next application by run.mts. Never an application route.
import { useEffect, useRef, useState } from "react";
import MathsRenderer from "@/components/maths-renderer/MathsRenderer";
import type { MathsPresentation, MathsResult } from "@/components/maths-renderer/types";

export type HostJob = {
  id: string;
  content: string;
  width: number;
  height: number;
  presentation: MathsPresentation;
  container?: boolean;
  transform?: string;
  hidden?: boolean;
};
export type HostRecord = { id: string; result: MathsResult };
declare global {
  interface Window {
    trustedProofHost?: {
      mount: (job: HostJob) => void;
      current: HostRecord | null;
      history: HostRecord[];
    };
  }
}

function Consumer({ job }: { job: HostJob }) {
  const budget = useRef<HTMLDivElement>(null);
  return <div ref={budget} data-proof-budget="" style={{ width: job.width, height: job.height,
    transform: job.transform, transformOrigin: "left top", visibility: job.hidden ? "hidden" : "visible" }}>
    <MathsRenderer content={job.content} presentation={job.presentation}
      constraints={job.container ? { kind: "container", elementRef: budget, height: "bounded" }
        : { kind: "explicit", widthPx: job.width, heightPx: job.height }}
      onResult={result => {
        const api = window.trustedProofHost!;
        api.current = { id: job.id, result };
        api.history.push(api.current);
      }} />
  </div>;
}

export default function Host() {
  const [job, setJob] = useState<HostJob | null>(null);
  useEffect(() => {
    window.trustedProofHost = { mount: next => {
      window.trustedProofHost!.current = null;
      setJob(next);
    }, current: null, history: [] };
    return () => { delete window.trustedProofHost; };
  }, []);
  // Deliberately keep the same component instance across source changes, so the
  // proof exercises the renderer's existing stale-generation protection.
  return <main style={{ padding: 32 }}>{job && <Consumer job={job} />}</main>;
}
