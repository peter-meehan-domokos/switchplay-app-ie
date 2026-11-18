import Link from "next/link";
import styles from "./PublicFooter.module.css";

export default function PublicFooter() {
  return (
    <nav className={styles.footerNav} aria-label="Footer navigation">
      <Link href="/">Home</Link>
      <Link href="/contact">Contact</Link>
      <Link href="/privacy">Privacy</Link>
    </nav>
  );
}
