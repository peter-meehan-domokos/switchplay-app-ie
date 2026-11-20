import type { ReactNode } from "react";
import PublicFooter from "./PublicFooter";
import styles from "./PublicLayout.module.css";

type PublicLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
  /** Let a custom footer span the full page width (it manages its own content width). Off for every page but the homepage. */
  fullBleedFooter?: boolean;
};

export default function PublicLayout({ children, footer, fullBleedFooter = false }: PublicLayoutProps) {
  return (
    <div className={styles.shell}>
      <main className={`${styles.container} ${styles.main}`}>{children}</main>
      <footer className={fullBleedFooter ? undefined : `${styles.container} ${styles.footer}`}>
        {footer ?? <PublicFooter />}
      </footer>
    </div>
  );
}
