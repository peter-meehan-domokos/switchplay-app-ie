import Link from "next/link";
import styles from "./PublicHeader.module.css";

type PublicHeaderProps = {
  showJoinLink?: boolean;
  showLoginLink?: boolean;
};

export default function PublicHeader({ showJoinLink = true, showLoginLink = true }: PublicHeaderProps) {
  return (
    <header className={styles.header}>
      <Link className={styles.wordmark} href="/" aria-label="Switchplay home">
        Switchplay
      </Link>
      <nav className={styles.nav} aria-label="Public navigation">
        {showJoinLink ? (
          <Link className={styles.navLink} href="/#early-access">
            Join
          </Link>
        ) : null}
        <Link className={styles.navLink} href="/contact">
          Contact
        </Link>
        {showLoginLink ? (
          <Link className={styles.navLink} href="/login">
            Log in
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
