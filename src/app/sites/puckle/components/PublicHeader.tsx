import Link from "next/link";
import BrandLink from "./BrandLink";
import HeaderMenu from "./HeaderMenu";
import buttonStyles from "./PublicButton.module.css";
import { getCurrentUser } from "@/lib/auth";
import styles from "./PublicHeader.module.css";

type PublicHeaderProps = {
  showJoinLink?: boolean;
  showLoginLink?: boolean;
};

export default async function PublicHeader({ showJoinLink = true, showLoginLink = true }: PublicHeaderProps) {
  const user = await getCurrentUser();
  const authLink = user ? { href: "/decks", label: "Open App" } : { href: "/login", label: "Log in" };
  const menuLinks = [
    { href: "/contact", label: "Contact" },
    { href: "/step-visuals", label: "Step Visuals" },
    ...(showLoginLink ? [authLink] : []),
  ];

  return (
    <header className={styles.header}>
      <BrandLink />
      <div className={styles.actions}>
        {showJoinLink && !user ? (
          <Link className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.joinButton}`} href="/#early-access">
            Join
          </Link>
        ) : null}
        <HeaderMenu links={menuLinks} />
      </div>
    </header>
  );
}
