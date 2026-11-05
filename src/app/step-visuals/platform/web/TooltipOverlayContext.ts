"use client";

import { createContext } from "react";

/** Hosts can keep explanations in the same modal layer as their visual. */
export const TooltipOverlayContext = createContext<HTMLElement | null>(null);
