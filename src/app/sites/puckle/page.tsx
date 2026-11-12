import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { brandFontClassName } from "./components/BrandLink";
import PublicLayout from "./components/PublicLayout";
import PublicHeader from "./components/PublicHeader";
import PublicFooter from "./components/PublicFooter";
import BenefitSections from "./components/BenefitSections";
import TuitionEnquiryForm from "./components/TuitionEnquiryForm";
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
    <PublicLayout
      footer={
        <>
          <p className={styles.footerInvite}>
            Interested in contributing to Puckle? <Link href="/contact">Get in touch.</Link>
          </p>
          <PublicFooter />
        </>
      }
    >
      <PublicHeader />
      <section className={styles.hero} aria-labelledby="home-hero-title">
        <div className={styles.heroCopy}>
          <h1 className={`${brandFontClassName} ${styles.title}`} id="home-hero-title">
            Unpickle your maths.
          </h1>
          <p className={styles.supportingText}>
            Expert tuition, hands-on visuals that make maths click, and support beyond lessons.
          </p>
          <p className={styles.curriculumLine}>
            Leaving Cert &amp; Junior Cycle · GCSE &amp; A-level
          </p>
        </div>
        <div className={styles.artwork}>
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
          <div className={styles.bridge}>
            <p className={`${brandFontClassName} ${styles.bridgeTitle}`}>
              Card by Card. Step by step.
            </p>
            <p className={styles.bridgeText}>
              Every Card has three steps. Complete your Cards, see your progress build, and keep
              moving.
            </p>
          </div>
        </div>
      </section>
      <div className={brandFontClassName}>
        <BenefitSections />
        <TuitionEnquiryForm />
      </div>
    </PublicLayout>
  );
}
