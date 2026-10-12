import styles from "./Lab.module.css";

const variants = ["Complete", "Graphics-only", "Notation-only"] as const;

export default function SparklinePreview() {
  return (
    <section className={styles.spvPreview} aria-label="Sparkline preview">
      <header>
        <p className={styles.spvEyebrow}>Card 1 · Static companion</p>
        <h1 className={styles.spvExperienceTitle} tabIndex={-1} data-spv-experience-heading>Sparkline preview</h1>
        <p className={styles.spvDescription}>Three reference views, together for comparison.</p>
      </header>
      {variants.map((variant) => (
        <section className={styles.spvVariant} key={variant} aria-label={`${variant} variant`}>
          <h2 className={styles.spvVariantTitle}>{variant}</h2>
          <div className={styles.spvSparklinePlaceholder}>Sparkline placeholder</div>
        </section>
      ))}
    </section>
  );
}
