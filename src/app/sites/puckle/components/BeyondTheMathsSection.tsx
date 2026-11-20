import Image from "next/image";
import Link from "next/link";
import buttonStyles from "./PublicButton.module.css";
import { buildBeyondTheMathsLayout, type ProjectPreviewLayout } from "./beyondTheMathsLayout";
import styles from "./BeyondTheMathsSection.module.css";

export default function BeyondTheMathsSection() {
  const layout = buildBeyondTheMathsLayout();

  return (
    <section className={styles.section} aria-labelledby={layout.headingId}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{layout.eyebrow}</p>
        <h2 className={styles.title} id={layout.headingId}>
          {layout.heading}
        </h2>
      </header>

      <ul className={styles.cards}>
        {layout.projects.map((project) => (
          <ProjectPreview key={project.id} project={project} />
        ))}
      </ul>

      <div className={styles.invitation}>
        <p className={styles.invitationPrompt}>{layout.invitation.prompt}</p>
        <Link className={`${buttonStyles.button} ${buttonStyles.primary}`} href={layout.invitation.href}>
          {layout.invitation.linkLabel}
        </Link>
      </div>
    </section>
  );
}

// Presentation only, with no link: both projects are announcements.
function ProjectPreview({ project }: { project: ProjectPreviewLayout }) {
  return (
    <li className={`${styles.card} ${styles[project.tone]}`}>
      <span className={styles.backdrop} aria-hidden="true" />
      <div className={styles.art}>
        <Image
          alt={project.art.alt}
          className={styles.artImage}
          height={project.art.height}
          sizes="(min-width: 1200px) 600px, 58vw"
          src={project.art.src}
          width={project.art.width}
        />
      </div>
      <h3 className={styles.cardTitle}>{project.title}</h3>
      <p className={styles.label}>{project.label}</p>
      {project.wideDescription ? (
        <>
          <p className={`${styles.description} ${styles.narrowOnly}`}>{project.description}</p>
          <p className={`${styles.description} ${styles.wideOnly}`}>{project.wideDescription}</p>
        </>
      ) : (
        <p className={styles.description}>{project.description}</p>
      )}
    </li>
  );
}
