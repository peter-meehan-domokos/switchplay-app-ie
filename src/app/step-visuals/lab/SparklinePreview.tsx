"use client";

import { useId, useState } from "react";
import Card1Sparkline from "../sparklines/Card1Sparkline";
import { formatNumber } from "../core/math/realFactors";
import { useSurfaceActive } from "../platform/web/SurfaceLifecycle";
import styles from "./Lab.module.css";
import previewStyles from "./SparklinePreview.module.css";
import { createCard1Math, type RootInteger } from "../activities/roots-factors/model";

const variants = [
  { id: "complete", label: "Graph + factor notation" },
  { id: "graphics-only", label: "Graph only" },
  { id: "notation-only", label: "Factor notation only" },
] as const;
const referenceWidths = [160, 240, 320] as const;
const roots = Array.from({ length: 11 }, (_, index) => index - 5);

export default function SparklinePreview() {
  const [root, setRoot] = useState<RootInteger>(3);
  const rootId = useId();
  const active = useSurfaceActive();
  return (
    <section className={styles.spvPreview} aria-label="Sparkline preview">
      <header>
        <h1 className={styles.spvExperienceTitle} tabIndex={-1} data-spv-experience-heading>Sparkline preview</h1>
        <p className={styles.spvDescription}>Compare the same quadratic at three card widths.</p>
      </header>
      <label className={previewStyles.spvSparklineControl} htmlFor={rootId}>
        Movable root
        <select id={rootId} aria-label="Sparkline root" value={root} disabled={!active} onChange={(event) => setRoot(createCard1Math(Number(event.target.value)).movingRoot)}>
          {roots.map((value) => <option key={value} value={value}>x = {formatNumber(value)}</option>)}
        </select>
      </label>
      {referenceWidths.map((width) => (
        <section className={previewStyles.spvSparklineReferences} key={width} aria-label={`${width}px card comparison`} data-spv-reference-width={width}>
          <h2 className={previewStyles.spvSparklineReferenceTitle}>Up to {width}px wide</h2>
          {variants.map((variant) => <section className={previewStyles.spvSparklineSample} key={variant.id} aria-label={variant.label} style={{ width, maxWidth: "100%" }}>
            <h3 className={previewStyles.spvSparklineVariantTitle}>{variant.label}</h3>
            <Card1Sparkline movingRoot={root} variant={variant.id} width={width} />
          </section>)}
        </section>
      ))}
    </section>
  );
}
