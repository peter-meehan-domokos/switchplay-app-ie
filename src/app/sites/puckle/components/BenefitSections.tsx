import { Caveat } from "next/font/google";
import Image from "next/image";
import buttonStyles from "./PublicButton.module.css";
import ExploreVideo from "./ExploreVideo";
import styles from "./BenefitSections.module.css";

const handwriting = Caveat({ subsets: ["latin"], display: "swap" });

const progressIdeas = [
  { title: "Keep what helps.", body: "Add private notes, videos and photos to your cards." },
  { title: "Learn from others.", body: "Discover explanations and ideas shared by other students." },
] as const;

// Trial: swap the Test yourself worksheet for the Kane / Mbappe image. Set to false to bring back the original HTML worksheet.
const USE_TRIAL_WORKSHEET_IMAGE = true;
const trialWorksheetLabel =
  "Illustration: handwritten working comparing the goals scored by Harry Kane and Kylian Mbappé over five seasons, with the averages worked out, a teacher tick for the averages and a note asking about consistency, beside a thumbnail of a personal video feedback clip";

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
          <p className={styles.stepLabel}>1. Learn</p>
          <h3 className={styles.beatTitle}>Explanations that actually explain.</h3>
          <p className={styles.body}>
            Watch our videos when you need them. See why the maths works — not just which steps to copy.
          </p>
        </div>
        <figure className={styles.media}>
          <Image
            alt="Example Puckle Card step: a tutor video preview beside a graph asking why the curve turns"
            className={styles.mediaImage}
            height={1039}
            sizes="(min-width: 900px) 560px, calc(100vw - 32px)"
            src="/images/sites/puckle/puckle-video-explanation-v3.png"
            width={1514}
          />
        </figure>
      </div>

      <div className={`${styles.beat} ${styles.beatReverse}`}>
        <div className={styles.beatCopy}>
          <p className={styles.stepLabel}>2. Explore</p>
          <h3 className={styles.beatTitle}>Interactive visuals you can play with.</h3>
          <p className={styles.body}>
            Change graphs, move points and experiment with mathematical ideas for yourself.
          </p>
        </div>
        <figure className={`${styles.media} ${styles.mediaFeature} ${styles.mediaVideo}`}>
          <ExploreVideo
            height={696}
            label="Unroll the cone: an animation showing a cone opening out into a sector, with its measurements and the sector area calculation underneath"
            poster="/images/sites/puckle/cone-poster-v2.jpg"
            src="/videos/sites/puckle/cone-unroll-v2.mp4"
            width={936}
          />
        </figure>
      </div>

      <div className={styles.beat}>
        <div className={styles.beatCopy}>
          <p className={styles.stepLabel}>3. Test yourself</p>
          <h3 className={styles.beatTitle}>Comments on your work. Video feedback just for you.</h3>
          <p className={styles.body}>
            Upload a photo of your work and find out what to improve and what to try next.
          </p>
        </div>
        <figure className={styles.media}>
          <Image
            alt={trialWorksheetLabel}
            className={styles.mediaImage}
            height={1086}
            sizes="(min-width: 900px) 480px, calc(100vw - 32px)"
            src="/images/sites/puckle/test-yourself-v3.png"
            width={1448}
          />
        </figure>
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
          src="/images/sites/puckle/puckle-tutor-photo-v2.jpg"
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
          height={1058}
          sizes="(min-width: 900px) 540px, calc(100vw - 32px)"
          src="/images/sites/puckle/puckle-collaboration-v2.png"
          width={1487}
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

// Previous Test yourself illustration, assembled in code (worksheet, video thumbnail, play icon and label inside a panel). Not rendered
// now that test-yourself-v3.png shows all of it as one image; kept, with its styles and the flag above, in case it is wanted again.
export function AssembledTestYourselfIllustration() {
  return (
    <div
      className={styles.feedback}
      role="img"
      aria-label={
        USE_TRIAL_WORKSHEET_IMAGE
          ? trialWorksheetLabel
          : "Illustration: handwritten working for solving x squared minus 5x plus 6 equals 0, with a teacher comment praising the factorising and a note to check the signs in the final line, beside a thumbnail of a personal video feedback clip"
      }
    >
      {USE_TRIAL_WORKSHEET_IMAGE ? (
        <Image
          alt=""
          aria-hidden="true"
          className={styles.worksheetImage}
          height={678}
          sizes="(min-width: 390px) 309px, calc(100vw - 80px)"
          src="/images/sites/puckle/test-yourself-worksheet.png"
          width={1172}
        />
      ) : (
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
      )}
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
  );
}
