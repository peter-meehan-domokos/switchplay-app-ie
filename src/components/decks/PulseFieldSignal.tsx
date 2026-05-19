import { useId } from "react";

type PulseFieldSignalProps = {
  value: number;
  className?: string;
};

const fieldStart = 12;
const fieldWidth = 216;
const fieldY = 10;
const fieldHeight = 8;
const fieldCenterY = fieldY + fieldHeight / 2;

export default function PulseFieldSignal({ value, className }: PulseFieldSignalProps) {
  const id = useId().replace(/:/g, "");
  const clampedValue = Math.min(Math.max(value, 0), 1);
  const pulseX = fieldStart + clampedValue * fieldWidth;
  const trailStart = Math.max(fieldStart, pulseX - 62);
  const clipId = `${id}-field`;
  const blurId = `${id}-blur`;

  return (
    <svg
      className={className}
      viewBox="0 0 240 28"
      role="img"
      aria-label={`Signal field ${Math.round(clampedValue * 100)} percent`}
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={fieldStart} y={fieldY} width={fieldWidth} height={fieldHeight} rx="4" />
        </clipPath>
        <filter id={blurId} x="-40%" y="-160%" width="180%" height="420%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect
        x={fieldStart}
        y={fieldY}
        width={fieldWidth}
        height={fieldHeight}
        rx="4"
        fill="currentColor"
        opacity="0.075"
      />
      <g clipPath={`url(#${clipId})`}>
        <line
          x1={trailStart}
          x2={pulseX + 16}
          y1={fieldCenterY}
          y2={fieldCenterY}
          stroke="var(--progress-accent)"
          strokeLinecap="round"
          strokeWidth="5.8"
          opacity="0.1"
        />
        <ellipse
          cx={pulseX}
          cy={fieldCenterY}
          rx="34"
          ry="9"
          fill="var(--progress-accent)"
          opacity="0.28"
          filter={`url(#${blurId})`}
        />
        <ellipse cx={pulseX} cy={fieldCenterY} rx="13" ry="4.2" fill="var(--progress-accent)" opacity="0.2" />
      </g>
    </svg>
  );
}
