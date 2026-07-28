import Link from "next/link";
import styles from "./PublicHeader.module.css";

export default function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.wordmark} href="/" aria-label="Switchplay home">
        Switchplay
      </Link>
      <nav className={styles.nav} aria-label="Public navigation">
        <Link className={styles.navLink} href="/contact">
          Contact
        </Link>
        <Link className={styles.navLink} href="/login">
          Log in
        </Link>
      </nav>
    </header>
  );
}
