import Link from "next/link";
import styles from "./SwitchplayBrandLink.module.css";

type SwitchplayBrandLinkProps = {
  className?: string;
};

export default function SwitchplayBrandLink({ className }: SwitchplayBrandLinkProps) {
  const linkClassName = className ? `${styles.brandLink} ${className}` : styles.brandLink;

  return (
    <Link className={linkClassName} href="/" aria-label="Switchplay home">
      Switchplay
    </Link>
  );
}
