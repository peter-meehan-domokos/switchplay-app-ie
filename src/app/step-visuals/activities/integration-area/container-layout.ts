import type { CSSProperties } from "react";
import type { VisualContentDimensions } from "../../core/host";

/** These are the complete supplied bounds. Overlay controls consume no height. */
export function integrationContainerStyle(dimensions?: VisualContentDimensions): CSSProperties {
  return dimensions ? { width: dimensions.width, height: dimensions.height } : { height: "100%" };
}

/** A compact fallback, not a target: flex layout spends all spare space on the graph. */
export const minimumIntegrationGraphHeight = 120;
