import Image from "next/image";
import PublicLayout from "@/components/public-site/PublicLayout";
import PublicHeader from "@/components/public-site/PublicHeader";
import buttonStyles from "@/components/public-site/PublicButton.module.css";
import styles from "./HomePage.module.css";

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
            Discover real journeys shared by ordinary people who have already achieved something meaningful. Follow
            their path, learn what worked, and create your own when you&apos;re ready.
          </p>
          <div className={styles.actions}>
            <button className={`${buttonStyles.button} ${buttonStyles.primary}`} type="button">
              Be one of our first creators
            </button>
            <button className={`${buttonStyles.button} ${buttonStyles.secondary}`} type="button">
              Learn more
            </button>
          </div>
        </div>
        <figure className={styles.artworkPanel}>
          <Image
            alt="Two people in training clothes talking after a gym session"
            className={styles.artworkImage}
            height={1402}
            priority
            sizes="(min-width: 840px) 38vw, calc(100vw - 32px)"
            src="/images/hero/hero-illustration.png"
            width={1122}
          />
        </figure>
      </section>
    </PublicLayout>
  );
}
