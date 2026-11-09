import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { SITE_TITLE_NAME } from "../siteInfo";
import styles from "./BrandLink.module.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--sp-brand-font-family",
});

type BrandLinkProps = {
  className?: string;
};

export default function BrandLink({ className }: BrandLinkProps) {
  const linkClassName = className
    ? `${spaceGrotesk.variable} ${styles.brandLink} ${className}`
    : `${spaceGrotesk.variable} ${styles.brandLink}`;

  return (
    <Link className={linkClassName} href="/" aria-label={`${SITE_TITLE_NAME} home`}>
      STRAT<span className={styles.brandNumber}>17</span>
    </Link>
  );
}
