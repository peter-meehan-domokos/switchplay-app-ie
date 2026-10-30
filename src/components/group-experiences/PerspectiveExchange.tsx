"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { perspectiveExchange } from "@/components/decks/motion/deckMotion";

// Animate the existing physical object, never duplicate live Cards/players or
// retain an outgoing private DTO after authority/subject changes.
export default function PerspectiveExchange({ identity, kind, children, disabled = false }: { identity?: string; kind: "focused" | "deck"; children: ReactNode; disabled?: boolean }) {
  const controls = useAnimationControls(), reduced = useReducedMotion(), previous = useRef(identity);
  useEffect(() => {
    if (previous.current === identity || !identity) return;
    previous.current = identity; controls.stop();
    if (disabled) { controls.set({ x: 0, y: 0, scale: 1, rotateZ: 0 }); return; }
    void controls.start(reduced ? { x: 0, y: 0, scale: 1, rotateZ: 0, transition: { duration: 0 } } : {
      x: kind === "focused" ? [0, 5, -2, 0] : [0, -6, 2, 0],
      y: kind === "focused" ? [0, 3, -2, 0] : [0, -5, 1, 0], scale: [1, .985, 1.004, 1],
      rotateZ: [0, -.25, .1, 0], transition: perspectiveExchange,
    });
  }, [identity, kind, controls, reduced, disabled]);
  return identity ? <motion.div className={`group-perspective-exchange group-perspective-exchange--${kind}`} initial={false} animate={controls}>{children}</motion.div> : children;
}
