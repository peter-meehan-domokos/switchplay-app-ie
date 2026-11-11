import Image from "next/image";
import buttonStyles from "./PublicButton.module.css";
import styles from "./BenefitSections.module.css";

const cardSteps = ["Learn", "Explore", "Test yourself"] as const;

const progressIdeas = [
  {
    title: "Make it yours",
    body: "Reorganise or adapt Cards around your needs; add notes, photos and videos.",
  },
  {
    title: "Learn from others",
    body: "In a learning group, see another student’s helpful Info Card: a note, photo of working or short video.",
  },
  {
    title: "See your progress",
    body: "Keep an eye on progress towards the exam topics you are working on.",
  },
] as const;

const tuitionOptions = ["One-to-one", "Small groups", "Flexible focused sessions"] as const;

export default function BenefitSections() {
  return (
    <div className={styles.sections}>
      <LearningSection />
      <TuitionSection />
      <ProgressSection />
    </div>
  );
}

function LearningSection() {
  return (
    <section className={`${styles.section} ${styles.primary}`} aria-labelledby="learning-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>THE PUCKLE EXPERIENCE</p>
        <h2 className={styles.primaryTitle} id="learning-title">
          Learning beyond the lesson.
        </h2>
        <p className={styles.lead}>
          Clear explanations, maths you can explore for yourself, and feedback that helps you improve your exam work.
        </p>
        <ol className={styles.stepStrip} aria-label="How each Card works">
          {cardSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </header>

      <div className={styles.beat}>
        <div className={styles.beatCopy}>
          <p className={styles.stepLabel}>Learn</p>
          <h3 className={styles.beatTitle}>Explanations that actually explain.</h3>
          <p className={styles.body}>
            Short, focused videos show you why the maths works — not just which steps to copy.
          </p>
        </div>
        <figure className={styles.media}>
          <Image
            alt="Example Puckle Card step: a tutor video preview beside a graph asking why the curve turns"
            className={styles.mediaImage}
            height={1000}
            sizes="(min-width: 900px) 560px, calc(100vw - 32px)"
            src="/images/sites/puckle/puckle-video-explanation.png"
            width={1440}
          />
        </figure>
      </div>

      <div className={`${styles.beat} ${styles.beatReverse}`}>
        <div className={styles.beatCopy}>
          <p className={styles.stepLabel}>Explore</p>
          <h3 className={styles.beatTitle}>See what changes. Understand why.</h3>
          <p className={styles.body}>
            Move points, change graphs and investigate the ideas behind the questions you’ll meet in your exams.
          </p>
        </div>
        <figure className={`${styles.media} ${styles.mediaFeature}`}>
          <Image
            alt="Functions and Graphs preview: a parabola with its vertex at (1, −1) and the prompt to drag the point to explore how the graph changes"
            className={styles.mediaImage}
            height={1000}
            sizes="(min-width: 900px) 620px, calc(100vw - 32px)"
            src="/images/sites/puckle/puckle-functions-graphs.png"
            width={1440}
          />
        </figure>
      </div>

      <div className={styles.beat}>
        <div className={styles.beatCopy}>
          <p className={styles.stepLabel}>Test yourself</p>
          <h3 className={styles.beatTitle}>Show your working. Get feedback.</h3>
          <p className={styles.body}>
            Upload a photo of your exam answer and get targeted feedback on what to improve between lessons.
          </p>
        </div>
        <div
          className={styles.feedback}
          role="img"
          aria-label="Illustration: a photo of an exam answer, and the teacher feedback “Good method. Check the final sign.”"
        >
          <span className={styles.paper} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <svg className={styles.arrow} aria-hidden="true" focusable="false" height="20" viewBox="0 0 24 20" width="24">
            <path d="M2 10h19M14 3l7 7-7 7" />
          </svg>
          <span className={styles.feedbackCard} aria-hidden="true">
            <span className={styles.feedbackLabel}>Teacher feedback</span>
            <span className={styles.feedbackText}>Good method. Check the final sign.</span>
          </span>
        </div>
      </div>

      <p className={styles.bridge}>Your lessons, practice and feedback stay connected — so you keep moving forward.</p>
    </section>
  );
}

function TuitionSection() {
  return (
    <section className={`${styles.section} ${styles.secondary} ${styles.tuition}`} aria-labelledby="tuition-title">
      <figure className={styles.portrait}>
        <Image
          alt="Your Puckle maths teacher"
          className={styles.portraitImage}
          height={1280}
          sizes="(min-width: 900px) 280px, 230px"
          src="/images/sites/puckle/puckle-tutor-photo.jpg"
          width={960}
        />
      </figure>
      <div className={styles.tuitionCopy}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>PERSONAL SUPPORT</p>
          <h2 className={styles.secondaryTitle} id="tuition-title">
            Expert tuition, your way.
          </h2>
        </header>
        <p className={styles.body}>
          Learn with an experienced maths teacher who makes tricky ideas clear, engaging and relevant — with examples
          from sport, business and everyday life.
        </p>
        <ul className={styles.options} aria-label="Ways to learn">
          {tuitionOptions.map((option) => (
            <li key={option}>{option}</li>
          ))}
        </ul>
        <p className={styles.body}>
          We focus on the topics you need most for your exams, with learning materials developed around your questions.
        </p>
      </div>
    </section>
  );
}

function ProgressSection() {
  return (
    <section className={`${styles.section} ${styles.secondary} ${styles.progress}`} aria-labelledby="progress-title">
      <div className={styles.progressCopy}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>YOUR LEARNING</p>
          <h2 className={styles.secondaryTitle} id="progress-title">
            Built around your progress.
          </h2>
        </header>
        <p className={styles.body}>
          Work on the maths that matters to you. Keep your own notes, photos and videos with the Cards, pick up ideas
          from other students, and see how far you’ve come.
        </p>
        <ul className={styles.ideas}>
          {progressIdeas.map((idea) => (
            <li key={idea.title}>
              <strong>{idea.title}</strong> — {idea.body}
            </li>
          ))}
        </ul>
      </div>
      <figure className={`${styles.media} ${styles.progressMedia}`}>
        <Image
          alt="Two example Info Cards on quadratics: a handwritten note on completing the square, and a short video explanation"
          className={styles.mediaImage}
          height={1000}
          sizes="(min-width: 900px) 540px, calc(100vw - 32px)"
          src="/images/sites/puckle/puckle-collaboration.png"
          width={1440}
        />
      </figure>
      <div className={styles.cta}>
        <a className={`${buttonStyles.button} ${buttonStyles.primary}`} href="#early-access">
          Get tuition
        </a>
      </div>
    </section>
  );
}
