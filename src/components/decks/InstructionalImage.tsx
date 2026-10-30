"use client";

import { useState } from "react";
import { instructionalImageUrl, type InstructionalImageContext } from "@/lib/instructionalImageContext";
import styles from "./StepView.module.css";

export default function InstructionalImage({ context, alt }: { context?: InstructionalImageContext; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!context || failed) return <p role="status">Image unavailable.</p>;
  // Exact-context endpoint only. A failed authorization/provider read has no raw-URL fallback.
  // eslint-disable-next-line @next/next/no-img-element -- Authenticated same-origin raster response.
  return <img className={styles.instructionalImage} src={instructionalImageUrl(context)} alt={alt} decoding="async" onError={() => setFailed(true)} />;
}
