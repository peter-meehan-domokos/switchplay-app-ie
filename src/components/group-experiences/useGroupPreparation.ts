"use client";
import { useEffect, type RefObject } from "react";
import { personalWork } from "@/lib/cards/personalWork";
import type { createGroupResource } from "./groupResource";

// One follow-up at a time. This owns only idle starts, never foreground saves,
// transport cancellation or accepted domain data.
export function useGroupPreparation(resource: ReturnType<typeof createGroupResource> | undefined,
  root: RefObject<HTMLElement | null>, actor: string, experienceId: string, busy: boolean) {
  useEffect(() => {
    if (!resource) return;
    let stopped = false, running = false, timer: ReturnType<typeof setTimeout> | undefined;
    const pointers = new Set<number>();
    const allowed = () => {
      const data = resource.snapshot().data;
      if (stopped || busy || pointers.size || document.visibilityState === "hidden" || !root.current || !data) return false;
      if ([...document.querySelectorAll("video")].some(video => !video.paused && !video.ended)) return false;
      if (document.querySelector('[role="dialog"], dialog[open]')) return false;
      const scope = { userId: actor, cardIds: data.bootstrap.deck.cards.map(card => card.id) };
      return !personalWork.hasPending(scope)
        && !personalWork.hasPending({ ...scope, context: { kind: "experience-contribution", experienceId } })
        && !personalWork.hasPending({ ...scope, context: { kind: "experience-assessment", experienceId } });
    };
    const wake = () => {
      if (stopped || running || timer) return;
      timer = setTimeout(async () => {
        timer = undefined;
        if (stopped) return;
        if (!allowed()) { wake(); return; }
        running = true;
        try { if (await resource.prepareNext(allowed)) { running = false; wake(); } }
        finally { running = false; }
      }, 250);
    };
    const down = (event: PointerEvent) => { if (event.target instanceof Node && root.current?.contains(event.target)) pointers.add(event.pointerId); };
    const up = (event: PointerEvent) => { pointers.delete(event.pointerId); wake(); };
    const blur = () => { pointers.clear(); };
    const unsubscribe = resource.subscribe(wake);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true);
    document.addEventListener("visibilitychange", wake);
    document.addEventListener("pause", wake, true); document.addEventListener("ended", wake, true);
    window.addEventListener("blur", blur);
    wake();
    return () => {
      stopped = true; if (timer) clearTimeout(timer); unsubscribe();
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true);
      document.removeEventListener("visibilitychange", wake);
      document.removeEventListener("pause", wake, true); document.removeEventListener("ended", wake, true);
      window.removeEventListener("blur", blur);
    };
  }, [resource, root, actor, experienceId, busy]);
}
