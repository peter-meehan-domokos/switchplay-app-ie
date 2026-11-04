import { useId } from "react";

// Refined A: clockwise open arc; substantial down/right head, fading tail.
// Separate paths allow the head to retain its shape at actual mobile size.
export default function ReflectionNextIcon() {
  const raw = useId().replaceAll(":", ""), gradient = `reflection-arc-${raw}`, highlight = `reflection-light-${raw}`;
  return <svg aria-hidden="true" className="reflection-next-icon" width="24" height="24" viewBox="0 0 48 48" fill="none">
    <defs>
      <linearGradient id={gradient} x1="10" y1="42" x2="34" y2="7" gradientUnits="userSpaceOnUse">
        <stop stopColor="#596b82" stopOpacity="0.02" /><stop offset=".45" stopColor="#73829b" stopOpacity=".48" />
        <stop offset=".8" stopColor="#b7bfd0" stopOpacity=".77" /><stop offset="1" stopColor="#d6d7e0" stopOpacity=".86" />
      </linearGradient>
      <linearGradient id={highlight} x1="17" y1="8" x2="38" y2="19" gradientUnits="userSpaceOnUse">
        <stop stopColor="#e0e4ec" stopOpacity="0" /><stop offset=".55" stopColor="#e0e4ec" stopOpacity=".3" /><stop offset="1" stopColor="#e0e4ec" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M20 44C9 42 4 31 7 21C10 11 19 5 28 7C36 8 41 14 42 21L36 23C35 16 31 12 25 12C16 11 10 18 10 26C9 34 13 41 20 44Z" fill={`url(#${gradient})`} />
    <path d="M11 15C19 3 36 4 42 19" stroke={`url(#${highlight})`} strokeWidth=".8" strokeLinecap="round" />
    <path d="M33 21L45 17Q46.5 16.5 46 18L43 29Q42.6 30.6 41.3 29.6L32.8 23Q31.4 21.9 33 21Z" fill="#bec5d3" fillOpacity=".82" />
  </svg>;
}
