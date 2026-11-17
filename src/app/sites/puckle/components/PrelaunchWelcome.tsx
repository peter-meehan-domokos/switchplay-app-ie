import Link from "next/link";
import type { PrelaunchLayout } from "../lib/prelaunchLayout";
import PrelaunchGuardian from "./PrelaunchGuardian";
import PrelaunchSignOut from "./PrelaunchSignOut";
import styles from "./Prelaunch.module.css";

/** Decorative stand-in for My Decks: shapes only, no names, links or data, hidden from assistive technology and not interactive. */
function Backdrop() {
  return (
    <div aria-hidden="true" className={styles.backdrop} data-prelaunch="backdrop" inert>
      <div className={styles.backdropBar} />
      <div className={styles.backdropGrid}>
        {Array.from({ length: 8 }, (_, index) => <div className={styles.backdropTile} key={index}><span /><span /></div>)}
      </div>
    </div>
  );
}

/** Renders the read-only pre-launch layout. All wording and conditions come from buildPrelaunchLayout. */
export default function PrelaunchWelcome({ layout, actorId, username }: Readonly<{ layout: PrelaunchLayout; actorId: string; username: string }>) {
  const action = layout.followUp.action;
  return (
    <div className={styles.page} data-audience={layout.audience} data-testid="prelaunch-welcome">
      <Backdrop />
      <main className={styles.stage}>
        <section aria-labelledby="prelaunch-title" className={styles.card}>
          <p className={styles.kicker}>{layout.kicker}</p>
          <h1 className={styles.title} id="prelaunch-title">{layout.heading}</h1>
          <p className={styles.lead}>{layout.lead}</p>
          <p className={styles.body}>{layout.body}</p>
          <div className={styles.followUp}>
            <h2 className={styles.followTitle}>{layout.followUp.heading}</h2>
            <p className={styles.body}>{layout.followUp.text}</p>
            {action.kind === "enquire"
              ? <Link className={styles.action} href={action.href}>{action.label}</Link>
              : <a className={styles.email} href={action.href}>{action.address}</a>}
          </div>
          {layout.parentApproval ? <PrelaunchGuardian actorId={actorId} {...layout.parentApproval} /> : null}
        </section>
        <PrelaunchSignOut username={username} />
      </main>
    </div>
  );
}
