import buttonStyles from "./PublicButton.module.css";
import CreatorInterestForm from "./CreatorInterestForm";
import styles from "./CreatorSection.module.css";

const supportPoints = [
  {
    title: "Find the real value in your experience",
    body: "We help you uncover the decisions, obstacles and lessons that made the difference.",
  },
  {
    title: "Build a path people can follow",
    body: "We help you organise your journey into simple stages and practical steps.",
  },
  {
    title: "Share it in your own voice",
    body: "You remain the creator. Switchplay provides the structure and support without making your story feel generic.",
  },
];

export default function CreatorSection() {
  return (
    <section className={styles.creatorSection} aria-labelledby="creator-recruitment-title">
      <div className={styles.recruitment}>
        <header className={styles.recruitmentHeader}>
          <p className={styles.eyebrow}>Become an early creator</p>
          <h2 className={styles.recruitmentTitle} id="creator-recruitment-title">
            We’ll help you become a great creator.
          </h2>
        </header>
        <div className={styles.recruitmentCopy}>
          <p>
            You do not need to be an expert, an influencer or an experienced teacher. If you have achieved something
            meaningful, the way you did it could help someone else.
          </p>
          <p>Switchplay helps you turn that experience into a clear path people can follow.</p>
          <button className={`${buttonStyles.button} ${buttonStyles.primary}`} type="button">
            Create a path with us
          </button>
        </div>
      </div>

      <section className={styles.support} aria-labelledby="creator-support-title">
        <header className={styles.supportHeader}>
          <h2 className={styles.supportTitle} id="creator-support-title">
            You won’t have to work it all out alone.
          </h2>
          <p>
            We guide you through the process, ask the right questions and help you shape your experience into something
            clear, useful and personal.
          </p>
        </header>
        <div className={styles.supportGrid}>
          {supportPoints.map((point) => (
            <article className={styles.supportPoint} key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </article>
          ))}
        </div>
      </section>

      <blockquote className={styles.testimonial}>
        <p>“This is making me think things I didn’t know were possible.”</p>
        <cite>Joe, early Switchplay creator</cite>
      </blockquote>

      <CreatorInterestForm />
    </section>
  );
}
