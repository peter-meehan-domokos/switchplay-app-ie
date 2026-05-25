import SemanticTraceGlyph, { type SemanticTraceFamily } from "@/components/cards/SemanticTraceGlyph";

type SemanticTraceLaneProps = {
  families: SemanticTraceFamily[];
  pattern: "progression-a" | "progression-b" | "progression-c";
};

export default function SemanticTraceLane({ families, pattern }: SemanticTraceLaneProps) {
  return (
    <span className={`step-semantic-trace-cluster step-semantic-lane--${pattern}`} aria-hidden="true">
      {families.map((family) => (
        <SemanticTraceGlyph family={family} key={family} />
      ))}
    </span>
  );
}
