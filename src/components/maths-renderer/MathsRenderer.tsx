"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import { prepareContent } from "./prepareContent";
import type { ContentPart } from "./parseContent";
import type { MathsRendererProps } from "./types";
import { useMeasurement } from "./useMeasurement";
import styles from "./MathsRenderer.module.css";
import "./katex.scoped.css";

export default function MathsRenderer({ content, constraints, presentation, onResult }: MathsRendererProps) {
  const root = useRef<HTMLDivElement>(null);
  const prepared = useMemo(() => prepareContent(content), [content]);
  // Primitive dependencies make equivalent consumer objects stable. Callback
  // identity is deliberately excluded from the measurement lifecycle.
  const kind = constraints.kind;
  const width = constraints.kind === "explicit" ? constraints.widthPx : 0;
  const height = constraints.kind === "explicit" ? constraints.heightPx : null;
  const elementRef = constraints.kind === "container" ? constraints.elementRef : null;
  const containerHeight = constraints.kind === "container" ? constraints.height : "unbounded";
  const stableConstraints = useMemo<MathsRendererProps["constraints"]>(() => kind === "explicit" ? { kind, widthPx: width, heightPx: height }
    : { kind, elementRef: elementRef!, height: containerHeight }, [kind, width, height, elementRef, containerHeight]);
  const presentationKey = JSON.stringify(presentation);
  const inputKey = useMemo(() => ({ prepared, stableConstraints, presentationKey }), [prepared, stableConstraints, presentationKey]);
  const positive = [presentation.fontSizePx, presentation.lineHeight, presentation.mathScale, presentation.fontWeight ?? 400];
  const nonnegative = [presentation.paragraphGapEm, presentation.displayIndentEm, presentation.displayGapEm];
  const configurationError = !presentation.fontFamily.trim() || positive.some(n => !Number.isFinite(n) || n <= 0) || nonnegative.some(n => !Number.isFinite(n) || n < 0);
  const result = useMeasurement(root, stableConstraints, inputKey, prepared.diagnostics, prepared.invalid, configurationError, onResult);
  function renderPart(part: ContentPart, index: number) {
    if (part.kind === "text") return part.text;
    if (part.kind === "literal") return <span key={index} className={styles.fallback} data-maths-fallback="">{part.raw}</span>;
    const typeset = prepared.mathematics.get(part)!;
    const className = part.display ? styles.display : styles.inline;
    if (!typeset.ok) return <span key={index} className={`${className} ${styles.fallback}`} data-maths-fallback="">{part.raw}</span>;
    return <span key={index} className={`${className} switchplay-maths-katex`} data-maths-expression={part.display ? "display" : "inline"}
      dangerouslySetInnerHTML={{ __html: typeset.html }} />;
  }
  const style = {
    width: stableConstraints.kind === "explicit" && Number.isFinite(stableConstraints.widthPx) && stableConstraints.widthPx > 0 ? stableConstraints.widthPx : "100%",
    fontFamily: presentation.fontFamily, fontSize: presentation.fontSizePx, fontWeight: presentation.fontWeight ?? 400, lineHeight: presentation.lineHeight,
    "--maths-scale": `${presentation.mathScale}em`, "--maths-paragraph-gap": `${presentation.paragraphGapEm}em`,
    "--maths-display-indent": `${presentation.displayIndentEm}em`, "--maths-display-gap": `${presentation.displayGapEm}em`,
  } as CSSProperties;
  return <div ref={root} className={styles.content} style={style} data-maths-renderer="" data-maths-status={result.status}>
    {prepared.blocks.map((block, index) => block.kind === "display"
      ? <div key={index} data-maths-display="">{renderPart(block.part, 0)}</div>
      : <p key={index} className={styles.paragraph} data-maths-paragraph="">{block.parts.map(renderPart)}</p>)}
  </div>;
}
