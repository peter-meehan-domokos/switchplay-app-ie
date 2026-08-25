import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import styles from "./SwitchplayBrandLink.module.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--sp-brand-font-family",
});

type SwitchplayBrandLinkProps = {
  className?: string;
};

export default function SwitchplayBrandLink({ className }: SwitchplayBrandLinkProps) {
  const linkClassName = className
    ? `${spaceGrotesk.variable} ${styles.brandLink} ${className}`
    : `${spaceGrotesk.variable} ${styles.brandLink}`;

  return (
    <Link className={linkClassName} href="/" aria-label="STRAT17 home">
      STRAT<span className={styles.brandNumber}>17</span>
    </Link>
  );
}
