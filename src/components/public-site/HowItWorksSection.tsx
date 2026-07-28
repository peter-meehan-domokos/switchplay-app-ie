import buttonStyles from "./PublicButton.module.css";
import styles from "./HowItWorksSection.module.css";

const steps = [
  {
    eyebrow: "Step 1",
    title: "Follow a path",
    body: "Choose a journey that matches something you want to achieve.",
  },
  {
    eyebrow: "Step 2",
    title: "Learn from real experience",
    body: "See how someone else approached the challenges, decisions and setbacks along the way.",
  },
  {
    eyebrow: "Step 3",
    title: "Create your own",
    body: "As your experience grows, you can build a path that helps the next person.",
  },
];

export default function HowItWorksSection() {
  return (
    <section className={styles.section} aria-labelledby="how-it-works-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>How it works</p>
        <h2 id="how-it-works-title">Small steps. Real experience. Meaningful progress.</h2>
        <div className={styles.intro}>
          <p>Switchplay helps you learn from people who have already achieved something meaningful.</p>
          <p>
            Instead of trying to work everything out alone, you can follow a clear path built from someone else&apos;s
            real experience.
          </p>
          <p>
            Each path breaks a journey into simple stages, practical steps and moments to reflect before moving forward.
          </p>
        </div>
      </header>

      <div className={styles.steps} aria-label="How Switchplay works">
        {steps.map((step) => (
          <article className={styles.stepCard} key={step.title}>
            <p className={styles.stepEyebrow}>{step.eyebrow}</p>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FollowerInterestSection() {
  return (
    <section className={styles.followerSection} id="early-access" aria-labelledby="follower-interest-title">
      <div className={styles.followerCopy}>
        <h2 id="follower-interest-title">Interested in following paths?</h2>
        <p>Join our early access list and we&apos;ll let you know when Switchplay is ready to explore.</p>
      </div>
      <button className={`${buttonStyles.button} ${buttonStyles.primary}`} type="button">
        Join early access
      </button>
    </section>
  );
}
