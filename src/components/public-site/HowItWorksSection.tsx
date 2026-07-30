import EarlyAccessForm from "./EarlyAccessForm";
import styles from "./HowItWorksSection.module.css";

const steps = [
  {
    eyebrow: "Step 1",
    title: "Follow a path",
    body: "Choose a journey that matches something you want to achieve.",
  },
  {
    eyebrow: "Step 2",
    title: "Complete the steps",
    body: "Do the steps outlined in the path to make progress towards your goal.",
  },
  {
    eyebrow: "Step 3",
    title: "Learn from real experience",
    body: "See how the path creator approached the challenges, decisions and setbacks along the way.",
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
  return <EarlyAccessForm />;
}
