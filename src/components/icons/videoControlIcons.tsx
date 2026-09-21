type VideoControlIconProps = {
  className?: string;
};

export function DeckIntroSemiExpandIcon({ className }: VideoControlIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="currentColor"
      className={className}
    >
      <path d="M 46.980469 -0.009765625 A 1.0001 1.0001 0 0 0 46.869141 0 L 36 0 A 1.0001 1.0001 0 1 0 36 2 L 44.585938 2 L 28.292969 18.292969 A 1.0001 1.0001 0 1 0 29.707031 19.707031 L 46 3.4140625 L 46 12 A 1.0001 1.0001 0 1 0 48 12 L 48 1.1269531 A 1.0001 1.0001 0 0 0 46.980469 -0.009765625 z M 9 6 C 6.2518422 6 4 8.2518422 4 11 L 4 39 C 4 41.748158 6.2518422 44 9 44 L 37 44 C 39.748158 44 42 41.748158 42 39 L 42 14 A 1.0001 1.0001 0 1 0 40 14 L 40 39 C 40 40.663842 38.663842 42 37 42 L 9 42 C 7.3361578 42 6 40.663842 6 39 L 6 11 C 6 9.3361578 7.3361578 8 9 8 L 34 8 A 1.0001 1.0001 0 1 0 34 6 L 9 6 z" />
    </svg>
  );
}

export function ExpandVideoIcon({ className }: VideoControlIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 3H3v5" />
      <path d="M3 3l7 7" />
      <path d="M16 21h5v-5" />
      <path d="M21 21l-7-7" />
    </svg>
  );
}

export function CollapseVideoIcon({ className }: VideoControlIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 3v7H3" />
      <path d="M3 10l7-7" />
      <path d="M14 21v-7h7" />
      <path d="M21 14l-7 7" />
    </svg>
  );
}

export function CloseVideoIcon({ className }: VideoControlIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}
