import Link from "next/link";
import SwitchplayBrandLink from "@/components/brand/SwitchplayBrandLink";
import { getCurrentUser } from "@/lib/auth";
import type { SiteId } from "@/lib/sites/siteResolver";
import styles from "./PublicHeader.module.css";

type PublicHeaderProps = {
  showJoinLink?: boolean;
  showLoginLink?: boolean;
  showStepVisualsLink?: boolean;
  site?: SiteId;
};

export default async function PublicHeader({
  showJoinLink = true,
  showLoginLink = true,
  showStepVisualsLink = true,
  site,
}: PublicHeaderProps) {
  const user = await getCurrentUser();
  const authLink = user ? { href: "/decks", label: "Open App" } : { href: "/login", label: "Log in" };

  return (
    <header className={styles.header}>
      <SwitchplayBrandLink site={site} />
      <nav className={styles.nav} aria-label="Public navigation">
        {showJoinLink && !user ? (
          <Link className={styles.navLink} href="/#early-access">
            Join
          </Link>
        ) : null}
        <Link className={styles.navLink} href="/contact">
          Contact
        </Link>
        {showStepVisualsLink ? (
          <Link className={styles.navLink} href="/step-visuals">
            Step Visuals
          </Link>
        ) : null}
        {showLoginLink ? (
          <Link className={styles.navLink} href={authLink.href}>
            {authLink.label}
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
