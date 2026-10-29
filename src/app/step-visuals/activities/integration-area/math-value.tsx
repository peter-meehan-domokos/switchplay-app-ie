import { mathDescription, type IndefiniteIntegralScene, type MathExpression } from "./math-presentation";
import type { IntegrationPresentation } from "./presentation";
import styles from "./later-stages.module.css";

export default function MathValue({ parts, units }: { parts: MathExpression; units?: string }) {
  return <span className={styles.math} role="math" aria-label={`${mathDescription(parts)}${units ? ` ${units}` : ""}`}>{parts.map((part, index) => "text" in part ? <span key={index} aria-hidden="true">{part.text}</span> : <span key={index} className={styles.fraction} aria-hidden="true"><span>{part.numerator}</span><span>{part.denominator}</span></span>)}{units ? <span className={styles.units} aria-hidden="true">{units}</span> : null}</span>;
}

export function IndefiniteIntegral({ scene }: { scene: IndefiniteIntegralScene }) {
  return <div className={styles.integral} role="math" aria-label={`Integral of ${scene.integrand} with respect to x equals ${mathDescription(scene.primitive)}`}>
    <span className={styles.indefiniteSymbol} aria-hidden="true">∫</span><span aria-hidden="true">{scene.integrand} dx = </span>
    <span aria-hidden="true"><MathValue parts={scene.primitive} /></span>
  </div>;
}

export function Integral({ integral, result, prefix }: { integral: NonNullable<IntegrationPresentation["integral"]>; result?: number; prefix?: string }) {
  return <div className={styles.integral} role="math" aria-label={`${prefix ? prefix + " " : ""}${integral.description}${result === undefined ? "" : ` equals ${result} square units`}`}>
    {prefix ? <span aria-hidden="true">{prefix}</span> : null}
    <span className={styles.integralSymbol} aria-hidden="true"><span>{integral.b}</span><span>∫</span><span>{integral.a}</span></span>
    <span aria-hidden="true">{integral.parentheses === false ? integral.integrand : `(${integral.integrand})`} dx{result === undefined ? null : <> = {result} <span className={styles.units}>square units</span></>}</span>
  </div>;
}
