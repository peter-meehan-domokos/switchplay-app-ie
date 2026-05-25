import type { CSSProperties } from "react";

type BackCardReflectionFragmentProps = {
  reflectionVerticalOffset?: number;
  text?: string | null;
};

type ReflectionFragmentStyle = CSSProperties & {
  "--reflection-y-offset"?: string;
};

export default function BackCardReflectionFragment({ reflectionVerticalOffset = 0, text }: BackCardReflectionFragmentProps) {
  if (!text) {
    return null;
  }

  const style: ReflectionFragmentStyle = {
    "--reflection-y-offset": `${reflectionVerticalOffset}px`,
  };

  return (
    <p className="focused-card-back-reflection-fragment" style={style}>
      {text}
    </p>
  );
}
