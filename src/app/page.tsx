import type { Metadata } from "next";
import Image from "next/image";
import PublicLayout from "@/components/public-site/PublicLayout";
import PublicHeader from "@/components/public-site/PublicHeader";
import CreatorSection from "@/components/public-site/CreatorSection";
import HowItWorksSection, { FollowerInterestSection } from "@/components/public-site/HowItWorksSection";
import buttonStyles from "@/components/public-site/PublicButton.module.css";
import styles from "./HomePage.module.css";

const homeTitle = "STRAT17 — People like you. Showing you how.";
const homeDescription =
  "A clear path, not just another video. Follow the steps of someone who's done it.";

export const metadata: Metadata = {
  title: {
    absolute: homeTitle,
  },
  description: homeDescription,
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    siteName: "STRAT17",
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
          <h1 className={styles.title} id="home-hero-title" aria-label="The unofficial way to get there.">
            <span className={styles.titleLine}>
              The <span className={styles.unofficialMark}>unofficial</span> way
            </span>
            <span className={styles.titleLine}>to get there</span>
          </h1>
          <p
            className={styles.supportingText}
            aria-label="A clear path, not just another video. Follow the steps of someone who's done it."
          >
            <span>Follow the steps of someone who&apos;s done it.</span>
          </p>
          <div className={styles.actions}>
            <a className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.primaryAction}`} href="#early-access">
              Join early access
            </a>
            <a className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.secondaryAction}`} href="#creator-interest">
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
            src="/images/hero/hero-illustration8.png"
            width={1122}
          />
        </figure>
      </section>
      <HowItWorksSection />
      <figure className={styles.creatorArtworkPanel}>
        <Image
          alt="People collaborating around a Switchplay path"
          className={styles.creatorArtworkImage}
          height={1086}
          sizes="(min-width: 840px) 70vw, calc(100vw - 32px)"
          src="/images/other/second-illustration.png"
          width={1448}
        />
      </figure>
      <CreatorSection />
      <FollowerInterestSection />
    </PublicLayout>
  );
}
