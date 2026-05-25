export type SemanticTraceFamily = "media" | "questionnaire" | "substeps";

type SemanticTraceGlyphProps = {
  family: SemanticTraceFamily;
};

export default function SemanticTraceGlyph({ family }: SemanticTraceGlyphProps) {
  return (
    <svg
      className={`step-semantic-trace step-semantic-trace--${family}`}
      viewBox="0 0 20 8"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.95">
        {family === "media" ? (
          <>
            <path d="M3.08 4H7.02" opacity="0.86" />
            <path d="M12.5 4H16.88" opacity="0.86" />
            <path
              d="M8.38 2.38C8.38 2.12 8.67 1.95 8.9 2.08L11.48 3.48C11.84 3.68 11.84 4.32 11.48 4.52L8.9 5.92C8.67 6.05 8.38 5.88 8.38 5.62Z"
              fill="currentColor"
              stroke="none"
            />
          </>
        ) : null}
        {family === "questionnaire" ? (
          <>
            <path d="M3.02 4H6.28" opacity="0.86" />
            <path
              d="M8.05 2.72C8.42 1.34 10.78 1.18 11.12 2.76C11.38 3.92 10.28 4.32 9.82 4.88C9.58 5.17 9.48 5.4 9.42 5.66"
              strokeWidth="0.88"
            />
            <circle cx="9.4" cy="6.78" r="0.36" fill="currentColor" stroke="none" />
            <path d="M12.62 4H16.9" opacity="0.86" />
          </>
        ) : null}
        {family === "substeps" ? (
          <>
            <path d="M2.95 4H7.38" opacity="0.86" />
            <circle cx="9.15" cy="4" r="0.54" fill="currentColor" stroke="none" />
            <circle cx="11.15" cy="4" r="0.54" fill="currentColor" stroke="none" />
            <path d="M13.08 4H16.95" opacity="0.86" />
          </>
        ) : null}
      </g>
    </svg>
  );
}
