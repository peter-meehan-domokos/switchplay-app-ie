import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import styles from "./SwitchplayBrandLink.module.css";
import { siteBrands } from "@/lib/sites/siteBrands";
import type { SiteId } from "@/lib/sites/siteResolver";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--sp-brand-font-family",
});

type SwitchplayBrandLinkProps = {
  className?: string;
  site?: SiteId;
};

export default function SwitchplayBrandLink({ className, site = "switchplay" }: SwitchplayBrandLinkProps) {
  const brand = siteBrands[site];
  const linkClassName = className
    ? `${spaceGrotesk.variable} ${styles.brandLink} ${className}`
    : `${spaceGrotesk.variable} ${styles.brandLink}`;

  return (
    
    <Link className={linkClassName} href="/" aria-label={`${brand.titleName} home`}>
      {brand.brandLead}
      {brand.brandTail ? <span className={styles.brandNumber}>{brand.brandTail}</span> : null}
    </Link>
  );
}

/*
<Link className={linkClassName} href="/" aria-label="SWITCHPLAY home">
      STRAT<span className={styles.brandNumber}>17</span>
    </Link>
*/
