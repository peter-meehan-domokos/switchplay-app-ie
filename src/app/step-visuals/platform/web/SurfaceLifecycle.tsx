"use client";

import { createContext, useContext, type ReactNode } from "react";

const SurfaceActiveContext = createContext(true);

export function SurfaceLifecycle({ active, children }: { active: boolean; children: ReactNode }) {
  return <SurfaceActiveContext.Provider value={active}>{children}</SurfaceActiveContext.Provider>;
}

export const useSurfaceActive = () => useContext(SurfaceActiveContext);
