import type { RefObject } from "react";

export type SourceRange = { start: number; end: number };
export type MathsDiagnostic = {
  code: string;
  message: string;
  severity: "error" | "warning";
  source?: SourceRange;
};

export type MathsConstraints =
  | { kind: "explicit"; widthPx: number; heightPx: number | null }
  | { kind: "container"; elementRef: RefObject<HTMLElement | null>; height: "bounded" | "unbounded" };

// The consumer chooses typography and spacing; there are no consumer-size modes.
export type MathsPresentation = {
  fontFamily: string;
  fontSizePx: number;
  lineHeight: number;
  fontWeight?: number;
  mathScale: number;
  paragraphGapEm: number;
  displayIndentEm: number;
  displayGapEm: number;
};

export type MathsLayout = {
  available: { width: number; height: number | null };
  bounds: { left: number; top: number; right: number; bottom: number };
  width: number;
  height: number;
  overflowX: boolean;
  overflowY: boolean;
  excess: { left: number; top: number; right: number; bottom: number };
};

type ResultBase = { generation: number; diagnostics: MathsDiagnostic[] };
export type MathsResult = ResultBase & (
  | { status: "pending" }
  | { status: "ready"; fits: boolean; layout: MathsLayout }
  | { status: "invalid-input" }
  | { status: "measurement-unavailable"; reason: string }
);

export type MathsRendererProps = {
  content: string;
  constraints: MathsConstraints;
  presentation: MathsPresentation;
  onResult?: (result: MathsResult) => void;
};
