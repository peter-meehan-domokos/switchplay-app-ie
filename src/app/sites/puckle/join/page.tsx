import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isPrelaunchMode } from "@/lib/prelaunch";
import MembershipJoinForm from "../components/MembershipJoinForm";
import styles from "../components/MembershipJoinForm.module.css";
import buttonStyles from "../components/PublicButton.module.css";
import PublicHeader from "../components/PublicHeader";
import PublicLayout from "../components/PublicLayout";
import { isJoinOpen } from "../lib/joinAvailability";
import { SITE_NAME } from "../siteInfo";

export const metadata: Metadata = {
  title: "Join",
  description: `Join ${SITE_NAME}, or register your interest.`,
};

export default async function JoinPage() {
  // Closed on production until explicitly opened; an absent route reveals nothing.
  if (!isJoinOpen()) notFound();
  const user = await getCurrentUser();
  return (
    <PublicLayout>
      <PublicHeader showJoinLink={false} />
      {user ? (
        <section aria-labelledby="join-signed-in-title" className={styles.page}>
          <h1 id="join-signed-in-title">You&apos;re already signed in.</h1>
          <p className={styles.intro}>Your {SITE_NAME} account is ready to use.</p>
          <Link className={`${buttonStyles.button} ${buttonStyles.primary}`} href="/decks">Open {SITE_NAME}</Link>
        </section>
      ) : (
        <MembershipJoinForm prelaunch={isPrelaunchMode()} />
      )}
    </PublicLayout>
  );
}
