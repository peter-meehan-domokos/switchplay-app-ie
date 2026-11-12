import { Caveat } from "next/font/google";
import Image from "next/image";
import buttonStyles from "./PublicButton.module.css";
import styles from "./BenefitSections.module.css";

const handwriting = Caveat({ subsets: ["latin"], display: "swap" });

const progressIdeas = [
  { title: "Keep what helps.", body: "Add private notes, videos and photos to your cards." },
  { title: "Learn from others.", body: "Discover explanations and ideas shared by other students." },
] as const;

const tuitionOptions = ["One-to-one", "Small groups", "Quick topic check-ins"] as const;

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
      </header>

      <div className={styles.beat}>
        <div className={styles.beatCopy}>
          <p className={styles.stepLabel}>Learn</p>
          <h3 className={styles.beatTitle}>Explanations that actually explain.</h3>
          <p className={styles.body}>
            Watch our videos when you need them. See why the maths works — not just which steps to copy.
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
          <h3 className={styles.beatTitle}>Interactive visuals you can play with.</h3>
          <p className={styles.body}>
            Change graphs, move points and experiment with mathematical ideas for yourself.
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
          <h3 className={styles.beatTitle}>Comments on your work. Video feedback just for you.</h3>
          <p className={styles.body}>
            Upload a photo of your work and find out what to improve and what to try next.
          </p>
        </div>
        <div
          className={styles.feedback}
          role="img"
          aria-label="Illustration: handwritten working for solving x squared minus 5x plus 6 equals 0, with a teacher comment praising the factorising and a note to check the signs in the final line, beside a thumbnail of a personal video feedback clip"
        >
          <div className={`${handwriting.className} ${styles.paper}`} aria-hidden="true">
            <p className={styles.workingTitle}>Solve x² - 5x + 6 = 0</p>
            <div className={styles.workingRow}>
              <span className={styles.working}>x² - 5x + 6 = 0</span>
            </div>
            <div className={styles.workingRow}>
              <span className={styles.working}>(x - 2)(x - 3) = 0</span>
              <span className={`${styles.comment} ${styles.commentGood}`}>✓ Good factorising</span>
            </div>
            <div className={styles.workingRow}>
              <span className={styles.working}>
                x = <span className={styles.flagged}>-2 or x = -3</span>
              </span>
              <span className={styles.comment}>Check the signs</span>
            </div>
          </div>
          <div className={styles.videoFeedback} aria-hidden="true">
            <span className={styles.thumbnail}>
              <Image alt="" height={1280} sizes="112px" src="/images/sites/puckle/puckle-tutor-photo.jpg" width={960} />
              <span className={styles.play}>
                <svg focusable="false" height="12" viewBox="0 0 12 12" width="12">
                  <path d="M3 1.5v9l7.5-4.5z" />
                </svg>
              </span>
            </span>
            <span className={styles.videoLabel}>Personal video feedback</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function TuitionSection() {
  return (
    <section className={`${styles.section} ${styles.secondary} ${styles.tuition}`} aria-labelledby="tuition-title">
      <header className={`${styles.header} ${styles.tuitionHeader}`}>
        <p className={styles.eyebrow}>PERSONAL SUPPORT</p>
        <h2 className={styles.secondaryTitle} id="tuition-title">
          Expert tuition, your way.
        </h2>
      </header>
      <figure className={styles.portrait}>
        <Image
          alt="Your Puckle maths teacher"
          className={styles.portraitImage}
          height={1280}
          sizes="(min-width: 900px) 286px, 220px"
          src="/images/sites/puckle/puckle-tutor-photo.jpg"
          width={960}
        />
        <figcaption className={styles.credential}>
          <span>15+ years teaching secondary maths</span>
          <span>Thousands of students taught</span>
        </figcaption>
      </figure>
      <div className={styles.tuitionCopy}>
        <p className={styles.body}>
          Learn with an experienced maths teacher who makes tricky ideas clear and relevant — with examples
          from sport, business and everyday life.
        </p>
        <p className={styles.body}>
          <strong>Stuck on an exam question?</strong>
          <br />
          That’s where we start. Your questions shape what we teach and the
          learning cards we create next.
        </p>
        <ul className={styles.options} aria-label="Ways to learn">
          {tuitionOptions.map((option) => (
            <li key={option}>{option}</li>
          ))}
        </ul>
        <p className={styles.deliveryNote}>Online tuition, with in-person options in Galway.</p>
        <div className={styles.cta}>
          <a className={`${buttonStyles.button} ${buttonStyles.primary}`} href="#early-access">
            Request a free session
          </a>
        </div>
      </div>
    </section>
  );
}

function ProgressSection() {
  return (
    <section className={`${styles.section} ${styles.secondary} ${styles.progress}`} aria-labelledby="progress-title">
      <div className={styles.progressIntro}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>YOUR LEARNING</p>
          <h2 className={styles.secondaryTitle} id="progress-title">
            Make the learning yours.
          </h2>
        </header>
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
      <ul className={styles.ideas}>
        {progressIdeas.map((idea) => (
          <li key={idea.title}>
            <strong>{idea.title}</strong>
            <span>{idea.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
