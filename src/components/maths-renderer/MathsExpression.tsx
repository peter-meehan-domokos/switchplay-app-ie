import { typesetMath } from "./typesetMath";
import "./katex.scoped.css";
import styles from "./MathsExpression.module.css";

// Minimal standalone typesetting primitive for Stage 1 alignment verification.
// This deliberately does not implement the future mixed-content renderer API.
export default function MathsExpression({ latex, display = true }: { latex: string; display?: boolean }) {
  const result = typesetMath(latex, display);
  const delimiter = display ? "$$" : "$";
  if (!result.ok) return <span className={styles.failure} data-maths-error="">
    <code>{delimiter}{latex}{delimiter}</code>
    <span role="alert">{result.message}</span>
  </span>;

  const className = `switchplay-maths-katex ${display ? styles.display : styles.inline}`;
  // Only trusted engine output enters this HTML boundary; source is never HTML.
  return display
    ? <div className={className} data-maths-expression="display" dangerouslySetInnerHTML={{ __html: result.html }} />
    : <span className={className} data-maths-expression="inline" dangerouslySetInnerHTML={{ __html: result.html }} />;
}
