import type { Metadata } from "next";
import Image from "next/image";
import { brandFontClassName } from "./components/BrandLink";
import PublicLayout from "./components/PublicLayout";
import PublicHeader from "./components/PublicHeader";
import HomeFooter from "./components/HomeFooter";
import buttonStyles from "./components/PublicButton.module.css";
import BenefitSections from "./components/BenefitSections";
import BeyondTheMathsSection from "./components/BeyondTheMathsSection";
import TuitionEnquiryForm from "./components/TuitionEnquiryForm";
import { SHARE_IMAGE, SITE_NAME } from "./siteInfo";
import styles from "./HomePage.module.css";

// ======================================================================================================================================
// PUCKLE HOMEPAGE METADATA (what puckleup.com shows in Google results, browser tabs and link previews such as WhatsApp / Facebook / X).
//
// THIS IS THE FILE THAT WINS FOR THE HOMEPAGE ("/"). A page's own `metadata` overrides the layout files above it, so changing the
// title or description in src/app/sites/puckle/layout.tsx or src/app/layout.tsx will NOT change the homepage. Edit it here.
//
// There are three separate places that set metadata, from lowest to highest priority:
//   1. src/app/layout.tsx               - root fallback for the whole app. Puckle never uses it for "/" (overridden twice below).
//   2. src/app/sites/puckle/layout.tsx  - Puckle default, used by Puckle pages that set no title/description of their own.
//   3. THIS FILE                        - Puckle homepage only. Overrides 1 and 2 for "/".
// If you change the wording here, also update (2) so the other Puckle pages stay consistent with it.
//
// Note: `title.absolute` below deliberately ignores the "%s | Puckle" template in layout.tsx, so the homepage tab shows exactly this text.
// Open Graph (og:) and Twitter values are NOT inherited from the title/description above; they are set separately in this file, so
// keep all three blocks (main, openGraph, twitter) in step.
// ======================================================================================================================================
const homeTitle = "Puckle — Unpickle your maths.";
const homeDescription =
  "Your maths progress, your way. Puckle's student-centred platform combines expert online tuition, video explanations, hands-on visuals and examples from real-life activities such as sport and business.";

export const metadata: Metadata = {
  title: {
    absolute: homeTitle, // Browser tab, Google result title. `absolute` = ignore the layout's "%s | Puckle" template.
  },
  description: homeDescription, // Google result snippet.
  openGraph: {
    // Link previews (WhatsApp, Facebook, LinkedIn, iMessage...).
    title: homeTitle,
    description: homeDescription,
    images: [SHARE_IMAGE], // The picture in the link preview (defined once in ./siteInfo.ts). Set separately from `twitter.images` below.
    siteName: SITE_NAME, // From ./siteInfo.ts. NOT SITE_TITLE_NAME (that is the all-caps "PUCKLE" used in the on-page brand link).
    type: "website",
  },
  twitter: {
    // Link previews on X / Twitter.
    card: "summary_large_image", // Wide picture above the text. ("summary" would show a small square thumbnail instead.)
    title: homeTitle,
    description: homeDescription,
    images: [SHARE_IMAGE.url], // Same picture, from ./siteInfo.ts.
  },
};

export default function Home() {
  return (
    <PublicLayout footer={<HomeFooter />} fullBleedFooter>
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
          <div className={styles.heroCta}>
            <a className={`${buttonStyles.button} ${buttonStyles.primary}`} href="#early-access">
              Request a free session
            </a>
          </div>
        </div>
        <div className={styles.artwork}>
          <figure className={styles.artworkPanel}>
            <Image
              alt="Three Puckle Cards showing a maths lesson on integration, with a video, an interactive graph, and Learn, Explore and Test yourself steps"
              className={styles.artworkImage}
              height={985}
              priority
              sizes="(min-width: 840px) 540px, min(380px, calc(100vw - 32px))"
              src="/images/sites/puckle/hero-cropped-v2.png"
              width={1199}
            />
          </figure>
          <div className={styles.bridge}>
            <p className={`${brandFontClassName} ${styles.bridgeTitle}`}>
              Card by Card. Step by step.
            </p>
            <p className={styles.bridgeText}>
              Every card has three steps. Complete your <br className={styles.bridgeBreak} />
              cards to build exam skills and see your progress.
            </p>
            <div className={styles.bridgeCta}>
              <a className={`${buttonStyles.button} ${buttonStyles.primary}`} href="#early-access">
                Request a free session
              </a>
              <p className={styles.bridgeCtaNote}>Free 20–30 minute online maths session.</p>
            </div>
          </div>
        </div>
      </section>
      <div className={brandFontClassName}>
        <BenefitSections />
        <TuitionEnquiryForm />
        <BeyondTheMathsSection />
      </div>
    </PublicLayout>
  );
}
