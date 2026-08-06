import type { Metadata } from "next";
import Image from "next/image";
import PublicLayout from "@/components/public-site/PublicLayout";
import PublicHeader from "@/components/public-site/PublicHeader";
import CreatorSection from "@/components/public-site/CreatorSection";
import HowItWorksSection, { FollowerInterestSection } from "@/components/public-site/HowItWorksSection";
import buttonStyles from "@/components/public-site/PublicButton.module.css";
import styles from "./HomePage.module.css";

const homeTitle = "Switchplay — Learn from people like you";
const homeDescription =
  "Follow real paths created by people who have been where you are and have achieved what you want to achieve.";

export const metadata: Metadata = {
  title: {
    absolute: homeTitle,
  },
  description: homeDescription,
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    siteName: "Switchplay",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: homeTitle,
    description: homeDescription,
  },
};

export default function Home() {
  return (
    <PublicLayout>
      <PublicHeader />
      <section className={styles.hero} aria-labelledby="home-hero-title">
        <div className={styles.heroCopy}>
          <h1 className={styles.title} id="home-hero-title">
            Learn from people like you.
          </h1>
          <p className={styles.supportingText}>
            Follow real paths from people who have been where you are and have achieved what you want to achieve.
          </p>
          <div className={styles.actions}>
            <a className={`${buttonStyles.button} ${buttonStyles.primary}`} href="#early-access">
              Join early access
            </a>
            <a className={`${buttonStyles.button} ${buttonStyles.secondary}`} href="#creator-interest">
              Become a creator
            </a>
          </div>
        </div>
        <figure className={styles.artworkPanel}>
          <Image
            alt="Two people in training clothes talking after a gym session"
            className={styles.artworkImage}
            height={1402}
            priority
            sizes="(min-width: 840px) 38vw, calc(100vw - 32px)"
            src="/images/hero/hero-illustration4.png"
            width={1122}
          />
        </figure>
      </section>
      <HowItWorksSection />
      <CreatorSection />
      <FollowerInterestSection />
    </PublicLayout>
  );
}
