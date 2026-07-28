import type { ReactNode } from "react";
import styles from "./PublicLayout.module.css";

type PublicLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
};

export default function PublicLayout({ children, footer }: PublicLayoutProps) {
  return (
    <div className={styles.shell}>
      <main className={`${styles.container} ${styles.main}`}>{children}</main>
      {footer ? <footer className={`${styles.container} ${styles.footer}`}>{footer}</footer> : null}
    </div>
  );
}
