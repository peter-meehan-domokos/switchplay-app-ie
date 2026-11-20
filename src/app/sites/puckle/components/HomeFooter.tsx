import { brandFontClassName } from "./BrandLink";
import PublicFooter from "./PublicFooter";
import styles from "./HomeFooter.module.css";

// Homepage-only footer: the page's existing Home / Contact / Privacy navigation under an oversized, muted wordmark, with
// sweeping colour shapes drawn in SVG. Every other page keeps the plain PublicFooter.
export default function HomeFooter() {
  return (
    <div className={`${brandFontClassName} ${styles.footer}`}>
      <svg
        aria-hidden="true"
        className={styles.curves}
        focusable="false"
        preserveAspectRatio="xMaxYMax slice"
        viewBox="0 0 1440 300"
      >
        <defs>
          <linearGradient id="home-footer-blue-fill" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="0.55" stopColor="#38bdf8" stopOpacity="0.16" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="home-footer-blue-edge" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#7dd3fc" stopOpacity="0" />
            <stop offset="0.6" stopColor="#7dd3fc" stopOpacity="0.45" />
            <stop offset="1" stopColor="#67e8f9" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="home-footer-purple-fill" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="#7c3aed" stopOpacity="0" />
            <stop offset="0.5" stopColor="#8b5cf6" stopOpacity="0.2" />
            <stop offset="1" stopColor="#c084fc" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="home-footer-purple-edge" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#c084fc" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c084fc" stopOpacity="0.5" />
            <stop offset="1" stopColor="#e9b6ff" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <path d="M-120 300C300 200 900 14 1560 70V300Z" fill="url(#home-footer-blue-fill)" />
        <path d="M-120 300C300 200 900 14 1560 70" fill="none" stroke="url(#home-footer-blue-edge)" strokeWidth="1.5" />
        <path d="M300 300C700 236 1120 130 1560 186V300Z" fill="url(#home-footer-purple-fill)" />
        <path d="M300 300C700 236 1120 130 1560 186" fill="none" stroke="url(#home-footer-purple-edge)" strokeWidth="1.5" />
      </svg>
      <div className={styles.inner}>
        <p aria-hidden="true" className={styles.wordmark}>
          Puckle.
        </p>
        <div className={styles.links}>
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}
