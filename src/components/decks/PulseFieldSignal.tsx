import { useId } from "react";

export type PulseFieldSignalVariant = "recovery" | "movement" | "load";

type PulseFieldSignalProps = {
  value: number;
  variant?: PulseFieldSignalVariant;
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const fieldStart = 12;
const fieldWidth = 216;
const fieldY = 8.6;
const fieldHeight = 10.6;
const fieldCenterY = fieldY + fieldHeight / 2;

const fieldCharacters = {
  recovery: {
    fieldDrift: -3,
    ambientOpacity: 0.039,
    directionOpacity: 0.038,
    coherentOpacity: 0.039,
    wakeScale: 1.08,
    wakeOpacity: 0.019,
    residueOffset: -34,
    residueOpacity: 0.014,
    outerOffset: 10,
    outerRx: 102,
    outerRy: 16.4,
    outerOpacity: 0.075,
    backwardRx: 78,
    backwardOpacity: 0.026,
    innerRx: 64,
    innerOpacity: 0.047,
    coreRx: 42,
    coreOpacity: 0.039,
    surfaceOpacity: 0.029,
    verticalOpacity: 0.015,
  },
  movement: {
    fieldDrift: 1,
    ambientOpacity: 0.032,
    directionOpacity: 0.041,
    coherentOpacity: 0.048,
    wakeScale: 0.92,
    wakeOpacity: 0.019,
    residueOffset: -24,
    residueOpacity: 0.009,
    outerOffset: 11,
    outerRx: 86,
    outerRy: 14.4,
    outerOpacity: 0.08,
    backwardRx: 58,
    backwardOpacity: 0.027,
    innerRx: 52,
    innerOpacity: 0.055,
    coreRx: 34,
    coreOpacity: 0.046,
    surfaceOpacity: 0.031,
    verticalOpacity: 0.016,
  },
  load: {
    fieldDrift: 2,
    ambientOpacity: 0.034,
    directionOpacity: 0.039,
    coherentOpacity: 0.044,
    wakeScale: 0.98,
    wakeOpacity: 0.021,
    residueOffset: -29,
    residueOpacity: 0.011,
    outerOffset: 14,
    outerRx: 90,
    outerRy: 13.2,
    outerOpacity: 0.089,
    backwardRx: 66,
    backwardOpacity: 0.034,
    innerRx: 56,
    innerOpacity: 0.059,
    coreRx: 35,
    coreOpacity: 0.048,
    surfaceOpacity: 0.033,
    verticalOpacity: 0.017,
  },
} satisfies Record<PulseFieldSignalVariant, Record<string, number>>;

export default function PulseFieldSignal({ value, variant = "movement", className }: PulseFieldSignalProps) {
  const character = fieldCharacters[variant];
  const id = useId().replace(/:/g, "");
  const clampedValue = clamp(value, 0, 1);
  const nearRightCoherence = clamp((clampedValue - 0.74) / 0.26, 0, 1);
  const pulseX = fieldStart + clampedValue * fieldWidth;
  const wakeExtent = pulseX - fieldStart;
  const wakeCenterX = fieldStart + wakeExtent * 0.42;
  const wakeRadiusX = Math.max(46, wakeExtent * 0.56 + 34) * character.wakeScale * (1 + nearRightCoherence * 0.045);
  const residueOpacity = character.residueOpacity * (1 - nearRightCoherence * 0.3);
  const backwardOpacity = character.backwardOpacity * (1 - nearRightCoherence * 0.22);
  const outerRx = character.outerRx * (1 + nearRightCoherence * 0.08);
  const outerRy = character.outerRy * (1 + nearRightCoherence * 0.05);
  const innerRx = character.innerRx * (1 + nearRightCoherence * 0.07);
  const coreRx = character.coreRx * (1 + nearRightCoherence * 0.04);
  const coreOpacity = character.coreOpacity * (1 - nearRightCoherence * 0.24);
  const coherentOpacity = character.coherentOpacity * (1 + nearRightCoherence * 0.14);
  const surfaceOpacity = character.surfaceOpacity * (1 + nearRightCoherence * 0.22);
  const endFadeId = `${id}-end-fade`;
  const directionId = `${id}-direction`;
  const wakeId = `${id}-wake`;
  const verticalFadeId = `${id}-vertical-fade`;
  const fieldMaskId = `${id}-field-mask`;
  const fieldBlurId = `${id}-field-blur`;
  const pulseBlurId = `${id}-pulse-blur`;

  return (
    <svg
      className={className}
      viewBox="0 0 240 28"
      role="img"
      aria-label={`Signal field ${Math.round(clampedValue * 100)} percent`}
      focusable="false"
    >
      <defs>
        <linearGradient id={endFadeId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="black" />
          <stop offset="11%" stopColor="white" stopOpacity="0.5" />
          <stop offset="24%" stopColor="white" />
          <stop offset="76%" stopColor="white" />
          <stop offset="89%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="black" />
        </linearGradient>
        <linearGradient id={directionId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.68" />
          <stop offset="54%" stopColor="rgba(255, 250, 240, 0.78)" stopOpacity="0.78" />
          <stop offset="100%" stopColor="var(--progress-accent)" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={wakeId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--progress-accent)" stopOpacity="0" />
          <stop offset="28%" stopColor="var(--progress-accent)" stopOpacity="0.36" />
          <stop offset="68%" stopColor="var(--progress-accent)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--progress-accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={verticalFadeId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="36%" stopColor="white" stopOpacity="0.82" />
          <stop offset="62%" stopColor="white" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={fieldMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="28">
          <rect x="0" y="0" width="240" height="28" fill={`url(#${endFadeId})`} />
        </mask>
        <filter id={fieldBlurId} x="-16%" y="-110%" width="132%" height="320%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
        <filter id={pulseBlurId} x="-52%" y="-180%" width="204%" height="460%">
          <feGaussianBlur stdDeviation="6.8" />
        </filter>
      </defs>
      <g mask={`url(#${fieldMaskId})`}>
        <rect x="6" y="2.5" width="228" height="23" fill={`url(#${verticalFadeId})`} opacity={character.verticalOpacity} />
        <ellipse
          cx={120 + character.fieldDrift}
          cy={fieldCenterY}
          rx="120"
          ry="12.5"
          fill="currentColor"
          opacity={character.ambientOpacity}
          filter={`url(#${fieldBlurId})`}
        />
        <ellipse
          cx={122 + character.fieldDrift}
          cy={fieldCenterY}
          rx="114"
          ry="6.6"
          fill={`url(#${directionId})`}
          opacity={character.directionOpacity}
          filter={`url(#${fieldBlurId})`}
        />
        <ellipse cx={120 + character.fieldDrift * 0.5} cy={fieldCenterY} rx="112" ry="5.8" fill={`url(#${directionId})`} opacity={coherentOpacity} />
        <ellipse
          cx={wakeCenterX}
          cy={fieldCenterY + 0.9}
          rx={wakeRadiusX}
          ry="8.4"
          fill={`url(#${wakeId})`}
          opacity={character.wakeOpacity}
          filter={`url(#${fieldBlurId})`}
        />
        <ellipse
          cx={pulseX + character.residueOffset}
          cy={fieldCenterY + 1.8}
          rx="78"
          ry="7.8"
          fill="var(--progress-accent)"
          opacity={residueOpacity}
          filter={`url(#${fieldBlurId})`}
        />
        <ellipse
          cx={pulseX + character.outerOffset}
          cy={fieldCenterY - 0.4}
          rx={outerRx}
          ry={outerRy}
          fill="var(--progress-accent)"
          opacity={character.outerOpacity}
          filter={`url(#${pulseBlurId})`}
        />
        <ellipse
          cx={pulseX - 11}
          cy={fieldCenterY + 1.5}
          rx={character.backwardRx}
          ry="9.1"
          fill="var(--progress-accent)"
          opacity={backwardOpacity}
          filter={`url(#${fieldBlurId})`}
        />
        <ellipse
          cx={pulseX + 6}
          cy={fieldCenterY - 0.5}
          rx={innerRx}
          ry="8.4"
          fill="var(--progress-accent)"
          opacity={character.innerOpacity}
          filter={`url(#${fieldBlurId})`}
        />
        <ellipse cx={pulseX - 1} cy={fieldCenterY + 0.2} rx={coreRx} ry="5.9" fill="var(--progress-accent)" opacity={coreOpacity} />
        <ellipse cx={120 + character.fieldDrift * 0.4} cy={fieldCenterY + 0.8} rx="116" ry="7.4" fill="rgba(255, 250, 240, 0.26)" opacity={surfaceOpacity} />
      </g>
    </svg>
  );
}
