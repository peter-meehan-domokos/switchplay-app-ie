type BackCardReflectionFragmentProps = {
  text?: string | null;
};

export default function BackCardReflectionFragment({ text }: BackCardReflectionFragmentProps) {
  if (!text) {
    return null;
  }

  return (
    <p className="focused-card-back-reflection-fragment">
      {text}
    </p>
  );
}
