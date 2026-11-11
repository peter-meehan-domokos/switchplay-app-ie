import type { Metadata } from "next";
import Image from "next/image";
import { brandFontClassName } from "./components/BrandLink";
import PublicLayout from "./components/PublicLayout";
import PublicHeader from "./components/PublicHeader";
import CreatorSection from "./components/CreatorSection";
import BenefitSections from "./components/BenefitSections";
import { FollowerInterestSection } from "./components/HowItWorksSection";
import { SITE_TITLE_NAME } from "./siteInfo";
import styles from "./HomePage.module.css";

const homeTitle = `${SITE_TITLE_NAME} — The unofficial way to get there.`;
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
    siteName: SITE_TITLE_NAME,
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
          <h1 className={`${brandFontClassName} ${styles.title}`} id="home-hero-title">
            Unpickle your maths.
          </h1>
          <p className={styles.supportingText}>
            Expert tuition, hands-on visuals that make maths click, and support beyond lessons.
          </p>
        </div>
        <figure className={styles.artworkPanel}>
          <Image
            alt="Three Puckle Cards showing a maths lesson on integration, with a video, an interactive graph, and Learn, Explore and Test yourself steps"
            className={styles.artworkImage}
            height={985}
            priority
            sizes="(min-width: 840px) 540px, min(380px, calc(100vw - 32px))"
            src="/images/sites/puckle/hero-cropped.png"
            width={1199}
          />
        </figure>
      </section>
      <div className={brandFontClassName}>
        <BenefitSections />
      </div>
      <CreatorSection />
      <FollowerInterestSection />
    </PublicLayout>
  );
}
